import { SupabaseTaskQueueRepository } from './SupabaseTaskQueueRepository.js';
import { SupabaseTaskLogRepository } from './SupabaseTaskLogRepository.js';
import { SupabaseSOPRepository } from './SupabaseSOPRepository.js';
import { SupabaseTenantRepository } from './SupabaseTenantRepository.js';
import { SupabaseContactRepository } from './SupabaseContactRepository.js';
import { SupabaseContactNoteRepository } from './SupabaseContactNoteRepository.js';
import { SupabaseLeadRepository } from './SupabaseLeadRepository.js';
import { SupabaseProjectRepository } from './SupabaseProjectRepository.js';
import { SupabaseEmployeeActivityLogRepository } from './SupabaseEmployeeActivityLogRepository.js';
import { SupabaseEmployeeRepository } from './SupabaseEmployeeRepository.js';
import { SupabaseEmployeeMemoryRepository } from './SupabaseEmployeeMemoryRepository.js';
import { SupabaseCompanyKnowledgeRepository } from './SupabaseCompanyKnowledgeRepository.js';
import { SupabaseApprovalRepository } from './SupabaseApprovalRepository.js';
import { SupabaseTenantIntegrationRepository } from './SupabaseTenantIntegrationRepository.js';

export const createSupabaseRepositoryProvider = ({ supabase }) => ({
  createSystemRepositories() {
    return {
      taskQueue: new SupabaseTaskQueueRepository(supabase),
      taskLogs: new SupabaseTaskLogRepository(supabase),
      sops: new SupabaseSOPRepository(supabase),
      tenants: new SupabaseTenantRepository(supabase),
      contacts: new SupabaseContactRepository(supabase),
      contactNotes: new SupabaseContactNoteRepository(supabase),
      leads: new SupabaseLeadRepository(supabase),
      projects: new SupabaseProjectRepository(supabase),
      employeeActivityLogs: new SupabaseEmployeeActivityLogRepository(supabase),
      employees: new SupabaseEmployeeRepository(supabase),
      employeeMemory: new SupabaseEmployeeMemoryRepository(supabase),
      companyKnowledge: new SupabaseCompanyKnowledgeRepository(supabase),
      approvals: new SupabaseApprovalRepository(supabase),
      tenantIntegrations: new SupabaseTenantIntegrationRepository(supabase),
    };
  },
});
