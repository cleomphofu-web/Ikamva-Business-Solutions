# Prompt Architecture

This document describes how system prompts are constructed for every Ikamva `task_type`. It reflects the actual implementation and must be updated whenever prompt construction, tool registration, or conditional behavior changes.

> **Critical design principle:** Application code—not the language model—must make deterministic policy decisions such as shift-hours eligibility. The model receives only the context necessary for its specific task.

---

## Shared Prompt Pipeline

Every AI task follows this high-level prompt construction flow:

```text
Inbound request
  -> Authenticate and resolve tenant
  -> Load employee configuration
  -> Load tenant company context
  -> Load task-specific memory/context
  -> Evaluate deterministic policy in application code
  -> Register task-appropriate tools
  -> Assemble system prompt
  -> Call model with system prompt, messages, and tools
  -> Execute tool calls (if any) and continue generation
  -> Validate output / apply safety guardrails
```

### Shared Context Sections

The following sections may appear in prompts depending on the task type:

| Section | Source | Included When |
|---------|--------|---------------|
| Employee identity and role | `EmployeeRepository` | All task types |
| Company context | `TenantRepository.companyContext` | All customer-facing tasks |
| Products / services | `TenantRepository.companyContext.productsServices` | All customer-facing tasks |
| Target customers | `TenantRepository.companyContext.customers` | All customer-facing tasks |
| Industry | `TenantRepository.companyContext.industry` | All customer-facing tasks |
| Long-term memory | `MemoryRepository` | When relevant tenant/customer memory exists |
| Conversation/thread history | Chat or Gmail repositories | Multi-turn tasks |
| Live email data | Gmail API OAuth connection | Only through registered tools or pre-retrieval flow |
| Shift-hours result | Application code | Only real inbound email handling, and only when outside shift hours |

### Company Context Quality Gate

Before an Employee can be activated, the onboarding process must ensure company context is complete:

```typescript
interface RequiredCompanyContext {
  description: string;       // Required
  productsServices: string;  // Required
  customers: string;         // Required
  industry: string;          // Required
}
```

If any field is blank, activation must be blocked or clearly marked as incomplete. This prevents generic responses caused by incomplete context such as:

```text
COMPANY CONTEXT:
we manufecture paint
Products/Services:
Customers:
Industry:
```

---

## Task Type: Chat

### Purpose

The `chat` task type powers the in-dashboard **Test your Employee** widget and authenticated live chat interactions. It answers user questions using company context, conversation history, and—when requested—live Gmail data.

### Entry Point

- **Route:** `POST /api/v1/workforce/chat`
- **Worker:** `ChatWorker.handleChat()`
- **Prompt builder:** `PromptAssembler.buildChatPrompt()`
- **Model:** Configured provider/model; HAR trace indicated `openai/gpt-oss-20b` through Groq at the time of the Bug 1 report

### Assembly Sequence

1. Authenticate request and resolve the tenant and employee.
2. Load the employee role, behavior settings, tenant company context, and relevant conversation history.
3. Identify whether the request comes from the dashboard test widget (`isTestWidget`).
4. Register the email retrieval tools listed below when a Gmail OAuth connection exists for the tenant.
5. Build a system prompt with employee identity, company context, behavioral rules, data-grounding rules, available-tool instructions, and conversation context.
6. Call the configured model with actual function/tool definitions, execute any returned tool calls, append tool results, and make a final generation call.
7. If no tool result supports an email-specific assertion, prevent the response from presenting invented email content as fact.

### System Prompt Sections

| Order | Section | Content |
|------:|---------|---------|
| 1 | Role and identity | Employee name, job function, tenant-specific behavior |
| 2 | Company context | Description, products/services, customers, industry |
| 3 | Communication style | Tone, escalation boundaries, response rules |
| 4 | Grounding policy | Email facts must come from tool output; never invent sender, subject, dates, content, or thread details |
| 5 | Available tools | Tool names, purpose, input fields, and invocation guidance |
| 6 | Conversation context | Prior messages or session summary where available |
| 7 | User message | Current chat message, passed as the user turn rather than embedded as system instruction |

### Registered Tools

| Tool | Registration condition | Input | Output | Data source |
|------|------------------------|-------|--------|-------------|
| `search_recent_emails` | Tenant Gmail OAuth integration is connected | `query?: string`, `limit?: number` | Array of `{thread_id, message_id, subject, sender, date, snippet}` | Gmail API |
| `get_email_thread` | Tenant Gmail OAuth integration is connected | `thread_id: string` | Thread messages with sender, recipient, date, subject, and body/text | Gmail API |

### Tool Behavior

- `search_recent_emails` searches the tenant's connected Gmail mailbox. With no `query`, it returns the most recent messages; `limit` is bounded to a safe maximum.
- `get_email_thread` retrieves only the thread identified by a previously returned `thread_id`, preventing arbitrary cross-tenant or guessed-ID access.
- Both tools execute through the tenant's existing OAuth connection and must enforce the authenticated tenant boundary.
- If Gmail is disconnected, unavailable, or a search yields no matches, the assistant must say that plainly. It must not infer or fabricate email details.

