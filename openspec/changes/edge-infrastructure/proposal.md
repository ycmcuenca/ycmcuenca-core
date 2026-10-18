# Proposal

## Why

Both apps build for Cloudflare Workers but run only on developer machines. Sprint 1's exit criteria need a merged release PR to deploy the released app, and `admin` to be reachable only through Cloudflare Access. Decisions I9 and I10 also ask for observability and security headers from the first deploy, not added later. `ci-release-pipeline` left a gated, SHA-pinned pipeline whose release-please job already exposes `paths_released` for a deploy step, so the first Cloudflare secret can now be added to hardened infrastructure. Every later sprint (KV, R2, Neon) builds on the live workers this change creates.

## What Changes

- **Release-driven deploys.** A reusable `deploy.yml` workflow builds one app from a released commit with the frozen lockfile and deploys it with the lockfile-pinned Wrangler. `release-please.yml` calls it once for each app in `paths_released`. The same workflow can be started by hand (`workflow_dispatch`) for any existing `<app>-vX.Y.Z` tag, which covers rollback and re-running a failed deploy. Deploys of the same app are serialized, and each one ends with a production smoke check.
- **Credentials scoped to one environment.** A GitHub `production` environment, restricted to `main`, holds the Cloudflare API token (secret) and account ID (variable). It is defined in `scripts/github/apply-settings.sh` like every other repository setting. Merging the release PR is the approval, so there is no extra reviewer gate. The token is account-owned and limited to deploying Workers. Pull-request runs never see it, and there are no per-PR preview deployments.
- **Both workers live on `workers.dev`.** `welcome.ycmcuenca.workers.dev` and `admin.ycmcuenca.workers.dev`, with preview and version URLs enabled. Wrangler configs gain `workers_dev`, `preview_urls` and observability settings. `admin` gains `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` as committed variables, which are public identifiers, not credentials. No KV, R2, database or service bindings are added.
- **Cloudflare Access.** A Worker-level Access application protects every `admin` URL (production, preview and version), and a previews-only one keeps unreleased `welcome` versions owner-only while production `welcome` stays public. Sign-in is a one-time PIN sent to the owner's email only. `scripts/cloudflare/apply-access.sh` creates and reconciles both applications idempotently, with a `--check` mode. The owner runs it with their own token, and it reads the email from the environment, so the email is never committed.
- **`admin` verifies Access itself (A2).** Every request is checked for a valid `Cf-Access-Jwt-Assertion` token: signature against the team's public keys, issuer and audience. Anything else gets 403, so the check fails closed. Cloudflare's `ctx.access` cannot be used, because Workers with Static Assets do not receive it. Only the local Vite dev server skips the check, through a build-time flag that production builds remove. The committed team domain must be an `https://<team>.cloudflareaccess.com` origin, which a unit test and the deploy workflow both enforce.
- **Security headers and an enforced CSP on both apps (I10).** HSTS, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` go on every response, both worker-rendered pages and static assets. An enforced Content Security Policy (hash-based, so it stays compatible with the Workers Cache planned in C10) includes `frame-ancestors 'none'`, and `admin` also sends `X-Robots-Tag: noindex`. The default template's inline `style` attribute is removed so the strict policy holds.
- **Observability (I9).** Workers Logs (with invocation logs) and traces are enabled on both workers at full sampling. Errors are logged as structured JSON lines carrying the request's Cloudflare Ray ID, which also appears on error pages for correlation.
- **New `@ycmcuenca/edge` package.** It holds the shared header, CSP, Access-verification, logging and error-handling code, unit-tested once and wired into each app by a thin `hooks.server.ts`. It is the first internal TypeScript package and depends on `jose`. A change under `packages/` alone never releases an app, so a package change that must ship comes with a `fix(<app>)` commit touching each affected app. The README and `AGENTS.md` document this convention.
- **E2E tests extended.** The `admin` smoke test signs a test token against a local key set, then checks that a valid token renders the page and an anonymous request gets 403. Both apps' smoke tests fail on any CSP violation.
- **README** gains deploy, rollback, Access and package-shipping sections. The stale `App.Platform` declarations are removed, since SvelteKit 3 has no `platform`.

Out of scope:

- KV, R2, Neon, Hyperdrive, Images and service bindings. Each is created by the S2 or S3 change that first uses it.
- The custom domain, workers.dev redirects and email (parking lot).
- Per-PR preview deployments. They would hand pull-request code a Cloudflare token, which `ci-checks` forbids.
- A CSP reporting endpoint, Turnstile (S3), the Web Analytics beacon (S5) and the CSP changes those bring.
- Cron triggers and the per-tick heartbeat log (W1, S4), and any third-party error tracker (I9).
- Terraform, automated Free-plan usage alarms, the Workers Paid plan, and versioning internal packages (parking lot).

## Capabilities

### New Capabilities

- `deployment`: how released apps reach production on Cloudflare Workers: the release-driven and manual deploy paths, where the deploy credentials live and who can use them, and how a deploy is verified.
- `access-control`: who can reach `admin` and unreleased `welcome` versions, how `admin` verifies an Access sign-in itself, how local development and tests work without a production bypass, and how the Access configuration is kept as code.
- `security-headers`: the HTTP security headers and Content Security Policy every response of both apps carries.
- `observability`: what the workers record (logs, traces, structured error logs with a request id) and how an error seen by a user is traced to its log line.

### Modified Capabilities

- `developer-workspace`: "Hello-world applications on the Workers runtime" now allows the deployment, observability and Access settings in each Workers config, while still forbidding storage and service bindings, routes and custom domains. "End-to-end smoke tests" adds `admin`'s authenticated and anonymous paths and a CSP-violation check.
- `repository-governance`: a new requirement for the `production` deployment environment, restricted to `main` and defined in the settings script.

## Impact

- **New files**: `.github/workflows/deploy.yml`, `scripts/cloudflare/apply-access.sh` with its committed Access definitions, `packages/edge/` (source, tests, manifest), `apps/*/src/hooks.server.ts`, `apps/*/_headers`, and the admin e2e Access fixture.
- **Changed files**: `.github/workflows/release-please.yml` (deploy job), `scripts/github/apply-settings.sh` (environment step), `apps/*/wrangler.jsonc` and regenerated `worker-configuration.d.ts`, `apps/*/vite.config.ts` (CSP), `apps/*/src/app.html`, `apps/*/src/app.d.ts`, `apps/*/e2e/*`, `apps/admin/playwright.config.ts`, `package.json` and `bun.lock`, `renovate.json5` (if `jose` needs a group), `README.md`, `AGENTS.md`.
- **Releases**: this change's `feat(welcome)` and `feat(admin)` commits produce the first release PR (`0.1.0` for each), and merging it is the first automated deploy. Before merge, the owner deploys the branch build once by hand, so Access can be configured and its unknowns verified against live workers (owner decision).
- **External systems** (owner tasks): Zero Trust enabled on the Cloudflare account (Free plan, up to 50 users; payment details are required even though nothing is charged), the One-time PIN identity provider, two Access applications, an account-owned API token, and the GitHub `production` environment with its secret and variable. All of it stays within free plans.
- **Decisions**: builds on P3, P4, P6, A1, A2, I9 and I10 and contradicts none. A2's "the worker verifies the Access JWT's `aud`" is met by full JWT verification, because `ctx.access` is unavailable to Workers with Static Assets. At archive, DECISIONS.md records three platform-wide outcomes: Worker-level Access for `admin` and previews-only Access for `welcome`; in-worker JWT verification instead of `ctx.access`; and the `fix(<app>)` convention for shipping shared-package changes.
