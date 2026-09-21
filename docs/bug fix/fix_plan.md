
# IKAMVA BUG FIX PLAN

## Bug 1: Chat Has No Tools

### Problem Confirmed from HAR:
The POST /api/v1/workforce/chat prompt includes:
```
TOOLS YOU CAN USE:
[EMPTY - no tools registered]
```

### Root Cause Analysis:
- The ChatWorker or prompt assembly logic for task_type: "chat" does not register any tools
- The model (gpt-oss-20b via Groq) receives no function definitions
- Every response is unaided text completion

### Fix Required:

1. **Locate prompt assembly code** (likely in ChatWorker or similar)
2. **Register tools for chat task_type:**
   - search_recent_emails(query?, limit?) - returns subject/sender/date/snippet
   - get_email_thread(thread_id) - full thread content

3. **Verify Groq/gpt-oss-20b supports tool calling:**
   - If YES: Register tools in the API call
   - If NO: Either:
     a) Switch to AI_PROVIDER=openai (per TRD fallback)
     b) Implement manual two-step flow:
        - Classification call to detect if email data needed
        - Execute retrieval and inject results as context

4. **Add fabrication guard:**
   - If tools return nothing, response must state "no matching emails found" 
   - Never invent plausible-sounding email content

## Bug 2: Out-of-Office Check Leaking into Chat

### Problem Confirmed from HAR:
Every chat prompt includes:
```
INSTRUCTION: Evaluate whether the Live Server Time falls within the Configured Shift
hours. Only invoke the out-of-office response if the current live time is strictly
outside these boundaries.
```

This causes:
- Schedule-related answers to unrelated questions
- Internal reasoning leaking: "The live server time (23:22:59) is within the configured 
  shift hours (23:22–23:59). No out-of-office response is required."

### Root Cause Analysis:
- Shift hours check is in the LLM prompt instead of application code
- OOO instruction injected on EVERY chat turn, not just inbound customer emails
- Test widget also gets schedule-gated (shouldn't be)

### Fix Required:

1. **Move shift check to application code:**
   ```javascript
   // Before building prompt, compute:
   const isWithinShiftHours = checkShiftHours(tenant.schedule, serverTime);
   ```

2. **Conditional prompt injection:**
   - If isWithinShiftHours === true: NO shift hours instruction in prompt
   - If isWithinShiftHours === false AND is real inbound customer contact:
     - Inject OOO template path only

3. **Exclude chat widget from OOO logic:**
   - Dashboard "test your Employee" widget should never be schedule-gated
   - This is not a real customer waiting

4. **Add test:**
   - Send chat message during shift hours
   - Assert response contains NO reference to: shift hours, server time, out-of-office

## Bug 3: GET /api/v1/crm/accounts/summary Returns 500

### Problem:
- Confirmed in console log and HAR capture
- Fires on every Overview page load
- Started after CRM-related Tier 4/5 work

### Fix Required:
1. Check backend logs for stack trace
2. Likely causes:
   - Query broken by recent chain/CRM change
   - Tenant-scoping issue
   - Missing join or relationship

## Bug 4: Company Context Blank in Test Tenant

### Problem from HAR:
```
COMPANY CONTEXT:
we manufecture paint
Products/Services:
Customers:
Industry:
```

### Fix Required:
1. Confirm onboarding flow persists these fields
2. Make fields required OR flag as incomplete before Employee activation
3. An Employee with blank context will sound generic even with tools working

## Documentation to Generate:

### docs/product/API_REFERENCE.md
- Every real route in router
- Grouped by resource
- Each with: method, path, auth, request body, response shape, service/repository called
- Generate from actual router files, not TRD
- Flag divergences from TRD

### docs/product/PROMPT_ARCHITECTURE.md
- For each task_type (chat, email triage, quote chain, customer support, CRM update, lead capture):
  - How system prompt is assembled
  - What sections it has
  - What's conditionally included (like OOO instruction)
  - What tools registered and when
  - Where company context/memory/schedule data enters prompt
