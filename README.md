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
> not evidence of the target. Scenarios and specs that submit data call
> `assertNotProduction()` (`steps/world.mjs`, `browser/support/guards.ts`), which compares the
> resolved hostname against the prod URLs in the inventory and throws. It fails loudly rather
> than skipping, so a misconfigured run cannot pass quietly.

Optional variables:

| Variable | Effect |
|---|---|
| `EDCH_EXPECT_DRUPAL_MAJOR` | Assert the exact Drupal major version. Unset, the suite only requires `>= 10`, because prod and the test instance sit on different majors during a migration. Set it to `11` against a migrated instance to make it a hard gate. |
| `EDCH_REGISTRY_TEST_USER` / `EDCH_REGISTRY_TEST_PASSWORD` | Enable the authenticated browser flows. Unset, they skip. |

### Tags

`@smoke` (up + TLS + render, all services), `@feature` (service-specific features),
`@drupal`, `@tls`, `@interactive`. Run a slice: `bunx cucumber-js --tags '@smoke'`.

Also in use on the Registry: `@module` (a custom module's observable behaviour), `@external`
(depends on a third-party API, so allowed to be the flaky one — exclude with
`--tags 'not @external'`), `@not-installed` (asserts a module route is *absent*, recording
deployment reality rather than an aspiration).

## Registry custom modules

The Registry runs six custom modules from
[`EUDCH/registry-drupal-modules`](https://github.com/EUDCH/registry-drupal-modules). Release
1.3.0 declared `core_version_requirement: ^10 || ^11` on all six; declaring D11 support is not
the same as exercising it, so `features/registry.feature` covers what each module actually
does over HTTP, and `browser/specs/` covers what needs a real browser.

| Module | Covered by | Notes |
|---|---|---|
| `organization_validation` | HTTP + browser | Confirmation page, the login gate on `/check-organisation`, the POST-only submit route, and the post-login redirect |
| `webform_geonames` | HTTP + browser | Its Drupal endpoint is healthy; the browser-side autocomplete is a documented expected failure — see the spec |
| `email_protect` | HTTP | Asserts the `(at)` substitution *and* that no raw address or `mailto:` survives |
| `computed_address` | HTTP | Combined city/country computed field on an organisation profile |
| `org_moderation_sync` | **not covered** | Not installed. Even installed, no black-box assertion isolates it: `organization_validation` duplicates its moderation logic for the same bundle, so toggling it changes nothing observable. The duplication is the finding |
| `organization_listing` | absence only | Not installed on prod or test; the suite asserts its route 404s |

Two of the six therefore have no functional coverage. That is a property of the deployment and
of the modules, not an omission in the suite — a test that cannot fail is not a test.

## Add a service or a check

- **Service:** one entry in `config/services.json` (`name`, `tech`, `operator`, `envs`).
- **Feature:** a `features/<name>.feature` file. Reuse the existing HTTP/TLS steps; add
  tech-specific steps only where a service needs them.

## Browser layer

`browser/` holds Playwright specs for flows HTTP can't verify (submitting the org
registration form, JS search). It runs in a **separate, gated CI job** (manual + nightly) so
browser flake never blocks a pull request. The CI browser layer uses Playwright because a real
logged-in browser session cannot run headless in a pipeline.

## CI

- `http-tests.yml` — on PR, manual dispatch (choose env), and a daily schedule. Fails the job
  on any non-zero exit.
- `browser-tests.yml` — manual dispatch + nightly only.
