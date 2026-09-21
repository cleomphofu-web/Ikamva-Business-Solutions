import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEmployeeMemoryRepository } from '../repositories/InMemoryEmployeeMemoryRepository.js';

test('email memory preserves source and thread and filters by Gmail thread', async () => {
  const repo = new InMemoryEmployeeMemoryRepository();
  await repo.create('tenant-a', { employee_id: 'employee-1', source: 'email', thread_id: 'thread-a', memory_type: 'email_sent', content: 'reply a' });
  await repo.create('tenant-a', { employee_id: 'employee-1', source: 'email', thread_id: 'thread-b', memory_type: 'email_sent', content: 'reply b' });
  await repo.create('tenant-a', { employee_id: 'employee-1', source: 'chat', thread_id: null, memory_type: 'interaction', content: 'chat' });
  const rows = await repo.listByEmployee('tenant-a', 'employee-1', { threadId: 'thread-a' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].thread_id, 'thread-a');
  assert.equal(rows[0].source, 'email');

  const chatRows = await repo.listByEmployee('tenant-a', 'employee-1', { source: 'chat' });
  assert.equal(chatRows.length, 1);
  assert.equal(chatRows[0].content, 'chat');
  assert.equal(chatRows[0].source, 'chat');
});
