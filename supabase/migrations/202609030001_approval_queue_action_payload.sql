-- Add structured action payload to approval_queue so the WorkerEngine can
-- resume a task after human approval without re-parsing unstructured text.
-- Also adds updated_at for consistency with other tables.

alter table public.approval_queue
  add column if not exists action_payload jsonb not null default '{}'::jsonb,
  add column if not exists updated_at     timestamptz not null default now();

comment on column public.approval_queue.action_payload is
  'Structured payload needed to execute the approved action (e.g. email to/subject/text). '
  'Never contains credentials. Written by WorkerEngine when parking at awaiting_human.';

comment on column public.approval_queue.action is
  'Human-readable label for the action type (e.g. "gmail.send"). Used for UI display only.';
