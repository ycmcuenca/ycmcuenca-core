# Spec Delta

## ADDED Requirements

### Requirement: Failed purges are logged

Every cache purge that fails or cannot run SHALL write one warning-level log line with the request id, the tags it tried to purge and the reason.

#### Scenario: Purge refused

- **WHEN** the site's purge reports a failure for the tags `entry:article:hello-world` and `index:article:en`
- **THEN** one warning-level JSON log line in `admin` names both tags and the reason
