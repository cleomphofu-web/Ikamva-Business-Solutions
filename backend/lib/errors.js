export class AppError extends Error {
  constructor(message, code, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) { super(`${resource} not found: ${id}`, 'NOT_FOUND', 404); }
}
export class ValidationError extends AppError { constructor(message, details) { super(message, 'VALIDATION_ERROR', 422, details); } }
export class UnauthorizedError extends AppError { constructor(reason = 'Authentication required') { super(reason, 'UNAUTHORIZED', 401); } }
export class ForbiddenError extends AppError { constructor(reason = 'Access denied') { super(reason, 'FORBIDDEN', 403); } }
export class PlanLimitError extends AppError { constructor(skill, requiredPlan) { super(`Skill '${skill}' requires plan: ${requiredPlan}`, 'PLAN_LIMIT', 402, { skill, requiredPlan }); } }
export class SkillDisabledError extends AppError { constructor(skill) { super(`Skill '${skill}' is not enabled for this Employee`, 'SKILL_DISABLED', 403, { skill }); } }
export class TaskChainError extends AppError { constructor(message, stepIndex, cause) { super(message, 'TASK_CHAIN_FAILED', 500, { stepIndex, cause: cause?.message }); } }
export class ProviderError extends AppError { constructor(message, provider) { super(message, 'PROVIDER_ERROR', 502, { provider }); } }
export class IntegrationError extends AppError { constructor(message, provider = 'unknown', details = null) { super(message, 'INTEGRATION_ERROR', 502, { provider, ...(details || {}) }); } }
export class ActionPolicyError extends AppError { constructor(message, code = 'ACTION_NOT_ALLOWED', details = null) { super(message, code, 403, details); } }
