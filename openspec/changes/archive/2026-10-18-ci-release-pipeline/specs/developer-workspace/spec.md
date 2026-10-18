# Spec Delta

## MODIFIED Requirements

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
