export const SKILL_PLANS = Object.freeze({
  starter: new Set(['chat', 'customer_support']),
  growth: new Set(['chat', 'customer_support', 'quotes_and_invoicing', 'email_management']),
  premium: new Set(['chat', 'customer_support', 'quotes_and_invoicing', 'email_management', 'calendar', 'crm']),
});

export const SKILL_FOR_TASK = Object.freeze({
  chat: 'chat',
  job: 'customer_support',
  email_triage: 'email_management',
  email_response: 'email_management',
  quote_request: 'quotes_and_invoicing',
  quote: 'quotes_and_invoicing',
});

export const SKILL_ALIASES = Object.freeze({
  support: 'customer_support',
  email: 'email_management',
  calendar: 'calendar',
  research: 'research',
  data: 'data',
  reporting: 'reporting',
});

export function canonicalSkillId(skill) {
  return SKILL_ALIASES[String(skill || '').toLowerCase()] || String(skill || '').toLowerCase();
}

export function requiredSkillForTask(taskType, payload = {}) {
  if (taskType === 'chat' && /quote|invoice|pricing/i.test(String(payload.message || ''))) return 'quotes_and_invoicing';
  return SKILL_FOR_TASK[taskType] || taskType;
}

export function planIncludesSkill(plan, skill) {
  return SKILL_PLANS[String(plan || 'starter').toLowerCase()]?.has(skill) ?? false;
}
