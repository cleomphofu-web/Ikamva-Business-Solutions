# Implementation Guide: Bug Fixes

This document provides concrete implementation guidance for fixing the four confirmed bugs in Ikamva.

---

## Bug 1: Chat Has No Tools

### Location

Search for files matching these patterns:
- `**/ChatWorker.js` or `**/chatWorker.js`
- `**/PromptAssembler.js` or `**/promptAssembler.js`
- `**/workforceRouter.js` or `**/routes/workforce.js`

### Problem

The system prompt sent to the model on `POST /api/v1/workforce/chat` includes an empty tools section:

```
TOOLS YOU CAN USE:
[EMPTY]
```

### Fix Implementation

#### Step 1: Define Gmail Tools

Create or update a tools definition file (e.g., `tools/gmailTools.js`):

```javascript
// tools/gmailTools.js

/**
 * Gmail tool definitions for chat task type
 */
export const gmailTools = [
  {
    name: 'search_recent_emails',
    description: 'Search for recent emails in the tenant\'s connected Gmail account. Returns subject, sender, date, and snippet for matching or most recent messages.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search query. If omitted, returns most recent emails.'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 5, max: 20)',
          minimum: 1,
          maximum: 20
        }
      }
    }
  },
  {
    name: 'get_email_thread',
    description: 'Retrieve full thread content for a specific Gmail thread ID.',
    parameters: {
      type: 'object',
      properties: {
        thread_id: {
          type: 'string',
          description: 'Gmail thread ID (must come from search_recent_emails result)'
        }
      },
      required: ['thread_id']
    }
  }
];

/**
 * Execute search_recent_emails tool
 */
export async function executeSearchRecentEmails({ query, limit = 5 }, tenantId, gmailService) {
  // Enforce limit bounds
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  // Call Gmail service with tenant-scoped OAuth connection
  const results = await gmailService.searchRecentEmails({
    tenantId,
    query,
    limit: safeLimit
  });

  // Return only safe fields (no raw body content)
  return results.map(email => ({
    thread_id: email.threadId,
    message_id: email.id,
    subject: email.subject || '(no subject)',
    sender: email.from,
    date: email.date,
    snippet: email.snippet
  }));
}

/**
 * Execute get_email_thread tool
 */
export async function executeGetEmailThread({ thread_id }, tenantId, gmailService) {
  // Retrieve full thread with tenant-scoped OAuth connection
  const thread = await gmailService.getEmailThread({
    tenantId,
    threadId: thread_id
  });

  // Return thread messages with safe fields
  return {
    thread_id: thread.id,
    messages: thread.messages.map(msg => ({
      message_id: msg.id,
      sender: msg.from,
      recipient: msg.to,
      date: msg.date,
      subject: msg.subject || '(no subject)',
      body: msg.body || msg.snippet
    }))
  };
}
```

#### Step 2: Register Tools in ChatWorker

Update your ChatWorker to register tools:

