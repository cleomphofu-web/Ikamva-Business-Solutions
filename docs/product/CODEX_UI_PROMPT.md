# Ikamva — UI Implementation Prompt for Codex
**Reference image:** Dark teal portfolio UI with bold white typography, clean nav, image cards

---

## Design System to Inherit

### Color tokens
```css
--color-base:        #323232   /* unified dark background */
--color-surface:     rgba(50, 50, 50, 0.4) /* glass panel background */
--color-accent:      #FC6F20   /* primary action, buttons, indicators */
--color-text-primary:#FEE8D0   /* headlines and primary text */
--color-text-secondary: rgba(254, 232, 208, 0.6) /* supporting text, captions */
--color-border:      rgba(254, 232, 208, 0.1) /* subtle glass border */
```

### Typography
Two fonts only. Both self-hosted via @fontsource.

```css
/* Display — headings, Employee names, large numbers */
font-family: 'Space Grotesk', sans-serif;
/* weights: 500 (medium), 700 (bold) */

/* Body — UI text, labels, prose */
font-family: 'Plus Jakarta Sans', sans-serif;
/* weights: 400 (regular), 500 (medium), 600 (semibold) */
```

Type scale:
```css
--text-display: clamp(2.5rem, 6vw, 5rem) / 700 / Space Grotesk / letter-spacing: -0.03em
--text-headline: clamp(1.5rem, 3vw, 2.5rem) / 700 / Space Grotesk / letter-spacing: -0.02em
--text-title: 1.25rem / 600 / Plus Jakarta Sans
--text-body: 1rem / 400 / Plus Jakarta Sans / line-height: 1.6
--text-small: 0.875rem / 500 / Plus Jakarta Sans
--text-caption: 0.75rem / 400 / Plus Jakarta Sans / letter-spacing: 0.01em
```

### Spacing and radius
```css
--radius-sm:  4px
--radius-md:  8px
--radius-lg:  16px
--radius-xl:  24px

/* Sections breathe — minimum 80px vertical padding */
/* Cards: 24px internal padding */
/* Form inputs: 12px vertical, 16px horizontal */
```

### Shadows
```css
--shadow-card: 0 2px 16px rgba(0, 0, 0, 0.4)
--shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.5)
/* No soft rgba(0,0,0,0.1) shadows — too light for this dark theme */
```

---

## Landing Page

### Hero section
Full viewport height. Left-aligned content. Right side: abstract visual of the Employee "working" — could be animated dots showing task steps completing, or a screenshot montage of the approval interface.

```
┌─────────────────────────────────────────────────────┐
│  IKAMVA                              Sign in  Start  │
│                                                      │
│                                                      │
│  Your business,                                      │
│  handled.          [rotating text component]         │
│                                                      │
│  Sjava handles your quote requests,                  │
│  customer emails, and follow-ups —                   │
│  while you approve what matters.                     │
│                                                      │
│  [Start free — no card required]                     │
│                                                      │
│                         [Right: visual/mockup]       │
└─────────────────────────────────────────────────────┘
```

Rotating text cycles every 3 seconds with CSS crossfade (not JS animation library):
- "handled."
- "automated."
- "responded to."
- "followed up."

### How it works — 3 steps (not numbered markers, use icons)
```
[Inbox icon]           [Brain icon]         [Checkmark icon]
Connect Gmail          Teach your Employee  Approve and go
One OAuth click.       Upload your SOPs,    Review what
Your Employee starts   price lists, FAQs.   Sjava drafted.
monitoring immediately.She learns your       Send with one click.
                       business in minutes.
```

### Proof section — stats, not testimonials (no fake reviews)
```
Average time to first AI action:    < 2 hours
Quote emails handled per client:    47 per month
Time saved per client:              6 hours per week
```

### Pricing — 3 tiers, clean cards
Starter / Professional / Business. Professional marked as "Most popular" with accent border. "Start free" CTA on all three — do not use "Get started" (vague).

### Footer — minimal
Logo | Links: Privacy, Terms, Contact | © 2025 Ikamva

---

## Sign Up / Sign In Pages

Two-panel layout:
- Left: dark surface panel with rotating quote from a satisfied client (placeholder initially) and the Ikamva logo
- Right: clean form on the base background

Sign up form order:
1. "Continue with Google" button — prominent, full width, at the top
2. Divider: "or sign up with email"
3. Email field
4. Password field with strength hint ("At least 8 characters")
5. "Create account" button
6. "Already have an account? Sign in →" link

