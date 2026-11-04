# Spec Delta

## ADDED Requirements

### Requirement: Database tests on a throwaway CI database

Every CI run SHALL create a fresh database branch from a database project used only by CI, apply all migrations to it, check the runtime role's privileges, run the integration tests and delete the branch, also when a step fails. The credential CI uses SHALL reach only that CI project and never the production database.

#### Scenario: Migration breaks

- **WHEN** a pull request adds a migration that fails to apply
- **THEN** the database check fails and names the failing step

#### Scenario: Branch cleaned up

- **WHEN** a database check finishes, whether it passed or failed
- **THEN** the branch it created no longer exists

#### Scenario: Production unreachable

- **WHEN** the CI database credential is used against the production database project
- **THEN** the database provider refuses the request

### Requirement: Pull requests from forks are not accepted

A CI run for a pull request from a fork SHALL fail, with a message stating that pull requests from forks are not accepted. It SHALL still receive no secrets.

#### Scenario: Fork pull request

- **WHEN** a pull request from a fork runs CI
- **THEN** the database check fails with the message that fork pull requests are not accepted, and the aggregate check fails