```javascript
// workers/ChatWorker.js

import { gmailTools, executeSearchRecentEmails, executeGetEmailThread } from '../tools/gmailTools.js';
import { gmailService } from '../services/gmailService.js';

export class ChatWorker {
  async handleChat(request) {
    const { tenantId, employeeId, message, sessionId, isTestWidget } = request.body;

    // Resolve tenant and employee
    const tenant = await tenantRepository.getById(tenantId);
    const employee = await employeeRepository.getById(employeeId);

    // Check if Gmail is connected for this tenant
    const hasGmailIntegration = tenant.integrations?.gmail?.connected === true;

    // Build prompt with tools
    const prompt = await this.buildChatPrompt({
      tenant,
      employee,
      message,
      sessionId,
      hasGmailIntegration,
      isTestWidget
    });

    // Define tools for the model
    const tools = hasGmailIntegration ? gmailTools : [];

    // Call the model with tools
    const response = await this.callModel({
      prompt,
      message,
      tools,
      tenantId
    });

    // Handle tool calls if any
    if (response.tool_calls) {
      const toolResults = await this.executeToolCalls({
        toolCalls: response.tool_calls,
        tenantId,
        gmailService
      });

      // Make final generation call with tool results
      const finalResponse = await this.callModel({
        prompt,
        message,
        tools,
        toolResults,
        tenantId
      });

      return {
        sessionId: response.sessionId,
        response: finalResponse.content,
        timestamp: new Date().toISOString()
      };
    }

    return {
      sessionId: response.sessionId,
      response: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async executeToolCalls({ toolCalls, tenantId, gmailService }) {
    const results = [];

    for (const call of toolCalls) {
      try {
        let result;

        if (call.function.name === 'search_recent_emails') {
          const args = JSON.parse(call.function.arguments);
          result = await executeSearchRecentEmails(args, tenantId, gmailService);
        } else if (call.function.name === 'get_email_thread') {
          const args = JSON.parse(call.function.arguments);
          result = await executeGetEmailThread(args, tenantId, gmailService);
        } else {
          result = { error: 'Unknown tool' };
        }

        results.push({
          tool_call_id: call.id,
          result
        });
      } catch (error) {
        results.push({
          tool_call_id: call.id,
          error: error.message
        });
      }
    }

    return results;
  }

  async buildChatPrompt({ tenant, employee, message, sessionId, hasGmailIntegration, isTestWidget }) {
    const sections = [];

    // Section 1: Role and identity
    sections.push(`You are ${employee.name}, ${employee.role} at ${tenant.name}.`);

    // Section 2: Company context
    if (tenant.companyContext) {
      const ctx = tenant.companyContext;
      sections.push(`
COMPANY CONTEXT:
${ctx.description || ''}

Products/Services:
${ctx.productsServices || 'Not specified'}

Customers:
${ctx.customers || 'Not specified'}

Industry:
${ctx.industry || 'Not specified'}
`.trim());
    }

    // Section 3: Communication style
    sections.push(`
COMMUNICATION STYLE:
- Be helpful, professional, and concise
- Answer questions directly
- If you don't know something, say so plainly
- Never invent or fabricate information
`.trim());

    // Section 4: Grounding policy for email data
    sections.push(`
EMAIL DATA POLICY:
- When asked about emails, you must use the search_recent_emails or get_email_thread tools
- Never claim to see or remember email content unless you have actually retrieved it via tools
- If tools return no results, say "I didn't find any matching emails" or "No emails found"
- If the email integration is disconnected, say "Email integration is not connected"
- Never fabricate email subjects, senders, dates, or content
`.trim());

    // Section 5: Available tools (ONLY if Gmail is connected)
    if (hasGmailIntegration) {
      sections.push(`
TOOLS YOU CAN USE:
- search_recent_emails(query?, limit?) — Search for recent emails. Returns subject, sender, date, and snippet.
- get_email_thread(thread_id) — Get full thread content for follow-up questions.

When the user asks about emails, use these tools to retrieve actual data.
`.trim());
    } else {
      sections.push(`
TOOLS YOU CAN USE:
No email tools are currently available. The email integration is not connected.
If asked about emails, explain that email access is not available.
`.trim());
    }

    // Section 6: Conversation context (if continuing a session)
    if (sessionId) {
      const history = await chatRepository.getSessionHistory(sessionId);
      if (history && history.length > 0) {
        sections.push(`
