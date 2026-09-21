import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_RISK, AUTONOMY_MODES, assessAction } from '../config/action-risk.js';

test('action risk policy covers every risk tier across every autonomy mode', () => {
  const representative = { low: 'add_internal_note', medium: 'log_crm_contact', high: 'send_email', very_high: 'send_to_new_contact', critical: 'issue_refund' };
  for (const mode of AUTONOMY_MODES) {
    for (const [risk, action] of Object.entries(representative)) {
      const result = assessAction({ action, autonomyMode: mode, allowedActions: mode === 'controlled' ? [action] : [] });
      assert.equal(result.risk, risk);
      if (risk === 'critical') assert.equal(result.outcome, 'blocked');
      else if (mode === 'observe') assert.equal(result.outcome, 'observe');
      else if (mode === 'draft' || risk === 'very_high' || (risk === 'high' && mode === 'approve')) assert.equal(result.outcome, 'approval');
      else assert.equal(result.outcome, 'execute');
    }
  }
  assert.equal(Object.keys(ACTION_RISK).length, 11);
  assert.equal(assessAction({ action: 'send_email', autonomyMode: 'controlled', allowedActions: [] }).outcome, 'blocked');
});
