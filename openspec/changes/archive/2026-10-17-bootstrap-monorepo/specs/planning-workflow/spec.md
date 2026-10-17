# Spec Delta

## Purpose

Sets the rules for how changes to `ycmcuenca-core` are planned and closed in OpenSpec, so that every design teaches its reasoning and the living documentation always matches the system that has been built.

## ADDED Requirements

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

Archiving a change SHALL include reviewing each living document in `docs/` (`ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, `ROADMAP.md`, `USER_JOURNEY.md`) once those documents exist. Any document the change affects SHALL be updated, its Mermaid diagram included, in the same branch before archiving.

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
