# planning-workflow Specification

## Purpose

Sets the rules for how changes to `ycmcuenca-core` are planned and closed in OpenSpec, so that every design teaches its reasoning and the living documentation always matches the system that has been built.

## Requirements

### Requirement: Project context available to planning

The OpenSpec configuration SHALL provide project context that every planning workflow reads. It covers the platform's purpose, deployment target, constraints (Cloudflare Workers Free plan, public repository, single admin user) and learning goal. Context SHALL contain only facts an agent cannot infer from the code.

#### Scenario: Context loaded

- **WHEN** an OpenSpec artifact instruction is requested for any change
- **THEN** the returned context includes the project's deployment constraints and learning goal

### Requirement: Designs explain their reasoning

Every `design.md` SHALL state, for each significant decision, the architectural reasoning (pattern and why it fits), the alternatives considered with their trade-offs, and the expected failure modes with how they are detected or mitigated.

#### Scenario: Design rule delivered

- **WHEN** design instructions are requested for any change
- **THEN** the returned rules require reasoning, trade-offs and failure modes for each significant decision

### Requirement: Verified, version-specific external facts

Planning artifacts SHALL take facts about external libraries, platforms and services (versions, limits, APIs, pricing) from current documentation. They SHALL record the versions they rely on, and SHALL list unverified facts as open questions rather than state them as true.

#### Scenario: Version recorded

- **WHEN** a design relies on a library or platform behavior
- **THEN** the design names the version or documentation date it relied on

#### Scenario: Unverified fact flagged

- **WHEN** a fact needed by a design cannot be verified
- **THEN** the design lists it under open questions instead of stating it as fact

### Requirement: Open questions go to the owner

Planning workflows SHALL ask the owner about any ambiguity that affects scope, behavior, security or cost. Any minor assumption SHALL be listed explicitly in the artifact for the owner to review.

#### Scenario: Assumptions listed

- **WHEN** an artifact relies on an assumption the owner did not confirm
- **THEN** the artifact lists that assumption explicitly for review

### Requirement: Living documents synced on archive

Archiving a change SHALL include reviewing each living document in `docs/` (`ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, `ROADMAP.md`, `SYSTEM_DESIGN.md`, `USER_JOURNEY.md`) once those documents exist. Any document the change affects SHALL be updated, its Mermaid diagram included, in the same branch before archiving.

#### Scenario: Archive guidance delivered

- **WHEN** an archive workflow runs for any change
- **THEN** its guidance requires reviewing the living documents and updating those the change affects

#### Scenario: Documents not yet created

- **WHEN** a change is archived before the living documents exist
- **THEN** the archive proceeds and reports that no living documents existed to sync

### Requirement: Changes are scoped by capability

Each change SHALL be scoped to one coherent capability area so that it can be reviewed and merged as one pull request. Its name SHALL describe the capability work, not a sprint or date.

#### Scenario: Proposal rule delivered

- **WHEN** proposal instructions are requested for any change
- **THEN** the returned rules require a single capability-scoped change with an explicit out-of-scope list

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
