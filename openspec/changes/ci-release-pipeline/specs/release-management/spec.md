# Spec Delta

## Purpose

Defines how each deployable app's version, changelog, git tag and GitHub Release are derived from the Conventional Commits that land on `main`, so that releases need no hand-edited version numbers.

## ADDED Requirements

### Requirement: Independent version per app

Each deployable app (`welcome`, `admin`) SHALL have its own semantic version, changelog, git tag and GitHub Release. Internal packages SHALL NOT be versioned or released.

#### Scenario: Tag naming

- **WHEN** `welcome` is released at version 0.2.0
- **THEN** the git tag is `welcome-v0.2.0` and the GitHub Release has the same name

#### Scenario: Package-only change

- **WHEN** a `feat:` commit touches only files under `packages/`
- **THEN** no app's version is proposed for a bump

### Requirement: Versions follow commit types

An app's next version SHALL be computed from the Conventional Commits that touched that app's directory since its last release. While an app is below 1.0.0, `feat` SHALL bump the minor version and a breaking change SHALL also bump the minor version. `fix` and `perf` SHALL bump the patch version.

#### Scenario: Feature before 1.0

- **WHEN** `admin` is at 0.1.0 and a `feat(admin): …` commit lands
- **THEN** the proposed next version of `admin` is 0.2.0

#### Scenario: Breaking change before 1.0

- **WHEN** `welcome` is at 0.3.1 and a commit marked as breaking (`feat!:` or a `BREAKING CHANGE:` footer) touches `apps/welcome`
- **THEN** the proposed next version of `welcome` is 0.4.0

#### Scenario: Fix

- **WHEN** `welcome` is at 0.4.0 and a `fix(welcome): …` commit lands
- **THEN** the proposed next version of `welcome` is 0.4.1

#### Scenario: Non-releasing commit types

- **WHEN** only `chore`, `ci`, `docs`, `test`, `style` or `refactor` commits touched an app since its last release
- **THEN** no release is proposed for that app

### Requirement: Fresh versioning start

Release history SHALL start after this change. Commits from before this change SHALL NOT appear in any app's first changelog. The first releasing change to an app currently at 0.0.1 SHALL produce version 0.1.0 for a feature, or 0.0.2 for a fix.

#### Scenario: First feature release

- **WHEN** the first `feat(welcome): …` commit after this change lands
- **THEN** the proposed version of `welcome` is 0.1.0 and its changelog lists only commits made after this change

### Requirement: Release proposals as one reviewable pull request

Pending releases SHALL be proposed in a single release pull request that bumps every app with releasable changes and updates their changelogs. The pull request SHALL stay up to date as more commits land. Nothing SHALL be released until the owner merges it.

#### Scenario: Both apps changed

- **WHEN** releasable commits touched both `welcome` and `admin` since their last releases
- **THEN** one open release pull request bumps both apps' versions and changelogs

#### Scenario: Release pull request kept current

- **WHEN** another releasable commit lands on `main` while the release pull request is open
- **THEN** the same release pull request is updated to include it

#### Scenario: Release pull request passes the same gate

- **WHEN** the release pull request is opened or updated
- **THEN** the pull-request CI runs on it once the owner approves the run, and it cannot merge until the aggregate check passes

### Requirement: Merging a release pull request publishes releases

When a release pull request is merged, each app it bumped SHALL receive a git tag and a published GitHub Release whose notes match its new changelog entry.

#### Scenario: Release published

- **WHEN** the owner merges a release pull request that bumps `admin` to 0.1.0
- **THEN** the tag `admin-v0.1.0` exists on `main` and a GitHub Release `admin-v0.1.0` is published with the 0.1.0 changelog entry

#### Scenario: Release events for later automation

- **WHEN** a GitHub Release for an app is published
- **THEN** the release automation exposes which app paths were released, for later workflows (such as deployment) to consume

### Requirement: Release automation uses no long-lived credentials

Release automation SHALL use only the workflow's built-in, short-lived repository token, with write access limited to what proposing and publishing releases requires.

#### Scenario: No stored release secret

- **WHEN** the repository's Actions secrets are listed
- **THEN** no secret exists for release automation
