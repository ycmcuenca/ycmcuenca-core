# Spec Delta

## Purpose

Defines how the CMS stores entries and their append-only revisions in its database of record, which rights the running app has on that database, how the schema changes over time, and that a save is visible to the next read.

## ADDED Requirements

### Requirement: Entries have a unique address

Every entry SHALL have an id, a content type and a slug. No two entries of the same type SHALL share a slug.

#### Scenario: Create an entry

- **WHEN** an article entry is created with the slug `hello-world` and valid content
- **THEN** the entry exists with a new id, the type `article` and the slug `hello-world`, and its first revision is number 1

#### Scenario: Duplicate slug

- **WHEN** a second article entry is created with the slug `hello-world`
- **THEN** the creation fails with an error naming the slug, and no entry or revision is stored

### Requirement: Revisions are append-only

Saving an entry's content SHALL add a new revision numbered one higher than the entry's latest revision. A stored revision SHALL never change or disappear, and the running app SHALL lack the database rights to update or delete one.

#### Scenario: Save twice

- **WHEN** content is saved twice for an entry that has one revision
- **THEN** the entry has revisions 1, 2 and 3, and revision 1 still holds its original content

#### Scenario: Update attempt by the app

- **WHEN** the running app's database role tries to update or delete a revision
- **THEN** the database refuses with a permission error

### Requirement: Stored content is versioned and validated

Every revision SHALL store content that passed the content model's validation, together with its schema version. Content read back SHALL go through the content model's versioned reader.

#### Scenario: Invalid content refused

- **WHEN** content that fails validation is saved
- **THEN** nothing is stored and the validation errors are returned

#### Scenario: Read back

- **WHEN** a stored revision is read
- **THEN** its content and schema version 1 are returned through the versioned reader

### Requirement: The running app has least privilege

The database role the running app uses SHALL NOT be able to create, alter or drop any persistent database object, and SHALL have only the table rights its operations need. A temporary table is outside this rule. Schema changes SHALL use a separate role that the running app never holds.

#### Scenario: DDL refused

- **WHEN** the running app's role tries to create a table
- **THEN** the database refuses with a permission error

#### Scenario: Privileges checked

- **WHEN** the privilege check runs against a migrated database
- **THEN** it reports the runtime role's rights and exits non-zero if any right differs from the expected set

### Requirement: Schema changes are forward-only and backward-compatible

Every schema change SHALL be a numbered migration applied in order and recorded in the database. No migration SHALL be undone. Each migration SHALL keep working for the previously released version of the app, so a rollback deploy of that version keeps working.

#### Scenario: Pending migrations

- **WHEN** migrations run against a database that lacks the newest ones
- **THEN** exactly the missing migrations are applied, in order

#### Scenario: Nothing pending

- **WHEN** migrations run against an up-to-date database
- **THEN** nothing changes and the run succeeds

### Requirement: A save is visible to the next read

After the app stores a revision, the app's next read of that entry SHALL return it. No cache between the app and the database SHALL serve an older result.

#### Scenario: Read after save

- **WHEN** the owner saves new content and the app immediately lists the entry's revisions
- **THEN** the list includes the revision just saved
