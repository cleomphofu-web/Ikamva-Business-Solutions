begin;

-- Add optional source_filter parameter to match_company_knowledge.
-- When source_filter is null (the default for all existing callers), behaviour
-- is identical to before — no additional filtering is applied.
-- When source_filter is a non-empty text array, only chunks whose `source`
-- column matches one of the provided filenames are considered.
-- This allows job_spec.knowledge_sources to restrict retrieval to the specific
-- documents the employee was configured with, preventing cross-domain bleed
-- between employees sharing the same tenant corpus.

create or replace function public.match_company_knowledge(
  query_embedding vector(768),
  match_tenant_id uuid,
  match_count     integer default 3,
  source_filter   text[]  default null
)
returns table (id uuid, tenant_id uuid, content text, source text, similarity double precision)
language sql stable
as $$
  select ck.id, ck.tenant_id, ck.content, ck.source,
         1 - (ck.embedding <=> query_embedding) as similarity
  from public.company_knowledge ck
  where ck.tenant_id = match_tenant_id
    and ck.active = true
    and ck.embedding is not null
    and (source_filter is null or ck.source = any(source_filter))
  order by ck.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

commit;
