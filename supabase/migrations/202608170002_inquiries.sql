-- Inquiries table: replaces localStorage for Onboarding/Contact form submissions
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  company text,
  service text,
  plan text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'in_review', 'contacted', 'converted', 'closed')),
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Auto-update updated_date
create or replace function public.set_updated_date()
returns trigger as $$
begin
  new.updated_date = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_inquiries_updated_date on public.inquiries;
create trigger set_inquiries_updated_date
before update on public.inquiries
for each row execute function public.set_updated_date();

-- RLS: public inserts (contact/onboarding form), admin reads
alter table public.inquiries enable row level security;

-- Anyone can insert an inquiry (public contact form)
create policy "Anyone can insert inquiries"
  on public.inquiries for insert
  with check (true);

-- Only admins can read inquiries
create policy "Admins can read inquiries"
  on public.inquiries for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Only admins can update inquiries
create policy "Admins can update inquiries"
  on public.inquiries for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