### Shift-Hours Rule

**Chat is never schedule-gated.** The dashboard test widget is not an inbound customer contact, and the general chat path must not trigger out-of-office handling.

The chat prompt must contain **no** instruction to evaluate, describe, or mention live server time, configured shift hours, or out-of-office status. Schedule evaluation belongs exclusively to the real inbound-email triage flow described below.

### Prohibited Legacy Behavior

The following legacy instruction must never be included in a `chat` prompt:

```text
INSTRUCTION: Evaluate whether the Live Server Time falls within the Configured Shift
hours. Only invoke the out-of-office response if the current live time is strictly
outside these boundaries.
```

It caused the model to narrate internal scheduling decisions instead of answering users, for example by returning schedule status as the reply to an email question.

### Required Tests

- During configured shift hours, send a chat message and assert that the reply contains no mention of `shift hour`, `server time`, or `out-of-office`.
- Ask for recent email with a connected Gmail integration and assert `search_recent_emails` executes.
- Ask for a returned email's details and assert `get_email_thread` executes with that returned thread ID.
- With no search results, assert the reply explicitly says no matching email was found.
- With a disconnected Gmail integration, assert the reply explicitly says the email integration is disconnected or unavailable.

---

## Task Type: Email Triage

### Purpose

The `email_triage` task type processes a **real inbound customer email** and determines the permitted response/action. This is the only workflow in which out-of-office automation may be applicable.

### Entry Point

- **Route:** `POST /api/v1/workforce/email/triage`
- **Worker:** `EmailTriageWorker.processEmail()`
- **Prompt builder:** `PromptAssembler.buildEmailTriagePrompt()`

### Deterministic Schedule Gate

Before building any LLM prompt, application code calculates:

```typescript
const isWithinShiftHours = isWithinTenantShiftHours({
  now: clock.now(),
  timezone: tenant.schedule.timezone,
  workingDays: tenant.schedule.workingDays,
  start: tenant.schedule.shiftHours.start,
  end: tenant.schedule.shiftHours.end,
});
```

The function must support the tenant's IANA timezone and overnight shifts. It returns a boolean; the LLM must not be asked to calculate it.

| Condition | Application behavior | Prompt behavior |
|-----------|----------------------|-----------------|
| Within shift hours | Continue normal email triage | No schedule/OOO instruction appears |
| Outside shift hours, real inbound customer contact, OOO enabled | Select OOO reply path | Prompt receives only the relevant OOO template/action constraint, not raw clock reasoning |
| Outside shift hours, non-customer, internal, or ineligible message | Continue or skip per business rules | No automatic OOO reply solely from schedule |
| Dashboard test chat | Route to `chat` | Never evaluate or apply OOO logic |

### System Prompt Sections

| Order | Section | Content |
|------:|---------|---------|
| 1 | Role and email-handling policy | Employee authority, allowed actions, escalation criteria |
| 2 | Company context | Tenant description, products/services, customers, industry |
| 3 | Inbound email / thread context | Retrieved Gmail message and prior thread messages |
| 4 | Customer / CRM context | Account, contact, interaction history when found |
| 5 | Memory | Relevant durable preferences, agreements, or prior facts |
| 6 | OOO path (conditional) | Included only after application code selected the legitimate after-hours inbound-customer OOO action |
| 7 | Output schema | Required action, reply, confidence, and escalation data |

### Tools

Email triage may use Gmail read/thread tools and CRM lookup tools as necessary. Tool registration must be explicit in the worker and restricted to tenant-scoped records.

### Shift-Hours Safety

- Do not expose live server time or raw schedule evaluation instructions to the model.
- During normal working hours, do not include an OOO template or mention OOO status.
- The post-processing layer sends an OOO response only when application code has established eligibility.

---

## Task Type: Quote Chain

### Purpose

The `quote_chain` task type manages multi-step quote creation, refinement, and finalization.

### Entry Point

- **Route:** `POST /api/v1/workforce/chains`
- **Worker:** `QuoteChainWorker.handleChain()`
- **Prompt builder:** `PromptAssembler.buildQuoteChainPrompt()`

### System Prompt Sections

| Order | Section | Content |
|------:|---------|---------|
| 1 | Employee authority | Quote-generation scope and approval limits |
| 2 | Company and catalog context | Company description, products/services, applicable catalog/pricing data |
| 3 | Customer requirements | Customer details and stated needs |
| 4 | Existing quote state | Current line items, totals, assumptions, chain status |
| 5 | Pricing and validation rules | Currency, tax, discounts, required information, approval thresholds |
| 6 | Output/action contract | Create, update, or finalize the quote chain |

### Tools

Register only tools required to retrieve approved product, price, customer, or CRM data. The assistant must not invent SKUs, quoted prices, availability, or contractual terms where no grounded source is available.

### Schedule Behavior

Quote-chain work is not automatically schedule-gated. If it originates from a real customer contact, the caller must determine any communication timing separately; prompt construction does not ask the model to evaluate server time.

---

