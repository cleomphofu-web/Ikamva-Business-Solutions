# Ikamva — Backend Schema
**Version:** 2.0 | Database: Supabase PostgreSQL

---

## Core Tables

### tenants
```sql
id                  uuid primary key default gen_random_uuid()
name                text not null
slug                text unique not null
plan                text not null default 'starter'
  -- check: in ('starter', 'professional', 'business', 'enterprise')
status              text not null default 'pending'
  -- check: in ('pending', 'active', 'suspended', 'cancelled')
webhook_token       text unique not null  -- 32-byte URL-safe random
owner_email         text not null
trial_ends_at       timestamptz
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
```

### tenant_users
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
user_id             uuid not null references auth.users(id)
role                text not null default 'member'
  -- check: in ('owner', 'admin', 'member')
status              text not null default 'active'
  -- check: in ('active', 'inactive', 'invited')
created_at          timestamptz not null default now()
unique (tenant_id, user_id)
```

### ai_employees
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
name                text not null
role                text
mission             text
personality         text
description         text
responsibilities    jsonb default '[]'
configuration       jsonb default '{}'
  -- contains: company_name, industry, description, products,
  --           customers, tone, system_prompt, skills, tools,
  --           escalation_policy, industry_category
rules               jsonb default '{}'
  -- contains: always[], never[], needs_approval[], escalate_when[]
schedule            jsonb default '{}'
  -- contains: days[], start_time, end_time, timezone
monthly_hours_limit integer default 160
token_limit         integer default 100000
setup_step          text default '1'
lifecycle_status    text not null default 'draft'
  -- check: in ('draft', 'active', 'paused', 'archived')
runtime_status      text default 'idle'
  -- check: in ('idle', 'processing', 'error')
activated_at        timestamptz
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
```

### tenant_integrations
```sql
id                          uuid primary key default gen_random_uuid()
tenant_id                   uuid not null references tenants(id)
provider                    text not null  -- 'gmail', 'calendar', 'drive'
status                      text not null default 'disconnected'
  -- check: in ('pending', 'connected', 'disconnected', 'failed', 'disabled')
access_token_encrypted      text  -- AES-256-GCM encrypted
access_token_expires_at     timestamptz
refresh_token_encrypted     text not null  -- AES-256-GCM encrypted
scopes                      text[]
account_email               text  -- display only, never used for auth
connected_at                timestamptz
last_refreshed_at           timestamptz
error_message               text
created_at                  timestamptz not null default now()
updated_at                  timestamptz not null default now()
unique (tenant_id, provider)
```

---

## Queue & Execution

### task_queue
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
employee_id         uuid references ai_employees(id)
parent_task_id      uuid references task_queue(id)
step_index          integer not null default 0
step_name           text
chain_config        jsonb
  -- contains: steps[], on_step_failure, failure_notification
task_type           text not null
  -- 'chat', 'email_triage', 'email_response', 'email_read',
  -- 'crm_lookup', 'quote_generate', 'email_draft',
  -- 'approval_gate', 'email_send'
payload             jsonb not null default '{}'
normalized_payload  jsonb not null default '{}'
status              text not null default 'pending'
  -- check: in ('pending', 'processing', 'completed', 'failed',
  --            'awaiting_human', 'cancelled')
priority            integer not null default 5
idempotency_key     text not null unique
retry_count         integer not null default 0
max_retries         integer not null default 3
locked_at           timestamptz
locked_by           text
scheduled_for       timestamptz not null default now()
completed_at        timestamptz
failed_at           timestamptz
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()

index: (status, scheduled_for) where status = 'pending'
index: (parent_task_id) where parent_task_id is not null
index: (tenant_id, status)
```

### task_logs
```sql
id                  uuid primary key default gen_random_uuid()
task_id             uuid not null references task_queue(id)
tenant_id           uuid not null references tenants(id)
from_status         text
to_status           text not null
  -- 'TASK_CREATED', 'WORKER_STARTED', 'VALIDATION_STARTED',
  -- 'VALIDATION_COMPLETED', 'QUOTA_APPROVED', 'PLAN_LIMIT',
  -- 'SKILL_DISABLED', 'AI_REQUESTED', 'AI_COMPLETED',
  -- 'AWAITING_HUMAN', 'HUMAN_APPROVED', 'HUMAN_REJECTED',
  -- 'GMAIL_SENT', 'CHAIN_COMPLETED', 'CHAIN_FAILED',
  -- 'TASK_RECOVERED', 'INTEGRATION_AUTH_FAILED'
message             text
metadata            jsonb not null default '{}'
  -- contains: provider, model, token_usage, system_prompt,
  --           result, error, step_name, draft_id
created_by          text
created_at          timestamptz not null default now()

index: (task_id, created_at)
index: (tenant_id, created_at desc)
```

### task_chains (Realtime ticker)
```sql
id                  uuid primary key default gen_random_uuid()
parent_task_id      uuid not null references task_queue(id) unique
tenant_id           uuid not null references tenants(id)
chain_type          text not null
current_step_index  integer not null default 0
current_step_name   text
total_steps         integer not null
status              text not null default 'running'
  -- check: in ('running', 'awaiting_human', 'completed', 'failed')
