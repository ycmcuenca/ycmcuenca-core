# Spec Delta

## Purpose

Defines what `welcome` and `admin` record about their own behavior in production (request logs, traces and structured error logs), and how an error a user sees is traced back to its log line, using only Cloudflare's built-in tools.

## ADDED Requirements

### Requirement: Logs and traces recorded for every request

Both workers SHALL persist invocation logs and traces for every request to the platform's built-in observability, with no sampling. No third-party log or error service SHALL be used.

#### Scenario: Request visible

- **WHEN** a request is served by either deployed worker
- **THEN** its invocation log and trace can be found in the worker's observability view within minutes

#### Scenario: No external sink

- **WHEN** the workers' configuration and dependencies are inspected
- **THEN** no third-party logging, tracing or error-tracking service is configured

### Requirement: Structured application logs

Every log line the apps write SHALL be a single JSON object with at least a level, a message, the app name and the request id, where the request id is the request's Cloudflare Ray ID when present. Log lines SHALL NOT contain credentials, Access tokens or cookies.

#### Scenario: Log line shape

- **WHEN** either app writes a log line while handling a request
- **THEN** the line parses as JSON and has `level`, `msg`, `app` and `requestId` fields

#### Scenario: Secrets never logged

- **WHEN** a request carrying an Access token and cookies fails in `admin`
- **THEN** the resulting log line contains neither the token nor any cookie value

### Requirement: Unexpected errors are logged and traceable

Every unexpected server error SHALL produce one error-level log line with the request id and the error's message and stack. The error page shown to the user SHALL show the same request id and SHALL NOT reveal the error's message or stack.

#### Scenario: Server error

- **WHEN** a request to either app throws an unexpected error
- **THEN** one error-level JSON log line with that request's id is written, and the user's error page shows the request id but not the error details

#### Scenario: Not found is not an error

- **WHEN** a path that does not exist is requested
- **THEN** no error-level log line is written

### Requirement: Access refusals are logged

Every request `admin` refuses during Access verification SHALL produce one warning-level log line with the request id and the reason, such as a missing token, a wrong audience or unavailable keys, without the token itself.

#### Scenario: Refused request

- **WHEN** `admin` refuses a request because its token has the wrong audience
- **THEN** one warning-level log line with reason `audience` and the request id is written
