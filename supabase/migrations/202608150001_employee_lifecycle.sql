-- Phase 3: Employee Architecture Lock - Lifecycle, Provenance, and Permissions

-- 1. Extend ai_employees with rich identity and limits
ALTER TABLE public.ai_employees
  ADD COLUMN description text,
  ADD COLUMN personality text,
  ADD COLUMN responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN monthly_hours_limit integer,
  ADD COLUMN token_limit integer,
  ADD COLUMN setup_step text,
  ADD COLUMN activated_at timestamptz;
-- Explicitly separate lifecycle from runtime state
ALTER TABLE public.ai_employees
  DROP CONSTRAINT IF EXISTS ai_employees_status_check;
-- Rename 'status' to 'lifecycle_status' and add 'runtime_status'
ALTER TABLE public.ai_employees
  RENAME COLUMN status TO lifecycle_status;
ALTER TABLE public.ai_employees
  ADD COLUMN runtime_status text NOT NULL DEFAULT 'idle';
ALTER TABLE public.ai_employees
  ADD CONSTRAINT ai_employees_lifecycle_check
  CHECK (lifecycle_status in ('draft', 'configuring', 'ready', 'active', 'suspended', 'archived'));
ALTER TABLE public.ai_employees
  ADD CONSTRAINT ai_employees_runtime_check
  CHECK (runtime_status in ('idle', 'thinking', 'working', 'waiting', 'approval_required', 'paused', 'failed'));
-- 2. Extend company_knowledge with provenance and ingestion tracking
ALTER TABLE public.company_knowledge
  ADD COLUMN source_type text NOT NULL DEFAULT 'manual' CHECK (source_type in ('manual', 'upload', 'integration', 'sop', 'policy')),
  ADD COLUMN source_system text,
  ADD COLUMN source_record_id text,
  ADD COLUMN ingestion_status text NOT NULL DEFAULT 'complete' CHECK (ingestion_status in ('pending', 'processing', 'complete', 'failed')),
  ADD COLUMN file_metadata jsonb;
-- 3. Create employee_permissions mapping table (Integration -> Permission -> Requires Approval -> Employee)
CREATE TABLE IF NOT EXISTS public.employee_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.ai_employees(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  permission_scope text NOT NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  granted boolean NOT NULL DEFAULT true,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, integration_id, permission_scope)
);
CREATE INDEX IF NOT EXISTS employee_permissions_tenant_idx ON public.employee_permissions (tenant_id, employee_id);
-- Apply RLS to employee_permissions
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_permissions_select_tenant 
  ON public.employee_permissions 
  FOR SELECT TO authenticated 
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY employee_permissions_no_insert 
  ON public.employee_permissions 
  FOR INSERT TO authenticated 
  WITH CHECK (false);
CREATE POLICY employee_permissions_no_update 
  ON public.employee_permissions 
  FOR UPDATE TO authenticated 
  USING (false) WITH CHECK (false);
CREATE POLICY employee_permissions_no_delete 
  ON public.employee_permissions 
  FOR DELETE TO authenticated 
  USING (false);
