# Spec Delta

## Purpose

Defines which public-site responses are cached at the edge and for how long, how they are tagged, how publishing purges exactly the affected pages, what happens when a purge fails, and who can purge.

## ADDED Requirements

### Requirement: Public pages are cached with a bounded lifetime

Successful responses of the home page, article pages, the sitemap and the feed SHALL be cached by the edge for at most 60 seconds, SHALL be served stale for no longer than 300 seconds after that while they are refreshed, and SHALL tell browsers not to reuse them without revalidating.

#### Scenario: Browser-facing header

- **WHEN** a visitor requests a published article page
- **THEN** the response carries `Cache-Control: public, max-age=0` and no edge-only cache header

#### Scenario: Repeated request

- **WHEN** the same article page is requested twice within 60 seconds in production
- **THEN** the second response is served from the edge cache without running SvelteKit and without reading KV; only the thin `default` entrypoint runs, to decide that the request is cacheable

### Requirement: Other responses are never cached

Every public-site response other than a successful home, article, sitemap or feed response, including 404 and error responses, SHALL carry `Cache-Control: no-store`.

#### Scenario: Unknown article

- **WHEN** `/en/articles/does-not-exist` is requested twice
- **THEN** both responses carry `Cache-Control: no-store` and are produced by the site's code

### Requirement: Unreleased versions never fill the public cache

Only requests to the production host SHALL be served through the cache. Requests to preview or version URLs SHALL be served without reading or filling it.

#### Scenario: Preview request

- **WHEN** the owner requests an article on a `welcome` preview URL
- **THEN** the response is produced by that version's code, and the production page's cached copy is unchanged

### Requirement: Responses are tagged by what they contain

Each cached response SHALL carry tags naming its content: an article page its entry, its type and its locale; the home page, the sitemap and the feed the type's index, the type and the locale. Visitors SHALL NOT see the tags.

#### Scenario: Article tags

- **WHEN** the article page of `hello-world` is cached
- **THEN** it is tagged `entry:article:hello-world`, `type:article` and `locale:en`

#### Scenario: Tags hidden

- **WHEN** a visitor inspects a public response's headers
- **THEN** no cache-tag header is present

### Requirement: Publishing purges exactly the affected pages

After a publish, rollback, unpublish or retry has written the snapshot store, `admin` SHALL purge the entry's tag and its type's index tag, and no other tag.

#### Scenario: Publish purges

- **WHEN** the owner publishes a new revision of `hello-world` while its page, the home page and the article `other` are cached
- **THEN** the next requests for `hello-world` and the home page are served fresh with the new content, and `other` is still served from the cache

#### Scenario: Unpublish purges

- **WHEN** the owner unpublishes `hello-world` while its page is cached
- **THEN** the next request for its page receives HTTP 404

### Requirement: A failed purge does not fail the publish

If the purge cannot be performed, the publish SHALL still succeed and report the entry as live, and the failure SHALL be logged.

#### Scenario: Purge unavailable

- **WHEN** the owner publishes while the site's purge is unavailable
- **THEN** the entry is live, `admin` reports success, and a warning naming the tags is logged

### Requirement: Only admin can purge

Purging SHALL be possible only through the internal connection from `admin`. No public URL or HTTP method of the public site SHALL purge the cache.

#### Scenario: Public purge attempt

- **WHEN** a visitor sends a `POST`, `PURGE` or `DELETE` request to any public-site URL
- **THEN** no cached response is removed
