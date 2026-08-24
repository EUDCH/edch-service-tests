# EDCH service tests

Black-box feature baselines for the **EDCH services**, runnable locally and in CI. Each
service has a readable spec of what it must do; the suite checks it over HTTP (fast, every
run) with a thin browser layer for the few genuinely interactive flows.

It is the versioned, CI-runnable counterpart to ad-hoc on-demand checks. It does **not** apply
updates or touch the sites — it verifies their public behaviour after a change (a hosting-provider
upgrade, a content/theme/org change, a config tweak).

## Layout

```
config/services.json     # the inventory: every service, tech, operator, env -> base URL
features/                # one .feature per service = its baseline (Gherkin, readable)
steps/                   # HTTP + TLS step definitions (shared); world.mjs resolves env -> URL
support/                 # inventory loader
browser/                 # Playwright specs for interactive flows ONLY (gated CI job)
.github/workflows/       # http-tests (every run) + browser-tests (gated)
```

## Run

```bash
bun install
bun run test                 # all features, prod (default)
EDCH_ENV=test bun run test   # same suite against the PCSS test instances
bun run test:smoke           # @smoke only (reachable + TLS + renders)
bun run test:registry        # just the Registry feature
bunx cucumber-js --tags '@feature'   # ad-hoc tag slice
```

Use `bun run test`, not `bun test` — `bun test` invokes Bun's own test runner (and would
grab the Playwright `.spec.ts`), whereas `bun run test` runs the cucumber script. `npm` works
too (`npm install && npm test`) — the scripts call `cucumber-js` directly.

### Environments

`EDCH_ENV` selects which base URL each service is hit at: `prod` (default, public URLs in
`config/services.json`), `test`, or `local`. Non-public `test`/`local` base URLs are **not**
committed — supply them per service via `EDCH_<NAME>_<ENV>_URL`:

```bash
EDCH_ENV=test EDCH_REGISTRY_TEST_URL=https://… EDCH_CAP_TEST_URL=https://… bun run test
```

In CI, set these as GitHub Actions repository variables. A service with no URL for the chosen
env falls back to its prod URL.

> **That fallback is why anything which writes must guard on the hostname.** `EDCH_ENV=test`
> with `EDCH_REGISTRY_TEST_URL` unset silently resolves to the live site, so the env *name* is
> not evidence of the target. Only the browser layer writes (the org-registration submission),
> and its `@writes` spec calls `assertNotProduction()` (`browser/support/guards.ts`) before the
> first keystroke: it compares the resolved hostname against the prod URLs in the inventory and
> throws. It fails loudly rather than skipping, so a misconfigured run cannot pass quietly.

Optional variables:

| Variable | Effect |
|---|---|
| `EDCH_REGISTRY_TEST_USER` / `EDCH_REGISTRY_TEST_PASSWORD` | Enable the authenticated browser flows. Unset, they skip. |

### Tags

`@smoke` (up + TLS + render), `@feature` (service-specific features), `@tls`. On the Registry
also `@module` (a custom module's observable behaviour) and `@external` (depends on a
third-party API — the PR job excludes it with `--tags 'not @external'` so an upstream outage
cannot redden a pull request; the scheduled run exercises it). Run a slice:
`bunx cucumber-js --tags '@smoke'`.

## Registry custom modules

The Registry runs custom modules from
[`EUDCH/registry-drupal-modules`](https://github.com/EUDCH/registry-drupal-modules). Every
scenario here confirms one of their user-facing features doing its job — asserting the rendered
value, not the markup around it, so a scenario fails if the feature stops working.

| Module | Confirmed feature |
|---|---|
| `organization_validation` | Registration form is login-protected (403 anon); the organisation check redirects to login with its destination; the confirmation page renders its message; and, in the browser, login lands on the check page |
| `webform_geonames` | The city lookup endpoint validates input (empty set, no outbound call) and returns well-formed suggestions for a known city (`@external`) |
| `email_protect` | Contact addresses render obfuscated as `(at)` on the listing and on a profile, with no raw address or `mailto:` anywhere |
| `computed_address` | An organisation profile renders a non-empty computed address value |

`org_moderation_sync` and `organization_listing` are not enabled on prod or test, so they
expose no user-facing feature to confirm and are intentionally not covered here.

## Add a service or a check

- **Service:** one entry in `config/services.json` (`name`, `tech`, `operator`, `envs`).
- **Feature:** a `features/<name>.feature` file. Reuse the existing HTTP/TLS steps; add
  tech-specific steps only where a service needs them.

## Browser layer

`browser/` holds Playwright specs for flows HTTP can't verify (submitting the org
registration form, the authenticated login → check-organisation redirect). It runs in a
**separate, gated CI job** (manual + nightly) so browser flake never blocks a pull request, and
uses headless Chromium driven by Playwright. The nightly runs read-only against prod; the
`@writes` submission spec runs only on a manual `env=test` dispatch (its guard refuses prod).

## CI

- `http-tests.yml` — on PR, manual dispatch (choose env), and a daily schedule. Fails the job
  on any non-zero exit.
- `browser-tests.yml` — manual dispatch + nightly only.
