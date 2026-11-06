# developer-workspace Specification

## Purpose

Defines how the `ycmcuenca-core` monorepo is laid out and operated, so that any contributor (human or agent) and CI can install, build, check, test and commit in one repeatable, public-safe way.

## Requirements

### Requirement: Workspace layout

The repository SHALL be a single workspace with deployable applications under `apps/` and internal packages under `packages/`. Every workspace member SHALL be private (never published) and named under the `@ycmcuenca/` scope, except deployable apps, which use their bare directory name.

#### Scenario: Members discovered from the layout

- **WHEN** a directory with a manifest is added under `apps/` or `packages/`
- **THEN** a single root install links it into the workspace without editing any other workspace member

#### Scenario: Internal package naming

- **WHEN** an internal package is listed by the workspace
- **THEN** its name starts with `@ycmcuenca/` and it is marked private

### Requirement: Internal dependencies resolve locally

A workspace member that depends on another workspace member SHALL resolve it from the local workspace and never from a public registry.

#### Scenario: Local resolution

- **WHEN** an app depends on `@ycmcuenca/tsconfig`
- **THEN** the installed dependency is a link to `packages/tsconfig` in the same checkout

### Requirement: Pinned toolchain

The repository SHALL declare the exact package-manager version and the supported Node.js major version (24 LTS) in committed files that tooling and CI read.

#### Scenario: Toolchain declared

- **WHEN** a fresh clone is inspected
- **THEN** the package-manager version and the Node.js version are readable from committed files

#### Scenario: Reproducible install

- **WHEN** a contributor installs dependencies on a fresh clone with the pinned toolchain
- **THEN** the install uses the committed lockfile without modifying it

### Requirement: Root task interface

The repository root SHALL expose the tasks `build`, `check`, `lint`, `format`, `test`, `test:e2e` and `dev`. Each task SHALL run across every workspace member that defines it and fail if any member fails.

#### Scenario: Whole-repo check

- **WHEN** a contributor runs the root `check` task
- **THEN** every member's type check runs and the task exits non-zero if any member has a type error

#### Scenario: Unchanged inputs are not rebuilt

- **WHEN** the root `build` task runs twice with no file changes in between
- **THEN** the second run reuses the previous results instead of rebuilding

#### Scenario: Dev servers

- **WHEN** a contributor runs the root `dev` task
- **THEN** both apps start local development servers that keep running until stopped

### Requirement: Shared configuration packages

TypeScript and lint configuration SHALL be defined once in internal packages and consumed by every app and package. Members SHALL NOT duplicate the shared rules.

#### Scenario: One rule change applies everywhere

- **WHEN** a rule is changed in the shared lint configuration package
- **THEN** the next root `lint` run applies the changed rule to every member that consumes it

### Requirement: Strict type checking

All TypeScript in the workspace SHALL be type-checked in strict mode. The type check SHALL include Svelte component files.

#### Scenario: Type error in a component

- **WHEN** a `.svelte` file in either app contains a type error
- **THEN** the root `check` task fails and reports the file

### Requirement: Consistent formatting and linting

The workspace SHALL have one formatting configuration and one lint configuration covering TypeScript, JavaScript, Svelte, JSON, YAML and Markdown files.

#### Scenario: Format check

- **WHEN** a file that does not match the formatting configuration is checked with the root `format` task in check mode
- **THEN** the task fails and names the file

### Requirement: Hello-world applications on the Workers runtime

The workspace SHALL contain the apps `welcome` and `admin`. Each SHALL render a home page whose heading names the app. Each SHALL build to Cloudflare Workers output, with a Workers config that declares only the deployment, observability, variable and binding settings the app's specs require. `welcome` SHALL NOT declare any database binding.

#### Scenario: Placeholder page

- **WHEN** an app's development server is running and its root URL is requested
- **THEN** the response is an HTML page with HTTP 200 whose heading names the app (`welcome` or `admin`)

#### Scenario: Workers build output

- **WHEN** the root `build` task runs
- **THEN** each app produces a Workers entry script and static assets directory referenced by its Workers config

#### Scenario: No cloud coupling yet

- **WHEN** either app's Workers config is inspected
- **THEN** it declares no routes or custom domains, and `welcome`'s declares no database or database-connection binding

### Requirement: Unit test harness

Every workspace member that contains source code SHALL be able to run unit tests through the root `test` task. Each app SHALL ship at least one passing unit test.

