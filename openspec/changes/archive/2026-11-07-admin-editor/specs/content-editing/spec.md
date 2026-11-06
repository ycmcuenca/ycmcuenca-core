# Spec Delta

## Purpose

Defines how the owner lists, creates and edits CMS entries in `admin`: the entry list, forms that follow the content type's own description, how validation errors and the preview are shown, and when an entry's slug can change.

## ADDED Requirements

### Requirement: Entry list

`admin`'s home page SHALL keep the heading `Admin` and the entry count, and SHALL list every entry with its title from the latest revision, its slug, its status and the time of its latest save, newest save first. The status SHALL be one of "Live", "Not published" and "Published, not live". Each item SHALL link to the entry's page.

#### Scenario: Mixed statuses

- **WHEN** one article is live, one was never published and one failed to project
- **THEN** the list shows each with "Live", "Not published" and "Published, not live" respectively

#### Scenario: Empty

- **WHEN** no entry exists
- **THEN** the page shows `Admin`, "0 entries" and a link to create an article

### Requirement: Forms follow the type's description

The create and edit forms SHALL show exactly the fields the content type describes, in its order, each with its label, its help text, its required marker and an input matching its editor kind: a single-line input, a multi-line text area or a Markdown text area.

#### Scenario: Article form

- **WHEN** the owner opens the form to create an article
- **THEN** it shows Title, Slug and Summary and a Markdown body area, in that order, each labeled

#### Scenario: Required marker

- **WHEN** the owner opens the form to create an article
- **THEN** each required field's label shows a visible marker, and each control still carries the `required` attribute

### Requirement: Create an article

Submitting a valid new-article form SHALL create the entry with its first revision and open the entry's page. An invalid submission SHALL create nothing and show the form again with the entered values.

#### Scenario: Valid article

- **WHEN** the owner submits a title, the slug `first-post`, a summary and a Markdown body
- **THEN** the entry exists with revision 1, and the owner sees its page with the status "Not published"

#### Scenario: Slug taken

- **WHEN** the owner submits a new article with a slug another article already uses
- **THEN** nothing is created, and the slug field shows that the slug is taken

### Requirement: Edit appends a revision

Saving the edit form SHALL append a new revision with the submitted content and SHALL leave every earlier revision unchanged. Saving content identical to the latest revision SHALL create no revision and SHALL say "No changes to save.".

#### Scenario: Save a change

- **WHEN** the owner changes the summary of an article with two revisions and saves
- **THEN** the article has revision 3 with the new summary, and the page lists revisions 1 to 3

#### Scenario: Save without changes

- **WHEN** the owner saves the edit form without changing anything
- **THEN** no revision is added and the page says "No changes to save."

#### Scenario: Save races another save

- **WHEN** two saves of the same entry reach the server at once
- **THEN** one adds the next revision, and the other is refused with a message to reload and try again, without a server error and without overwriting the first

### Requirement: Errors shown at their fields

When a submission fails validation, each error SHALL appear next to its field, the field SHALL be marked invalid for assistive technology and SHALL reference its message, and every entered value SHALL be kept.

#### Scenario: Two errors

- **WHEN** the owner submits a form with an empty title and the slug `Bad Slug`
- **THEN** the title and slug fields each show their message, are marked invalid, and keep the values entered, and the summary and body keep theirs

#### Scenario: Blank body

- **WHEN** the owner submits an article whose body holds only spaces
- **THEN** nothing is created, the body field shows "Enter the body." next to it and is marked invalid, and every entered value is kept

### Requirement: Preview without saving

The form SHALL offer a preview that renders the current, unsaved content the way the public site renders it, using the same rendering as a publish. Previewing SHALL NOT create a revision. Invalid content SHALL show its errors instead of a preview.

#### Scenario: Preview

- **WHEN** the owner writes `# Hello` and a list in the body and presses Preview
- **THEN** the page shows the rendered heading and list, the form keeps the text, and the revision count is unchanged

#### Scenario: Unsafe markup in preview

- **WHEN** the body contains `<script>alert(1)</script>` and the owner presses Preview
- **THEN** the preview shows the text escaped and no script runs

### Requirement: Slug editable until first publish

The edit form SHALL let the owner change the slug while the entry has never been published, and SHALL show the slug as read-only, with a note that published slugs cannot change, once it has been published.

#### Scenario: Unpublished entry

- **WHEN** the owner changes the slug of a never-published article and saves
- **THEN** the entry's slug is the new one

#### Scenario: Slug-only change

- **WHEN** the owner changes only the slug of a never-published article with two revisions and saves
- **THEN** the entry's slug is the new one, the article still has two revisions, and the page does not say "No changes to save."

#### Scenario: New slug taken

- **WHEN** the owner changes the slug of a never-published article to one another article uses and saves
- **THEN** the slug is unchanged, and the slug field shows that the slug is taken

#### Scenario: Published entry

- **WHEN** the owner opens the edit form of an article that has been published
- **THEN** the slug is shown read-only with the note, and a submitted slug value is ignored

### Requirement: Admin pages stay within the security policy

Every `admin` page, including the forms, the preview and the entry list, SHALL load without any Content Security Policy violation under the existing policy.

#### Scenario: Styled pages

- **WHEN** the home page, the new-article form and an entry page with a preview are loaded in a browser
- **THEN** the browser reports no Content Security Policy violation
