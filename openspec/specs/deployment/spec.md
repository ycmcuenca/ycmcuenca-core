# deployment Specification

## Purpose

Defines how released apps reach production on Cloudflare Workers: the release-driven and manual deploy paths, where deploy credentials live and which runs can use them, and how each deploy is verified.

## Requirements

### Requirement: A release deploys exactly the released apps

When a release pull request is merged, each app that received a GitHub Release SHALL be deployed to production from the released commit. Apps without a new release SHALL NOT be deployed.

#### Scenario: One app released

- **WHEN** a merged release pull request releases `welcome` only
- **THEN** `welcome` is deployed and `admin` is not

#### Scenario: Both apps released

- **WHEN** a merged release pull request releases both apps
- **THEN** each app is deployed once, and a failure deploying one does not cancel the other

#### Scenario: No release

- **WHEN** a commit lands on `main` without creating any release
- **THEN** no deploy runs

### Requirement: Deploys build from the released source

A deploy SHALL build the app from the exact commit of its release, installing dependencies from the committed lockfile without modifying it and using the Wrangler version that lockfile pins. A deploy SHALL NOT reuse build caches from other runs.

#### Scenario: Released commit

- **WHEN** `admin-v0.2.0` is deployed
- **THEN** the deployed code is built from the commit tagged `admin-v0.2.0`

#### Scenario: Lockfile drift

- **WHEN** the lockfile does not match the manifests at the released commit
- **THEN** the install fails and nothing is deployed

### Requirement: Manual redeploy of a released version

The owner SHALL be able to start a deploy by hand for any existing app release tag, using the same build, credentials and verification as a release-driven deploy. An input that is not an existing `<app>-v<semver>` tag SHALL be rejected before anything is built.

#### Scenario: Rollback

- **WHEN** the owner starts a manual deploy of `welcome-v0.1.0` while `welcome-v0.2.0` is live
- **THEN** production `welcome` serves the `0.1.0` build after the deploy succeeds

#### Scenario: Invalid tag

- **WHEN** a manual deploy is started with `welcome-latest` or a tag that does not exist
- **THEN** the run fails before building and nothing is deployed

### Requirement: Deploys of one app never overlap

Deploys of the same app SHALL run one at a time, in the order they started. A deploy in progress SHALL NOT be cancelled by a newer one.

#### Scenario: Two deploys queued

- **WHEN** a manual deploy of `admin` starts while a release-driven deploy of `admin` is running
- **THEN** the manual deploy waits until the first one finishes

### Requirement: Deploy credentials are scoped to production deploys

The Cloudflare credentials SHALL be available only to deploy jobs running in the `production` deployment environment from `main`. Pull-request runs, and any workflow job that does not use that environment, SHALL NOT receive them. The API token SHALL be limited to deploying Workers in the one account.

#### Scenario: Pull-request run

- **WHEN** CI runs for any pull request
- **THEN** no Cloudflare credential is available to any of its jobs

#### Scenario: Run from another branch

- **WHEN** a deploy is started by hand from a branch other than `main`
- **THEN** the deploy job cannot access the `production` environment and fails without deploying

#### Scenario: Token scope

- **WHEN** the deploy token is used for anything other than deploying the account's Workers, such as editing Access applications or DNS
- **THEN** the Cloudflare API refuses the request

### Requirement: Workers served on workers.dev

Each app SHALL be served at `<app>.ycmcuenca.workers.dev`. Preview and version URLs SHALL be enabled for both workers, and no route or custom domain SHALL be configured.

#### Scenario: Production URLs

- **WHEN** both apps have been deployed
- **THEN** `https://welcome.ycmcuenca.workers.dev` serves `welcome` and `https://admin.ycmcuenca.workers.dev` serves `admin` behind Access

#### Scenario: No pull-request previews

- **WHEN** a pull request is opened or updated
- **THEN** no preview or version of either worker is uploaded

### Requirement: Each deploy is verified in production

After deploying, the deploy SHALL request the app's production URL. For `welcome`, the check SHALL confirm an HTTP 200 response that carries the required security headers. For `admin`, it SHALL confirm that an anonymous request is refused or sent to sign-in and never receives the app's page. A failed check SHALL fail the run.

#### Scenario: Healthy welcome deploy

- **WHEN** `welcome` has just been deployed
- **THEN** the check receives HTTP 200 with the security headers and the run succeeds

#### Scenario: Admin exposed

- **WHEN** an anonymous check request to production `admin` receives the app's page
- **THEN** the run fails and names the exposure

#### Scenario: Broken deploy

- **WHEN** the deployed `welcome` returns a server error on its home page
- **THEN** the run fails, and the owner can redeploy the previous release tag by hand
