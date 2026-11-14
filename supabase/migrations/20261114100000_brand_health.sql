-- Brand Health (P5, proposal §8.3): fact-impact alerts need to know which content relies on a fact and when a fact
-- last changed.
-- 1. save_audit() also stores claim links for facts the content restates correctly (p.fact_links), not only for
--    findings that cite a fact. Without this, an approved post that says "99.9% uptime" has no link to FACT-07.
-- 2. approved_facts.updated_at, set by the database whenever the statement, dates or visibility change.

-- existing facts count as last changed when they were created, so old approvals do not all show as "changed"
alter table public.approved_facts add column updated_at timestamptz;
update public.approved_facts set updated_at = created_at;
alter table public.approved_facts alter column updated_at set default now(), alter column updated_at set not null;

create or replace function public.touch_fact() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.statement, new.valid_from, new.valid_until, new.visibility)
     is distinct from (old.statement, old.valid_from, old.valid_until, old.visibility) then
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger facts_touch before update on public.approved_facts
  for each row execute function public.touch_fact();
revoke execute on function public.touch_fact() from public, anon, authenticated;

create index if not exists claim_links_fact_idx on public.claim_links (fact_id);

/*
 * Same as 20261112000300, plus p.fact_links: [{ fact_code, quote }]. Codes are resolved to THIS org's facts only;
 * unknown codes are ignored. One link per (version, fact).
 */
create or replace function public.save_audit(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_version uuid := (p->>'version_id')::uuid;
  v_item uuid;
  v_run uuid;
begin
  select v.item_id into v_item from public.content_versions v where v.id = v_version and v.org_id = v_org;
  if v_item is null then
    raise exception 'version does not belong to this organisation' using errcode = 'P0001';
  end if;

  insert into public.audit_runs (org_id, version_id, mode, model, prompt_ver, score, ai_available, requested_by, warnings)
  values (v_org, v_version, p->>'mode', p->>'model', p->>'prompt_ver', (p->>'score')::int,
          coalesce((p->>'ai_available')::boolean, false), (p->>'requested_by')::uuid,
          coalesce(array(select jsonb_array_elements_text(p->'warnings')), '{}'))
  returning id into v_run;

  insert into public.findings (org_id, run_id, category, severity, confidence, quote, start_offset, end_offset,
                               clause_id, fact_id, term_id, rule_code, source, label, explanation, suggestion)
  select v_org, v_run,
         (f->>'category')::public.finding_category, (f->>'severity')::public.severity, (f->>'confidence')::public.confidence,
         f->>'quote',
         nullif((f->>'start_offset')::int, -1), nullif((f->>'end_offset')::int, -1),
         (select c.id from public.guideline_clauses c where c.org_id = v_org and c.code = f->>'rule_code'),
         (select a.id from public.approved_facts a where a.org_id = v_org and a.code = f->>'rule_code'),
         (select t.id from public.terminology t where t.org_id = v_org and t.code = f->>'rule_code'),
         f->>'rule_code', coalesce(f->>'source', 'rule'), f->>'label', f->>'explanation', f->>'suggestion'
  from jsonb_array_elements(coalesce(p->'findings', '[]'::jsonb)) as f;

  -- findings that cite a fact, plus facts the content restates; first quote wins per fact
  insert into public.claim_links (org_id, version_id, fact_id, quote)
  select distinct on (fact_id) v_org, v_version, fact_id, quote
  from (
    select fi.fact_id, fi.quote, 0 as pri
    from public.findings fi
    where fi.run_id = v_run and fi.fact_id is not null and fi.category in ('claim', 'factual')
    union all
    select a.id, l->>'quote', 1
    from jsonb_array_elements(coalesce(p->'fact_links', '[]'::jsonb)) as l
    join public.approved_facts a on a.org_id = v_org and a.code = l->>'fact_code'
  ) s
  where not exists (select 1 from public.claim_links cl where cl.version_id = v_version and cl.fact_id = s.fact_id)
  order by fact_id, pri;

  update public.content_items set status = 'ai_audited' where id = v_item;
  return v_run;
end $$;

revoke execute on function public.save_audit(jsonb) from public, anon, authenticated;
grant execute on function public.save_audit(jsonb) to service_role;