No captcha at this stage.

---

## Application Form (/apply)

Single page, not multi-step. Clean and fast.

```
What's your company called?
[Company name input]

What industry are you in?
[Dropdown: same industry categories as Employee setup]

What do you need help with?
[Textarea — "e.g. We get 30 quote requests a day and need help responding"]

What's the best email to reach you?
[Email — pre-filled if available from auth session]

[Submit application]

"We review every application within 24 hours."
```

---

## Employee Setup (/setup)

### Progress indicator
Top of page: horizontal step bar. Each step is a thin line segment — filled for completed, accent for current, dim for upcoming. Step name shows only for current step. No numbers.

```
━━━━━━━━━━ ━━━━━━━━━━ ━━━━━━━━━━ ───────── ─────────
  done        done      IDENTITY   upcoming  upcoming
```

### Step 0 — Fast-track (shown first, opt-in)
```
┌─────────────────────────────────────────────────────┐
│  What do you need your Employee to handle?           │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ e.g. "Handle customer quote requests from     │  │
│  │       Gmail and send approved replies"        │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  [Set up for me →]    [I'll set it up myself →]     │
└─────────────────────────────────────────────────────┘
```

### Step 1 — Identity
Large Employee avatar (initials, generated from name). Fields:
- Employee name (text input — large, prominent)
- Role (dropdown: Customer Operations, Sales Support, Admin, Research)
- Purpose (single sentence textarea, 120 char limit with live counter)
- Personality (dropdown: Professional, Warm and approachable, Direct and concise, Technical)

### Step 2 — Company context
- Company name (pre-filled from application)
- One-sentence description (120 char limit)
- Communication tone (dropdown — same as personality but for company voice)
- What Sjava must never do (textarea with example in placeholder)
- What to do when she cannot answer (dropdown: Escalate by email / Say "I'll follow up" / Ask to call)

### Step 3 — Company Brain
Category-aware document upload. Show 3 universal slots + category-specific slots based on industry.

Each slot:
```
┌─────────────────────────────────────────────────────┐
│ Company FAQ                                          │
│ Questions customers ask most often and your answers  │
│                                                      │
│ [📎 Upload PDF, DOCX, or TXT]  or  [Paste text]    │
│                                                      │
│  No file uploaded yet              [Skip for now]   │
└─────────────────────────────────────────────────────┘
```

After upload:
```
┌─────────────────────────────────────────────────────┐
│ Company FAQ                          ✓ Ready         │
│ FAQ_2024.pdf — 2.3 MB — 47 chunks processed         │
│                                      [Replace]       │
└─────────────────────────────────────────────────────┘
```

### Step 4 — Tool connections
Each integration card:

**Disconnected:**
```
┌─────────────────────────────────────────────────────┐
│  Gmail                                               │
│  Read customer threads and draft approved replies    │
│                               [Connect Gmail]        │
└─────────────────────────────────────────────────────┘
```

**Connected:**
```
┌─────────────────────────────────────────────────────┐
│  Gmail                         ● Connected           │
│  business@yourcompany.com      Connected 2 min ago   │
│                               [Disconnect]           │
└─────────────────────────────────────────────────────┘
```

Other tools show "Coming soon" pill — not a broken Connect button.

### Step 5 — Skills
Each skill card has exactly one of three states:

**Available (integration connected, plan includes):**
```
┌─────────────────────────────────────────────────────┐
│  Email Management                           [toggle] │
│  Triage inbox, label threads, draft replies          │
│  Needs: gmail.readonly, gmail.send — ✓ Connected    │
└─────────────────────────────────────────────────────┘
```

**Integration missing:**
```
┌─────────────────────────────────────────────────────┐
│  Calendar Management                    [disabled]   │
│  Book and manage appointments                        │
│  Needs: Google Calendar — [Connect Calendar first]  │
└─────────────────────────────────────────────────────┘
```

**Plan upgrade required:**
```
┌─────────────────────────────────────────────────────┐
│  Research                               [locked 🔒] │
│  Gather and summarise information                    │
│  Requires Business plan — [Upgrade to unlock]       │
└─────────────────────────────────────────────────────┘
```

### Step 6 — Permissions
Plain-English cards, not a checkbox grid:
```
Can [Employee name] read your emails?     [Yes] [No]
Can [Employee name] draft email replies?  [Yes] [No]
Can [Employee name] send emails after     [Yes] [No]
your approval?
```

