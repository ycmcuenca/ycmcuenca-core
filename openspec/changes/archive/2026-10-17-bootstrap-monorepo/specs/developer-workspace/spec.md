# Spec Delta

## Purpose

Defines how the `ycmcuenca-core` monorepo is laid out and operated, so that any contributor (human or agent) and CI can install, build, check, test and commit in one repeatable, public-safe way.

## ADDED Requirements

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

The workspace SHALL contain the apps `welcome` and `admin`. Each SHALL render a placeholder home page identifying the app. Each SHALL build to Cloudflare Workers output, with a Workers config declaring no bindings.

#### Scenario: Placeholder page

- **WHEN** an app's development server is running and its root URL is requested
- **THEN** the response is an HTML page with HTTP 200 whose heading names the app (`welcome` or `admin`)

#### Scenario: Workers build output

- **WHEN** the root `build` task runs
- **THEN** each app produces a Workers entry script and static assets directory referenced by its Workers config

#### Scenario: No cloud coupling yet

- **WHEN** either app's Workers config is inspected
- **THEN** it declares no KV, R2, database, service or other bindings and no routes or custom domains

### Requirement: Unit test harness

Every workspace member that contains source code SHALL be able to run unit tests through the root `test` task. Each app SHALL ship at least one passing unit test.

#### Scenario: Unit tests run from root

- **WHEN** the root `test` task runs
- **THEN** unit tests of every member execute and the task fails if any test fails

### Requirement: End-to-end smoke tests

Each app SHALL have an end-to-end smoke test that loads its home page in a real Chromium browser against a production build.

#### Scenario: Smoke test passes

- **WHEN** the root `test:e2e` task runs
- **THEN** for each app a browser loads the home page from a production build and finds the app's heading

#### Scenario: Smoke test catches a broken page

- **WHEN** an app's home page fails to render
- **THEN** the root `test:e2e` task exits non-zero

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

Local secret files and environment files SHALL be ignored by git. The repository SHALL contain no credentials, tokens or connection strings.

#### Scenario: Local secrets ignored

- **WHEN** a contributor creates `.dev.vars` or `.env` in any app
- **THEN** `git status` does not list the file

#### Scenario: Build artifacts ignored

- **WHEN** the root `build`, `test` or `test:e2e` tasks have run
- **THEN** `git status` lists no generated build output, cache, test report or downloaded browser files

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