## Task Type: Customer Support

### Purpose

The `customer_support` task type responds to customer support requests using company policy, product knowledge, and customer-specific context.

### System Prompt Sections

| Order | Section | Content |
|------:|---------|---------|
| 1 | Support role and boundaries | What the agent can solve, refund/escalation authority |
| 2 | Company context | Products/services, customers, industry |
| 3 | Issue and history | Incoming question, ticket/thread history |
| 4 | Customer context | CRM details, prior interactions, account status |
| 5 | Knowledge / memory | Approved support knowledge and relevant durable facts |
| 6 | Response constraints | Concise resolution, next action, no fabricated policies |

### Tools

Register customer/account lookup, ticket/thread retrieval, and approved knowledge retrieval only if each integration is connected and the task requires it. Tool absence or empty results must be surfaced honestly rather than filled with guessed facts.

### Schedule Behavior

If support is responding to a real inbound contact, scheduling eligibility is decided in application code before the support prompt is built. It is never presented to the model as a time-evaluation task.

---

## Task Type: CRM Update

### Purpose

The `crm_update` task type extracts or validates structured CRM changes from grounded inputs such as an email, chat, or operator request.

### System Prompt Sections

| Order | Section | Content |
|------:|---------|---------|
| 1 | Data-management role | Strict rules for creating, updating, and linking records |
| 2 | Source material | Message/email/transcript from which fields may be extracted |
| 3 | Existing CRM record | Tenant-scoped account, contact, and interaction context |
| 4 | Field mapping and validation | Allowed fields, required values, deduplication rules |
| 5 | Output schema | Proposed structured changes and confidence; no unverified data |

### Tools

Register tenant-scoped CRM account/contact lookup and mutation tools only with appropriate authorization and explicit approval policy. The model must identify uncertainty rather than create fictitious contacts, account details, or interaction history.

### Schedule Behavior

CRM updates are internal operations and are not subject to OOO scheduling.

---

## Task Type: Lead Capture

### Purpose

The `lead_capture` task type extracts and qualifies prospective-customer data from an inbound message or conversation.

### System Prompt Sections

| Order | Section | Content |
|------:|---------|---------|
| 1 | Lead qualification role | ICP criteria, qualification rules, and handoff policy |
| 2 | Company context | Products/services, industry, target customer profile |
| 3 | Source message | The prospective customer's actual text/email and conversation history |
| 4 | Existing CRM context | Potential duplicates and prior interactions |
| 5 | Extraction schema | Name, organization, contact details, needs, qualification, follow-up action |

### Tools

Register CRM duplicate search and lead/account creation tools as authorized. Any values not present in the source material must be null or marked unknown, never inferred as fact.

### Schedule Behavior

For live chats and internal capture, do not schedule-gate. If the task triggers an external response to a real after-hours customer contact, the application layer—not the model—chooses whether an OOO template applies.

---

## Model Provider and Tool Calling

### Provider Requirement

The chat path must use a model/provider combination that reliably supports function/tool calling in the SDK path being used. The HAR trace reported `openai/gpt-oss-20b` through Groq; implementation must verify this exact model/SDK configuration supports the required tool-call response format.

### Required Fallback

If the configured Groq model does not reliably invoke tools:

1. Switch the `chat` task type to the TRD-documented `AI_PROVIDER=openai` fallback with a function-calling capable model; **or**
2. Implement an application-owned two-step flow: classify whether live email data is needed, execute the Gmail search/thread retrieval in code, inject the retrieved data into a final-generation context, and enforce the same no-fabrication rule.

Do not ship a prose-only chat path for questions that require connected data.

### Tool-Call Loop

```text
Model receives system prompt + user message + tool definitions
  -> Model requests one or more tool calls
  -> Application validates tool name and tenant context
  -> Application executes Gmail/CRM operation
  -> Application appends tool result to messages
  -> Model generates grounded final answer
  -> Output guard checks unsupported claims / empty-data cases
```

---

## Prompt Safety Invariants

These invariants must be covered by unit/integration tests:

1. Chat registers Gmail tools when the tenant has a connected Gmail integration.
2. Chat never receives the legacy shift-hours instruction.
3. Chat responses about emails are grounded in tool output or explicitly state that no data is available.
4. Shift-hours evaluation occurs only in application code, using the tenant timezone and schedule.
5. OOO template selection occurs only for eligible real inbound customer contacts outside configured hours.
6. Dashboard test-widget messages never enter the OOO path.
7. Every tool call enforces authenticated tenant isolation.
8. Incomplete company context blocks Employee activation or surfaces a clear completion requirement.

---

## Maintenance Rules

- Update this document in the same pull request as any change to `PromptAssembler`, any task worker, model-provider configuration, tool schema, or schedule policy.
- Add a regression test whenever a prompt section is introduced, removed, or made conditional.
- Treat prompt construction as application behavior, not hidden configuration: reviewers should be able to determine which data and instructions the model will receive for each task type.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-09-11 | Initial architecture documentation and Bug 1/2 remediation requirements | Auto-generated |
| | | |
