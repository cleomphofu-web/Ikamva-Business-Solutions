-- 202609110001_ai_employee_specialists.sql
-- Manager + Specialists Architecture schema additions

CREATE TABLE IF NOT EXISTS ai_employee_specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES ai_employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  specialist_type TEXT NOT NULL, -- 'sales' | 'support' | 'crm' | 'lead_capture' | 'data_analysis'
  display_name TEXT NOT NULL,     -- client-visible label, e.g. "Sales Specialist"
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- specialist-specific tuning
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, specialist_type)
);

ALTER TABLE ai_employee_specialists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_scoped_ai_employee_specialists_select"
  ON ai_employee_specialists
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "tenant_scoped_ai_employee_specialists_update"
  ON ai_employee_specialists
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "tenant_scoped_ai_employee_specialists_insert"
  ON ai_employee_specialists
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Link specialist attribution to task_chains and approval_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_chains' AND column_name = 'specialist_id'
  ) THEN
    ALTER TABLE task_chains ADD COLUMN specialist_id UUID REFERENCES ai_employee_specialists(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_queue' AND column_name = 'specialist_id'
  ) THEN
    ALTER TABLE approval_queue ADD COLUMN specialist_id UUID REFERENCES ai_employee_specialists(id);
  END IF;
END $$;
