begin;

create extension if not exists vector;

alter table public.company_knowledge
  add column if not exists embedding vector(1536);

create index if not exists company_knowledge_embedding_hnsw_idx
  on public.company_knowledge
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_company_knowledge(
  query_embedding vector(1536),
  match_tenant_id uuid,
  match_count integer default 3
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
  order by ck.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

commit;
