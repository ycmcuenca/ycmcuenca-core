# Spec Delta

## Purpose

Defines what visitors can read on the public site: the article list and article pages served from published snapshots, the response for unknown or unreadable content, and the search-engine and feed metadata the site publishes.

## ADDED Requirements

### Requirement: Article pages

The public site SHALL serve each published article at `/en/articles/{slug}`. The page SHALL show the article's title as its main heading, its first-publish date, its last-update date when it differs from the first-publish date, and its rendered body blocks in order.

#### Scenario: Published article

- **WHEN** a visitor requests `/en/articles/hello-world` after `hello-world` was published
- **THEN** the response is HTTP 200 and the page shows the published title as its heading, the first-publish date and the rendered body

#### Scenario: Updated article

- **WHEN** an article first published on 2026-11-01 was last published on 2026-11-05
- **THEN** its page shows both dates

### Requirement: Unknown articles

A request for an article that is not published SHALL receive HTTP 404 with the site's error page.

#### Scenario: Never published

- **WHEN** a visitor requests `/en/articles/does-not-exist`
- **THEN** the response is HTTP 404

#### Scenario: Unpublished

- **WHEN** a visitor requests an article that was published and then unpublished
- **THEN** the response is HTTP 404

### Requirement: Home page lists published articles

The home page SHALL keep the heading `Welcome` and list every published article from the index, newest first publish first, each with its title linking to its page, its first-publish date and its summary. With no published article it SHALL say "No articles yet.".

#### Scenario: Two articles

- **WHEN** articles `a` and then `b` were published and a visitor opens the home page
- **THEN** the page lists `b` and then `a`, each linking to `/en/articles/{slug}`

#### Scenario: Nothing published

- **WHEN** no article is published and a visitor opens the home page
- **THEN** the page shows the heading `Welcome` and the text "No articles yet."

### Requirement: Unreadable snapshots are not shown

If an article snapshot or the index has an unsupported version or fails validation, the site SHALL log one error-level line naming the key and the problem, and SHALL answer as if the content were not published. It SHALL NOT render part of it.

#### Scenario: Future snapshot version

- **WHEN** the snapshot for `hello-world` has snapshot version 2 and a visitor requests its page
- **THEN** the response is HTTP 404 and one error-level log line names the key and version 2

#### Scenario: Broken index

- **WHEN** the index fails validation and a visitor opens the home page
- **THEN** the page shows "No articles yet." and one error-level log line names the index key

### Requirement: The public site reads only published snapshots

The public site SHALL read content only from the published snapshot store. It SHALL NOT connect to the database of record and SHALL NOT write to the snapshot store.

#### Scenario: Database unavailable

- **WHEN** the database of record is unreachable and a visitor requests a published article
- **THEN** the page is served from its snapshot as usual

### Requirement: Canonical and language links

Every page of the public site SHALL carry a canonical link to its absolute URL on the configured site origin, an `hreflang="en"` alternate link and an `hreflang="x-default"` alternate link to that same URL, and a meta description. An article's description SHALL be its summary.

#### Scenario: Article metadata

- **WHEN** a visitor requests `/en/articles/hello-world`
- **THEN** the page's canonical link is `<site origin>/en/articles/hello-world`, both alternate links point to it, and the meta description is the article's summary

### Requirement: Sitemap

The public site SHALL serve `/sitemap.xml` as an XML sitemap listing the home page and every published article's absolute URL, each article with its last-update date. `robots.txt` SHALL name the sitemap's absolute URL.

#### Scenario: Sitemap lists articles

- **WHEN** two articles are published and `/sitemap.xml` is requested
- **THEN** the response is XML listing the home page and both article URLs

#### Scenario: Robots points to the sitemap

- **WHEN** `/robots.txt` is requested
- **THEN** it contains a `Sitemap:` line with the sitemap's absolute URL

### Requirement: Atom feed

The public site SHALL serve an Atom feed of published articles at `/en/feed.xml`, newest first, each entry with its title, its absolute URL as link and id, its summary and its first-publish time. Every page SHALL link to the feed for autodiscovery.

#### Scenario: Feed entries

- **WHEN** two articles are published and `/en/feed.xml` is requested
- **THEN** the response is an Atom feed with two entries in newest-first order

#### Scenario: Empty feed

- **WHEN** no article is published and `/en/feed.xml` is requested
- **THEN** the response is a valid Atom feed with no entries
