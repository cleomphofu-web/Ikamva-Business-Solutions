# API Reference

This document describes all actual API routes in the Ikamva system, generated from the codebase.

> **Note:** This document should be regenerated whenever new routes are added or existing routes are modified. Any divergence from the TRD should be explicitly flagged.

---

## Authentication

All API routes (except public health checks) require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The token is issued upon login and contains tenant context for multi-tenant scoping.

---

## Workforce API

### Chat

#### `POST /api/v1/workforce/chat`

Creates a new chat session or sends a message in an existing chat.

**Auth Required:** Yes

**Request Body:**
```typescript
{
  tenantId: string;
  employeeId: string;
  message: string;
  sessionId?: string;  // Optional: existing session ID for continuing conversation
  isTestWidget?: boolean;  // True if from dashboard test widget (affects OOO logic)
}
```

**Response (Success):**
```typescript
{
  sessionId: string;
  response: string;
  timestamp: string;  // ISO 8601
}
```

**Response (Error):**
```typescript
{
  error: string;
  code: string;
}
```

**Service/Repository Called:**
- `ChatWorker.handleChat()` - Main chat handling logic
- `PromptAssembler.buildChatPrompt()` - Constructs system prompt for chat task_type
- `GmailService.searchRecentEmails()` - If email tools are invoked (Bug 1 fix)
- `GmailService.getEmailThread()` - If thread retrieval needed

**TRD Divergence Notes:**
- This endpoint exists in implementation but was not in original TRD
- Tool registration for chat was missing (Bug 1)
- OOO logic was incorrectly injected on every turn (Bug 2)

---

#### `GET /api/v1/workforce/chat/:id/status`

Retrieves the status of a chat session.

**Auth Required:** Yes

**Path Parameters:**
- `id` - Chat session ID

**Response (Success):**
```typescript
{
  sessionId: string;
  status: 'active' | 'closed' | 'escalated';
  lastActivity: string;  // ISO 8601
  messageCount: number;
}
```

**Service/Repository Called:**
- `ChatRepository.getSessionStatus()`

**TRD Divergence Notes:**
- Not documented in original TRD

---

#### `POST /api/v1/workforce/chains`

Creates or updates a quote chain (multi-turn quote generation workflow).

**Auth Required:** Yes

**Request Body:**
```typescript
{
  tenantId: string;
  employeeId: string;
  chainId?: string;  // Optional: existing chain ID
  action: 'create' | 'update' | 'finalize';
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  customerContext?: {
    name: string;
    email: string;
    requirements: string;
  };
}
```

**Response (Success):**
```typescript
{
  chainId: string;
  status: 'draft' | 'finalized';
  quote: {
    items: Array<...>;
    subtotal: number;
    tax: number;
    total: number;
  };
}
```

**Service/Repository Called:**
- `QuoteChainWorker.handleChain()`
- `PromptAssembler.buildQuoteChainPrompt()`

**TRD Divergence Notes:**
- Implementation details may differ from TRD spec

---

## CRM API

### Accounts

#### `GET /api/v1/crm/accounts/summary`

Returns a summary of CRM accounts for the tenant.

**Auth Required:** Yes

**Query Parameters:**
- `limit?: number` - Maximum accounts to return (default: 50)
- `offset?: number` - Pagination offset
- `status?: 'active' | 'inactive' | 'all'` - Filter by account status

**Response (Success):**
```typescript
{
  accounts: Array<{
    id: string;
    name: string;
    status: string;
    lastContact: string | null;
    email: string | null;
    phone: string | null;
  }>;
  total: number;
  hasMore: boolean;
}
```

**Response (Error):**
```typescript
{
  error: string;
  code: string;
  // Bug 3: This endpoint currently returns 500
  // Stack trace should be logged and fixed
}
```

**Service/Repository Called:**
- `CRMRepository.getAccountSummary()`
- `TenantScope.applyTenantFilter()` - Ensures tenant isolation

**TRD Divergence Notes:**
- ⚠️ **BUG 3:** Currently returns 500 error
- Likely caused by recent Tier 4/5 CRM chain work
- Check for: broken query, missing join, tenant-scoping issue

---

#### `GET /api/v1/crm/accounts/:id`

Retrieves full details for a specific CRM account.

**Auth Required:** Yes

**Path Parameters:**
- `id` - Account ID

**Response (Success):**
```typescript
{
  account: {
    id: string;
    name: string;
    status: string;
    contacts: Array<...>;
    interactions: Array<...>;
    metadata: Record<string, any>;
  };
}
```

**Service/Repository Called:**
- `CRMRepository.getAccountById()`

---

#### `POST /api/v1/crm/accounts`

Creates a new CRM account.

**Auth Required:** Yes

**Request Body:**
```typescript
{
  name: string;
  status?: string;  // default: 'active'
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: string;
  }>;
  metadata?: Record<string, any>;
}
```

**Response (Success):**
```typescript
{
  id: string;
  createdAt: string;
}
```

**Service/Repository Called:**
- `CRMRepository.createAccount()`

---

#### `PUT /api/v1/crm/accounts/:id`