CONVERSATION HISTORY:
${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
`.trim());
      }
    }

    // CRITICAL: Do NOT include any shift-hours or out-of-office instructions
    // This is chat, not email triage

    return sections.join('\n\n');
  }
}
```

#### Step 3: Verify Model Provider Supports Tool Calling

Check your model provider configuration:

```javascript
// config/aiProvider.js

import OpenAI from 'openai';
import Groq from 'groq-sdk';

export class AIProvider {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'groq';

    if (this.provider === 'openai') {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else if (this.provider === 'groq') {
      this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
      this.model = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
    }
  }

  async chat({ messages, tools }) {
    // Check if model supports tools
    const supportsTools = this.provider === 'openai' || 
                          (this.provider === 'groq' && this.model.includes('llama-3.1'));

    if (tools && tools.length > 0 && !supportsTools) {
      // Fallback: switch to OpenAI for tool calls
      console.warn('Configured model does not support tools, falling back to OpenAI');
      const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: tools.map(tool => ({
          type: 'function',
          function: tool
        }))
      });
      return response.choices[0].message;
    }

    if (tools && tools.length > 0) {
      // Model supports tools
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: tools.map(tool => ({
          type: 'function',
          function: tool
        }))
      });
      return response.choices[0].message;
    }

    // No tools needed
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages
    });
    return response.choices[0].message;
  }
}
```

#### Step 4: Add Fabrication Guard

Add post-processing validation:

```javascript
// workers/ChatWorker.js

validateResponse({ response, toolResults }) {
  // Check if response claims to reference email content
  const emailClaims = [
    /I (saw|found|retrieved|located) an? email/i,
    /The (recent|latest|last) email/i,
    /There (is|are) \d+ (new|unread|recent) email/i,
    /Your inbox (shows|contains|has)/i,
  ];

  const makesEmailClaim = emailClaims.some(pattern => pattern.test(response));

  if (makesEmailClaim) {
    // Response claims email knowledge
    const hasToolResults = toolResults && toolResults.some(r => r.result && !r.error);

    if (!hasToolResults) {
      // No tool results but claims email knowledge - fabricating!
      console.warn('Response appears to fabricate email content without tool results');
      // Either reject or rewrite
      return {
        valid: false,
        reason: 'Email claim without tool support',
        suggestedResponse: "I don't have access to your email right now. The email integration may not be connected, or I didn't find matching messages."
      };
    }
  }

  return { valid: true };
}
```

### Testing

```javascript
// tests/chatWorker.test.js

describe('ChatWorker', () => {
  describe('Bug 1: Tool Registration', () => {
    it('registers Gmail tools when integration is connected', async () => {
      const tenant = {
        id: 'test-tenant',
        name: 'Test Company',
        companyContext: { description: 'Test', productsServices: 'X', customers: 'Y', industry: 'Z' },
        integrations: { gmail: { connected: true } }
      };

      const prompt = await chatWorker.buildChatPrompt({
        tenant,
        employee: { name: 'Test Employee', role: 'Assistant' },
        message: 'What are my recent emails?',
        hasGmailIntegration: true
      });

      expect(prompt).toContain('search_recent_emails');
      expect(prompt).toContain('get_email_thread');
    });

    it('explains tools are unavailable when Gmail is disconnected', async () => {
      const tenant = {
        id: 'test-tenant',
        name: 'Test Company',
        companyContext: { description: 'Test', productsServices: 'X', customers: 'Y', industry: 'Z' },
        integrations: { gmail: { connected: false } }
      };

      const prompt = await chatWorker.buildChatPrompt({
        tenant,
        employee: { name: 'Test Employee', role: 'Assistant' },
        message: 'What are my recent emails?',
        hasGmailIntegration: false
      });

      expect(prompt).toContain('email integration is not connected');
    });

    it('does not fabricate email content when tools return nothing', async () => {
      // Mock tool returning empty results
      gmailService.searchRecentEmails = jest.fn().mockResolvedValue([]);

      const response = await chatWorker.handleChat({
        body: {
          tenantId: 'test-tenant',
          employeeId: 'test-employee',
          message: 'What are my recent emails?'
        }
      });

      expect(response.response).toMatch(/no (matching )?email/i);
      expect(response.response).not.toMatch(/I (saw|found) an email/i);
    });
  });
});
```

---

## Bug 2: Out-of-Office Check Leaking into Chat

### Location

Search for files containing:
- "Live Server Time"
- "Configured Shift"
- "out-of-office"
- "shift hours"
- "isWithinShift"

Likely in:
- `**/PromptAssembler.js`
- `**/ChatWorker.js`
- `**/emailTriageWorker.js`
- `**/scheduleService.js` or `**/shiftService.js`

### Problem

Every chat prompt includes this instruction:

```
INSTRUCTION: Evaluate whether the Live Server Time falls within the Configured Shift
hours. Only invoke the out-of-office response if the current live time is strictly
outside these boundaries.
```

This causes:
1. Schedule-related answers to unrelated questions
2. Internal reasoning leaking into user-facing responses

### Fix Implementation

#### Step 1: Move Shift Check to Application Code

Create or update a schedule utility:

```javascript
// utils/scheduleUtils.js

import { DateTime } from 'luxon';

/**
 * Check if current time is within tenant's configured shift hours
 * 
 * @param {Object} params
 * @param {Date} params.now - Current time
 * @param {string} params.timezone - IANA timezone (e.g., 'Africa/Johannesburg')
 * @param {number[]} params.workingDays - Array of day numbers (0=Sunday)
 * @param {string} params.start - Start time in HH:mm format
 * @param {string} params.end - End time in HH:mm format
 * @returns {boolean} True if within shift hours
 */
export function isWithinShiftHours({ now, timezone, workingDays, start, end }) {
  const localTime = DateTime.fromJSDate(now, { zone: timezone });

  // Check if today is a working day
  const dayOfWeek = localTime.weekday; // 1=Monday, 7=Sunday in Luxon
  const luxonDayMap = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }; // Convert JS to Luxon
  const luxonDay = luxonDayMap[localTime.weekday === 7 ? 0 : localTime.weekday];

  if (!workingDays.includes(luxonDay)) {
    return false;
  }

  // Parse shift times
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);

  const shiftStart = localTime.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
  const shiftEnd = localTime.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

  // Handle overnight shifts
  if (shiftEnd < shiftStart) {
    // Shift crosses midnight (e.g., 23:00 - 07:00)
    if (localTime >= shiftStart) {
      return true; // After start time (e.g., 23:30)
    }
    return localTime < shiftEnd; // Before end time (e.g., 06:00)
  }

  // Normal shift (e.g., 09:00 - 17:00)
  return localTime >= shiftStart && localTime < shiftEnd;
}

/**
 * Format time for debugging/logging (not for prompt injection)
 */
export function formatTime(date, timezone) {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat('HH:mm:ss');
}
```

#### Step 2: Remove OOO Logic from Chat Prompt Builder

Update your prompt builder:

```javascript
// workers/ChatWorker.js or PromptAssembler.js

import { isWithinShiftHours } from '../utils/scheduleUtils.js';

async buildChatPrompt({ tenant, employee, message, sessionId, hasGmailIntegration, isTestWidget }) {
  const sections = [];

  // ... [Role, Company Context, Communication Style, Grounding Policy, Tools] ...

  // CRITICAL: Chat NEVER receives shift-hours or OOO instructions
  // These belong ONLY in email triage, and ONLY when isWithinShiftHours === false

  // DO NOT include any code like this in chat:
  // ❌ BAD:
  // sections.push(`
  // INSTRUCTION: Evaluate whether the Live Server Time falls within the Configured Shift
  // hours. Only invoke the out-of-office response if the current live time is strictly
  // outside these boundaries.
  // `);

  // ✅ CORRECT: No shift-hours logic in chat

  return sections.join('\n\n');
}
```

#### Step 3: Apply OOO Logic Only in Email Triage

Update email triage worker:

```javascript
// workers/EmailTriageWorker.js

