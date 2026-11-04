# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
