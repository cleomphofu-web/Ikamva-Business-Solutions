-- Gmail push watch metadata.
-- push_expiry:    when the current Gmail watch registration expires (Google enforces max 7 days).
--                 NULL means no watch is currently registered for this integration row.
-- push_history_id: the historyId returned by Gmail users.watch() and updated on every push
--                  notification. Used as the startHistoryId for history.list() calls so we
--                  fetch only messages that arrived after the last processed push.
--                  NULL means no push has been processed yet (full unread poll on first triage).

alter table public.tenant_integrations
  add column if not exists push_expiry timestamptz,
  add column if not exists push_history_id bigint;
