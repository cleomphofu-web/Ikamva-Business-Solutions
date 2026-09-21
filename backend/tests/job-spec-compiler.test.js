import test from 'node:test';
import assert from 'node:assert/strict';
import { JobSpecCompiler } from '../services/JobSpecCompiler.js';

test('JobSpecCompiler compiles natural language description into structured job spec', () => {
  const spec = JobSpecCompiler.compile({
    description: 'Read customer emails, answer support questions, update HubSpot leads, and send quotes from pricing sheet.',
  });

  assert.ok(spec.capabilities.includes('read_respond_email'));
  assert.ok(spec.capabilities.includes('crm_update'));
  assert.ok(spec.capabilities.includes('send_quotes'));

  assert.ok(spec.tools_required.includes('gmail'));
  assert.ok(spec.tools_required.includes('hubspot'));

  assert.deepEqual(spec.conditional_rules, [
    { when: "category == 'new_lead'", then: 'crm_upsert_contact' },
    { when: "category == 'quote_request'", then: 'generate_quote_document' },
  ]);

  assert.deepEqual(spec.knowledge_sources, [], 'Should not invent fictional filenames when none explicitly provided');
  assert.equal(spec.schedule.timezone, 'Africa/Johannesburg');
  assert.equal(spec.task_quota.pack_size, 100);
  assert.equal(spec.task_quota.auto_pause_on_exhaustion, true);
});

test('JobSpecCompiler dynamically compiles completely different domain description (Outlook + Salesforce + Calendar + 500 quota)', () => {
  const customSpec = JobSpecCompiler.compile({
    description: 'Handle customer support in Outlook, manage Salesforce deals, schedule booking appointments on Microsoft calendar, and export weekly Excel data reports. Work 08:00 to 16:00 in UTC with 500 pack limit.',
    knowledge_sources: ['company_handbook.pdf'],
  });

  assert.ok(customSpec.capabilities.includes('read_respond_email'));
  assert.ok(customSpec.capabilities.includes('crm_update'));
  assert.ok(customSpec.capabilities.includes('calendar_management'));
  assert.ok(customSpec.capabilities.includes('data_reporting'));
  assert.ok(!customSpec.capabilities.includes('send_quotes'), 'Should not add send_quotes when quotes not mentioned');

  assert.ok(customSpec.tools_required.includes('outlook'));
  assert.ok(customSpec.tools_required.includes('salesforce'));
  assert.ok(customSpec.tools_required.includes('outlook_calendar'));
  assert.ok(customSpec.tools_required.includes('excel'));
  assert.ok(!customSpec.tools_required.includes('gmail'));

  assert.deepEqual(customSpec.conditional_rules, [
    { when: "category == 'new_lead'", then: 'crm_upsert_contact' },
    { when: "category == 'booking_request'", then: 'schedule_calendar_event' },
    { when: "category == 'report_request'", then: 'export_data_summary' },
  ]);

  assert.deepEqual(customSpec.knowledge_sources, ['company_handbook.pdf']);
  assert.equal(customSpec.schedule.start, '08:00');
  assert.equal(customSpec.schedule.end, '16:00');
  assert.equal(customSpec.schedule.timezone, 'UTC');
  assert.equal(customSpec.task_quota.pack_size, 500);
});

test('JobSpecCompiler checks connected integrations and reports missing tools', () => {
  const spec = {
    tools_required: ['gmail', 'hubspot'],
  };

  const integrations = [
    { provider: 'gmail', status: 'connected' },
  ];

  const check = JobSpecCompiler.checkIntegrations(spec, integrations);
  assert.equal(check.valid, false);
  assert.deepEqual(check.missing, ['hubspot']);

  integrations.push({ provider: 'hubspot', status: 'connected' });
  const check2 = JobSpecCompiler.checkIntegrations(spec, integrations);
  assert.equal(check2.valid, true);
  assert.deepEqual(check2.missing, []);
});

