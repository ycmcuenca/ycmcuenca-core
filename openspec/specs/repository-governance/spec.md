# repository-governance Specification

## Purpose

Defines the rules GitHub enforces on this public repository (how `main` changes, which merge methods exist, what Actions may run, which security features are on), how those settings are kept as reviewable code, and how dependencies stay current.

## Requirements

### Requirement: Main changes only through checked pull requests

`main` SHALL accept changes only through pull requests whose aggregate CI check, reported by GitHub Actions, has passed on a branch up to date with `main`. Nobody, including repository administrators, SHALL be able to bypass this rule.

#### Scenario: Direct push rejected

- **WHEN** anyone, including the repository owner, pushes a commit directly to `main`
- **THEN** GitHub rejects the push

#### Scenario: Failing check blocks merge

- **WHEN** a pull request's aggregate check has failed or not yet completed
- **THEN** the pull request cannot be merged

#### Scenario: Stale branch blocks merge

- **WHEN** `main` has moved on since a pull request's checks passed
- **THEN** the pull request cannot be merged until it is updated with `main` and its checks pass again

#### Scenario: Spoofed status ignored

- **WHEN** a commit status with the aggregate check's name is reported by anything other than GitHub Actions
- **THEN** it does not satisfy the merge requirement

#### Scenario: Solo owner can merge

- **WHEN** the owner's own pull request has a passing aggregate check and is up to date
- **THEN** the owner can merge it without another person's approval

### Requirement: Linear history through rebase merges

Pull requests SHALL be merged by rebasing only, and `main` SHALL keep a linear history. Merged head branches SHALL be deleted automatically.

#### Scenario: Merge methods offered

- **WHEN** the owner opens the merge menu on a pull request
- **THEN** rebase merging is the only method offered

#### Scenario: History rewrite rejected

- **WHEN** anyone force-pushes to `main` or tries to delete it
- **THEN** GitHub rejects the operation

#### Scenario: Branch cleanup

- **WHEN** a pull request is merged
- **THEN** its head branch is deleted

### Requirement: Actions must be pinned to commit SHAs

The repository SHALL only run actions referenced by full commit SHA, enforced by GitHub repository settings in addition to CI's workflow audit.

#### Scenario: Tag-referenced action refused

- **WHEN** a workflow references an action by a tag such as `@v7`
- **THEN** GitHub refuses to run that workflow job

### Requirement: Security features enabled

The repository SHALL have secret scanning, secret push protection, dependency vulnerability alerts and code scanning with GitHub's default configuration turned on.

#### Scenario: Security settings inspected

- **WHEN** the repository's security settings are read through the GitHub API
- **THEN** secret scanning, push protection, vulnerability alerts and code-scanning default setup are all reported as enabled

### Requirement: Settings defined as code

All settings in this capability SHALL be defined in committed files and applied by one committed, idempotent script. Running the script again on an already configured repository SHALL change nothing. Running it on a drifted repository SHALL restore the committed settings.

#### Scenario: Re-run is a no-op

- **WHEN** the owner runs the settings script twice in a row
- **THEN** the second run reports no changes and the settings are identical

#### Scenario: Drift corrected

- **WHEN** a setting covered by the script is changed by hand in the GitHub UI and the owner runs the script again
- **THEN** the setting returns to its committed value

#### Scenario: Settings reviewed like code

- **WHEN** a protection rule needs to change
- **THEN** the change is made by a pull request that edits the committed settings files

### Requirement: Dependency updates are proposed automatically

Updates to npm dependencies, the lockfile and GitHub Actions SHALL be proposed automatically as pull requests. They SHALL be grouped by ecosystem, opened on a weekly schedule after a minimum release age, tracked on a dependency dashboard issue, and kept exactly pinned. Vulnerability fixes SHALL be proposed outside the weekly schedule. No update SHALL be merged without the owner.

#### Scenario: Grouped update

- **WHEN** new patch versions of several SvelteKit-related packages are published
- **THEN** one pull request updates all of them together

#### Scenario: Exact pins preserved

- **WHEN** an update pull request changes a dependency version
- **THEN** the new version is written as an exact version, not a range

#### Scenario: Action updates keep SHA pins

- **WHEN** a pinned action has a new release
- **THEN** the update pull request replaces the commit SHA and updates the version comment

#### Scenario: Vulnerability fix

- **WHEN** a dependency has a published security advisory with a fixed version
- **THEN** an update pull request is opened without waiting for the weekly schedule

#### Scenario: No automerge

- **WHEN** an update pull request's checks all pass
- **THEN** it stays open until the owner merges it

### Requirement: Update commits signal release impact

An update to a library bundled into an app's deployed output, and any vulnerability fix, SHALL be committed as a `fix(deps)` Conventional Commit. An update to development tooling or GitHub Actions SHALL be committed as `chore(deps)`.

#### Scenario: Bundled runtime library updated

- **WHEN** an update pull request bumps `svelte` or a `@sveltejs/*` package in both apps
- **THEN** its commit type is `fix(deps)`, so each app it touches is proposed for a patch release

#### Scenario: Tooling updated

- **WHEN** an update pull request bumps only ESLint, Prettier, Vitest, Playwright, Turborepo, Wrangler or a GitHub Action
- **THEN** its commit type is `chore(deps)` and no app release is proposed

#### Scenario: Vulnerability fix in tooling

- **WHEN** an update pull request fixes a security advisory in a development tool
- **THEN** its commit type is `fix(deps)`
