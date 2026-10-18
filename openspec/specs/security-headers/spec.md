# security-headers Specification

## Purpose

Defines the HTTP security headers and the Content Security Policy that every response of `welcome` and `admin` carries, so both apps are hardened from their first deploy.

## Requirements

### Requirement: Baseline security headers on every response

Every response from either app SHALL carry `Strict-Transport-Security` with a max-age of at least one year, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that disables camera, microphone and geolocation. This covers rendered pages, error responses and static assets.

#### Scenario: Rendered page

- **WHEN** the home page of either app is requested
- **THEN** the response carries all four headers

#### Scenario: Static asset

- **WHEN** a static asset of either app is requested, such as `robots.txt` or a built script under `/_app/immutable/`
- **THEN** the response carries all four headers

#### Scenario: Error response

- **WHEN** a path that does not exist is requested from either app
- **THEN** the 404 response carries all four headers

### Requirement: Enforced Content Security Policy

Every HTML page from either app SHALL carry an enforced `Content-Security-Policy` that allows scripts, styles, images, fonts and connections from the app's own origin only, allows inline scripts and styles only by hash, forbids plugins, restricts `base-uri` and form targets to the app's origin, and forbids framing by any origin.

#### Scenario: Policy present

- **WHEN** the home page of either app is requested
- **THEN** the response carries a `Content-Security-Policy` header, not only a report-only one, with `default-src 'self'`, `object-src 'none'` and `frame-ancestors 'none'`

#### Scenario: No violations on the app's own pages

- **WHEN** the home page of either app is loaded in a browser
- **THEN** the browser reports no Content Security Policy violation

#### Scenario: Injected script blocked

- **WHEN** a page contains an inline script that the app did not generate
- **THEN** the browser does not execute it

#### Scenario: Framing refused

- **WHEN** another origin tries to embed either app in a frame
- **THEN** the browser refuses to render it

### Requirement: Policy stays cacheable

The Content Security Policy SHALL NOT depend on a per-response value such as a nonce, so a cached page stays valid for every visitor who receives it.

#### Scenario: Identical policies

- **WHEN** the same page of either app is requested twice
- **THEN** both responses carry the same `Content-Security-Policy` value

### Requirement: Admin is not indexed

Every response from `admin` SHALL carry `X-Robots-Tag: noindex, nofollow`.

#### Scenario: Admin page

- **WHEN** any `admin` page or asset is requested
- **THEN** the response carries `X-Robots-Tag: noindex, nofollow`
