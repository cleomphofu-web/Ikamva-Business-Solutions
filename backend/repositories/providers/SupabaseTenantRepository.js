/**
 * SupabaseTenantRepository.js
 *
 * Tenant / Client Profile access — used by QuotaService.
 *
 * Table: client_profiles
 *
 *   id uuid primary key default gen_random_uuid()
 *   tenant_id text not null unique
 *   user_id uuid references auth.users(id)
 *   company_name text
 *   full_name text
 *   email text
 *   tasks_used int not null default 0
 *   tasks_limit int not null default 100
 *   hours_used numeric not null default 0
 *   hours_limit numeric not null default 60
 *   status text not null default 'pending'
 *   approved_at timestamptz
 *   created_at timestamptz not null default now()
 *   updated_at timestamptz not null default now()
 */
export class SupabaseTenantRepository {
  constructor(supabase) {
    this.db = supabase;
  }

  async findClientProfileById(id) {
    const { data, error } = await this.db
      .from('client_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async findByTenantId(tenantId) {
    const { data, error } = await this.db
      .from('client_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }
  async listActive() { const { data, error } = await this.db.from('client_profiles').select('tenant_id').eq('status', 'active'); if (error) throw error; return data || []; }

  async incrementTasksUsed(clientProfileId) {
    // Use rpc for atomic increment, falling back to read-modify-write
    const { data, error } = await this.db.rpc('increment_tasks_used', {
      profile_id: clientProfileId,
    });

    if (error) {
      // fallback: read-modify-write (safe for low concurrency)
      const profile = await this.findClientProfileById(clientProfileId);
      if (!profile) return null;
      const { data: updated, error: updateError } = await this.db
        .from('client_profiles')
        .update({ tasks_used_this_month: (profile.tasks_used_this_month ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', clientProfileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return updated;
    }

    return data;
  }

  async findTenantForUpdate(tenantId) {
    return this.findByTenantId(tenantId);
  }
}
