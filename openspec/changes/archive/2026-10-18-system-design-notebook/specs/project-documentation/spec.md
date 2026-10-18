# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Five living documents`
- TO: `### Requirement: Six living documents`

## MODIFIED Requirements

### Requirement: Six living documents

The `docs/` directory SHALL contain the six living documents `ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, `ROADMAP.md`, `SYSTEM_DESIGN.md` and `USER_JOURNEY.md`. Each SHALL open by stating what it covers, and each SHALL contain at least one Mermaid diagram that renders on GitHub.

#### Scenario: Documents present

- **WHEN** the `docs/` directory is listed
- **THEN** all six living documents are present, alongside `DECISIONS.md`

#### Scenario: Diagram renders

- **WHEN** any living document is viewed on GitHub
- **THEN** it shows at least one rendered Mermaid diagram and no diagram rendering error

#### Scenario: Purpose stated

- **WHEN** a reader opens any living document
- **THEN** its opening paragraphs state what the document covers and which other documents cover neighboring topics

#### Scenario: Two design documents told apart

- **WHEN** a reader opens `DESIGN.md` or `SYSTEM_DESIGN.md`
- **THEN** its opening paragraphs say that DESIGN.md covers visual and user-experience design and SYSTEM_DESIGN.md covers system design concepts

### Requirement: Documentation index in the README

The README SHALL contain a documentation section that links every living document, the decision log and `AGENTS.md`.

#### Scenario: Reader finds the documents

- **WHEN** a new contributor reads the README
- **THEN** its documentation section links all six living documents, DECISIONS.md and AGENTS.md, and every link resolves
