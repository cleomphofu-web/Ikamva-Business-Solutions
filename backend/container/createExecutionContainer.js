import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { MockAIProvider } from '../providers/MockAIProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { GroqProvider } from '../providers/GroqProvider.js';
import { GmailMCPProvider } from '../providers/GmailMCPProvider.js';
import { MockEmailProvider } from '../providers/MockEmailProvider.js';
import { HttpEmailProvider } from '../providers/HttpEmailProvider.js';
import { RepositoryFactory } from '../repositories/RepositoryFactory.js';
import { AuditService } from '../services/AuditService.js';
import { QueueService } from '../services/QueueService.js';
import { QuotaService } from '../services/QuotaService.js';
import { SOPService } from '../services/SOPService.js';
import { BaseWorker } from '../workers/BaseWorker.js';
import { ShiftStartWorker } from '../workers/ShiftStartWorker.js';
import { EmailWorker } from '../workers/EmailWorker.js';

import { EmailTriageWorker } from '../workers/EmailTriageWorker.js';
import { EmailResponseWorker } from '../workers/EmailResponseWorker.js';
import { WorkerEngine } from '../workers/WorkerEngine.js';
import { WorkerRegistry } from '../workers/WorkerRegistry.js';
import { ChainStepWorker } from '../workers/ChainStepWorker.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { GmailMessageService } from '../services/GmailMessageService.js';
import { GmailWatchService } from '../services/GmailWatchService.js';
import { ProviderUsageService } from '../services/ProviderUsageService.js';
import { ServiceContainer } from './ServiceContainer.js';
import { TaskChainService } from '../services/TaskChainService.js';
import { TaskChainStateRepository } from '../repositories/TaskChainStateRepository.js';

/**
 * Creates the root dependency-injection container.
 *
 * When REPOSITORY_PROVIDER=supabase (from .env), a supabaseAdmin client must
 * be passed in so the RepositoryFactory can register the Supabase provider.
 */