import { isWithinShiftHours } from '../utils/scheduleUtils.js';

async processEmail(request) {
  const { tenantId, employeeId, emailId, threadId } = request.body;

  const tenant = await tenantRepository.getById(tenantId);
  const employee = await employeeRepository.getById(employeeId);

  // ✅ CORRECT: Evaluate shift hours in APPLICATION CODE
  const now = new Date();
  const withinShift = isWithinShiftHours({
    now,
    timezone: tenant.schedule.timezone,
    workingDays: tenant.schedule.workingDays,
    start: tenant.schedule.shiftHours.start,
    end: tenant.schedule.shiftHours.end
  });

  // Check if this is a real inbound customer contact (not internal, not test)
  const isInboundCustomerContact = await this.isInboundCustomerContact({
    emailId,
    tenantId
  });

  let prompt;

  if (!withinShift && isInboundCustomerContact && tenant.oooEnabled) {
    // Outside shift hours, real customer contact, OOO enabled
    // Inject OOO template path
    prompt = await this.buildEmailTriagePrompt({
      tenant,
      employee,
      emailId,
      threadId,
      oooPath: true  // Only flag, no raw time evaluation
    });
  } else {
    // Within shift hours OR not customer contact OR OOO disabled
    // Normal email triage, NO OOO logic
    prompt = await this.buildEmailTriagePrompt({
      tenant,
      employee,
      emailId,
      threadId,
      oooPath: false
    });
  }

  // Call model and process response
  // ...
}

