# content-model Specification

## Purpose

Defines the content the CMS manages: the article type, how its input is validated and limited, how Markdown becomes safe HTML, how stored content and published snapshots are versioned, and how a type describes its own form.

## Requirements

### Requirement: Article content type

The CMS SHALL know exactly one content type, `article`. An article SHALL have a title, a slug, a summary and a body. The body SHALL be an ordered list of at least one block, and the only block type SHALL be `markdown`, which holds Markdown source text.

#### Scenario: Valid article

- **WHEN** an article with a title, a slug, a summary and one `markdown` block is validated
- **THEN** validation succeeds and returns the article content with its blocks in the given order

#### Scenario: Empty body

- **WHEN** an article with no blocks is validated
- **THEN** validation fails with an error on the body

#### Scenario: Unknown block type

- **WHEN** an article whose body contains a block of type `image` is validated
- **THEN** validation fails with an error on that block

### Requirement: Field limits

The title SHALL be one line of 1 to 120 characters. The summary SHALL be 1 to 300 characters. The slug SHALL be 1 to 80 characters of lowercase ASCII letters, digits and single hyphens, and SHALL NOT start or end with a hyphen. Leading and trailing whitespace SHALL be removed from the title and summary before validation.

#### Scenario: Title too long

- **WHEN** an article whose title has 121 characters is validated
- **THEN** validation fails with an error on the title that names the limit

#### Scenario: Title with a line break

- **WHEN** an article whose title contains a line break is validated
- **THEN** validation fails with an error on the title

#### Scenario: Invalid slug

- **WHEN** an article with the slug `Hello World`, `-hello`, `hello-` or `hello--world` is validated
- **THEN** validation fails with an error on the slug

#### Scenario: Valid slug

- **WHEN** an article with the slug `hello-world-2` is validated
- **THEN** the slug passes validation

### Requirement: Body size limit

The Markdown of an article's body SHALL NOT exceed 32,768 bytes in UTF-8, counted across all of its blocks. The body SHALL NOT hold more than 200 blocks.

#### Scenario: Body over the limit

- **WHEN** an article whose blocks together hold 32,769 bytes of Markdown is validated
- **THEN** validation fails with an error on the body that names the limit

#### Scenario: Body at the limit

- **WHEN** an article whose blocks together hold exactly 32,768 bytes of Markdown is validated
- **THEN** the body passes validation

#### Scenario: Body over the block limit

- **WHEN** an article whose body holds 201 blocks is validated
- **THEN** validation fails with an error on the body that names the limit

### Requirement: Errors per field

Validation SHALL report every invalid field at once, each with the field's name and a message a person can act on. Validation SHALL NOT stop at the first error.

#### Scenario: Several invalid fields

- **WHEN** an article with an empty title and an invalid slug is validated
- **THEN** the result lists one error for the title and one for the slug

### Requirement: Markdown renders to safe HTML

Rendering a `markdown` block SHALL produce HTML in which raw HTML from the source appears as escaped text. Links and images whose address uses the `javascript:`, `vbscript:` or `file:` scheme, or a `data:` scheme other than a GIF, PNG, JPEG or WebP image, SHALL NOT become links or images. The same source SHALL always render to the same HTML.

#### Scenario: Script tag in Markdown

- **WHEN** a block containing `<script>alert(1)</script>` is rendered
- **THEN** the HTML shows that text escaped and contains no `<script>` element

#### Scenario: Event handler in Markdown

- **WHEN** a block containing `<img src=x onerror=alert(1)>` is rendered
- **THEN** the HTML contains no `img` element and no `onerror` attribute

#### Scenario: Dangerous link

- **WHEN** a block containing `[x](javascript:alert(1))` is rendered
- **THEN** the HTML contains no link whose address starts with `javascript:`

#### Scenario: Ordinary Markdown

- **WHEN** a block containing a heading, emphasis, a list, a code block and a link to `https://example.com` is rendered
- **THEN** the HTML contains the matching heading, emphasis, list, code and link elements

### Requirement: Stored content carries its schema version

Every article content the CMS stores SHALL carry the schema version 1. Reading stored content SHALL succeed for version 1. Reading content with any other version, or with no version, SHALL fail with an error that names the version found.

#### Scenario: Current version

- **WHEN** stored content with schema version 1 is read
- **THEN** the article content is returned

#### Scenario: Unknown version

- **WHEN** stored content with schema version 7 is read
- **THEN** reading fails with an error naming version 7

### Requirement: Snapshot contract

A published entry snapshot SHALL carry the snapshot version 1, the type, the slug, the title, the summary, the rendered blocks, the first-publish time and the last-publish time, both in UTC. A type index snapshot SHALL carry the snapshot version 1, the type, the locale and one item per published entry with its slug, title, summary and first-publish time.

#### Scenario: Entry snapshot round trip

- **WHEN** an entry snapshot is created from published article content and read back
- **THEN** the reader returns the same title, slug, summary, rendered blocks and times

#### Scenario: Index snapshot round trip

- **WHEN** an index snapshot with two items is created and read back
- **THEN** the reader returns both items in the same order

### Requirement: Snapshots are read tolerantly

Reading a snapshot SHALL accept every snapshot version the reader supports, which is version 1 until a later change adds one, and SHALL ignore fields it does not know. A snapshot with an unsupported version or a missing required field SHALL be rejected with an error naming the problem, never partially read.

#### Scenario: Unknown extra field

- **WHEN** a version 1 entry snapshot that also contains a field `reading_time` is read
- **THEN** the reader returns the snapshot without that field and without error

#### Scenario: Future version

- **WHEN** an entry snapshot with snapshot version 2 is read
- **THEN** reading fails with an error naming version 2

#### Scenario: Missing title

- **WHEN** a version 1 entry snapshot without a title is read
- **THEN** reading fails with an error naming the title

### Requirement: Types describe their own forms

Each content type SHALL describe its form as an ordered list of fields, each with its name, a label, an optional help text, an editor kind, whether it is required and its length limit. The editor kinds SHALL be single-line text, multi-line text and Markdown.

#### Scenario: Article form

- **WHEN** the form description of `article` is requested
- **THEN** it lists title (single-line text, required, 120 characters), slug (single-line text, required, 80 characters), summary (multi-line text, required, 300 characters) and the body's Markdown (Markdown editor, required, 32,768 bytes), in that order

#### Scenario: Form and validation agree

- **WHEN** a value at exactly the limit a form description states is validated for that field
- **THEN** validation accepts it, and one character or byte more is rejected
