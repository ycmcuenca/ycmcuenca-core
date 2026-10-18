# Spec Delta

## ADDED Requirements

### Requirement: Production deployment environment

The repository SHALL have a `production` deployment environment that only runs from `main` and holds the Cloudflare deploy credentials. Its existence and branch restriction SHALL be applied and drift-checked by the committed settings script. The credentials themselves SHALL be set by the owner and never committed.

#### Scenario: Environment applied

- **WHEN** the owner runs the settings script on a repository without the environment
- **THEN** the `production` environment exists afterwards and allows deployments only from `main`

#### Scenario: Branch restriction drift

- **WHEN** the environment's branch restriction is widened by hand and the owner runs the settings script in check mode
- **THEN** it reports the environment as drifted and exits non-zero

#### Scenario: Credentials not in the repository

- **WHEN** the repository's files are inspected
- **THEN** no Cloudflare token appears in them, and the settings script reports whether the environment's secret is set without reading its value