async buildEmailTriagePrompt({ tenant, employee, emailId, threadId, oooPath }) {
  const sections = [];

  // ... [Role, Company Context, Email Content, Customer Context] ...

  // Only inject OOO template when application code determined it's needed
  if (oooPath) {
    sections.push(`
OUT-OF-OFFICE RESPONSE:
The business is currently outside operating hours. Generate an out-of-office reply that:
- Thanks the sender for their message
- States the business hours
- Provides alternative contact if applicable
- Sets expectations for response time
`.trim());
  }

  // ✅ CORRECT: No "evaluate server time" instruction
  // The application already decided OOO is needed

  return sections.join('\n\n');
}
```

#### Step 4: Exclude Test Widget from OOO Logic

Ensure the chat endpoint checks for test widget:

```javascript
// routes/workforce.js

router.post('/chat', async (req, res) => {
  const { tenantId, employeeId, message, sessionId, isTestWidget } = req.body;

  // Test widget should NEVER be schedule-gated
  if (isTestWidget === true) {
    // Skip all OOO logic, proceed directly to chat
    const response = await chatWorker.handleChat({
      tenantId,
      employeeId,
      message,
      sessionId,
      isTestWidget: true
    });
    return res.json(response);
  }

  // Real chat: still no OOO, but could add other business logic if needed
  const response = await chatWorker.handleChat({
    tenantId,
    employeeId,
    message,
    sessionId,
    isTestWidget: false
  });
  return res.json(response);
});
```

### Testing

```javascript
// tests/chatWorker.test.js

describe('ChatWorker', () => {
  describe('Bug 2: OOO Logic', () => {
    it('does not include shift-hours instruction in chat prompt', async () => {
      const tenant = {
        id: 'test-tenant',
        name: 'Test Company',
        schedule: {
          timezone: 'Africa/Johannesburg',
          workingDays: [1, 2, 3, 4, 5],
          shiftHours: { start: '09:00', end: '17:00' }
        },
        companyContext: { description: 'Test', productsServices: 'X', customers: 'Y', industry: 'Z' }
      };

      const prompt = await chatWorker.buildChatPrompt({
        tenant,
        employee: { name: 'Test Employee', role: 'Assistant' },
        message: 'Hello',
        hasGmailIntegration: false,
        isTestWidget: false
      });

      expect(prompt).not.toContain('Live Server Time');
      expect(prompt).not.toContain('Configured Shift');
      expect(prompt).not.toContain('out-of-office');
      expect(prompt).not.toContain('shift hours');
    });

    it('does not mention shift hours in chat responses during working hours', async () => {
      const response = await chatWorker.handleChat({
        body: {
          tenantId: 'test-tenant',
          employeeId: 'test-employee',
          message: 'What time is it?'
        }
      });

      expect(response.response.toLowerCase()).not.toContain('shift');
      expect(response.response.toLowerCase()).not.toContain('out of office');
      expect(response.response.toLowerCase()).not.toContain('server time');
    });

    it('test widget is never schedule-gated', async () => {
      const response = await chatWorker.handleChat({
        body: {
          tenantId: 'test-tenant',
          employeeId: 'test-employee',
          message: 'Test message',
          isTestWidget: true
        }
      });

      // Should always respond, never OOO
      expect(response.response).not.toMatch(/out[- ]?of[- ]?office/i);
    });
  });
});
```

---

## Bug 3: GET /api/v1/crm/accounts/summary Returns 500

### Location

Search for:
- `**/crmRouter.js`
- `**/crmController.js`
- `**/CRMRepository.js`
- Backend logs for stack trace

### Problem

Confirmed in HAR capture and console logs. Started after CRM Tier 4/5 work.

### Fix Implementation

#### Step 1: Check Backend Logs

Find the actual error:

```bash
# Check application logs
grep -r "accounts/summary" /var/log/ikamva/
# or
journalctl -u ikamva | grep "accounts/summary"
```

Expected error patterns:
- `Cannot read property 'map' of undefined` - Query returned null
- `relation "accounts" does not exist` - Missing table
- `column tenant_id does not exist` - Schema mismatch
- `timeout exceeded` - Query too slow
- `tenant scope violation` - Security check failing

#### Step 2: Fix the Query

Likely issues and fixes:

```javascript
// repositories/CRMRepository.js

