# system-design-notebook Specification

## Purpose

Defines the system design notebook in `docs/SYSTEM_DESIGN.md`: a study record of every system design concept the platform applies, sprint by sprint. It explains each concept, shows where the repository applies it and points to trusted sources, so the owner and other readers can learn how the system was built.

## Requirements

### Requirement: Notebook outline

`docs/SYSTEM_DESIGN.md` SHALL open by stating what it covers and that `docs/DESIGN.md` covers visual design instead. It SHALL then give a contents list linking every sprint section and concept entry, a Mermaid overview of sprints and their concepts, and one section per sprint in the order of `docs/ROADMAP.md`.

#### Scenario: Reader opens the notebook

- **WHEN** a reader opens `docs/SYSTEM_DESIGN.md`
- **THEN** its opening paragraphs say it covers system design concepts, name DESIGN.md as the document for visual design, and are followed by a contents list and an overview diagram

#### Scenario: Sprint sections follow the roadmap

- **WHEN** ROADMAP.md lists sprints S1 to S6
- **THEN** the notebook has one section for each, in the same order and with the same sprint names

### Requirement: Study path per sprint

Each sprint section SHALL open with a study path: the order in which to read its concepts, and which to study before the sprint starts and which after it ends.

#### Scenario: Preparing for a sprint

- **WHEN** the owner prepares for Sprint 2
- **THEN** the Sprint 2 section's study path names the concepts to read first and the order to read them in

### Requirement: One entry per concept, under its first sprint

Each concept SHALL have exactly one entry, a heading under the sprint that first applies it. A later sprint that applies the concept again SHALL link to the existing entry instead of adding a second one. The heading's anchor SHALL be the concept's identifier.

#### Scenario: Concept revisited

- **WHEN** a Sprint 4 concept, such as reconciliation loops, builds on an S1 concept, such as settings as code
- **THEN** the S4 entry links to the S1 entry and does not repeat its explanation

#### Scenario: Concept cited from elsewhere

- **WHEN** another document cites a concept
- **THEN** it links to the concept's heading anchor in SYSTEM_DESIGN.md

### Requirement: Entry status

Every entry SHALL state its status on a line of its own directly under its heading: `built (S<n>)` once the change that applies it is archived, otherwise `planned (S<n>)`, where `S<n>` is the sprint that first applies the concept.

#### Scenario: Concept not yet built

- **WHEN** the change that applies a concept has not been archived
- **THEN** the entry's status reads `planned` with its sprint

#### Scenario: Concept built

- **WHEN** the change that applies a concept is archived
- **THEN** the entry's status reads `built` with its sprint

### Requirement: Parts of a built entry

A built entry SHALL contain these parts:

- what the concept is and the problem it solves
- at least one Mermaid diagram
- its general trade-offs
- how this repository applies it
- what we learned here
- self-check questions
- further reading

#### Scenario: Built entry complete

- **WHEN** a reader opens any built entry
- **THEN** they find all seven parts, in the same order as in every other built entry

### Requirement: Parts of a planned entry

A planned entry SHALL contain a one-paragraph definition of the concept, self-check questions and further reading, so the concept can be studied before it is built. It SHALL NOT describe how this repository applies the concept.

#### Scenario: Studying ahead

- **WHEN** a reader opens a planned entry
- **THEN** they find a definition, self-check questions and dated references, and no description of an implementation that does not exist yet

### Requirement: Applied, not restated

The part that says how this repository applies a concept SHALL cite the decisions in `docs/DECISIONS.md` by identifier, and SHALL cite the archived `design.md` decisions and code paths that apply the concept, each with a link. It SHALL NOT repeat the reasoning those sources record.

#### Scenario: Decision behind a concept

- **WHEN** the settings-as-code entry explains where the repository applies the concept
- **THEN** it links to the decision and the archived design decisions that apply it, and to the scripts that do it, without restating their reasons

### Requirement: Lessons kept apart from the concept

The "what we learned here" part SHALL hold only what building this repository revealed, such as a surprise, a mistake or a platform limit. It SHALL stay separate from the general explanation, which holds no repository-specific findings.

#### Scenario: Platform surprise recorded

- **WHEN** a change discovers that a platform does not behave as expected, such as Workers with static assets not exposing the Access identity
- **THEN** the finding is recorded under "what we learned here" in the related entry, not in its general explanation

### Requirement: Self-check answers hidden until asked

Every entry SHALL have two to four self-check questions. In a built entry, each question SHALL have an answer inside a collapsed section that stays closed until the reader opens it.

#### Scenario: Active recall

- **WHEN** a reader views a built entry on GitHub
- **THEN** each question is visible and its answer is hidden until the reader expands it

### Requirement: Dated, trustworthy references

Every entry's further reading SHALL list two to five external sources. Each SHALL be an official document, a specification, an original paper or the originator's own writing, or a widely recognized book. Each SHALL give the date it was last read, as `Read on YYYY-MM-DD`.

#### Scenario: Reference added

- **WHEN** an entry cites a source
- **THEN** the source is official, original or widely recognized, and its line ends with the date it was read

#### Scenario: Blog post offered as a source

- **WHEN** the only source found for a claim is an unattributed blog post
- **THEN** it is not listed, and a primary or canonical source is found instead

### Requirement: Plain language for a new reader

The notebook SHALL follow ISO 24495-1. It SHALL assume a reader who knows HTTP, TypeScript and git but is new to system design, and SHALL define each system design term where it first appears.

#### Scenario: Term defined at first use

- **WHEN** an entry uses a term such as "idempotent" for the first time in the notebook
- **THEN** the same sentence or the next one defines it in plain words

### Requirement: Every concept covered

The notebook SHALL have an entry for every concept in ROADMAP.md's learning-concepts lists. It SHALL also cover every pattern that an archived `design.md` names, either with its own entry or folded into a related entry that names it.

#### Scenario: Roadmap concept listed

- **WHEN** ROADMAP.md lists a learning concept for any sprint
- **THEN** the notebook has an entry for it, and the roadmap item links to that entry

#### Scenario: Pattern folded into an entry

- **WHEN** an archived design names a pattern, such as the required-check aggregator, that belongs with a broader concept
- **THEN** the broader concept's entry names the pattern and links to the design decision that applies it

### Requirement: Documents link to the concepts they apply

ROADMAP.md SHALL link each learning concept to its entry. ARCHITECTURE.md SHALL link each component and path that applies a concept to that concept's entry. DECISIONS.md SHALL link each decision that applies a concept to that concept's entry.

#### Scenario: From a decision to its concept

- **WHEN** a reader looks at decision C5 in DECISIONS.md
- **THEN** it links to the notebook entry for CQRS-lite read projections

#### Scenario: From a component to its concept

- **WHEN** a reader looks at the Cloudflare Access component in ARCHITECTURE.md
- **THEN** it links to the notebook entry for zero trust and defense in depth

### Requirement: Size limit stated

The notebook SHALL state its own size limit: once it passes about 3,000 lines, the next change that edits it SHALL split it into one file per sprint under `docs/system-design/`, with `docs/SYSTEM_DESIGN.md` kept as the index.

#### Scenario: Limit passed

- **WHEN** a change brings the notebook past about 3,000 lines
- **THEN** that change, or the next one to edit the notebook, splits it per sprint and updates every link to a moved entry, so the link check still passes
