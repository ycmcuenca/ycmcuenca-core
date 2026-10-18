# Tasks

## 1. Owner prerequisites

- [x] 1.1 **Owner task:** enable Zero Trust on the Cloudflare account (Free plan; payment details are required but nothing is charged) and choose the team name. Verify `curl -s https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` returns a JSON key set, and record the team domain and each key's `alg` for design D6

## 2. Shared package `@ycmcuenca/edge`

- [x] 2.1 Scaffold `packages/edge` per design D10: a private ESM manifest exporting TypeScript source at `"."` and `"./access"`, `jose` as a `peerDependency` (`^6.2.12`), a `tsconfig.json` extending `@ycmcuenca/tsconfig/base.json`, and `check`/`test`/`lint` scripts. Verify `bun install` links it, and `bun run check`, `bun run lint` and `bun run test` include the package (Turborepo lists `@ycmcuenca/edge` in each run)
- [x] 2.2 Implement `createLogger` and `handleErrorFor` per design D9, with Vitest tests. Verify the tests show: one JSON line with `level`, `msg`, `app` and `requestId`; `requestId` taken from `cf-ray` (or `local-…` when absent); no header, cookie or token value logged even when the error carries them; nothing logged for 404; and a `{ message: "Internal Error", requestId }` result for status ≥ 500
- [x] 2.3 Implement `securityHeaders`, the exported baseline header values and `cspDirectives` per design D8, with tests. Verify the four baseline headers are set on mutable and on immutable responses (via a clone), `extra` headers are merged (`X-Robots-Tag`), and `cspDirectives` contains no nonce and matches D8's list
- [x] 2.4 Implement `accessGuard` in `./access` per design D6, with tests that sign tokens using locally generated jose keys and inject the key set. Verify a 403 and exactly one warning with the matching reason for: empty configuration (`config`), no header (`missing`), bad signature (`signature`), wrong issuer (`issuer`), wrong audience (`audience`), expired token (`expired`) and an unreachable key set (`keys`). Verify a valid token passes and sets `locals.accessEmail`, and that no log line contains the token
- [x] 2.5 Add `jose@6.2.12` as an exact dependency of `apps/admin`, and an `edge-runtime` package rule in `renovate.json5` (`matchPackageNames: ["jose"]`, `semanticCommitType: "fix"`) per assumption A10. Verify `bun install --frozen-lockfile` passes after the lockfile update, and that `bunx --package renovate@44.166.0 renovate-config-validator renovate.json5` reports the config valid

## 3. App wiring: headers, CSP, logging and errors

- [x] 3.1 Add `src/hooks.server.ts` to both apps: `sequence(securityHeaders(...))` plus, in `admin`, the guard installed as `dev ? passThrough : accessGuard(...)` with `dev` from `$app/env` and the variables from `cloudflare:workers`; `handleError` from `handleErrorFor`. Remove the stale `App.Platform` block, add `App.Error.requestId` and `App.Locals.accessEmail` (admin), and add a minimal `src/routes/+error.svelte` showing the status and request id. Each file cites its design decision. Verify `bun run check` passes, and `bun run dev` serves both home pages (admin without any token)
- [x] 3.2 Configure `csp: { mode: "hash", directives: cspDirectives }` in both `vite.config.ts` files, and remove `style="display: contents"` from both `src/app.html` files. Verify that after `bun run build`, `curl -sI` against `bunx wrangler dev` returns a `Content-Security-Policy` header (not report-only) with `default-src 'self'`, `object-src 'none'` and `frame-ancestors 'none'`, and that two requests to the same page return an identical policy
- [x] 3.3 Add `apps/welcome/_headers` and `apps/admin/_headers` (project root) with the baseline headers under `/*`, plus `X-Robots-Tag: noindex, nofollow` for admin, and a unit test in each app asserting the file matches the package's exported values. Verify the test fails when one header value is edited, and that after a build `curl -sI` on `wrangler dev` shows the headers on `/robots.txt` and on a file under `/_app/immutable/`
- [x] 3.4 Verify whether `_headers` rules also apply to files the adapter serves through `ASSETS_BINDING.fetch` (`/_app/version.json`), and to a 404 page rendered by SvelteKit. If either lacks the baseline headers, stop and ask the owner before adding a worker-side fallback

## 4. Workers configuration, deploy pipeline and bootstrap

