# Spec Delta

## MODIFIED Requirements

### Requirement: Living documents synced on archive

Archiving a change SHALL include reviewing each living document in `docs/` (`ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, `ROADMAP.md`, `SYSTEM_DESIGN.md`, `USER_JOURNEY.md`) once those documents exist. Any document the change affects SHALL be updated, its Mermaid diagram included, in the same branch before archiving.

#### Scenario: Archive guidance delivered

- **WHEN** an archive workflow runs for any change
- **THEN** its guidance requires reviewing the living documents and updating those the change affects

#### Scenario: Documents not yet created

- **WHEN** a change is archived before the living documents exist
- **THEN** the archive proceeds and reports that no living documents existed to sync

## ADDED Requirements

### Requirement: Concept entries completed on archive

Archiving a change SHALL turn into built entries the notebook entries for the concepts the change applies: a planned stub is completed, and a concept with no entry gets a new one. The archiving agent SHALL draft the "what we learned here" part from the change's design risks, open questions and follow-ups, and SHALL mark it for the owner to rewrite.

#### Scenario: Stub completed

- **WHEN** a change that applies a planned concept is archived
- **THEN** the archive guidance requires completing that concept's entry and changing its status to built

#### Scenario: Lessons left for the owner

- **WHEN** the archiving agent drafts "what we learned here"
- **THEN** the draft is marked as awaiting the owner's rewrite, and the owner rewrites it in review. CI does not check the rewrite

### Requirement: Design patterns link to the notebook

Every `design.md` that names a pattern for a decision SHALL link that pattern to its notebook entry. When the pattern has no entry yet, the same change SHALL add a planned entry for it.

#### Scenario: Design rule delivered

- **WHEN** design instructions are requested for any change
- **THEN** the returned rules require each named pattern to link to its notebook entry, and a new planned entry when none exists