export const createExecutionContainer = ({
  repositoryFactory,
  providers,
  workers,
  clock,
  supabaseAdmin,
} = {}) => {
  const container = new ServiceContainer();
  container.registerValue('supabaseAdmin', supabaseAdmin || null);

  // Resolve provider name from env
  const providerName = process.env.REPOSITORY_PROVIDER || 'memory';

  // Build the repository factory with Supabase support when applicable
  const resolvedFactory = repositoryFactory || new RepositoryFactory({
    provider: providerName,
    supabase: supabaseAdmin,
  });

  // Determine the default AI provider based on environment
  const hasOpenAIKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_provider_chatGPT_API);
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  const configuredAIProvider = process.env.AI_PROVIDER || 'groq';
  const defaultAIProviderName = configuredAIProvider === 'groq' && hasGroqKey ? 'groq' : configuredAIProvider === 'openai' && hasOpenAIKey ? 'openai' : 'mock';

  container
    .registerValue('clock', clock || (() => new Date()))
    .registerValue('repositoryFactory', resolvedFactory)
    .register('embeddingService', () => new EmbeddingService())
    .register('gmailMessageService', container => new GmailMessageService({ tenantIntegrations: container.resolve('repositoryFactory').forSystem().tenantIntegrations }))
    .register('gmailWatchService', container => new GmailWatchService({
      gmailMessageService: container.resolve('gmailMessageService'),
      tenantIntegrations: container.resolve('repositoryFactory').forSystem().tenantIntegrations,
      topicName: process.env.PUBSUB_TOPIC || null,
    }))
    .register('providerUsageService', container => new ProviderUsageService({ repository: container.resolve('repositoryFactory').forSystem().tenants }))
    .register('providerRegistry', () => {
      if (providers) return providers;
      const registry = new ProviderRegistry();
      registry.register('mock', new MockAIProvider());
      registry.register('gmail-mcp', new GmailMCPProvider({ oauthEnabled: false }));
      registry.register('mock-email', new MockEmailProvider({ clock: clock || (() => new Date()) }));
      if (process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM) {
        registry.register('http-email', new HttpEmailProvider({
          endpoint: process.env.EMAIL_PROVIDER_URL || 'https://api.resend.com/emails',
          apiKey: process.env.EMAIL_PROVIDER_API_KEY,
          from: process.env.EMAIL_FROM,
        }));
      }
      if (hasOpenAIKey) {
        registry.register('openai', new OpenAIProvider({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini' }));
      }
      if (hasGroqKey) registry.register('groq', new GroqProvider({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b' }));
      return registry;
    })
    .register('workerRegistry', () => {
      if (workers) return workers;
      return new WorkerRegistry().register(
        'chat',
        new BaseWorker({ taskType: 'chat', providerName: defaultAIProviderName })
      ).register(
        'job',
        new BaseWorker({ taskType: 'job', providerName: defaultAIProviderName })
      ).register(
        'shift_start',
        new ShiftStartWorker({ providerName: defaultAIProviderName })
      ).register(
        'email_triage',
        new EmailTriageWorker({ providerName: defaultAIProviderName, gmailProvider: container.resolve('gmailMessageService'), taskChainService: null })
      ).register('email_read', new ChainStepWorker({ taskType: 'email_read' })).register('crm_lookup', new ChainStepWorker({ taskType: 'crm_lookup' })).register('quote_generate', new ChainStepWorker({ taskType: 'quote_generate', providerName: defaultAIProviderName })).register('support_response', new ChainStepWorker({ taskType: 'support_response', providerName: defaultAIProviderName })).register('lead_capture', new ChainStepWorker({ taskType: 'lead_capture' })).register('crm_update', new ChainStepWorker({ taskType: 'crm_update' })).register('email_draft', new ChainStepWorker({ taskType: 'email_draft', providerName: 'gmail-mcp' })).register('approval_gate', new ChainStepWorker({ taskType: 'approval_gate', providerName: 'http-email' })).register('email_send', new ChainStepWorker({ taskType: 'email_send', providerName: 'gmail-mcp' })).register(
        'email_response',
        new EmailResponseWorker({ providerName: defaultAIProviderName })
      ).register(
        'email',
        new EmailWorker({ providerName: process.env.GMAIL_MCP_ENABLED === 'true' ? 'gmail-mcp' : (process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM ? 'http-email' : 'mock-email') })
      );
    });

  return container;
};

export const createTenantExecutionContainer = ({ tenantId, rootContainer }) => {
  const scoped = rootContainer.createScope();
  const repos = rootContainer.resolve('repositoryFactory').forTenant(tenantId);

  scoped
    .registerValue('tenantId', tenantId)
    .registerValue('repositories', repos)
    .register('auditService', container => new AuditService({ taskLogRepository: container.resolve('repositories').taskLogs }))
    .register('queueService', container => new QueueService({
      taskQueueRepository: container.resolve('repositories').taskQueue,
      auditService: container.resolve('auditService'),
      chainStateRepository: rootContainer.resolve('supabaseAdmin') ? new TaskChainStateRepository(rootContainer.resolve('supabaseAdmin'), tenantId) : null,
      clock: container.resolve('clock'),
    }))
    .register('taskChainService', container => new TaskChainService({
      queueService: container.resolve('queueService'),
      taskQueueRepository: container.resolve('repositories').taskQueue,
      auditService: container.resolve('auditService'),
      chainStateRepository: rootContainer.resolve('supabaseAdmin') ? new TaskChainStateRepository(rootContainer.resolve('supabaseAdmin'), tenantId) : null,
      specialistRepository: container.resolve('repositories').specialists,
      employeeRepository: container.resolve('repositories').employees,
      taskLogRepository: container.resolve('repositories').taskLogs,
      quotaService: container.resolve('quotaService'),
      tenantRepository: container.resolve('repositories').tenants,
    }))
    .register('sopService', container => new SOPService({ sopRepository: container.resolve('repositories').sops }))
    .register('quotaService', container => new QuotaService({ tenantRepository: container.resolve('repositories').tenants }))
    .register('workerEngine', container => new WorkerEngine({
      queueService: container.resolve('queueService'),
      sopService: container.resolve('sopService'),
      quotaService: container.resolve('quotaService'),
      tenantRepository: container.resolve('repositories').tenants,
      employeeActivityLogRepository: container.resolve('repositories').employeeActivityLogs,
      employeeRepository: container.resolve('repositories').employees,
      employeeMemoryRepository: container.resolve('repositories').employeeMemory,
      companyKnowledgeRepository: container.resolve('repositories').companyKnowledge,
      embeddingService: container.resolve('embeddingService'),
      providerRegistry: container.resolve('providerRegistry'),
      workerRegistry: container.resolve('workerRegistry'),
      auditService: container.resolve('auditService'),
      approvalRepository: container.resolve('repositories').approvals,
      tenantIntegrations: container.resolve('repositories').tenantIntegrations,
      gmailMessageService: container.resolve('gmailMessageService'),
      providerUsageService: rootContainer.resolve('providerUsageService'),
      taskChainService: container.resolve('taskChainService'),
      contactRepository: container.resolve('repositories').contacts,
      specialistRepository: container.resolve('repositories').specialists,
      taskQueueRepository: container.resolve('repositories').taskQueue,
    }))
    // Tenant-scoped GmailWatchService: uses the tenant's own tenantIntegrations repository
    // so that watch metadata is persisted to the correct tenant row.
    .register('gmailWatchService', container => new GmailWatchService({
      gmailMessageService: rootContainer.resolve('gmailMessageService'),
      tenantIntegrations: container.resolve('repositories').tenantIntegrations,
      topicName: process.env.PUBSUB_TOPIC || null,
    }));

  return scoped;
};
