# Design

## Context

See proposal.md for the motivation, and the specs `deployment`, `access-control`, `security-headers`, `observability` and the `developer-workspace` and `repository-governance` deltas for the required behavior.

Current state, observed on 2026-10-18:

- `apps/welcome` and `apps/admin` are SvelteKit 3.1.0 apps on `@sveltejs/adapter-cloudflare` 8.0.1 with Wrangler 4.151.1. Each `wrangler.jsonc` has `main: .svelte-kit/cloudflare/_worker.js`, an `ASSETS` binding, `compatibility_date: 2026-10-17` and `nodejs_als`, and no bindings, routes or `workers_dev` settings. Nothing is deployed. The Cloudflare account exists and the `ycmcuenca` workers.dev subdomain is claimed. Zero Trust is **not** enabled yet.
- Both `src/app.d.ts` files still declare `App.Platform` with `env`/`ctx`, left over from SvelteKit 2. The generated `worker-configuration.d.ts` already types `ExecutionContext.access` and `cloudflare:workers` (`env`, `waitUntil`, `cache`, `tracing`, but no `access`).
- `src/app.html` in both apps wraps the body in `<div style="display: contents">`. An inline style attribute violates a hash-based `style-src`.
- There is no `hooks.server.ts`, no `+error.svelte` and no `_headers` file. The Playwright smoke tests run `wrangler dev` on the built output (welcome 8787/9229, admin 8788/9230) and assert the `<h1>`.
- `release-please.yml` has one job, `release-please`, that exposes `releases_created` and `paths_released`, and uses no checkout and no cache. `ci.yml`'s `workflows` job audits every workflow with actionlint 1.7.12 and zizmor 1.31.1. `scripts/github/apply-settings.sh` manages six settings with a `--check` mode, and there are no Actions secrets or environments yet.
- `packages/` holds only configuration packages (`tsconfig`, `eslint-config`). There is no TypeScript library package yet.
- `living-docs` is implemented first (owner decision), so `AGENTS.md` and `docs/ARCHITECTURE.md` exist when this change is built.

### Versions and facts verified (2026-10-18)