async getAccountSummary({ tenantId, limit = 50, offset = 0, status = 'all' }) {
  // ❌ BROKEN: May have been changed in Tier 4/5 work
  // Example broken query:
  // const accounts = await db.query(`
  //   SELECT * FROM accounts
  //   WHERE tenant_id = $1
  //   AND status = $2
  //   LIMIT $3 OFFSET $4
  // `, [tenantId, status, limit, offset]);

  // ✅ FIXED: Ensure proper tenant scoping and handle all status values
  const statusFilter = status === 'all' ? '1=1' : 'status = $2';
  const params = [tenantId];
  let paramIndex = 2;

  if (status !== 'all') {
    params.push(status);
    paramIndex++;
  }

  params.push(limit, offset);

  const accounts = await db.query(`
    SELECT 
      id,
      name,
      status,
      last_contact_at as "lastContact",
      email,
      phone
    FROM crm_accounts
    WHERE tenant_id = $1
    AND ${statusFilter}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, params);

  // Get total count for pagination
  const countParams = [tenantId];
  if (status !== 'all') {
    countParams.push(status);
  }

  const countResult = await db.query(`
    SELECT COUNT(*) as total
    FROM crm_accounts
    WHERE tenant_id = $1
    AND ${statusFilter}
  `, countParams);

  const total = parseInt(countResult.rows[0].total, 10);

  return {
    accounts: accounts.rows,
    total,
    hasMore: offset + limit < total
  };
}
```

#### Step 3: Add Error Handling

```javascript
// routes/crm.js

router.get('/accounts/summary', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { limit = 50, offset = 0, status = 'all' } = req.query;

    const result = await crmRepository.getAccountSummary({
      tenantId,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      status
    });

    res.json(result);
  } catch (error) {
    console.error('CRM accounts/summary error:', {
      error: error.message,
      stack: error.stack,
      tenantId: req.user?.tenantId,
      query: req.query
    });

    res.status(500).json({
      error: 'Failed to retrieve account summary',
      code: 'CRM_ACCOUNTS_SUMMARY_ERROR'
    });
  }
});
```

### Testing

```javascript
// tests/crmRepository.test.js

describe('CRMRepository', () => {
  describe('Bug 3: getAccountSummary', () => {
    it('returns account summary without error', async () => {
      const result = await crmRepository.getAccountSummary({
        tenantId: 'test-tenant',
        limit: 10,
        offset: 0,
        status: 'all'
      });

      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.accounts)).toBe(true);
    });

    it('handles empty results gracefully', async () => {
      const result = await crmRepository.getAccountSummary({
        tenantId: 'empty-tenant',
        limit: 10,
        offset: 0,
        status: 'all'
      });

      expect(result.accounts).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('filters by status correctly', async () => {
      const activeResult = await crmRepository.getAccountSummary({
        tenantId: 'test-tenant',
        status: 'active'
      });

      const inactiveResult = await crmRepository.getAccountSummary({
        tenantId: 'test-tenant',
        status: 'inactive'
      });

      // All returned accounts should match the filter
      activeResult.accounts.forEach(acc => {
        expect(acc.status).toBe('active');
      });

      inactiveResult.accounts.forEach(acc => {
        expect(acc.status).toBe('inactive');
      });
    });
  });
});
```

---

## Bug 4: Company Context Blank in Test Tenant

### Location

Search for:
- `**/onboardingRouter.js`
- `**/tenantController.js`
- `**/employeeActivation.js`
- `**/TenantRepository.js`

### Problem

Company context fields are empty:

```
COMPANY CONTEXT:
we manufecture paint
Products/Services:
Customers:
Industry:
```

### Fix Implementation

#### Step 1: Make Fields Required in Schema

```javascript
// schemas/tenant.js

import { z } from 'zod';

export const companyContextSchema = z.object({
  description: z.string().min(1, 'Company description is required'),
  productsServices: z.string().min(1, 'Products/services description is required'),
  customers: z.string().min(1, 'Target customers description is required'),
  industry: z.string().min(1, 'Industry is required')
});

export const tenantUpdateSchema = z.object({
  companyContext: companyContextSchema.optional()
});
```

#### Step 2: Validate Before Employee Activation

```javascript
// services/employeeActivationService.js

export async function canActivateEmployee(tenantId, employeeId) {
  const tenant = await tenantRepository.getById(tenantId);
  const employee = await employeeRepository.getById(employeeId);

  const issues = [];

  // Check company context completeness
  const ctx = tenant.companyContext;
  if (!ctx) {
    issues.push('Company context is not configured');
  } else {
    if (!ctx.description || ctx.description.trim() === '') {
      issues.push('Company description is required');
    }
    if (!ctx.productsServices || ctx.productsServices.trim() === '') {
      issues.push('Products/services description is required');
    }
    if (!ctx.customers || ctx.customers.trim() === '') {
      issues.push('Target customers description is required');
    }
    if (!ctx.industry || ctx.industry.trim() === '') {
      issues.push('Industry is required');
    }
  }

  return {
    canActivate: issues.length === 0,
    issues
  };
}
```

#### Step 3: Update Onboarding Flow

```javascript
// routes/onboarding.js

router.put('/tenants/:id/company-context', async (req, res) => {
  const { id: tenantId } = req.params;
  const { description, productsServices, customers, industry } = req.body;

  // Validate all fields are present
  const validation = companyContextSchema.safeParse({
    description,
    productsServices,
    customers,
    industry
  });

  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: validation.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message
      }))
    });
  }

  await tenantRepository.updateCompanyContext(tenantId, {
    description,
    productsServices,
    customers,
    industry
  });

  res.json({ success: true });
});

router.post('/employees/:id/activate', async (req, res) => {
  const { id: employeeId } = req.params;
  const employee = await employeeRepository.getById(employeeId);

  const { canActivate, issues } = await canActivateEmployee(
    employee.tenantId,
    employeeId
  );

  if (!canActivate) {
    return res.status(400).json({
      error: 'Cannot activate employee',
      issues,
      requiredAction: 'Complete company context configuration before activating'
    });
  }

  await employeeRepository.activate(employeeId);
  res.json({ success: true });
});
```

#### Step 4: Add UI Validation

```javascript
// frontend/components/Onboarding/CompanyContextForm.jsx

export function CompanyContextForm({ tenant, onSave, onNext }) {
  const [formData, setFormData] = useState({
    description: tenant.companyContext?.description || '',
    productsServices: tenant.companyContext?.productsServices || '',
    customers: tenant.companyContext?.customers || '',
    industry: tenant.companyContext?.industry || ''
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Company description is required';
    }
    if (!formData.productsServices.trim()) {
      newErrors.productsServices = 'Products/services description is required';
    }
    if (!formData.customers.trim()) {
      newErrors.customers = 'Target customers description is required';
    }
    if (!formData.industry.trim()) {
      newErrors.industry = 'Industry is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField
        label="Company Description"
        value={formData.description}
        onChange={(v) => setFormData({ ...formData, description: v })}
        error={errors.description}
        required
      />

      <FormField
        label="Products/Services"
        value={formData.productsServices}
        onChange={(v) => setFormData({ ...formData, productsServices: v })}
        error={errors.productsServices}
        required
      />

      <FormField
        label="Target Customers"
        value={formData.customers}
        onChange={(v) => setFormData({ ...formData, customers: v })}
        error={errors.customers}
        required
      />

      <FormField
        label="Industry"
        value={formData.industry}
        onChange={(v) => setFormData({ ...formData, industry: v })}
        error={errors.industry}
        required
      />

      <Button type="submit" disabled={Object.keys(errors).length > 0}>
        Save and Continue
      </Button>
    </form>
  );
}
```

### Testing

```javascript
// tests/employeeActivation.test.js

describe('Employee Activation', () => {
  describe('Bug 4: Company Context Validation', () => {
    it('blocks activation when company context is incomplete', async () => {
      const tenant = {
        id: 'test-tenant',
        companyContext: {
          description: 'We manufacture paint',
          productsServices: '',
          customers: '',
          industry: ''
        }
      };

      const { canActivate, issues } = await canActivateEmployee(
        tenant.id,
        'test-employee'
      );

      expect(canActivate).toBe(false);
      expect(issues).toContain('Products/services description is required');
      expect(issues).toContain('Target customers description is required');
      expect(issues).toContain('Industry is required');
    });

    it('allows activation when company context is complete', async () => {
      const tenant = {
        id: 'test-tenant',
        companyContext: {
          description: 'We manufacture paint',
          productsServices: 'Interior and exterior paints',
          customers: 'Homeowners and contractors',
          industry: 'Manufacturing - Paints and Coatings'
        }
      };

      const { canActivate, issues } = await canActivateEmployee(
        tenant.id,
        'test-employee'
      );

      expect(canActivate).toBe(true);
      expect(issues).toEqual([]);
    });
  });
});
```

---

## Verification Checklist

After implementing all fixes, verify:

- [ ] **Bug 1**: Chat can call `search_recent_emails` and `get_email_thread` tools
- [ ] **Bug 1**: Chat response includes actual email data when tools return results
- [ ] **Bug 1**: Chat response says "no emails found" when tools return empty
- [ ] **Bug 1**: Chat response says "email integration not connected" when Gmail is disconnected
- [ ] **Bug 2**: Chat prompt contains NO "Live Server Time" instruction
- [ ] **Bug 2**: Chat response contains NO mention of shift hours, server time, or OOO
- [ ] **Bug 2**: Test widget is never schedule-gated
- [ ] **Bug 3**: `GET /api/v1/crm/accounts/summary` returns 200 with valid data
- [ ] **Bug 3**: No 500 errors in backend logs for this endpoint
- [ ] **Bug 4**: Onboarding requires all company context fields
- [ ] **Bug 4**: Employee activation blocked until company context complete
- [ ] **Docs**: `API_REFERENCE.md` reflects actual routes
- [ ] **Docs**: `PROMPT_ARCHITECTURE.md` documents all task types
- [ ] **Docs**: Both docs are in `docs/product/` directory

---

## Files to Update

After fixes are complete, update these documentation files:

1. `docs/product/API_REFERENCE.md` - Populate with actual route details from code
2. `docs/product/PROMPT_ARCHITECTURE.md` - Populate with actual prompt assembly logic
3. This implementation guide - Add actual file paths and code snippets from your codebase