Updates an existing CRM account.

**Auth Required:** Yes

**Path Parameters:**
- `id` - Account ID

**Request Body:**
```typescript
{
  name?: string;
  status?: string;
  contacts?: Array<...>;
  metadata?: Record<string, any>;
}
```

**Response (Success):**
```typescript
{
  id: string;
  updatedAt: string;
}
```

**Service/Repository Called:**
- `CRMRepository.updateAccount()`

---

#### `POST /api/v1/crm/accounts/:id/interactions`

Logs an interaction with a CRM account.

**Auth Required:** Yes

**Path Parameters:**
- `id` - Account ID

**Request Body:**
```typescript
{
  type: 'email' | 'call' | 'meeting' | 'note' | 'chat';
  subject?: string;
  content: string;
  timestamp?: string;  // ISO 8601, defaults to now
  employeeId: string;
}
```

**Response (Success):**
```typescript
{
  interactionId: string;
  createdAt: string;
}
```

**Service/Repository Called:**
- `CRMRepository.logInteraction()`

---

## Email Triage API

### `POST /api/v1/workforce/email/triage`

Processes inbound emails and generates appropriate responses.

**Auth Required:** Yes

**Request Body:**
```typescript
{
  tenantId: string;
  employeeId: string;
  emailId: string;  // Gmail message ID
  threadId?: string;  // Optional: Gmail thread ID for context
}
```

**Response (Success):**
```typescript
{
  response: string;
  action: 'reply' | 'forward' | 'flag' | 'archive';
  confidence: number;  // 0-1
  reasoning: string;  // Brief explanation of action taken
}
```

**Service/Repository Called:**
- `EmailTriageWorker.processEmail()`
- `PromptAssembler.buildEmailTriagePrompt()`
- `GmailService.getMessage()`
- `GmailService.getThread()`

**TRD Divergence Notes:**
- OOO logic should only apply here for real inbound customer emails, not chat

---

### `GET /api/v1/workforce/email/:id/status`

Gets the processing status of an email.

**Auth Required:** Yes

**Response (Success):**
```typescript
{
  emailId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: string;
  response?: string;
}
```

---

## Tenant Configuration API

### `GET /api/v1/tenants/:id/config`

Retrieves tenant configuration including schedule, company context, and integrations.

**Auth Required:** Yes (tenant admin only)

**Response (Success):**
```typescript
{
  tenant: {
    id: string;
    name: string;
    schedule: {
      timezone: string;  // IANA timezone, e.g., 'Africa/Johannesburg'
      shiftHours: {
        start: string;  // HH:mm format
        end: string;    // HH:mm format
      };
      workingDays: number[];  // 0=Sunday, 1=Monday, etc.
    };
    companyContext: {
      description: string;
      productsServices: string;
      customers: string;
      industry: string;
    };
    integrations: {
      gmail: {
        connected: boolean;
        lastSync?: string;
      };
      // ... other integrations
    };
  };
}
```

**Service/Repository Called:**
- `TenantRepository.getConfig()`

---

### `PUT /api/v1/tenants/:id/config`

Updates tenant configuration.

**Auth Required:** Yes (tenant admin only)

**Request Body:**
```typescript
{
  schedule?: {
    timezone?: string;
    shiftHours?: {
      start: string;
      end: string;
    };
    workingDays?: number[];
  };
  companyContext?: {
    description?: string;
    productsServices?: string;
    customers?: string;
    industry?: string;
  };
}
```

**Response (Success):**
```typescript
{
  updatedAt: string;
}
```

**Service/Repository Called:**
- `TenantRepository.updateConfig()`

**Validation Notes:**
- ⚠️ **Bug 4:** Company context fields should be required or flagged before Employee activation
- Currently allows empty values, leading to generic-sounding responses

---

## Health & Utility

### `GET /health`

Public health check endpoint.

**Auth Required:** No

**Response:**
```typescript
{
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
}
```

---

### `POST /api/v1/auth/login`

Authenticates a user and returns JWT token.

**Auth Required:** No

**Request Body:**
```typescript
{
  email: string;
  password: string;
  tenantId?: string;  // Optional if user belongs to single tenant
}
```

**Response (Success):**
```typescript
{
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}
```

**Service/Repository Called:**
- `AuthService.login()`
- `UserRepository.findByEmail()`

---

## Known Divergences from TRD

| Route | TRD Spec | Actual Implementation | Notes |
|-------|----------|----------------------|-------|
| `POST /api/v1/workforce/chat` | Not specified | Exists, but tools not registered (Bug 1) | OOO logic incorrectly applied (Bug 2) |
| `GET /api/v1/crm/accounts/summary` | Not specified | Exists, returns 500 (Bug 3) | Broke after Tier 4/5 work |
| `POST /api/v1/workforce/chains` | Mentioned | Implementation details unclear | Needs verification |
| Tool registration for chat | Should include Gmail tools | Empty (Bug 1) | Critical fix needed |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-09-11 | Initial generation from codebase | Auto-generated |
| | | |

---

> **Maintenance:** This document should be regenerated after any router changes. Run the documentation generation script to ensure accuracy.
