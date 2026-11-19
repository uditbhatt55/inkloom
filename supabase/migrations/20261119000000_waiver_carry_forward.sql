-- Round 3, improvement 2 gap: a waiver may also cover later versions of the same post. Until now a waiver held for the
-- finding in that one version, so every edit brought the same accepted exception back and a reviewer had to waive it
-- again. A reviewer can now tick "carry forward": when a later version is audited and the same rule flags the same
-- words again, save_audit() writes a new waiver for the new finding (same author, reason and expiry, reason prefixed
-- with the version it came from). Every carried waiver is its own decision row, so the activity log, notifications
-- and the expiry check work as for any waiver. An expired waiver is not carried.

alter table public.decisions add column carry_forward boolean not null default false,
  add constraint decisions_carry_only_waive check (not carry_forward or decision = 'waive');

/*
 * Same as 20261114100000, plus: after the findings are written, carry live carry-forward waivers of this item onto
 * matching new findings (same category, rule code and quote). The newest such waiver per match wins.
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

  -- carry-forward waivers (the decisions_apply trigger marks each new finding waived)
  insert into public.decisions (org_id, item_id, version_id, finding_id, decision, reason, author_id, expires_at, carry_forward)
  select distinct on (nf.id) v_org, v_item, v_version, nf.id, 'waive',
         'Carried from version ' || ov.n || ': ' || regexp_replace(d.reason, '^Carried from version \d+: ', ''),
         d.author_id, d.expires_at, true
  from public.findings nf
  join public.findings pf on pf.org_id = v_org and pf.run_id <> v_run
       and pf.category = nf.category and pf.rule_code is not distinct from nf.rule_code and pf.quote = nf.quote
  join public.decisions d on d.finding_id = pf.id and d.item_id = v_item and d.decision = 'waive' and d.carry_forward
       and (d.expires_at is null or d.expires_at > now())
  join public.content_versions ov on ov.id = d.version_id
  where nf.run_id = v_run
  order by nf.id, d.created_at desc;

  update public.content_items set status = 'ai_audited' where id = v_item;
  return v_run;
end $$;

revoke execute on function public.save_audit(jsonb) from public, anon, authenticated;
grant execute on function public.save_audit(jsonb) to service_role;