context             jsonb not null default '{}'
  -- accumulated chain context passed between steps
started_at          timestamptz not null default now()
completed_at        timestamptz
updated_at          timestamptz not null default now()

-- Enable Realtime on this table for live ticker
```

### approval_queue
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
task_id             uuid references task_queue(id)
chain_id            uuid references task_chains(id)
action_type         text not null  -- 'gmail.send', 'calendar.create', etc.
action_payload      jsonb not null default '{}'
  -- contains: draft_id, recipient, subject, preview, thread_id
status              text not null default 'pending'
  -- check: in ('pending', 'approved', 'rejected', 'expired')
decided_by          uuid references auth.users(id)
decided_at          timestamptz
expires_at          timestamptz  -- optional auto-expiry
created_at          timestamptz not null default now()
```

---

## Memory & Knowledge

### ai_employee_memory
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
employee_id         uuid not null references ai_employees(id)
task_id             uuid references task_queue(id)
thread_id           text  -- Gmail thread ID if email-sourced
source              text not null default 'chat'
  -- check: in ('chat', 'email', 'crm', 'system')
memory_type         text not null
  -- check: in ('interaction', 'fact', 'preference',
  --            'task_completed', 'email_sent', 'email_skipped',
  --            'email_rejected')
content             text not null  -- compressed summary, not raw
metadata            jsonb not null default '{}'
  -- contains: user_message_preview, response_preview,
  --           tokens_used, model, sender, subject
created_at          timestamptz not null default now()

index: (employee_id, created_at desc)
index: (employee_id, thread_id) where thread_id is not null
```

### company_knowledge
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
employee_id         uuid references ai_employees(id)
source_file         text not null
source_type         text not null
  -- check: in ('pdf', 'docx', 'txt', 'csv', 'url', 'paste')
document_category   text
  -- check: in ('faq', 'price_list', 'sop', 'policy',
  --            'playbook', 'template', 'compliance', 'other')
chunk_index         integer not null
content             text not null
embedding           vector(1536)
token_count         integer
created_at          timestamptz not null default now()

index (HNSW): (embedding vector_cosine_ops)
index: (tenant_id, document_category)
```

---

## CRM

### crm_contacts
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
email               text
first_name          text
last_name           text
company             text
phone               text
account_tier        text  -- 'standard', 'vip', 'wholesale'
source              text  -- 'email', 'manual', 'lead'
metadata            jsonb default '{}'
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()

index: (tenant_id, email)
```

### crm_accounts
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
name                text not null
industry            text
status              text default 'active'
metadata            jsonb default '{}'
created_at          timestamptz not null default now()
```

---

## Usage & Billing

### tenant_usage_windows
```sql
tenant_id           uuid not null references tenants(id)
window_start        timestamptz not null  -- truncated to hour
ai_calls_count      integer not null default 0
tokens_used         integer not null default 0
primary key (tenant_id, window_start)
```

### employee_activity_logs
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid not null references tenants(id)
employee_id         uuid references ai_employees(id)
task_id             uuid references task_queue(id)
action              text not null
tool_name           text
duration_ms         integer
result              jsonb
error               jsonb
token_usage         jsonb
  -- contains: prompt_tokens, completion_tokens, total_tokens
estimated_cost      numeric(10, 6)
metadata            jsonb default '{}'
occurred_at         timestamptz not null default now()

index: (tenant_id, occurred_at desc)
index: (employee_id, occurred_at desc)
```

---

## Platform

### client_applications
```sql
id                  uuid primary key default gen_random_uuid()
user_id             uuid references auth.users(id)
company_name        text not null
industry            text
description         text
status              text not null default 'pending'
  -- check: in ('pending', 'approved', 'rejected')
reviewed_by         uuid references auth.users(id)
reviewed_at         timestamptz
notes               text
created_at          timestamptz not null default now()
```

### notifications
```sql
id                  uuid primary key default gen_random_uuid()
tenant_id           uuid references tenants(id)
user_id             uuid references auth.users(id)
type                text not null
title               text not null
body                text
read                boolean default false
action_url          text
created_at          timestamptz not null default now()
```

---

## RLS Policy Summary

Every table above has RLS enabled. Policy pattern is identical:
- `admin` and `platform_admin` roles: full access
- Authenticated tenant members: access to their own `tenant_id` only
- Unauthenticated: no access

Exception: `client_applications` — the applying user can read their own application row even before being a tenant member.

---

## Postgres Functions

### match_company_knowledge
```sql
create or replace function match_company_knowledge(
  query_embedding vector(1536),
  match_tenant_id uuid,
  match_count int default 3
)
returns table (id uuid, content text, similarity float)
language sql stable
as $$
  select id, content,
    1 - (embedding <=> query_embedding) as similarity
  from company_knowledge
  where tenant_id = match_tenant_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
```