- [x] 4.1 Update both `wrangler.jsonc` files per design D4: `workers_dev`, `preview_urls` and `observability`, plus admin `vars` with the team domain from 1.1 and an empty `ACCESS_AUD`. Run `bun run gen` in each app, commit the regenerated `worker-configuration.d.ts`, and verify `Env` types `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` in admin, and that `bun run check` and `bun run build` pass
- [x] 4.2 Write `.github/workflows/deploy.yml` per design D1–D2, the two caller jobs plus the `welcome_version`/`admin_version` outputs in `release-please.yml`, and `scripts/deploy/smoke-check.sh` per D11. Every action is SHA-pinned, top-level `permissions: {}`, inputs pass through `env`, and there is no cache. Verify actionlint 1.7.12, `uvx zizmor@1.31.1 .github/workflows` and `shellcheck scripts/deploy/smoke-check.sh` report nothing, and that the resolve step rejects `app=web`, `version=latest` and `version=1.2` in a local dry run of its script
- [x] 4.3 Determine from GitHub's documentation whether a job using an environment needs `deployments: write` on its token, and set the deploy job's permissions to the minimum. Confirm the setting on the first release deploy (task 8.2): if that job fails for lack of a permission, add only the one named
- [x] 4.4 Read `oven-sh/setup-bun`'s `action.yml` at the pinned SHA, and verify it caches nothing by default in `deploy.yml` (or disable caching explicitly). Confirm zizmor reports no `cache-poisoning` finding for `deploy.yml`
- [x] 4.5 **Owner task (bootstrap deploy, design Migration Plan step 3):** create an account-owned API token with only Workers Scripts: Edit, then run `bunx wrangler deploy` in `apps/welcome` and `apps/admin` from the branch build with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set. If the deploy is refused, add one permission at a time and re-run. Verify both deploys succeed, record the final permission set for the README, and verify the token cannot list Access applications (`GET /accounts/{id}/access/apps` returns 403)
- [x] 4.6 Run `scripts/deploy/smoke-check.sh welcome` and `scripts/deploy/smoke-check.sh admin` locally against the bootstrap deploy. Verify welcome passes (200 with headers), admin passes with 403 (empty `ACCESS_AUD`), and that the script fails when pointed at a URL that returns the admin page (simulated with the local `vite dev` server)
- [x] 4.7 Add step 7 (`production` environment, `main`-only branch policy, secret and variable presence reported by name) to `scripts/github/apply-settings.sh` per design D3. Verify `shellcheck` passes and `--check` against the live repository reports the environment as missing while changing nothing (re-read through `gh api`)

## 5. Cloudflare Access

- [x] 5.1 Write `scripts/cloudflare/apply-access.sh` and its desired-state JSON under `scripts/cloudflare/access/` per design D5 (OTP identity provider, `owner-only` policy with the email from `OWNER_EMAIL`, admin `worker` app, welcome `preview_worker` app, AUD compared with the committed `ACCESS_AUD`, `--check` mode, upsert without delete). Verify `shellcheck` passes, the script refuses to run without `OWNER_EMAIL`, and `git grep -n "@" scripts/cloudflare` finds no email address
- [x] 5.2 **Owner task:** create a personal Access-admin API token (never stored in GitHub), run `apply-access.sh`, and record the permission groups it needed (expected: Access: Apps and Policies Edit; Access: Organizations, Identity Providers, and Groups Edit; Workers Scripts Read). Verify a second run prints only `unchanged` (apart from the AUD drift until 5.3), that after editing the admin policy in the dashboard `--check` exits non-zero naming it, and that a re-run restores it
- [x] 5.3 Commit the printed AUD as `ACCESS_AUD` in `apps/admin/wrangler.jsonc`, and redeploy `admin` from the branch (owner, same token as 4.5). Then verify all of the following, and **stop and ask the owner before continuing** if the header is absent or the audience does not match:
  - the owner signs in with a one-time PIN and sees `Admin`
  - the worker received `Cf-Access-Jwt-Assertion` (no `missing` warning in Workers Logs)
  - an anonymous request to the production URL, a version URL (`bunx wrangler versions list` gives one) and a static asset is sent to the Access sign-in
  - a `welcome` version URL requires sign-in while production `welcome` loads without it
  - `apply-access.sh --check` exits 0
