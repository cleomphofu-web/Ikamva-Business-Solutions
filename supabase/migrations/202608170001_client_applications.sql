-- Client applications: bridges Supabase Auth signup → admin approval → tenant creation
create table if not exists public.client_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null,
  full_name text not null,
  company_name text,
  phone text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at
drop trigger if exists set_client_applications_updated_at on public.client_applications;
create trigger set_client_applications_updated_at
before update on public.client_applications
for each row execute function public.set_updated_at();

-- RLS: users can read their own application, service-role can do everything
alter table public.client_applications enable row level security;

create policy "Users can read own application"
  on public.client_applications for select
  using (auth.uid() = user_id);

create policy "Users can insert own application"
  on public.client_applications for insert
  with check (auth.uid() = user_id);

-- Admins (service-role or users with admin metadata) can read/update all
-- For now, service-role bypasses RLS. Admin reads via authenticated client
-- are handled by checking app_metadata in the frontend.
create policy "Authenticated users can read all applications"
  on public.client_applications for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can update applications"
  on public.client_applications for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
