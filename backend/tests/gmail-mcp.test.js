import assert from 'node:assert/strict';
import test from 'node:test';
import { GmailMCPProvider } from '../providers/GmailMCPProvider.js';

test('Gmail MCP scaffold never sends without OAuth and returns approval state', async () => {
  const provider = new GmailMCPProvider();
  const result = await provider.send({ to: 'client@example.com', subject: 'Hello', metadata: { task_id: 'task-1' } });
  assert.equal(result.provider, 'gmail-mcp');
  assert.equal(result.output.status, 'awaiting_approval');
  assert.equal(result.output.action.to, 'client@example.com');
});
