# Spec Delta

## MODIFIED Requirements

### Requirement: Hello-world applications on the Workers runtime

The workspace SHALL contain the apps `welcome` and `admin`. Each SHALL render a placeholder home page identifying the app. Each SHALL build to Cloudflare Workers output, with a Workers config that declares only deployment, observability and plain-variable settings and no storage, database or service bindings.

#### Scenario: Placeholder page

- **WHEN** an app's development server is running and its root URL is requested
- **THEN** the response is an HTML page with HTTP 200 whose heading names the app (`welcome` or `admin`)

#### Scenario: Workers build output

- **WHEN** the root `build` task runs
- **THEN** each app produces a Workers entry script and static assets directory referenced by its Workers config

#### Scenario: No cloud coupling yet

- **WHEN** either app's Workers config is inspected
- **THEN** it declares no KV, R2, database, service or other bindings beyond the static-assets binding, and no routes or custom domains; it may declare `workers.dev` and preview-URL settings, observability settings and plain variables

### Requirement: End-to-end smoke tests

Each app SHALL have an end-to-end smoke test that loads its home page in a real Chromium browser against a production build and fails on any Content Security Policy violation. For `admin`, the test SHALL also show that a request without a valid Access token is refused and that one with a valid test token is served.

#### Scenario: Smoke test passes

- **WHEN** the root `test:e2e` task runs
- **THEN** for each app a browser loads the home page from a production build and finds the app's heading, with `admin` loaded using a valid test token

#### Scenario: Smoke test catches a broken page

- **WHEN** an app's home page fails to render
- **THEN** the root `test:e2e` task exits non-zero

#### Scenario: Smoke test catches a policy violation

- **WHEN** an app's home page triggers a Content Security Policy violation in the browser
- **THEN** the root `test:e2e` task exits non-zero

#### Scenario: Admin refuses an anonymous request

- **WHEN** the `admin` smoke test requests the home page without an Access token
- **THEN** it receives HTTP 403 and none of the app's content
