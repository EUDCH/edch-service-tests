# EDCH service tests

Black-box feature baselines for the **EDCH services**, runnable locally and in CI. Each
service has a readable spec of what it must do; the suite checks it over HTTP (fast, every
run) with a thin browser layer for the few genuinely interactive flows.

This is the CI-grade, team-visible sibling of the on-demand `_SERVICEREVIEW` check. It does
**not** apply updates or touch the sites — it verifies their public behaviour after a change
(a PCSS/EIFL upgrade, a content/theme/org change, a config tweak).

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

`EDCH_ENV` selects which base URL each service is hit at, from `config/services.json`:
`local` (DDEV copy), `test` (PCSS test instance), or `prod` (default). A service with no URL
for the chosen env falls back to its prod URL.

### Tags

`@smoke` (up + TLS + render, all services), `@feature` (service-specific features),
`@drupal`, `@tls`, `@interactive`. Run a slice: `bunx cucumber-js --tags '@smoke'`.

## Add a service or a check

- **Service:** one entry in `config/services.json` (`name`, `tech`, `operator`, `envs`).
- **Feature:** a `features/<name>.feature` file. Reuse the existing HTTP/TLS steps; add
  tech-specific steps only where a service needs them.

## Browser layer

`browser/` holds Playwright specs for flows HTTP can't verify (submitting the org
registration form, JS search). It runs in a **separate, gated CI job** (manual + nightly) so
browser flake never blocks a pull request. In CI the browser layer must be Playwright;
Interceptor (used elsewhere for local verification) needs a live logged-in session and cannot
run headless in a pipeline.

## CI

- `http-tests.yml` — on PR, manual dispatch (choose env), and a daily schedule. Fails the job
  on any non-zero exit.
- `browser-tests.yml` — manual dispatch + nightly only.
