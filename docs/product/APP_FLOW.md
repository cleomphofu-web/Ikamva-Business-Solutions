# Ikamva — App Flow
**Version:** 2.0

---

## Flow 1 — New Client: Landing to Active Employee

```
Landing Page
  │
  ├─ "Start free" CTA
  │
  ▼
Sign Up (/signup)
  ├─ Google OAuth (preferred, top of form)
  └─ Email + Password
        │
        ▼
  Email Confirmation
  (SKIP_EMAIL_CONFIRMATION=true in dev bypasses this)
        │
        ▼
  Application Form (/apply)
  ├─ Company name
  ├─ Industry
  ├─ What do you need help with? (free text)
  └─ Submit
        │
        ▼
  "Application Pending" screen
  (client waits — admin notified by email)
        │
        ▼
  Admin approves in Admin Dashboard
        │
        ▼
  Client receives "Account Ready" email
        │
        ▼
  Client signs in → redirected to Employee Setup (/setup)

Employee Setup — 10 steps, each persisted on Continue
  Step 0:  Fast-track option ("Describe what you need")
           OR "Set it up myself →"
  Step 1:  Employee name, role, purpose, personality
  Step 2:  Company context (name, description, tone)
  Step 3:  Company Brain (document upload by category)
  Step 4:  Tool connections (Gmail OAuth)
  Step 5:  Skills (contextual to plan + connections)
  Step 6:  Permissions (per-tool read/write)
  Step 7:  Rules (always, never, needs approval, escalate)
  Step 8:  Schedule (days, hours, timezone)
  Step 9:  Capacity (review limits)
  Step 10: Review + Activate
           → POST /api/v1/workforce/employees/:id/activate
           → System prompt generated and stored
           → Employee lifecycle_status = 'active'
           → Redirect to /dashboard
```

---

## Flow 2 — Active Client: Daily Use

```
Sign In (/signin)
  │
  ▼
Dashboard (/dashboard)
  ├─ Panel: Pending approvals (count + quick link)
  ├─ Panel: Today's activity (tasks handled)
  └─ Panel: Employee health (Connected/Auth warning)
        │
        ├─ → Approvals tab
        ├─ → Mission Control (chat + live chain ticker)
        └─ → Logs tab

Mission Control (/dashboard/mission-control)
  ├─ Overview: Chat with Employee
  │     └─ Live "Employee is working" panel when chain active
  ├─ Approvals: Pending approval cards
  │     ├─ Draft preview
  │     ├─ Original email context
  │     ├─ [Approve] → email sends, audit trail written
  │     └─ [Reject] → draft deleted, audit trail written
  └─ Logs: Chain history, memory timeline, activity feed
```

---

## Flow 3 — Incoming Email → Quote Sent

```
Gmail inbox receives: "I need a quote for 50 units"
        │
        ▼
EmailTriageWorker (polls every 5 min)
  ├─ Creates email_triage task (idempotency key: gmail_message_id)
  ├─ Calls AI: classify email category
  ├─ Result: { requires_response: true, category: "quote_request" }
  └─ Checks: tenant has quotes_and_invoicing skill + in plan?
        │
        ├─ NO → mark read, write email_skipped memory, done
        └─ YES → enqueue email_response task chain
                      │
                      ▼
TaskChainService.createChain()
  Creates 6 child tasks with parent_task_id:

  [1] email_read     → extract sender, subject, body, thread_id
  [2] crm_lookup     → find sender in crm_contacts (non-required)
  [3] quote_generate → AI generates quote using Company Brain
  [4] email_draft    → format as branded email, create Gmail draft
  [5] approval_gate  → create approval record, send Resend notification
                       transition chain to awaiting_human
                       ← CLIENT SEES APPROVAL IN DASHBOARD
  [6] email_send     → on approval: send Gmail draft
                       on rejection: delete Gmail draft

Both paths:
  → Write audit trail to task_logs
  → Write memory row to ai_employee_memory
  → Update task_chains Realtime row → ticker updates in browser
```

