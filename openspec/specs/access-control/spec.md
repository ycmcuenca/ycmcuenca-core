# access-control Specification

## Purpose

Defines who can reach `admin` and unreleased versions of `welcome`, how `admin` verifies a Cloudflare Access sign-in itself, how local development and tests work without any production bypass, and how the Access configuration is kept as code.

## Requirements

### Requirement: Admin is reachable only through Access

Every URL that serves `admin` (production, preview and version URLs) SHALL require a Cloudflare Access sign-in. Only the owner's email address SHALL be allowed, signing in with a one-time PIN.

#### Scenario: Anonymous visitor

- **WHEN** a visitor without an Access session requests any `admin` URL, including a static asset or a version URL
- **THEN** they are sent to the Access sign-in and receive none of the app's content

#### Scenario: Owner signs in

- **WHEN** the owner enters their email at the Access sign-in and submits the one-time PIN they receive
- **THEN** the `admin` page loads

#### Scenario: Other email

- **WHEN** someone requests a PIN for any email address other than the owner's
- **THEN** Access does not grant a session

### Requirement: Unreleased welcome versions are owner-only

Preview and version URLs of `welcome` SHALL require the same Access sign-in as `admin`. Production `welcome` SHALL stay public.

#### Scenario: Version URL

- **WHEN** a visitor without an Access session requests a `welcome` version or preview URL
- **THEN** they are sent to the Access sign-in

#### Scenario: Production stays public

- **WHEN** any visitor requests `https://welcome.ycmcuenca.workers.dev`
- **THEN** the page loads without a sign-in

### Requirement: Admin verifies the Access token itself

Every request that reaches `admin`'s code SHALL carry an Access token whose signature verifies against the configured team's public keys, whose issuer is that team and whose audience includes the configured application audience. Otherwise `admin` SHALL respond 403 without rendering the app. If verification cannot complete, the request SHALL be refused.

#### Scenario: Missing token

- **WHEN** a request reaches `admin`'s code without an Access token, for example because Access was disabled by mistake
- **THEN** the response is 403 and contains none of the app's content

#### Scenario: Wrong audience

- **WHEN** the token is validly signed by the team but was issued for a different Access application
- **THEN** the response is 403

#### Scenario: Forged or expired token

- **WHEN** the token's signature does not verify, or the token has expired
- **THEN** the response is 403

#### Scenario: Keys unavailable

- **WHEN** the team's public keys cannot be fetched
- **THEN** the response is 403 and the failure is logged

#### Scenario: Missing configuration

- **WHEN** the deployed `admin` has no team domain or audience configured
- **THEN** every request receives 403

### Requirement: Production trust settings are fixed in reviewed configuration

`admin`'s team domain and application audience SHALL be committed in its Workers configuration. The committed team domain SHALL be an `https://<team>.cloudflareaccess.com` origin, and a deploy SHALL refuse to proceed otherwise. They SHALL NOT be changeable without a reviewed change.

#### Scenario: Non-Access issuer committed

- **WHEN** the committed team domain is not an `https://<team>.cloudflareaccess.com` origin
- **THEN** the unit tests and the deploy both fail, and nothing is deployed

### Requirement: No sign-in bypass in production

Only `admin`'s local development server SHALL skip the Access check. The skip SHALL be decided at build time, so no runtime setting, request header or variable can enable it in a production build.

#### Scenario: Local development

- **WHEN** a contributor runs the root `dev` task and opens `admin` locally
- **THEN** the page loads without an Access token

#### Scenario: Production build

- **WHEN** a production build of `admin` receives a request without a valid token, whatever headers or variables are set
- **THEN** the response is 403

### Requirement: Access configuration as code

The Access applications and their policies SHALL be defined in committed files and applied by one idempotent script, run by the owner with their own credentials. The script SHALL take the allowed email at run time and never write it to the repository. A check mode SHALL report drift without changing anything.

#### Scenario: Re-run is a no-op

- **WHEN** the owner runs the Access script twice in a row
- **THEN** the second run reports every item unchanged

#### Scenario: Drift detected

- **WHEN** the `admin` policy is changed by hand in the Cloudflare dashboard and the owner runs the script in check mode
- **THEN** it reports the drifted item, changes nothing, and exits non-zero

#### Scenario: Email kept out of the repository

- **WHEN** the repository is searched for the owner's email address after the script has run
- **THEN** it does not appear in any committed file
