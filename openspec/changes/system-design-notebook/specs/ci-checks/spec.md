# Spec Delta

## MODIFIED Requirements

### Requirement: Living documents stay present

Every CI run SHALL check that each of the six living documents (`docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, `docs/ROADMAP.md`, `docs/SYSTEM_DESIGN.md`, `docs/USER_JOURNEY.md`) exists and contains at least one Mermaid diagram block. A missing document or a document without a diagram SHALL fail the run and name the document.

#### Scenario: Document deleted

- **WHEN** a pull request deletes `docs/PRODUCT.md`
- **THEN** the living-documents check fails and names `docs/PRODUCT.md`

#### Scenario: Diagram removed

- **WHEN** a pull request removes the only Mermaid diagram from `docs/DESIGN.md`
- **THEN** the living-documents check fails and names `docs/DESIGN.md`

#### Scenario: Notebook deleted

- **WHEN** a pull request deletes `docs/SYSTEM_DESIGN.md`
- **THEN** the living-documents check fails and names `docs/SYSTEM_DESIGN.md`

#### Scenario: All documents present

- **WHEN** all six documents exist and each contains a Mermaid diagram block
- **THEN** the living-documents check passes

## ADDED Requirements

### Requirement: Notebook entries keep their required parts

Every CI run SHALL check each concept entry in `docs/SYSTEM_DESIGN.md`. An entry with no status line, a built entry missing any of its seven parts, or a planned entry missing any of its three parts SHALL fail the run. The failure SHALL name the entry and each missing part.

#### Scenario: Built entry loses a part

- **WHEN** a pull request removes the further-reading part from a built entry
- **THEN** the check fails and names that entry and "further reading"

#### Scenario: Built entry has no diagram

- **WHEN** a built entry contains no Mermaid diagram block
- **THEN** the check fails and names that entry and "diagram"

#### Scenario: Reference without a date

- **WHEN** an entry's further reading has fewer than two references that end with a `Read on YYYY-MM-DD` date
- **THEN** the check fails and names that entry and "further reading"

#### Scenario: Draft lesson left in place

- **WHEN** a built entry's "what we learned here" still carries the marker that it awaits the owner's rewrite
- **THEN** the check fails and names that entry and "what we learned here"

#### Scenario: Planned entry is complete

- **WHEN** a planned entry has a status line, a definition, self-check questions and two dated references
- **THEN** the check passes for that entry, although it has no diagram and no lessons

### Requirement: Documentation links resolve

Every CI run SHALL check that each relative link in the Markdown files in `docs/`, in `AGENTS.md` and in `README.md` points to an existing file, and that each link to a heading points to a heading that exists in its target. A broken link SHALL fail the run and name the file, the line and the link. External links SHALL NOT be checked in CI.

#### Scenario: Heading renamed

- **WHEN** a pull request renames a notebook heading that ARCHITECTURE.md links to
- **THEN** the check fails and names the ARCHITECTURE.md line with the broken link

#### Scenario: File moved

- **WHEN** a pull request moves a file that README.md links to
- **THEN** the check fails and names the README.md line with the broken link

#### Scenario: External site down

- **WHEN** an external site linked from the notebook is unreachable during a CI run
- **THEN** the check is not affected, because external links are re-checked by hand on a schedule instead
