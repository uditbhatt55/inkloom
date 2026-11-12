-- Audit persistence (proposal §7, §8; decisions D5, D6)
-- 1. findings keep the code of the rule they cite even when it is not an org clause/fact/term
--    (WCAG-1.4.3, WCAG-1.1.1, READABILITY, BRAND-*, PACK-*), plus where they came from and their label.
-- 2. a run can be rule-only (AI skipped or failed) and records who asked for it and any warnings shown.
-- 3. save_audit() writes a run, its findings, claim links and the item status in ONE transaction.

alter table public.findings
  add column rule_code text,
  add column source text not null default 'rule' check (source in ('rule', 'ai')),
  add column label text check (label in ('needs_human_check', 'unverified_claim'));

alter table public.audit_runs drop constraint audit_runs_mode_check;
alter table public.audit_runs
  add constraint audit_runs_mode_check check (mode in ('real', 'simulated', 'rule_only')),
  add column requested_by uuid references auth.users,
  add column warnings text[] not null default '{}';

create index if not exists findings_run_idx on public.findings (run_id);
create index if not exists runs_version_idx on public.audit_runs (version_id, created_at desc);

/*
 * Called by the server with the service role after runAudit(). p is:
 * { org_id, version_id, requested_by, mode, model, prompt_ver, score, ai_available, warnings: text[],
 *   findings: [{ category, severity, confidence, quote, start_offset, end_offset, rule_code, source, label, explanation, suggestion }] }
 * rule_code is resolved to clause_id / fact_id / term_id of THIS org only. A finding that cites a fact also records a
 * claim link (fact-impact alerts, §8.3). The item moves to 'ai_audited' (§8 state diagram).
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

  insert into public.claim_links (org_id, version_id, fact_id, quote)
  select distinct v_org, v_version, fi.fact_id, fi.quote
  from public.findings fi
  where fi.run_id = v_run and fi.fact_id is not null and fi.category in ('claim', 'factual');

  update public.content_items set status = 'ai_audited' where id = v_item;
  return v_run;
end $$;

revoke execute on function public.save_audit(jsonb) from public, anon, authenticated;
grant execute on function public.save_audit(jsonb) to service_role;
