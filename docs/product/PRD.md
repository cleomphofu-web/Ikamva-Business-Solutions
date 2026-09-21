# Ikamva — Product Requirements Document
**Version:** 2.0 | **Status:** Active | **Owner:** Cleo

---

## 1. Problem Statement

Small and medium businesses in South Africa lose hours every week to repetitive communication tasks — responding to quote requests, following up on invoices, answering FAQ emails, booking appointments, updating CRM records. Hiring a full-time admin employee to handle this costs R12,000–R25,000 per month. A virtual assistant is cheaper but unreliable, unavailable after hours, and cannot act on your business systems.

Ikamva gives every SME an AI Employee — a configurable autonomous agent that handles incoming business communication, executes multi-step tasks, and only asks the business owner for approval before taking irreversible actions like sending emails.

**Core promise:** The AI does the work. You approve the important decisions. Nothing sensitive happens without your say-so.

---

## 2. Who This Is For

### Primary User: The SME Business Owner
- 1–20 employees
- Receives 20–200 emails per day
- Uses Gmail for business communication
- Has no in-house developer
- Is price-sensitive but will pay for something that demonstrably saves time
- Industries: Professional Services, Retail, Healthcare, Real Estate, Trade Services, Education

### Secondary User: The Admin Employee or Office Manager
- Uses the dashboard daily on behalf of the business owner
- Reviews and approves AI actions
- Uploads company documents to the Company Brain
- Monitors the Employee activity log

### What They Are Not
- Enterprise companies with IT departments (they use Salesforce, Zendesk, etc.)
- Technical users who want to build custom workflows
- Companies outside South Africa in the near term

---

## 3. What Ikamva Is Not

- Not a chatbot widget for websites
- Not a no-code automation builder (Zapier, Make)
- Not a CRM replacement
- Not a call centre solution
- Not a general-purpose AI assistant

---

## 4. Core Product Concepts

### 4.1 The AI Employee
Each client configures one named AI Employee. The Employee has:
- A name (client-chosen)
- A role (Customer Operations, Sales, Admin)
- A personality (communication style)
- Company context (who the company is, what they do)
- A Company Brain (uploaded documents, SOPs, price lists, FAQs)
- Skills (which tasks it is allowed to perform)
- Permissions (which systems it can read/write)
- Rules (hard limits it can never cross)
- A schedule (working hours and timezone)
- Connected tools (Gmail, Calendar, etc.)

### 4.2 Skills
Each skill is a category of work the Employee can perform. Skills require integrations and plan entitlements:

| Skill | What it does | Requires |
|---|---|---|
| Customer Support | Answers customer questions using Company Brain | gmail.readonly |
| Email Management | Triages inbox, labels, drafts approved replies | gmail.readonly, gmail.send |
| Quote & Invoice | Generates quotes from pricing data, sends after approval | gmail.readonly, gmail.send |
| Calendar Management | Books and manages appointments | calendar.events |
| CRM Update | Updates contact records from email content | gmail.readonly |
| Lead Capture | Identifies and logs new leads | gmail.readonly |

### 4.3 The Approval Gate
Every action that changes the real world (sending email, updating a record, booking a meeting) requires an explicit human approval. The Employee drafts; the human decides. This is the non-negotiable safety contract with every client.

### 4.4 Task Chains
Complex work is broken into sequential steps called chains. A quote request chain is: read email → look up customer → generate quote → draft email → await approval → send. Each step is a discrete task in the queue. If a required step fails, the chain fails and the client is notified.

### 4.5 Company Brain
A vector knowledge base built from uploaded documents. When the Employee answers questions or generates content, it retrieves the most relevant chunks from this brain rather than hallucinating. Clients upload: FAQs, price lists, SOPs, playbooks, policies.

---

## 5. User Journey

### 5.1 Landing → Signup
1. Client lands on Ikamva.co.za
2. Rotating headline addresses their specific pain by industry
3. "Start free — no card required" CTA
4. Sign up with Google or email
5. Email confirmation (required)
6. Optional: "Set up for me" prompt — client describes what they need in plain English; system pre-fills onboarding from intent

### 5.2 Application → Approval
7. Client submits a brief application (company name, industry, what they need)
8. Ikamva admin reviews and approves within 24 hours
9. Client receives email: "Your account is ready"
10. Client logs in and begins Employee setup

### 5.3 Employee Setup (10 steps, each persisted immediately)
1. Employee name and role
2. Company context (name, one-sentence description, tone)
3. Company Brain (document upload by category)
4. Tool connections (Gmail OAuth)
5. Skills selection (only unlockable skills shown based on plan + connections)
6. Permissions (read/write per tool)
7. Rules (always, never, escalate, needs approval)
8. Schedule (days, hours, timezone)
9. Capacity (monthly limits display)
10. Review and activate

### 5.4 Active Use
- Client receives approval notification emails
- Client reviews and approves/rejects in Mission Control
- AI handles the rest autonomously
- Dashboard shows: pending approvals, today's activity, Employee health status

### 5.5 Upgrade
- Upgrade prompt appears at the moment of first completed value delivery
- Skill-specific upsell: "Unlock Calendar Management — R299/month"

---

## 6. Plans and Pricing

| Plan | Price (ZAR) | Included Skills | AI Calls/hour | Employees |
|---|---|---|---|---|
| Starter | R499/month | Customer Support, Email Management | 100 | 1 |
| Professional | R999/month | All Starter + Quotes, CRM Update, Lead Capture | 500 | 1 |
| Business | R2,499/month | All + Calendar, Research | 2,000 | 3 |
| Enterprise | Custom | All | Unlimited | Unlimited |

14-day free trial on Professional. No credit card required to start.

---

## 7. Success Metrics

- Time to first AI action completed: target < 48 hours from signup
- Approval rate (actions approved vs rejected): target > 70% (measures AI accuracy)
- Client retention at 90 days: target > 60%
- Average approvals per client per week: target 10–50 (measures active use)
- NPS: target > 40

---

## 8. Out of Scope for v1

- Voice calling
- WhatsApp integration
- Multi-language support (English only)
- Slack/Teams integration
- Automated billing (manual upgrade process initially)
- iOS/Android apps
- White-labelling
