export const AUTONOMY_MODES = Object.freeze(['observe', 'draft', 'approve', 'controlled', 'autonomous']);
export const ACTION_RISK = Object.freeze({
  add_internal_note: 'low',
  log_crm_contact: 'medium',
  update_crm_field: 'medium',
  draft_email: 'medium',
  send_email: 'high',
  book_calendar_event: 'high',
  send_to_new_contact: 'very_high',
  delete_crm_record: 'very_high',
  issue_refund: 'critical',
  change_permissions: 'critical',
  financial_transaction: 'critical',
});
export const RISK_LEVELS = Object.freeze(['low', 'medium', 'high', 'very_high', 'critical']);
export function actionForTask(task = {}, payload = {}) {
  if (payload.action_type && ACTION_RISK[payload.action_type]) return payload.action_type;
  if (['email', 'email_response', 'email_send'].includes(task.task_type)) return 'send_email';
  if (['email_draft', 'draft_email'].includes(task.task_type)) return 'draft_email';
  return null;
}
export function assessAction({ action, autonomyMode = 'approve', allowedActions = [] } = {}) {
  const risk = ACTION_RISK[action];
  if (!risk) return { outcome: 'execute', action, risk: null };
  if (risk === 'critical') return { outcome: 'blocked', code: 'BLOCKED_CRITICAL_ACTION', action, risk };
  if (autonomyMode === 'observe') return { outcome: 'observe', action, risk };
  if (autonomyMode === 'draft') return { outcome: 'approval', action, risk };
  if (autonomyMode === 'controlled' && !allowedActions.includes(action)) return { outcome: 'blocked', code: 'ACTION_NOT_ALLOWED', action, risk };
  if (risk === 'very_high' || (risk === 'high' && !['controlled', 'autonomous'].includes(autonomyMode))) return { outcome: 'approval', action, risk };
  return { outcome: 'execute', action, risk };
}