| Item                                 | Version or fact                                                                                                                                                                                                                                                                                                                 | Source                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Wrangler config                      | 4.151.1 schema has `workers_dev` (default true), `preview_urls` (default false), `observability.{enabled, logs.{enabled, invocation_logs, head_sampling_rate}, traces.{enabled, head_sampling_rate}}`, `upload_source_maps` (default true for `deploy`), `access.dev.{aud, identity}`, `previews`, `vars`                       | `apps/admin/node_modules/wrangler/config-schema.json`                                      |
| adapter-cloudflare worker            | 8.0.1's `_worker.js` calls `server.respond(req, …)` with no `platform`/`ctx`. Static files go through `env.ASSETS_BINDING`. It reads a project-root `_headers`, appends its own `/_app/*` rules and warns if `_headers` sits in `static/`                                                                                       | package source in `node_modules`                                                           |
| `_headers` rules through the binding | responses the worker gets from `env.ASSETS_BINDING.fetch` carry the `_headers` rules: `/_app/version.json` kept all baseline headers on both apps under `wrangler dev` (task 3.4), so no worker-side fallback is needed                                                                                                         | `curl` against `wrangler dev` on the built output                                          |
| Environment job permissions          | a job that references `environment:` needs no `deployments: write` for the environment itself: GitHub creates the deployment object, and `deployments: write` only lets an action call the Deployments API (task 4.3)                                                                                                           | GitHub docs: workflow syntax `permissions`, "Deploying with GitHub Actions"                |
| setup-bun caching                    | v2.2.0's `action.yml` caches the Bun executable by default (`no-cache` defaults to `false`, a `post` step saves it); `deploy.yml` passes `no-cache: "true"`, so a deploy caches nothing (task 4.4, and zizmor's cache-poisoning stays clean)                                                                                    | `action.yml` at the pinned SHA                                                             |
| SvelteKit 3                          | `platform` removed; `env` and `waitUntil` come from `cloudflare:workers`; `$app/environment` renamed to `$app/env` (`dev`, `building`, …); `csp` is configured on the Vite plugin, with `mode: 'hash' \| 'nonce' \| 'auto'`; `sequence` from `@sveltejs/kit/hooks`                                                              | Context7 `/websites/svelte_dev_kit` (migration guide, hooks, config)                       |
| SvelteKit announcer                  | its root component puts a hardcoded inline `style` on `#svelte-announcer`; Chromium asks for the hash `sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=` with `'unsafe-hashes'` (sveltejs/kit#11993; upstream fix PR #14566 open)                                                                                            | a probe against `wrangler dev` and a local SHA-256, task 6.1                               |
| Workers Access                       | Worker-level Access (2026-08-14): `destinations: [{ type: "worker" \| "preview_worker", worker_id }]` on `POST /accounts/{id}/access/apps` covers all of a Worker's domains and previews. **Workers with Static Assets do not receive `ctx.access`**                                                                            | Context7 `/cloudflare/cloudflare-docs` (changelog, Cloudflare Access)                      |
| Access token                         | `Cf-Access-Jwt-Assertion` header (validate it, not the cookie); keys at `<team domain>/cdn-cgi/access/certs`; `iss` = `https://<team>.cloudflareaccess.com`; `aud` is an array of application AUD tags                                                                                                                          | Context7 `/cloudflare/cloudflare-docs` (validating JSON, SASE)                             |
| Access team (task 1.1)               | Team `ycmcuenca`: `https://ycmcuenca.cloudflareaccess.com/cdn-cgi/access/certs` returns a key set with two RSA keys, both `alg: RS256` (kid `60483f…011f`, `10f9ce…599c`), verified 2026-10-18                                                                                                                                  | curl, task 1.1                                                                             |
| Zero Trust Free                      | up to 50 users; onboarding needs payment details even on the Free plan (not charged); a One-time PIN rule must be paired with specific emails                                                                                                                                                                                   | Context7 `/cloudflare/cloudflare-docs`                                                     |
| jose                                 | 6.2.12 (npm). `createRemoteJWKSet` defaults: `cacheMaxAge` 600000 ms, `cooldownDuration` 30000 ms, `timeoutDuration` 5000 ms                                                                                                                                                                                                    | npm registry; Context7 `/panva/jose`                                                       |
| Workers Logs / Observability         | Free: 200,000 log events/day, 3-day retention until 2026-12-01; then Observability pricing: Free 0.5 GB/day ingestion, 7-day retention, ingestion paused until 00:00 UTC at the limit. Traces: 7-day retention                                                                                                                  | Context7 `/cloudflare/cloudflare-docs` (pricing)                                           |
| Workers CPU limits                   | Free plan: 10 ms CPU per request; an isolate tolerates occasional overage ("built-in flexibility"), while consistent overage is terminated (Error 1102, outcome `exceededCpu`); the docs call 10–20 ms typical for authentication and server-side rendering                                                                     | developers.cloudflare.com/workers/platform/limits, 2026-10-18                              |
| CPU measured (task 7.3)              | the first signed-in `admin` GET after the bootstrap redeploy (2026-10-18) logged `wallTimeMs` 40 and `cpuTimeMs` 14 on a cold isolate, inside the 10–20 ms the docs call typical for authentication and SSR; a warm-isolate GET logged `wallTimeMs` 40 and `cpuTimeMs` 4, and a 404 request logged no error line (level `info`) | Workers Logs, owner report                                                                 |
| Workers Previews                     | Wrangler ≥ 4.135; Free: 100 previews per Worker; preview URLs public by default; `workers.dev` previews carry `X-Robots-Tag: noindex`                                                                                                                                                                                           | Context7 `/cloudflare/cloudflare-docs` (previews)                                          |
| Wrangler in CI                       | authenticates with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; `wrangler dev --var key:value` overrides config `vars`                                                                                                                                                                                                   | Context7 `/cloudflare/cloudflare-docs`                                                     |
| workerd loopback fetch               | `wrangler dev`'s workerd reaches `http://127.0.0.1:8799`: `admin`'s e2e passes while the guard verifies its token against the fixture's key set                                                                                                                                                                                 | task 6.2                                                                                   |
| Workers Scripts API                  | `GET /accounts/{id}/workers/scripts` returns each script's `id` (name) and `tag`                                                                                                                                                                                                                                                | Context7 `/cloudflare/cloudflare-docs`                                                     |
| `GITHUB_TOKEN` events                | do not create workflow runs, except `workflow_dispatch`, `repository_dispatch` and approval-required `pull_request` runs                                                                                                                                                                                                        | Context7 `/websites/github_en_actions`                                                     |
| GitHub environments                  | secrets reach only jobs that reference the environment; deployment branch policies are available for public repositories                                                                                                                                                                                                        | Context7 `/websites/github_en_actions`                                                     |
| release-please-action                | v5.0.0: path outputs such as `apps/admin--version` via bracket notation. release-please has no option to count another path's commits toward a component (only `exclude-paths`)                                                                                                                                                 | Context7 `/googleapis/release-please-action`, `/googleapis/release-please` (`manifest.ts`) |

## Goals / Non-Goals

**Goals:**

- A release deploys itself. After one owner bootstrap deploy (Migration Plan), nobody runs `wrangler deploy` by hand, and the token's only automated use is in one environment-scoped job.
- The riskiest unknowns (Access forwarding the token, token permissions, CPU cost) are verified against live workers **before** this change merges, so a wrong assumption stops the PR rather than a release.
- `admin` fails closed at every layer: Access in front, token verification in the worker, and 403 when configuration is missing.
- Every response is hardened from the first deploy, with headers that stay compatible with the Workers Cache planned in C10.
- The Cloudflare side is reproducible from committed files, as the GitHub side already is.

**Non-Goals:**

- Zero-downtime or gradual rollouts (Wrangler's percentage deployments). A single owner and one app version at a time do not need them.
- Detecting Cloudflare drift on a schedule. That would need an Access-admin token in Actions, which this change deliberately avoids, as `ci-release-pipeline` did for GitHub settings.

## Decisions

### D1. One reusable deploy workflow, called per released app

- `.github/workflows/deploy.yml` has two triggers:
  - `workflow_call` with inputs `app` (string) and `version` (string).
  - `workflow_dispatch` with inputs `app` (`choice`: `welcome`, `admin`) and `version` (string, for example `0.2.0`).
- `release-please.yml` gains two caller jobs, `deploy-welcome` and `deploy-admin`. Each `needs: release-please`, runs only when `contains(fromJSON(needs.release-please.outputs.paths_released), 'apps/<app>')`, and passes `version` from the new job outputs `welcome_version` and `admin_version`, which map to `steps.release.outputs['apps/<app>--version']`. A deploy never runs when there is no release.
- Two explicit caller jobs, not a matrix: job outputs must be declared statically, so a matrix cannot pick a per-path output without dynamic indexing. Two jobs keep each app's path readable. A third app is a third job.
- **Pattern:** a release train with a single deploy definition: the automated and manual paths are the same workflow, so a rollback exercises exactly the code path a release uses.
- **Why called, not triggered:** releases created with `GITHUB_TOKEN` do not start other workflows (verified), so a `on: release` workflow would never fire.
- **Alternatives:** _`on: release` with a PAT or GitHub App token for release-please_ (works, but a long-lived secret was rejected in `ci-release-pipeline` D8); _everything inside `release-please.yml`_ (owner chose the reusable file); _`cloudflare/wrangler-action`_ (a third-party hop that handles the token and installs its own Wrangler; rejected for the lockfile-pinned `bunx wrangler`).
- **Failure modes:** _`paths_released` empty or malformed:_ `contains(fromJSON(...))` is false, so the job is skipped (release-please always sets it, verified). _A caller job fails for one app:_ the two jobs are independent, so the other app still deploys. _Manual input typo:_ D2's validation step rejects it before anything is built.

### D2. The deploy job

`deploy.yml` has top-level `permissions: {}` and one job, `deploy`:

1. **Resolve:** the inputs reach the step through `env` (template-injection-safe). The step validates `app ∈ {welcome, admin}` and `version` against `^[0-9]+\.[0-9]+\.[0-9]+$`, then builds `TAG=<app>-v<version>`.
2. `environment: production`; `concurrency: { group: deploy-${{ inputs.app }}, cancel-in-progress: false }`; `permissions: { contents: read }`, plus `deployments: write` only if the environment requires it (task 4.3 verifies).
3. `actions/checkout` at `refs/tags/$TAG` with `persist-credentials: false`. A missing tag fails here, before anything is built.
4. `setup-bun` (no version input) and `setup-node` (`.node-version`), then `bun install --frozen-lockfile`. No `actions/cache`, and no setup-action caching (zizmor `cache-poisoning`; task 4.4 confirms setup-bun caches nothing by default).
5. `bunx turbo run check test build --filter=<app>`. The app's unit tests include D6's trust-configuration test, so a misconfigured `admin` never deploys.
6. `bunx wrangler deploy --message "$TAG"` in `apps/<app>`, with `CLOUDFLARE_API_TOKEN` (environment secret) and `CLOUDFLARE_ACCOUNT_ID` (environment variable) passed through `env`.
7. `scripts/deploy/smoke-check.sh <app>` (D11).

The caller jobs in `release-please.yml` grant at most the same permissions. No step interpolates `${{ }}` into `run:`.

- **Why the tag and not `github.sha`:** a manual redeploy of an old version must build that version's code and Wrangler config, and the tag is the one identifier both paths share.
- **Failure modes:** _the token leaks through logs:_ Actions masks secrets, and Wrangler never prints the token. _A deploy succeeds but the smoke check fails:_ the run is red, and the owner redeploys the previous tag by hand (deployment spec). _An old tag predates this workflow:_ none exists, since this change creates the first releases.

### D3. Credentials and the `production` environment

- **Deploy token:** an account-owned API token (not tied to the owner's user) limited to **Workers Scripts: Edit** on the one account. Task 4.5 checks whether Wrangler also needs **Account Settings: Read** (or another permission) to deploy with `workers_dev` and `preview_urls`, adds only what a deploy actually needs, and records the final set in the README.
- **Environment:** `scripts/github/apply-settings.sh` gains step 7. It `PUT`s `repos/{repo}/environments/production` with `deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }` and makes sure the only branch policy is `main` (type `branch`). It then **reports** whether `CLOUDFLARE_API_TOKEN` (secret) and `CLOUDFLARE_ACCOUNT_ID` (variable) are set, by name only; it cannot set the secret. A missing value counts as drift under `--check`. There are no required reviewers (owner decision).
- **Pattern:** least privilege by scope: one credential, one environment, one branch.
- **Alternatives:** _repository secrets_ (any job could reference them); _required-reviewer approval_ (owner rejected: merging the release PR is the approval); _a user token_ (dies with the user's session or rights; account-owned tokens are the documented CI choice).
- **Failure modes:** _token expired or revoked:_ the deploy fails at `wrangler deploy` with an auth error; the README documents rotation. _Branch policy widened by hand:_ `--check` reports drift.

### D4. Workers configuration

Both `wrangler.jsonc` files gain the following, each commented with this design's decision IDs:

```jsonc
"workers_dev": true,
"preview_urls": true,
"observability": {
  "enabled": true,
  "logs": { "enabled": true, "invocation_logs": true, "head_sampling_rate": 1 },
  "traces": { "enabled": true, "head_sampling_rate": 1 },
},
```

`admin` also gains `"vars": { "ACCESS_TEAM_DOMAIN": "https://<team>.cloudflareaccess.com", "ACCESS_AUD": "<aud>" }`. The AUD exists only once the Access application exists, and the application needs the deployed Worker's tag (D5). So `ACCESS_AUD` is empty for the owner's bootstrap deploy, and is committed in this same change before merge (Migration Plan). `upload_source_maps` keeps its deploy default (true), so stack traces in Workers Logs map to source, which is public anyway. `keep_vars` stays unset, so a deploy overwrites any variable edited in the dashboard. After the config changes, `wrangler types` is re-run and the generated `worker-configuration.d.ts` is committed. The stale `App.Platform` block is removed from both `app.d.ts` files.

- **Failure modes:** _Free-plan log volume:_ at 100,000 requests a day (the Workers Free cap), invocation logs stay below today's 200,000 log events a day. After 2026-12-01 the cap becomes 0.5 GB/day of ingestion. The monthly usage check in ROADMAP.md covers both, and sampling can drop below 1 in a later change.

### D5. Access topology and Access as code

- **Identity provider:** One-time PIN (`onetimepin`), the only one allowed on both applications.
- **Policy:** one reusable policy `owner-only` (decision `allow`, include `email: <OWNER_EMAIL>`), with a session duration of 24 h (assumption A4).
- **Applications:**
  - `admin`: `self_hosted` with destination `{ type: "worker", worker_id: <admin tag> }` (all traffic).
  - `welcome`: `self_hosted` with destination `{ type: "preview_worker", worker_id: <welcome tag> }` (previews only).
- **Script:** `scripts/cloudflare/apply-access.sh`, with the same shape as `apply-settings.sh`: `set -euo pipefail`, compare-then-apply, `unchanged`/`updated`/`drifted`, and a `--check` mode that changes nothing. It reads `CLOUDFLARE_API_TOKEN` (the owner's own Access-admin token, never the deploy token), `CLOUDFLARE_ACCOUNT_ID` and `OWNER_EMAIL` from the environment. The desired state lives in committed JSON under `scripts/cloudflare/access/`, with the email filled in at run time (`jq --arg`). Worker tags are looked up by name through `GET /workers/scripts`. Its steps, in order:
  1. Make sure the One-time PIN identity provider exists.
  2. Upsert the `owner-only` policy.
  3. Upsert both applications by name (`PUT` when present, `POST` when absent, never delete and recreate, so the AUD stays stable).
  4. Print `admin`'s AUD and compare it with the `ACCESS_AUD` committed in `apps/admin/wrangler.jsonc`, reporting a mismatch as drift.
- **Pattern:** settings as code (declarative desired state plus an idempotent reconciler), reused from `ci-release-pipeline` D9.
- **Why Worker-level:** one rule follows the Worker across `workers.dev`, previews, version URLs and a future custom domain, so there are no hostname lists to keep in sync (verified, 2026-08-14 changelog).
- **Alternatives:** _hostname applications_ (one per URL pattern, drifting as previews appear); _account-wide "protect all Workers" plus a bypass for `welcome`_ (safer default, but every future public satellite needs a bypass); _dashboard by hand_ and _Terraform_ (both rejected by the owner).
- **Failure modes:**
  - _Worker not deployed yet:_ the tag lookup fails and the script stops, naming the missing Worker.
  - _Owner token missing a permission:_ the API's 403 is surfaced with the endpoint. The required permission groups (expected: Access: Apps and Policies Edit; Access: Organizations, Identity Providers, and Groups Edit; Workers Scripts Read) are confirmed in task 5.2 and recorded in the README.
  - _An Access application deleted by hand:_ the next run recreates it with a **new** AUD; the AUD comparison then reports the mismatch, and `admin` fails closed until the new AUD is committed.
  - _OTP abuse:_ the policy includes one exact email, so codes go only to that address.

### D6. In-worker Access verification (A2)

- `@ycmcuenca/edge/access` exports `accessGuard({ teamDomain, audience, log })`, a SvelteKit `Handle`, with these steps:
  1. Read `cf-access-jwt-assertion`.
  2. `jwtVerify` it against `createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain))` with `issuer: teamDomain`, `audience`, `algorithms: ["RS256"]` (task 5.4 confirms the algorithm from the live key set).
  3. On success, set `event.locals.accessEmail`.
  4. On any failure, return a plain `403 Forbidden` and log a warning with the reason: `config`, `missing`, `signature`, `issuer`, `audience`, `expired` or `keys`.

  The key set is created once per isolate and per team domain, and jose then caches it (10 min) and refetches on an unknown `kid` (30 s cooldown).

- `apps/admin/src/hooks.server.ts` reads `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` through `import { env } from "cloudflare:workers"`, and installs the guard as `dev ? passThrough : accessGuard(...)`, with `dev` from `$app/env`. `dev` is a build-time constant, so a production build contains only the guarded branch. An empty team domain or audience makes the guard refuse every request (`config`).
- **Trust configuration rule:** an `admin` unit test reads `wrangler.jsonc` with Wrangler's own config reader if it exposes one, or else TypeScript's JSONC parser `ts.parseConfigFileTextToJson` (task 5.5 picks one). It asserts that `ACCESS_TEAM_DOMAIN` matches `^https://[a-z0-9-]+\.cloudflareaccess\.com$`, and that `ACCESS_AUD` is empty or 64 hex characters. D2 step 5 runs it before every deploy. The runtime trusts whatever is configured, which lets e2e point at a local key set (D7), while production is held to an Access origin by the test that gates the deploy.
- **Pattern:** defense in depth for zero-trust access. The edge decides, and the app re-verifies cryptographically instead of trusting that a request arrived through Access.
- **Alternatives:** _`ctx.access`_ (verified unavailable to Workers with Static Assets); _a worker wrapper around SvelteKit's entry_ (same `ctx.access` problem); _hand-rolled WebCrypto verification_ (more security-critical code to own); _Access only_ (contradicts A2).
- **Failure modes:**
  - _Access doesn't forward the header for Worker-level applications:_ every request is refused. This is unverified, so task 5.3 tests it first and stops for the owner if the header is absent.
  - _Key-set fetch fails:_ the request gets 403 with reason `keys`. The owner is locked out until Cloudflare's endpoint answers, which is fail-closed by design.
  - _CPU:_ one RS256 verification per request through WebCrypto, plus one key-set subrequest per cold isolate. Task 7.3 measures `cpuTime` in Workers Logs against the 10 ms limit.
  - _Static assets bypass the worker:_ they are protected by Access alone. They are built output of a public repository, so this is accepted.

### D7. Local development and e2e without a production bypass

- **`bun run dev`:** the guard is skipped (`dev` is true), so local work needs no tokens.
- **`admin` e2e:**
  - `playwright.config.ts` defines two `webServer` entries.
    - **Key-set fixture** (`e2e/access-fixture.ts`, run with Bun on port 8799): it generates an RS256 key pair, serves the public key at `/cdn-cgi/access/certs`, and writes the private JWK to a git-ignored temporary file.
    - **App server:** `bunx wrangler dev --port 8788 --inspector-port 9230 --var ACCESS_TEAM_DOMAIN:http://127.0.0.1:8799 --var ACCESS_AUD:e2e-audience`.
  - The smoke test signs a token with that key (`iss` = the fixture origin, `aud` = `["e2e-audience"]`, 5-minute expiry). With the header set, the page loads and shows `Admin`. Without it, the response is 403 and contains no heading.
- **Both apps' e2e:** an init script collects `securitypolicyviolation` events, and the test fails if any is recorded. The response must also carry the D8 headers.
- **Pattern:** test the production artifact with a test trust anchor injected through configuration, never through a code path.
- **Alternatives:** _the `access.dev` block_ (feeds `ctx.access`, which the app cannot see); _asserting only the 403_ (owner chose full coverage).
- **Failure modes:** _workerd refuses outbound fetches to `127.0.0.1` in `wrangler dev`:_ checked in task 6.2; workerd fetches the fixture, so the fallback (the 403-only e2e plus unit tests) is not needed. _Port clash:_ 8799 is fixed and `strictPort`-style, failing loudly.

### D8. Security headers and the Content Security Policy

- **Baseline headers** (`@ycmcuenca/edge` `securityHeaders(extra)` handle on every SvelteKit response, cloning when headers are immutable):
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload`: a `workers.dev` subdomain cannot be submitted)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

  `admin` adds `X-Robots-Tag: noindex, nofollow`.

- **Static assets:** these are served without the worker, so `apps/<app>/_headers` (project root, which the adapter picks up, verified) carries the same baseline under `/*`, plus `X-Robots-Tag` for `admin`. A unit test asserts each `_headers` file contains exactly the package's baseline values, so the two sources cannot drift.
- **CSP:** both `vite.config.ts` files set `sveltekit({ csp: { mode: "hash", directives: cspDirectives } })`, with `cspDirectives` exported by `@ycmcuenca/edge`:
  - `default-src`, `script-src`, `style-src`, `font-src` and `connect-src`: `'self'`
  - `img-src`: `'self' data:`
  - `object-src`: `'none'`
  - `base-uri` and `form-action`: `'self'`
  - `frame-ancestors`: `'none'`

  SvelteKit adds hashes for its own inline script and styles. The one inline style it never hashes is the `svelte-announcer` element in its root component (sveltejs/kit#11993). `style-src-attr` therefore carries `'unsafe-hashes'` and the SHA-256 hash of that exact attribute value: the keyword is what CSP3 requires before a hash applies to a style attribute at all (Chrome 69+, Firefox 109+, Safari 15.4+), and the lone hash allows that one value and nothing else. A SvelteKit upgrade that changes the string fails the e2e violation check, and the new hash is whatever the browser asks for. The pages are rendered on demand, so the policy arrives as a header (`frame-ancestors` is honored only there). The inline `style="display: contents"` is removed from both `app.html` files.

- **Why hash, not nonce:** a nonce changes per response, so caching a page whole with Workers Cache (C10) would either reuse one nonce for everyone or force bypassing the cache. Hashes are stable (security-headers spec, "Policy stays cacheable").
- **Alternatives:** _report-only first_ (owner chose enforcement); _headers in `_headers` only_ (not applied to worker-generated responses, verified); _per-app hooks_ (owner chose the shared package).
- **Failure modes:** _a future feature needs an inline style or an external origin_ (Turnstile, the analytics beacon): the e2e violation check fails, and that change widens `cspDirectives` deliberately. _Svelte runtime style injection_ in later UI work is caught the same way.

### D9. Structured logging and error handling

- `@ycmcuenca/edge` `createLogger(app)` returns `{ info, warn, error }(msg, fields)`. Each call writes one `console.log(JSON.stringify({ level, msg, app, requestId, ...fields }))`. The request id comes from `cf-ray`, or is `local-<uuid>` when absent. The logger only serializes the fields it is given; no helper ever logs headers, cookies or tokens.
- `handleErrorFor(app)` returns SvelteKit's `handleError`. For unexpected errors with status ≥ 500 it logs one `error` line with `message` and `stack`. It never logs 404s. It returns `{ message: "Internal Error", requestId }`. `App.Error` gains `requestId`, and a minimal `src/routes/+error.svelte` in each app shows the status and the request id.
- **Pattern:** structured logs with a correlation id. The Ray ID ties a user's error page, the invocation log and the trace together.
- **Alternatives:** _a log line per request_ (duplicates invocation logs and spends the Free ingestion quota; owner rejected); _Sentry or another tracker_ (I9 rules it out).
- **Failure modes:** _an error object carrying secrets in its message:_ the error page never shows the message, and the guard's own errors are logged by reason code only.

### D10. `@ycmcuenca/edge`: the first internal library package

- `packages/edge` (`private`, `type: module`) exports TypeScript source directly with no build step: `"."` exposes headers, CSP, logger and errors, and `"./access"` exposes the guard. The apps bundle it through Vite. Its scripts are `check` (`tsc --noEmit` against `@ycmcuenca/tsconfig/base.json`), `test` (Vitest) and `lint`. It joins Turborepo's existing `check`, `test` and `lint` tasks unchanged.
- **jose:** declared as an exact dependency of `admin` (the only consumer of `./access`) and as a `peerDependency` (`^6.2.12`) of `packages/edge`. That way a jose update touches `apps/admin/package.json`, and Renovate's new `edge-runtime` group commits it as `fix(deps)`, so `admin` gets a patch release and the update ships. Bundled runtime libraries thus follow the existing `fix(deps)` rule, and package-only changes stay unreleased.
- **Shipping package changes (owner decision):** a change under `packages/edge` that must reach production comes with a `fix(<app>)` (or `feat(<app>)`) commit touching each affected app, such as the app's `hooks.server.ts` or a comment line in it. The README and `AGENTS.md` state this.
- **Alternatives:** _versioning the package with release-please's `node-workspace` plugin_ (contradicts `release-management` and the parking lot; plugin support for `bun.lock` is unverified, and in `ci-release-pipeline` it only handled `package-lock.json`).
- **Failure modes:** _someone ships a package fix without the app commit:_ the fix waits for the next app release. The convention is documented, and the risk is visible because no release PR appears.

### D11. Post-deploy smoke check

- `scripts/deploy/smoke-check.sh <app>` uses curl with retries for up to 60 s, since propagation takes a few seconds:
  - **welcome:** `GET https://welcome.ycmcuenca.workers.dev/` must return 200 and carry `Content-Security-Policy`, `Strict-Transport-Security` and `X-Content-Type-Options`.
  - **admin:** an anonymous `GET https://admin.ycmcuenca.workers.dev/` without following redirects must return 302 (to the Access sign-in), 401 or 403, and the body must not contain `<h1>Admin`.
- The script also runs locally, so the owner uses it after the bootstrap deploy (task 4.6).
- **Failure modes:** _Access not configured yet_ (the bootstrap deploy): the guard answers 403 and the check passes, which is correct because the app stays closed. _A real exposure_ (200 with the page): the run fails and names it.

### D12. Documentation

- `README.md` gains:
  - "Deploying": the release flow, the manual redeploy and rollback by tag, and the token rotation.
  - "Cloudflare Access": the Zero Trust setup, `apply-access.sh`, the OTP sign-in and committing the AUD.
  - "Shipping shared-package changes": D10's convention.
  - The final token permission sets from tasks 4.5 and 5.2.
- `AGENTS.md` gains one convention line for D10.
- Living-document diagrams are updated at archive, per the archive rule. Before then, ARCHITECTURE.md shows this change as planned.

## Risks / Trade-offs

- [Access does not forward `Cf-Access-Jwt-Assertion` to Worker-level applications, so the guard refuses everything] → verified first (task 5.3), with a stop-and-ask; the fallback options are hostname-based applications or changing A2.
- [Wrong OTP email, or an Access outage, locks the owner out of `admin`] → no data is in `admin` in S1; re-run `apply-access.sh` with the correct email; fail-closed is intended.
- **The bootstrap deploy puts an unreleased branch build on the production URLs** → it is a hello-world `welcome` and a fail-closed `admin`; the first release overwrites both, and the deploy history keeps the bootstrap version visible.
- **Deploy token compromise** → it can only deploy Workers in one account. It lives in a `main`-only environment, is never available to PR code, and is rotated per the README.
- **Strict CSP blocks a future feature silently** → not silently: the e2e violation check fails in that feature's PR.
- **Free-plan observability limits change on 2026-12-01** → the monthly usage check (ROADMAP "Recurring checks"); sampling can be lowered without code changes.
- **Hash CSP and Workers Cache interact badly later** → hashes are content-derived and identical per page, which C10 needs; re-checked when C10 is built.

## Migration Plan

1. **Owner, before implementation:** enable Zero Trust on the account and choose the team name (task 1.1). It is committed as `ACCESS_TEAM_DOMAIN` in this change.
2. Implement on the change branch. PR CI runs without any secret.
3. **Owner bootstrap deploy (owner decision, 2026-10-18):** create the account-owned deploy token, then run `wrangler deploy` once for each app from the branch build on their machine, with `ACCESS_AUD` still empty. `welcome` serves its hello-world page; `admin` answers 403 to everyone. This is the only hand deploy, and it fixes the token's permission set (task 4.5).
4. **Owner:** run `apply-access.sh` with `OWNER_EMAIL` set. It creates the identity provider, the policy and both applications, and prints `admin`'s AUD. The AUD is committed to `apps/admin/wrangler.jsonc` on the branch. A second bootstrap deploy of `admin` then lets the owner sign in, and confirms against the live worker that the token header arrives, the audience matches and the CPU cost fits (tasks 5.3, 5.4, 7.3). If any of these fails, stop and ask the owner before merging.
5. **Owner:** run `apply-settings.sh` (creating the `production` environment), then set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` on it.
6. Rebase-merge the PR. release-please opens the first release PR (`welcome` 0.1.0, `admin` 0.1.0). Approve its CI, then merge it. Both apps deploy through `deploy.yml`, replacing the bootstrap builds, and both smoke checks pass. The owner signs in to `admin` with a one-time PIN.

**Rollback:** a manual deploy of an earlier tag rolls an app back. Removing the Access applications leaves `admin` closed (the guard refuses requests without a token). Reverting the PR and running `wrangler delete` for both workers returns to the previous state; no data is at risk.

## Open Questions

Each of these is verified by a task that stops for the owner if the answer changes the approach. None changes the specs.

- Whether Worker-level Access applications forward `Cf-Access-Jwt-Assertion` to the Worker, and whether their token's `aud` is the application's AUD tag (task 5.3).
- The minimal permission sets for the deploy token (task 4.5) and the owner's Access token (task 5.2).
- Whether `wrangler dev`'s workerd allows outbound fetches to `127.0.0.1` for the e2e key set (task 6.2).
- Whether the `production` environment needs `deployments: write` on the job token (task 4.3), and whether `setup-bun` caches anything by default (task 4.4).
- Whether `_headers` rules apply to assets served through the adapter's `ASSETS_BINDING.fetch` as well as to assets served directly (task 3.4).
- Access's signing algorithm (expected RS256), read from the live key set (task 5.4).

## Assumptions for owner review

- **A1** HSTS is `max-age=63072000; includeSubDomains` without `preload`.
- **A2** `Referrer-Policy: strict-origin-when-cross-origin` on both apps, and `Permissions-Policy` disables camera, microphone and geolocation.
- **A3** CSP directives as listed in D8, with `img-src` also allowing `data:` URLs.
- **A4** The Access session lasts 24 h.
- **A5** Logs and traces are sampled at 100% (`head_sampling_rate: 1`).
- **A6** Source maps are uploaded on deploy (Wrangler's default), so stack traces in logs are readable.
- **A7** The deploy token is account-owned and starts with Workers Scripts: Edit only; the owner's Access token is separate and never stored in GitHub.
- **A8** (confirmed by the owner) One owner bootstrap deploy from the branch creates both workers before merge, so Access can be configured, the AUD committed and the unknowns verified in this PR (Migration Plan steps 3–4).
- **A9** The e2e key-set fixture listens on port 8799, and the e2e audience is `e2e-audience`.
- **A10** `jose` is an exact dependency of `admin`, committed by Renovate as `fix(deps)` in a new `edge-runtime` group.
- **A11** Both apps get a minimal `+error.svelte` that shows the status and the request id.
- **A12** Token verification uses no clock tolerance, the jose default.
