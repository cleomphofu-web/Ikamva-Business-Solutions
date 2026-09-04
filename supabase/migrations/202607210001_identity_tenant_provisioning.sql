create table if not exists tenant_applications (
  id uuid primary key,
  user_id text not null,
  full_name text not null,
  business_email text not null,
  phone_number text not null,
  planned_company_name text not null,
  industry text not null,
  country text not null,
  number_of_employees text not null,
  website text,
  requested_automations jsonb not null default '[]'::jsonb,
  other_automation_goal text,
  email_verified boolean not null default false,
  trusted_business_email boolean not null default false,
  status text not null,
  review_notes text,
  tenant_id uuid references tenants(id),
  client_profile_id uuid references client_profiles(id),
  workspace_id uuid,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  provisioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tenant_applications_user_id_idx
  on tenant_applications(user_id);
create index if not exists tenant_applications_status_idx
  on tenant_applications(status);
create table if not exists workspaces (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists workspace_settings (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  crm_pipeline jsonb not null default '[]'::jsonb,
  task_categories jsonb not null default '[]'::jsonb,
  sop_library jsonb not null default '[]'::jsonb,
  folders jsonb not null default '[]'::jsonb,
  notification_preferences jsonb not null default '{}'::jsonb,
  ai_configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
