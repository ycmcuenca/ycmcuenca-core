# Spec Delta

## ADDED Requirements

### Requirement: Publish path tested across both apps

The root `test:e2e` task SHALL include a test that runs production builds of both apps sharing one local snapshot store, publishes an article in `admin`, reads it on `welcome`, unpublishes it, and sees it disappear from `welcome`.

#### Scenario: Publish then read

- **WHEN** the publish-path test publishes a seeded article in `admin`
- **THEN** `welcome` serves the article's page with its title and lists it on the home page

#### Scenario: Unpublish then gone

- **WHEN** the publish-path test then unpublishes the article in `admin`
- **THEN** `welcome` answers the article's URL with HTTP 404
