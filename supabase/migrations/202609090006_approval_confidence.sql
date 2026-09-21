alter table public.approval_queue add column if not exists confidence_score integer;
alter table public.approval_queue add column if not exists confidence_reason text;
alter table public.approval_queue drop constraint if exists approval_queue_confidence_score_check;
alter table public.approval_queue add constraint approval_queue_confidence_score_check check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100));
