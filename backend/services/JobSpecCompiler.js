/**
 * JobSpecCompiler.js
 *
 * Compiles human-described requirements or configuration parameters into a
 * deterministic, canonical Job Spec structure stored under
 * ai_employees.configuration.job_spec.
 */

export class JobSpecCompiler {
  /**
   * Compiles natural language input and/or structured config into a standard Job Spec.
   *
   * @param {object} input
   * @param {string} [input.description] - Natural language description of the job
   * @param {Array<string>} [input.tools_required] - Explicit tool list override
   * @param {Array<string>} [input.capabilities] - Explicit capabilities list override
   * @param {Array<object>} [input.conditional_rules] - Explicit conditional routing rules
   * @param {Array<string>} [input.knowledge_sources] - Documents/spreadsheets to ground on
   * @param {Array<object>} [input.document_templates] - Template configurations
   * @param {object} [input.schedule] - Schedule configuration (days, start, end, timezone)
   * @param {object} [input.task_quota] - Task quota configuration (pack_size, auto_pause_on_exhaustion)
   * @returns {object} Canonical Job Spec
   */
  static compile(input = {}) {
    const text = String(input.description || '').toLowerCase();

    // 1. Resolve Capabilities
    const capabilities = new Set(input.capabilities || []);
    if (/email|inbox|reply|support|customer|tickets|inquiries/i.test(text) || capabilities.size === 0) {
      capabilities.add('read_respond_email');
    }
    if (/crm|hubspot|salesforce|contact|lead|pipeline|deals/i.test(text)) {
      capabilities.add('crm_update');
    }
    if (/quote|pricing|invoice|estimate|proposal|billing/i.test(text)) {
      capabilities.add('send_quotes');
    }
    if (/calendar|appointment|booking|meeting|schedule\s+calls/i.test(text)) {
      capabilities.add('calendar_management');
    }
    if (/data|analytics|report|spreadsheet|csv|sheets/i.test(text)) {
      capabilities.add('data_reporting');
    }

    // 2. Resolve Required Tools
    const tools = new Set(input.tools_required || []);
    if (capabilities.has('read_respond_email')) {
      if (/outlook|office365|microsoft/i.test(text)) {
        tools.add('outlook');
      } else {
        tools.add('gmail');
      }
    }
    if (capabilities.has('crm_update')) {
      if (/salesforce/i.test(text)) {
        tools.add('salesforce');
      } else {
        tools.add('hubspot');
      }
    }
    if (capabilities.has('send_quotes')) {
      if (!tools.has('outlook')) tools.add('gmail');
      if (/word|office/i.test(text)) {
        tools.add('microsoft_word');
      } else if (/docs|google\s*docs|pdf/i.test(text) || capabilities.has('send_quotes')) {
        tools.add('google_docs');
      }
    }
    if (capabilities.has('calendar_management')) {
      if (/outlook|microsoft/i.test(text)) {
        tools.add('outlook_calendar');
      } else {
        tools.add('google_calendar');
      }
    }
    if (capabilities.has('data_reporting')) {
      if (/excel/i.test(text)) {
        tools.add('excel');
      } else {
        tools.add('google_sheets');
      }
    }

    // 3. Resolve Conditional Rules
    let conditionalRules = Array.isArray(input.conditional_rules) ? [...input.conditional_rules] : [];
    if (conditionalRules.length === 0) {
      if (capabilities.has('crm_update')) {
        conditionalRules.push({ when: "category == 'new_lead'", then: 'crm_upsert_contact' });
      }
      if (capabilities.has('send_quotes')) {
        conditionalRules.push({ when: "category == 'quote_request'", then: 'generate_quote_document' });
      }
      if (capabilities.has('calendar_management')) {
        conditionalRules.push({ when: "category == 'booking_request'", then: 'schedule_calendar_event' });
      }
      if (capabilities.has('data_reporting')) {
        conditionalRules.push({ when: "category == 'report_request'", then: 'export_data_summary' });
      }
    }

    // 4. Resolve Knowledge Sources & Document Templates
    const knowledgeSources = Array.isArray(input.knowledge_sources)
      ? [...input.knowledge_sources]
      : [];
    if (knowledgeSources.length === 0) {
      if (/pricing|rate|catalog/i.test(text)) knowledgeSources.push('pricing_sheet.xlsx');
      if (/faq|handbook|policy|guidelines/i.test(text)) knowledgeSources.push('company_faq.pdf');
      if (/product|specs|documentation/i.test(text)) knowledgeSources.push('product_catalog.pdf');
    }

    const documentTemplates = Array.isArray(input.document_templates)
      ? [...input.document_templates]
      : [];
    if (documentTemplates.length === 0) {
      if (capabilities.has('send_quotes')) {
        documentTemplates.push({ type: 'quote', template_id: 'tpl_quote_v1' });
      }
      if (/invoice/i.test(text)) {
        documentTemplates.push({ type: 'invoice', template_id: 'tpl_invoice_v1' });
      }
    }

    const rawTz = (String(input.description || '').match(/\b(UTC|GMT|CAT|SAST|EST|PST|CST|[A-Z][a-z]+(?:\/[A-Z][a-z_]+))\b/i) || [])[1];
    let resolvedTz = 'Africa/Johannesburg';
    if (rawTz) {
      if (/^utc$/i.test(rawTz)) resolvedTz = 'UTC';
      else if (/^gmt$/i.test(rawTz)) resolvedTz = 'GMT';
      else if (/^cat|sast$/i.test(rawTz)) resolvedTz = 'Africa/Johannesburg';
      else if (/^est$/i.test(rawTz)) resolvedTz = 'America/New_York';
      else if (/^pst$/i.test(rawTz)) resolvedTz = 'America/Los_Angeles';
      else resolvedTz = rawTz;
    }


    const scheduleMatch = text.match(/(\d{1,2}:\d{2})\s*(?:to|-)\s*(\d{1,2}:\d{2})/);

    const defaultSchedule = {
      days: /weekend/i.test(text)
        ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        : /mon(?:day)?\s*(?:to|-)\s*thu(?:rsday)?/i.test(text)
          ? ['mon', 'tue', 'wed', 'thu']
          : ['mon', 'tue', 'wed', 'thu', 'fri'],
      start: scheduleMatch ? scheduleMatch[1] : '09:00',
      end: scheduleMatch ? scheduleMatch[2] : '17:00',
      timezone: resolvedTz,
    };


    const schedule = {
      ...defaultSchedule,
      ...(input.schedule || {}),
    };

    // 6. Resolve Task Quota from text or defaults
    const quotaMatch = text.match(/(\d+)\s*(?:tasks|pack|quota|limit)/);
    const defaultQuota = {
      pack_size: quotaMatch ? parseInt(quotaMatch[1], 10) : 100,
      auto_pause_on_exhaustion: true,
    };
    const taskQuota = {
      ...defaultQuota,
      ...(input.task_quota || {}),
    };

    return {
      tools_required: Array.from(tools),
      capabilities: Array.from(capabilities),
      conditional_rules: conditionalRules,
      knowledge_sources: knowledgeSources,
      document_templates: documentTemplates,
      schedule,
      task_quota: taskQuota,
      compiled_at: new Date().toISOString(),
    };
  }

  /**
   * Validate that all tools required by a Job Spec are connected.
   *
   * @param {object} jobSpec
   * @param {Array<object>} connectedIntegrations
   * @returns {{ valid: boolean, missing: Array<string> }}
   */
  static checkIntegrations(jobSpec, connectedIntegrations = []) {
    const connectedProviders = new Set(
      connectedIntegrations
        .filter(i => i.status === 'connected')
        .map(i => i.provider?.toLowerCase())
    );

    const required = jobSpec?.tools_required || [];
    const missing = required.filter(tool => !connectedProviders.has(tool.toLowerCase()));

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
