# ci-checks Specification

## Purpose

Defines the checks every proposed change to `main` must pass on a clean machine, how their result gates merging, and the security rules the CI workflows themselves follow in a public repository.

## Requirements

### Requirement: Checks run on every pull request and on main

CI SHALL run for every pull request targeting `main`, on every update to it, and for every push to `main`. A newer run for the same pull request SHALL cancel the run it supersedes.

#### Scenario: Pull request opened

- **WHEN** a pull request targeting `main` is opened or receives new commits
- **THEN** a CI run starts for the pull request's latest commit

#### Scenario: Superseded run

- **WHEN** new commits are pushed to a pull request while an earlier CI run for it is still in progress
- **THEN** the earlier run is cancelled and only the latest commit's run reports a result

#### Scenario: Push to main

- **WHEN** a commit lands on `main`
- **THEN** a CI run starts for that commit

### Requirement: Clean-machine quality gate

Each CI run SHALL install dependencies from the committed lockfile without modifying it, using the repository's pinned toolchain versions. It SHALL then run format check, lint, type check, build, unit tests and the end-to-end smoke tests. Any failure SHALL fail the run.

#### Scenario: Lockfile out of date

- **WHEN** a pull request changes a manifest without updating the lockfile in a way that requires a lockfile change
- **THEN** the dependency install step fails and the run fails

#### Scenario: Toolchain from the pins

- **WHEN** CI sets up its tools
- **THEN** the Bun and Node.js versions it uses are the ones declared in the repository's committed pin files

#### Scenario: Failing check fails the run

- **WHEN** any one of format check, lint, type check, build, unit tests or end-to-end smoke tests fails
- **THEN** the CI run reports failure and names the failing check

### Requirement: Every commit follows Conventional Commits

CI SHALL validate the message of every commit a pull request adds, using the same rules as the local commit-msg hook. A non-conforming commit SHALL fail the run.

#### Scenario: One bad commit among good ones

- **WHEN** a pull request contains three commits and one of them has the message `wip`
- **THEN** the commit-message check fails and identifies that commit

#### Scenario: Hook bypassed locally

- **WHEN** a contributor commits `updated stuff` with local hooks bypassed and opens a pull request
- **THEN** the commit-message check fails

### Requirement: Specifications stay valid

CI SHALL validate all OpenSpec specs and active changes in strict mode. A validation error SHALL fail the run.

#### Scenario: Invalid spec delta

- **WHEN** a pull request adds a requirement without any scenario
- **THEN** the specification check fails

### Requirement: Workflow files are linted and audited

CI SHALL lint every workflow file for syntax and expression errors and audit it for known GitHub Actions security weaknesses. Any finding of either kind SHALL fail the run.

#### Scenario: Template injection

- **WHEN** a pull request adds a workflow step that interpolates an attacker-controllable value (such as a pull request title) directly into a shell command
- **THEN** the workflow audit fails the run

#### Scenario: Unpinned action

- **WHEN** a pull request references an action by tag or branch instead of a full commit SHA
- **THEN** the workflow audit fails the run

### Requirement: Single aggregate result

CI SHALL report one aggregate check that succeeds only when every other check in the run has succeeded. Branch protection requires this aggregate check, so adding or renaming individual checks needs no protection change.

#### Scenario: All checks pass

- **WHEN** every check in a run succeeds
- **THEN** the aggregate check succeeds

#### Scenario: A check fails or is skipped unexpectedly

- **WHEN** any check in a run fails, is cancelled, or does not run because a check it depends on failed
- **THEN** the aggregate check fails

### Requirement: Least-privilege workflows

Every workflow SHALL declare explicit token permissions. The default SHALL be no permissions, with each job granted only what it needs. Repository checkouts SHALL NOT persist credentials. Every third-party or GitHub-authored action SHALL be referenced by full commit SHA; container images used through `docker://` SHALL be pinned by `sha256` digest.

#### Scenario: Read-only CI

- **WHEN** the pull-request CI workflow runs
- **THEN** its jobs hold at most read access to repository contents and no write access to any scope

#### Scenario: Pinned references

- **WHEN** any workflow file in the repository is inspected
- **THEN** every `uses:` reference to an action is a 40-character commit SHA followed by a comment naming its version, and every `docker://` container image is pinned by a `sha256` digest whose tag names the version

### Requirement: Untrusted code never receives secrets

CI SHALL NOT use workflow triggers that run pull-request code with access to repository secrets or a write-scoped token.

#### Scenario: Fork pull request

- **WHEN** a pull request from a fork runs CI
- **THEN** the run receives no repository secrets and only a read-only token

### Requirement: Cached results are reused safely

CI SHALL reuse build-system results and browser downloads from earlier runs when inputs are unchanged. A cache miss SHALL only cost time, never change results.

#### Scenario: Unchanged rerun

- **WHEN** CI runs for a commit whose inputs match a previously cached run
- **THEN** cached task results are restored and those tasks are not re-executed

#### Scenario: Cache unavailable

- **WHEN** no cache entry exists or cache restore fails
- **THEN** every task executes and the run's result is the same as with a cache