Never show "Delete emails" in onboarding.

### Step 7 — Rules
Guided prompts with placeholder examples:
```
[Employee name] should always...
placeholder: "Greet customers by name. Confirm appointments 24 hours before."

[Employee name] must never...
placeholder: "Share pricing without checking the price list."

[Employee name] needs your approval before...
placeholder: "Any email promising a refund."

When should [Employee name] escalate immediately?
placeholder: "Legal threats. Angry or abusive messages."
```

### Step 8 — Schedule
Day toggles (Mon–Fri selected by default), time range, timezone (auto-detected, editable).
Subtitle: "She works only in the hours you set. Outside these hours, tasks are queued for the next slot."

### Step 9 — Capacity
Read-only display of plan limits. No editing.
```
Your plan: Professional
AI calls per hour: 500
Monthly email tasks: Unlimited
Monthly token budget: 500,000 tokens
```

### Step 10 — Review + Activate
Summary of all configuration. Edit link on each section.
"Activate [Employee name]" button — calls activate endpoint, shows brief animation, navigates to /dashboard only after confirmed 200 response.

---

## Dashboard (/dashboard)

### Three-panel top section
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Pending approvals│ │ Today's activity │ │ Sjava's status   │
│                  │ │                  │ │                  │
│       3          │ │  12 emails read  │ │  ● Active        │
│                  │ │   2 quotes sent  │ │  Gmail connected │
│ [Review now →]  │ │   1 lead logged  │ │  Last active 4m  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Below: recent activity feed. Timeline of completed actions.

---

## Mission Control

### Overview tab
Full-width chat interface. Above chat (when chain is active):

```
┌─────────────────────────────────────────────────────────┐
│  Sjava is working on: Quote request — James Mokoena     │
│                                                          │
│  Reading email          ✓ complete                      │
│  Looking up customer    ✓ complete — Found in CRM       │
│  Generating quote       ⟳ working...                   │
│  Drafting email         · pending                       │
│  Awaiting your approval · pending                       │
│  Sending reply          · pending                       │
└─────────────────────────────────────────────────────────┘
```

When chain reaches `awaiting_human`:
```
┌─────────────────────────────────────────────────────────┐
│  ✓ Quote ready for your review                          │
│  [Go to Approvals →]                                    │
└─────────────────────────────────────────────────────────┘
```

### Approvals tab
Each pending approval card:
```
┌─────────────────────────────────────────────────────────┐
│  Reply to: james.mokoena@example.com                    │
│  Re: Quote request — 50 units premium package           │
│  Received: 2 hours ago                                  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Good day James,                                   │  │
│  │                                                   │  │
│  │ Thank you for reaching out. Based on your         │  │
│  │ request for 50 units of our premium package,      │  │
│  │ please see the quote below...                     │  │
│  │                                              [+]  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [✓ Approve and send]    [✗ Reject]                     │
└─────────────────────────────────────────────────────────┘
```

### Logs tab
Timeline of all chain activity. Each chain expandable to show step-by-step timeline.

## Glassmorphism Design System

Every main container, sidebar, and floating element must use the `.glass-panel` effect.

```css
.glass-panel {
  background: rgba(50, 50, 50, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(254, 232, 208, 0.1);
  border-radius: 1rem;
}
```

Additional interactive traits:
- Interactive elements (buttons, cards) must apply `transform: scale(0.83)` on hover using `.hover-scale`.
- Main flexible containers must apply `flex: 1` using `.flex-1-container`.
- The chat input and primary action buttons must be deeply rounded pills using `.pill-radius` (`border-radius: 107px`).

---

## Implementation Rules for Codex

1. Import Space Grotesk and Plus Jakarta Sans from @fontsource — do not use Google Fonts CDN links.
2. All color values must use the CSS custom properties above — no hardcoded hex values in component files.
3. Dark theme is the only theme — do not add a theme toggle, do not add light mode classes.
4. Use Tailwind for layout and spacing. Use CSS custom properties for brand colors, not Tailwind color utilities (no `bg-blue-500`).
5. No loading spinners that persist more than 200ms without showing progress.
6. Error states must say what went wrong and what to do — never show "Something went wrong" alone.
7. Empty states must invite action — never show a blank component with nothing to do.
8. Every button must have a visible disabled state when its action is unavailable.
9. The Employee name must never be hardcoded anywhere — always read from the employee record or show "Your Employee" as fallback.
10. Mobile-responsive down to 375px minimum width.