#### Scenario: Unit tests run from root

- **WHEN** the root `test` task runs
- **THEN** unit tests of every member execute and the task fails if any test fails

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

### Requirement: Local commit checks

After installing dependencies, git hooks SHALL be active. Pre-commit SHALL format and lint only the staged files. Commit-msg SHALL reject messages that are not Conventional Commits. A failed hook SHALL abort the commit.

#### Scenario: Non-conventional message rejected

- **WHEN** a contributor commits with the message `updated stuff`
- **THEN** the commit is aborted with an explanation of the expected `type(scope): subject` format

#### Scenario: Conventional message accepted

- **WHEN** a contributor commits with the message `feat(welcome): add placeholder page`
- **THEN** the commit-msg check passes

#### Scenario: Staged files only

- **WHEN** a contributor commits one staged file while other files have unstaged changes
- **THEN** only the staged file is formatted and linted, and unstaged changes are left untouched

### Requirement: Public-repository secret hygiene

Local secret files and environment files SHALL be ignored by git. Local tooling state, such as code-index databases, SHALL also be ignored. The repository SHALL contain no credentials, tokens or connection strings.

#### Scenario: Local secrets ignored

- **WHEN** a contributor creates `.dev.vars` or `.env` in any app
- **THEN** `git status` does not list the file

#### Scenario: Build artifacts ignored

- **WHEN** the root `build`, `test` or `test:e2e` tasks have run
- **THEN** `git status` lists no generated build output, cache, test report or downloaded browser files

#### Scenario: Local code index ignored

- **WHEN** a local code-indexing tool creates its database in `.codegraph/` at the repository root
- **THEN** `git status` does not list the directory or its files

### Requirement: Licensing

The repository SHALL include an MIT license for its source code. The license SHALL state that the owner's personal brand assets and published content are not covered by it.

#### Scenario: License present

- **WHEN** the repository root is listed
- **THEN** a `LICENSE` file contains the MIT license text and a clause excluding brand assets and content

### Requirement: Repository entry point

The repository SHALL include a README that states the project's purpose, the required toolchain and the commands to install, develop, check and test.

#### Scenario: Onboarding from README

- **WHEN** a new contributor follows only the README on a machine with the pinned toolchain
- **THEN** they can install dependencies, start both apps and run all checks and tests successfully

### Requirement: Local database

The repository SHALL provide a local Postgres database of the same major version as production, started with one command, and a command that prepares it (roles and migrations). Its connection strings SHALL live only in git-ignored files, with placeholders in a committed example file.

#### Scenario: Fresh local database

- **WHEN** a contributor copies the example environment file, starts the local database and runs the prepare command
- **THEN** the database is migrated, the runtime role exists, and `admin` started locally shows its home page with the entry count

#### Scenario: Connection strings stay local

- **WHEN** a contributor creates the local environment file with real passwords
- **THEN** `git status` does not list it

### Requirement: Integration test task

The repository root SHALL expose a `test:integration` task that runs every member's database integration tests against the database named by the environment, and fails if any test fails. The unit `test` task SHALL NOT need a database.

#### Scenario: Unit tests without a database

- **WHEN** the root `test` task runs with no database available
- **THEN** it passes

#### Scenario: Integration tests

- **WHEN** the root `test:integration` task runs against a prepared database
- **THEN** the database package's integration tests run and the task reports their result

### Requirement: Admin smoke test uses a real database

`admin`'s end-to-end smoke test SHALL run its production build against a prepared local database and show the entry count on the home page.

#### Scenario: Entry count shown

- **WHEN** the `admin` smoke test loads the home page with a valid test token against an empty prepared database
- **THEN** the page shows the heading `Admin` and states that there are 0 entries

### Requirement: Publish path tested across both apps

The root `test:e2e` task SHALL include a test that runs production builds of both apps sharing one local snapshot store, publishes an article in `admin`, reads it on `welcome`, unpublishes it, and sees it disappear from `welcome`.

#### Scenario: Publish then read

- **WHEN** the publish-path test publishes a seeded article in `admin`
- **THEN** `welcome` serves the article's page with its title and lists it on the home page

#### Scenario: Unpublish then gone

- **WHEN** the publish-path test then unpublishes the article in `admin`
- **THEN** `welcome` answers the article's URL with HTTP 404