- [x] 5.4 Decode the header of a live Access token (from the signed-in browser's `CF_Authorization` cookie, locally only, never committed) and the team's key set. Verify the `alg` is the one `accessGuard` allows, and that the token's `aud` contains the committed `ACCESS_AUD`. If not, stop and ask the owner
- [x] 5.5 Add the admin trust-configuration unit test per design D6: read `wrangler.jsonc` with Wrangler's exported config reader if 4.151.1 has one, otherwise `ts.parseConfigFileTextToJson`, and record which in a comment. Verify it passes on the committed config and fails when `ACCESS_TEAM_DOMAIN` is set to `http://127.0.0.1:8799` or `https://example.com`, and when `ACCESS_AUD` is not empty or 64 hex characters

## 6. End-to-end tests

- [x] 6.1 Extend both apps' smoke tests per design D7: collect `securitypolicyviolation` events through an init script, fail on any, and assert the response carries the baseline headers and the CSP. Verify the suites pass, and that temporarily re-adding the inline `style` attribute to `app.html` makes them fail; then revert
- [x] 6.2 Spike: verify that `bunx wrangler dev` (Wrangler 4.151.1) lets the admin worker fetch `http://127.0.0.1:8799/cdn-cgi/access/certs` from a local Bun server. If workerd blocks it, stop and ask the owner whether to fall back to the 403-only admin e2e (design D7)
- [x] 6.3 Add `apps/admin/e2e/access-fixture.ts` and the two-entry `webServer` config (key-set server on 8799, then `wrangler dev` with `--var ACCESS_TEAM_DOMAIN:http://127.0.0.1:8799 --var ACCESS_AUD:e2e-audience`), with the private key in a git-ignored temporary file. Verify the admin smoke test shows `Admin` with a signed test token, receives 403 with no heading without one, and that `git status` lists no key file after a run

## 7. Documentation and integration verification

- [x] 7.1 Update `README.md` per design D12 (deploying, rollback by tag, token rotation and permission sets from 4.5 and 5.2, Cloudflare Access setup, shipping shared-package changes) and add the D10 convention line to `AGENTS.md`. Verify every command shown runs as written (`apply-settings.sh --check`, `apply-access.sh --check`, `smoke-check.sh`), and that all links resolve
- [x] 7.2 **Owner task:** run `scripts/github/apply-settings.sh`, then set `CLOUDFLARE_API_TOKEN` (`gh secret set --env production`) and `CLOUDFLARE_ACCOUNT_ID` (`gh variable set --env production`). Verify a second run prints only `unchanged`, `--check` exits 0, and the environment's branch policy lists only `main`
- [x] 7.3 On the bootstrap deploys, verify in Workers Logs that invocation logs and traces appear for both workers, that the admin worker's `cpuTime` for a signed-in request (cold and warm isolate) stays well under 10 ms, and that a 404 request produces no error-level line. Record the measured CPU times in the design's facts table
- [x] 7.4 Run the local CI equivalent (`bun install --frozen-lockfile`, `bun run format`, `bun run lint`, `bun run check`, `bun run build`, `bun run test`, `bun run test:e2e`, `bunx openspec validate --all --strict --no-interactive`, `scripts/docs/check-living-docs.sh`, actionlint, zizmor and shellcheck on every script). Verify all pass, `openspec validate edge-infrastructure --strict` passes, and `ci-ok` is green on the PR with no Cloudflare secret available to any PR job (each job's "Set up job" log lists no environment)

## 8. First release deploy

- [x] 8.1 Rebase-merge the PR, then verify release-please opens one release PR proposing `welcome` 0.1.0 and `admin` 0.1.0
- [x] 8.2 Approve the release PR's CI run and merge it. Verify `deploy-welcome` and `deploy-admin` run in the `production` environment from the released tags, both smoke checks pass, the deploy messages name the tags (`bunx wrangler deployments list`), and the job permissions match task 4.3
- [x] 8.3 Verify the manual path: start `deploy.yml` by hand for `welcome` `0.1.0` from `main` and confirm it succeeds; start it with `version=latest` and confirm it fails before building; start it from a non-`main` branch and confirm the job cannot use the `production` environment
- [x] 8.4 **Owner task:** sign in to `https://admin.ycmcuenca.workers.dev` with a one-time PIN and confirm `Admin` loads, and confirm an anonymous request from a private window is sent to the Access sign-in. Record the outcome in this file
  - the owner signed in with a one-time PIN and saw `Admin`
  - the deployed version `e67771b4-aea9-43af-b47b-a444bbe14f95` answered 200
  - `Cf-Access-Jwt-Assertion` was present on the request
  - an anonymous request got a 302 to the Access sign-in

## Workflow follow-up

- Set this change's row in `docs/ROADMAP.md` to `in progress` when implementation starts, and to `merged` once the PR lands.
- Commit through `/git` and ship through `/ship`.
- Archive: set the row to `archived`. Record in `docs/DECISIONS.md` the Worker-level Access topology (admin all traffic, welcome previews only), JWT verification instead of `ctx.access` for Workers with Static Assets, and the `fix(<app>)` convention for shipping shared-package changes. Update `docs/ARCHITECTURE.md` so deployment, Access, observability and security headers are drawn solid, and review the other living documents.
- Sprint 1 exit criteria are then met; the next change is S2's `content-store`.
