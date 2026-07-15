# Ikamva AI Operating System

## Vision

Ikamva is a multi-tenant AI Operating System for SMEs.

The platform orchestrates business processes using client-specific SOPs rather than acting as a generic chatbot. Each client can have versioned procedures, validation rules, output expectations, quota limits, and provider preferences while still running on the same operating foundation.

The long-term objective is an automation platform whose intelligence compounds through versioned SOPs. As the system learns which procedures, prompts, validations, and worker patterns produce reliable outcomes, Ikamva becomes more capable without coupling the business model to any single AI, storage, auth, database, or hosting provider.

## Core Principles

- Tenant-first architecture
- SOP-driven automation
- Infrastructure independence
- Vendor independence
- Security by default
- Auditability
- Modular capabilities
- AI augments business processes rather than replacing governance

## Architecture Overview

```text
React Components
  ↓
Services
  ↓
Repositories
  ↓
Providers
  ↓
Infrastructure
```

React components own presentation and user interaction. They must never communicate directly with providers.

Services own business workflows, orchestration, validation, quota checks, task lifecycle transitions, and execution rules.

Repositories own persistence contracts. They define how business logic asks for data without knowing where that data lives.

Providers own vendor-specific SDKs, APIs, credentials, and infrastructure details.

Infrastructure is the replaceable runtime layer: database, storage, queue, auth, AI, email, hosting, observability, and worker platforms.

## Current Stack

Frontend: React + Vite

Authentication: Provider abstraction, Supabase planned

Database: Supabase PostgreSQL

Storage: Supabase Storage

Queue: PostgreSQL

AI: Provider Registry

Hosting: Vercel / Cloudflare

## Development Philosophy

The execution engine must remain infrastructure-independent.

Repositories may change.

Providers may change.

Business logic should not.

Ikamva should evolve by adding capabilities, workers, SOPs, and provider adapters rather than by rewriting business workflows around vendor SDKs.

## Roadmap

Completed:

- Goal A: Foundation
- Goal B: Execution Engine
- Goal C1: Repository Contract Suite

Current:

- Goal C2: Architecture Decision Records

Future:

- Repository Factory
- Queue Semantics
- Supabase Adapters
- Integration Tests
- Operational Telemetry
- Capability Development

For the detailed roadmap, see [docs/roadmap.md](docs/roadmap.md).
