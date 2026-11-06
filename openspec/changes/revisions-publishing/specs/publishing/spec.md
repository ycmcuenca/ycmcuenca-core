# Spec Delta

## Purpose

Defines how an entry's published revision is chosen and moved, how publishing, unpublishing and rolling back reach the published snapshot store that the public site reads, what those snapshots contain, how publish times are kept, and how a failed projection is shown and retried.

## ADDED Requirements

### Requirement: Publish a revision

Publishing SHALL make one existing revision of an entry its published revision, then write the entry's snapshot and its type's index to the published snapshot store. A revision of another entry SHALL be refused.

#### Scenario: First publish

- **WHEN** the owner publishes revision 1 of the unpublished article `hello-world`
- **THEN** the entry's published revision is 1, the snapshot store holds the entry snapshot for `hello-world` with revision 1's title, summary and rendered body, and the article index lists `hello-world`

#### Scenario: Publish a newer revision

- **WHEN** the owner publishes revision 3 of an article whose published revision is 2
- **THEN** the entry snapshot shows revision 3's content, and revisions 1 to 3 are unchanged

#### Scenario: Revision of another entry

- **WHEN** a publish names a revision that belongs to a different entry
- **THEN** the publish is refused with an error, and nothing changes

### Requirement: Roll back to an earlier revision

Rolling back SHALL publish an earlier revision of the same entry, exactly as publishing it would.

#### Scenario: Roll back

- **WHEN** the owner rolls back an article from revision 3 to revision 1
- **THEN** the entry snapshot shows revision 1's content and the published revision is 1

### Requirement: Unpublish an entry

Unpublishing SHALL clear the entry's published revision, remove its entry snapshot from the store and remove it from its type's index. Its revisions SHALL remain.

#### Scenario: Unpublish

- **WHEN** the owner unpublishes the published article `hello-world`
- **THEN** the snapshot store has no entry snapshot for `hello-world`, the article index does not list it, and all its revisions still exist

### Requirement: The index lists every published entry

After any publish, rollback, unpublish or retry, the type's index SHALL list exactly the entries of that type that have a published revision, newest first publish first, built from the database of record.

#### Scenario: Two published articles

- **WHEN** article `a` was first published before article `b` and both are published
- **THEN** the article index lists `b` and then `a`, each with its published title, summary and first-publish time

#### Scenario: Index after unpublish

- **WHEN** article `a` is unpublished while `b` stays published
- **THEN** the article index lists only `b`

### Requirement: Publish times

An entry's first-publish time SHALL be set to the current UTC time on its first publish and SHALL never change afterwards, including after unpublishing and publishing again. Its last-publish time SHALL be the time of its most recent publish or rollback.

#### Scenario: Republish keeps the first-publish time

- **WHEN** an article first published on 2026-11-01 is unpublished and published again on 2026-11-05
- **THEN** its snapshot's first-publish time is 2026-11-01 and its last-publish time is 2026-11-05

### Requirement: Failed projection is visible and retryable

Moving the published revision and marking the entry as not yet projected SHALL happen in one database write. The mark SHALL be cleared only after the entry snapshot and the index are both written. While the mark is set, `admin` SHALL show the entry as published but not live and SHALL offer a retry, which repeats the projection of the current published revision.

#### Scenario: Snapshot store fails

- **WHEN** the owner publishes a revision and the snapshot store write fails
- **THEN** the entry's published revision has moved, `admin` shows "published, not live" with a retry button, and the publish reports the failure

#### Scenario: Retry succeeds

- **WHEN** the owner presses retry on an entry marked not live and the snapshot store is available
- **THEN** the entry snapshot and index are written, and `admin` shows the entry as live

#### Scenario: Retry after unpublish

- **WHEN** the owner retries an entry whose unpublish failed to reach the snapshot store
- **THEN** its entry snapshot is removed, the index no longer lists it, and the mark is cleared

### Requirement: Projection is idempotent

Projecting the same published state twice SHALL leave the snapshot store in the same state as projecting it once.

#### Scenario: Double retry

- **WHEN** a retry runs twice for the same published revision
- **THEN** the entry snapshot and the index are identical after each run

### Requirement: Slug fixed after first publish

An entry's slug SHALL be changeable only while the entry has never been published.

#### Scenario: Change before publish

- **WHEN** the owner changes the slug of a never-published article
- **THEN** the change succeeds

#### Scenario: Change after publish

- **WHEN** the owner tries to change the slug of an article that has been published at least once
- **THEN** the change is refused with a message that published slugs cannot change
