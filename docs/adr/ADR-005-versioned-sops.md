# ADR-005 Versioned SOPs

## Status

Accepted

## Context

Ikamva should orchestrate business processes using client-specific procedures. These procedures need to improve over time without losing historical traceability.

## Decision

SOPs are versioned. Each task type can have one active SOP per tenant. SOPs include system prompts, validation schemas, output schemas, model settings, and timestamps.

## Consequences

- Automation quality can improve through controlled SOP evolution.
- Task execution can be audited against the SOP version used.
- SOP changes become deployable business artifacts.

## Alternatives Considered

- Hardcoded prompts in workers: rejected because it prevents client-specific versioning.
- Generic chatbot prompts: rejected because Ikamva is process-oriented, not chat-oriented.
