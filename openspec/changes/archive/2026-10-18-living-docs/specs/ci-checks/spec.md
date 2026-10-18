# Spec Delta

## ADDED Requirements

### Requirement: Living documents stay present

Every CI run SHALL check that each of the five living documents (`docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, `docs/ROADMAP.md`, `docs/USER_JOURNEY.md`) exists and contains at least one Mermaid diagram block. A missing document or a document without a diagram SHALL fail the run and name the document.

#### Scenario: Document deleted

- **WHEN** a pull request deletes `docs/PRODUCT.md`
- **THEN** the living-documents check fails and names `docs/PRODUCT.md`

#### Scenario: Diagram removed

- **WHEN** a pull request removes the only Mermaid diagram from `docs/DESIGN.md`
- **THEN** the living-documents check fails and names `docs/DESIGN.md`

#### Scenario: All documents present

- **WHEN** all five documents exist and each contains a Mermaid diagram block
- **THEN** the living-documents check passes
