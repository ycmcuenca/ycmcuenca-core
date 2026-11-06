# Spec Delta

## ADDED Requirements

### Requirement: Failed projections are logged

Every projection that fails SHALL write one error-level log line with the request id, the entry id, the failed step (entry snapshot, index or removal) and the error message. The line SHALL NOT contain the entry's content.

#### Scenario: Snapshot write fails

- **WHEN** a publish's entry snapshot write fails
- **THEN** one error-level JSON log line names the entry id, the step `entry-snapshot` and the error message, and contains no title, summary or body text
