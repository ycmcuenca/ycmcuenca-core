# Spec Delta

## Purpose

Defines the living documents that describe `ycmcuenca-core` (its architecture, product, user journeys, visual design and plan), what each one owns, and how humans and coding agents find them, so the documentation always matches the system that has been built.

## ADDED Requirements

### Requirement: Five living documents

The `docs/` directory SHALL contain the five living documents `ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, `ROADMAP.md` and `USER_JOURNEY.md`. Each SHALL open by stating what it covers, and each SHALL contain at least one Mermaid diagram that renders on GitHub.

#### Scenario: Documents present

- **WHEN** the `docs/` directory is listed
- **THEN** all five living documents are present, alongside `DECISIONS.md`

#### Scenario: Diagram renders

- **WHEN** any living document is viewed on GitHub
- **THEN** it shows at least one rendered Mermaid diagram and no diagram rendering error

#### Scenario: Purpose stated

- **WHEN** a reader opens any living document
- **THEN** its opening paragraphs state what the document covers and which other documents cover neighboring topics

### Requirement: Built versus planned in the architecture diagram

The master architecture diagram SHALL distinguish what exists from what is planned: existing elements and connections are drawn solid, planned ones dashed, with a legend. Each planned element SHALL name the roadmap change or sprint that brings it.

#### Scenario: Planned element

- **WHEN** a component exists only in the roadmap, such as the KV publish snapshot
- **THEN** the architecture diagram draws it and its connections dashed and labels it with the sprint or change that delivers it

#### Scenario: Existing element

- **WHEN** a component is built and its change is archived, such as the CI pipeline
- **THEN** the architecture diagram draws it and its connections solid

### Requirement: Decisions cited, not restated

The living documents SHALL cite platform-wide decisions by their identifier in `docs/DECISIONS.md` and link to it, rather than restating the reasoning. They SHALL take sprint and status information from `docs/ROADMAP.md` and SHALL NOT contradict either document.

#### Scenario: Decision referenced

- **WHEN** ARCHITECTURE.md explains why `welcome` has no database binding
- **THEN** it cites the decision identifier (C5) with a link to DECISIONS.md and does not repeat the decision's full reasoning

#### Scenario: Superseded decision

- **WHEN** a decision cited by a living document is superseded in DECISIONS.md
- **THEN** the living document cites the superseding decision once the change that superseded it is archived

### Requirement: Product document

`PRODUCT.md` SHALL state the platform's purpose, the audiences of the public portfolio (recruiters and hiring managers, prospective clients, developer peers), the owner as the only editor, the supported locales, and the product's goals and non-goals.

#### Scenario: Audiences named

- **WHEN** a reader looks for who the public site is for
- **THEN** PRODUCT.md names the three audiences and what each one comes to the site to do

#### Scenario: Non-goals stated

- **WHEN** a reader asks whether the platform supports several editors or public sign-ups
- **THEN** PRODUCT.md states this is a non-goal for the core platform and cites the decision that defers it

### Requirement: User journeys

`USER_JOURNEY.md` SHALL describe one journey for each audience named in PRODUCT.md, and the owner's journey from writing an entry to seeing it published. Each step SHALL be marked as available today or planned, with the sprint that brings it.

#### Scenario: Planned step

- **WHEN** a journey step depends on work that is not built yet, such as publishing an entry
- **THEN** the step is marked planned and names its sprint

#### Scenario: Every audience covered

- **WHEN** PRODUCT.md names an audience
- **THEN** USER_JOURNEY.md contains a journey for that audience

### Requirement: Design document

`DESIGN.md` SHALL describe the visual and user-experience design: design principles, the accessibility target, glyph coverage for every supported locale, how shared design tokens are layered, the current visual state, and which design choices are deferred to a later sprint.

#### Scenario: Deferred choices visible

- **WHEN** a design choice has not been made yet, such as the brand colour palette
- **THEN** DESIGN.md lists it as open and names the sprint that decides it

#### Scenario: Current state honest

- **WHEN** a reader compares DESIGN.md with the running apps
- **THEN** the document's description of the current visual state matches what the apps show

### Requirement: Agent entry point

The repository root SHALL contain `AGENTS.md`, which tells a coding agent what to read before working (the roadmap, the decision log and the OpenSpec rules), where the living documents are, the everyday commands and the repository's conventions. It SHALL link to these sources rather than copy their content.

#### Scenario: Agent starts a session

- **WHEN** a coding agent starts working in the repository
- **THEN** `AGENTS.md` at the root points it to ROADMAP.md, DECISIONS.md, `openspec/config.yaml` and the living documents

#### Scenario: No duplicated rules

- **WHEN** an OpenSpec rule or a decision changes
- **THEN** `AGENTS.md` needs no edit, because it links to the source instead of restating it

### Requirement: Documentation index in the README

The README SHALL contain a documentation section that links every living document, the decision log and `AGENTS.md`.

#### Scenario: Reader finds the documents

- **WHEN** a new contributor reads the README
- **THEN** its documentation section links all five living documents, DECISIONS.md and AGENTS.md, and every link resolves
