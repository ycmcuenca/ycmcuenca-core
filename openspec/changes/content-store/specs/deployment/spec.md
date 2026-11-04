# Spec Delta

## ADDED Requirements

### Requirement: Migrations run before admin is deployed

A deploy of `admin` SHALL apply the released commit's pending database migrations, using a credential available only to production deploy jobs, before the new worker is uploaded. If a migration fails, the deploy SHALL stop and the running worker SHALL stay as it was.

#### Scenario: New migration released

- **WHEN** an `admin` release whose commit adds a migration is deployed
- **THEN** the migration is applied before `wrangler deploy` runs

#### Scenario: Migration fails

- **WHEN** a migration fails during an `admin` deploy
- **THEN** the run fails, and no new `admin` version is uploaded

#### Scenario: Rollback deploy

- **WHEN** the owner redeploys an older `admin` release whose commit has fewer migrations than the database
- **THEN** no migration is applied or undone, and the older worker is deployed

#### Scenario: Welcome deploy

- **WHEN** `welcome` is deployed
- **THEN** no migration runs and no database credential is used

### Requirement: Runtime privileges are checked on deploy

After migrations and before the upload, a deploy of `admin` SHALL check that the runtime database role has exactly the expected rights, and SHALL stop if it does not.

#### Scenario: Privilege drift

- **WHEN** the runtime role was granted an extra right by hand and `admin` is deployed
- **THEN** the run fails before the upload and names the unexpected right