---

## Flow 4 — Fast-Track Employee Setup

```
Client types: "I need someone to handle customer quote
               requests from Gmail and send approved replies"
        │
        ▼
POST /api/v1/workforce/employees/parse-intent
  → AI classifies intent
  → Returns:
    {
      skills: ["email_management", "quotes_and_invoicing"],
      integrations_needed: ["gmail"],
      industry_hint: "professional_services",
      personality_hint: "professional",
      role_hint: "Customer Operations Specialist"
    }
        │
        ▼
Form pre-filled with parsed values
Review screen: "Does this look right?"
  ├─ Edit any section
  └─ Confirm → continue to Tool Connections (Step 4)
```

---

## Flow 5 — Gmail OAuth Connection

```
Client clicks "Connect Gmail" on Tool Connections step
        │
        ▼
Frontend calls GET /api/v1/integrations/gmail/connect
  → Backend returns Google consent URL
        │
        ▼
window.location.href = consentUrl
(navigates current tab to Google)
        │
        ▼
Client consents on Google
        │
        ▼
Google redirects to:
GET /api/v1/integrations/gmail/callback?code=...
  → Backend exchanges code for tokens
  → Encrypts refresh token (AES-256-GCM)
  → Stores in tenant_integrations
  → Redirects to /setup?step=4&connected=gmail
        │
        ▼
Tool Connections step shows:
  Gmail — ● Connected — user@gmail.com — [Disconnect]
Skills step unlocks skills requiring gmail.readonly
```

---

## Flow 6 — Plan Limit Enforcement

```
Client (on Starter plan) triggers a chain
that requires quotes_and_invoicing skill
        │
        ▼
WorkerEngine.processTask()
  → loadEntitlements(tenantId)
  → check: skillPlans['quotes_and_invoicing'] = 'professional'
  → check: tenant.plan = 'starter'
  → FAIL: throw new PlanLimitError('quotes_and_invoicing', 'professional')
        │
        ▼
Task written to task_logs with:
  to_status: 'PLAN_LIMIT'
  message: "Skill 'quotes_and_invoicing' requires plan: professional"
        │
        ▼
Client sees in dashboard:
  "This task requires the Professional plan.
   Upgrade to unlock Quote & Invoice handling. →"
```

---

## Screen Inventory

| Spec route | Implemented as | Screen | Auth required |
|---|---|---|---|
| / | / | Landing page | No |
| /signup | /signup | Sign up | No |
| /signin | /signin | Sign in | No |
| /verify-email | /verify-email | Email confirmation | No |
| /apply | → redirects to /signup | Application form | No |
| /application-pending | /application-pending | Waiting screen | No |
| /setup | → redirects to /dashboard/onboarding | Employee setup (10 steps) | Yes (client) |
| /dashboard | /dashboard | Main dashboard + chat | Yes (client) |
| /dashboard/mission-control | → redirects to /dashboard | Chat + approvals + logs overview | Yes (client) |
| /dashboard/approvals | /dashboard/approvals | Approvals queue | Yes (client) |
| /dashboard/logs | /dashboard/logs | Activity logs + chains | Yes (client) |
| /dashboard/billing | /dashboard/billing | Plan and usage | Yes (client) |
| /dashboard/settings | → redirects to /dashboard/account | Employee settings | Yes (client) |
| /admin | /admin | Admin dashboard | Yes (admin) |
| /admin/applications | /admin/applications | Application review | Yes (admin) |
| /admin/subscribers | /admin/subscribers | Client list | Yes (admin) |
| /admin/tasks | /admin/tasks | Task monitor | Yes (admin) |

> **Implementation note:** `/apply`, `/setup`, `/dashboard/mission-control`, and `/dashboard/settings`
> are canonical spec paths maintained as client-side redirects for external links and bookmark
> compatibility. The actual implementations live at the routes listed in "Implemented as".
