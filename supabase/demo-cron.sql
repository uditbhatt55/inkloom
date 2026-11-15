-- Nightly reset of the Northbeam demo organisation, for the live site only (not a migration: pg_cron does not exist in the
-- test database). Judges share the demo accounts and may change anything; nobody from the team is online while they judge.
-- Run once as postgres (SQL editor). It does the same as demo-reset.sql + seed.sql + demo-history.sql and keeps users and
-- memberships, so "Try the demo" keeps working. Schedule: 01:00 IST every night (19:30 UTC).
--   Change the time:  select cron.alter_job((select jobid from cron.job where jobname = 'demo-reset'), schedule => '30 19 * * *');
--   Stop it:          select cron.unschedule('demo-reset');
--   Run it now:       select private.reset_demo();
-- If you change supabase/seed.sql or demo-history.sql, update this file too and run it again.

create extension if not exists pg_cron;

create or replace function private.demo_post(
  p_owner uuid, p_reviewer uuid, p_title text, p_channel text, p_text text, p_days_ago int,
  p_findings jsonb, p_approve boolean, p_facts text[]
) returns void language plpgsql set search_path = public as $fn$
declare
  v_org constant uuid := '00000000-0000-4000-8000-000000000001';
  v_at timestamptz := now() - make_interval(days => p_days_ago);
  v_item uuid; v_version uuid; v_run uuid; f jsonb;
begin
  insert into content_items (org_id, title, channel, owner_id, status, created_at)
  values (v_org, p_title, p_channel, p_owner, 'ai_audited', v_at) returning id into v_item;
  insert into content_versions (org_id, item_id, n, text, sha256, created_by, created_at)
  values (v_org, v_item, 1, p_text, encode(sha256(convert_to(p_text, 'UTF8')), 'hex'), p_owner, v_at) returning id into v_version;
  insert into audit_runs (org_id, version_id, mode, model, prompt_ver, score, ai_available, requested_by, created_at)
  values (v_org, v_version, 'simulated', 'simulated', 'v1-draft', 100, true, p_owner, v_at) returning id into v_run;

  for f in select * from jsonb_array_elements(p_findings) loop
    insert into findings (org_id, run_id, category, severity, confidence, quote, start_offset, end_offset,
                          clause_id, fact_id, term_id, rule_code, source, explanation, status, decided_by, reason)
    values (v_org, v_run, (f->>'category')::finding_category, (f->>'severity')::severity,
            (f->>'confidence')::confidence, f->>'quote',
            strpos(p_text, f->>'quote') - 1, strpos(p_text, f->>'quote') - 1 + length(f->>'quote'),
            (select id from guideline_clauses where org_id = v_org and code = f->>'rule'),
            (select id from approved_facts where org_id = v_org and code = f->>'rule'),
            (select id from terminology where org_id = v_org and code = f->>'rule'),
            f->>'rule', coalesce(f->>'source', 'rule'), f->>'why', (f->>'status')::finding_status,
            case when f->>'status' = 'open' then null else p_reviewer end, f->>'reason');
  end loop;

  -- the run's score by the proposal formula (src/lib/score)
  update audit_runs set score = greatest(0, round(100 - coalesce((
    select sum(d) from (
      select least(40, sum((case severity when 'critical' then 25 when 'major' then 10 when 'minor' then 3 else 0 end)
                           * (case confidence when 'high' then 1.0 when 'medium' then 0.6 else 0 end))) as d
      from findings where run_id = v_run and status not in ('dismissed', 'waived', 'resolved') group by category
    ) c), 0)))::int
  where id = v_run;

  insert into claim_links (org_id, version_id, fact_id, quote, matched_at)
  select v_org, v_version, a.id, coalesce(substring(p_text from '\d+(?:[.,]\d+)*%?'), a.code), v_at
  from approved_facts a where a.org_id = v_org and a.code = any(p_facts);

  if p_approve then
    insert into decisions (org_id, item_id, version_id, author_id, decision, created_at)
    values (v_org, v_item, v_version, p_reviewer, 'approve', v_at + interval '1 day');
  end if;
end $fn$;

create or replace function private.reset_demo() returns void language plpgsql set search_path = public as $fn$
declare
  v_org constant uuid := '00000000-0000-4000-8000-000000000001';
  v_owner uuid := (select id from auth.users where email = 'demo-owner@northbeam.example');
  v_reviewer uuid := (select id from auth.users where email = 'demo-reviewer@northbeam.example');
  nb constant jsonb := '{"rule":"TERM-02","category":"terminology","severity":"major","confidence":"high","quote":"NB Sync","why":"Banned product name; use Northbeam Sync."}';
  hype constant jsonb := '{"rule":"PACK-HYPE","category":"tone","severity":"minor","confidence":"medium","quote":"revolutionary","why":"Hype word; say what it does."}';
begin
  if not exists (select 1 from organizations where id = v_org and demo) then raise exception 'Demo organisation not found.'; end if;
  if v_owner is null or v_reviewer is null then raise exception 'Demo users not found.'; end if;

  delete from content_items where org_id = v_org;
  delete from activity_log where org_id = v_org;
  delete from guideline_clauses where org_id = v_org;
  delete from approved_facts where org_id = v_org;
  delete from terminology where org_id = v_org;
  delete from brand_assets where org_id = v_org;

  insert into guideline_clauses (org_id, code, category, text, examples_do, examples_dont)
  select v_org, c.code, c.category::finding_category, c.text, c.dos, c.donts from (values
    ('CLAIM-01', 'claim', 'Every number in public copy (uptime, customers, savings, speed) must match an approved fact.', array['99.9% monthly uptime (FACT-07)'], array['99.99% uptime', '10x faster']),
    ('CLAIM-02', 'claim', 'Do not describe service levels as guaranteed; refer to the SLA.', array['backed by our SLA'], array['guaranteed uptime', '100% reliable']),
    ('CLAIM-03', 'claim', 'Do not call Northbeam the best, #1 or market leader unless an approved fact supports it.', array['used by teams in 14 countries'], array['India''s #1 sync platform']),
    ('CLAIM-04', 'claim', 'Do not claim legal compliance (GDPR, DPDP, HIPAA). Describe the security feature instead.', array['data encrypted at rest with AES-256'], array['fully GDPR-compliant']),
    ('TONE-01', 'tone', 'Professional and plain: no slang, no exclamation-mark hype in B2B channels.', array['It keeps your files in step.'], array['It''s the bomb!', 'Insane deal!!!']),
    ('TONE-02', 'tone', 'Speak to the customer as "you"; avoid "users" in marketing copy.', array['your team'], array['our users']),
    ('MSG-01', 'messaging', 'Lead with the customer benefit (files in step across devices), then the feature.', array[]::text[], array[]::text[]),
    ('ACC-01', 'accessibility', 'Every image needs alt text; text on images needs 4.5:1 contrast (3:1 for large text).', array[]::text[], array[]::text[]),
    ('VIS-01', 'visual', 'Use only the brand palette and the Inter typeface.', array[]::text[], array[]::text[])
  ) as c(code, category, text, dos, donts);

  insert into approved_facts (org_id, code, statement, evidence_ref, owner_name, valid_from, valid_until, visibility, updated_at)
  select v_org, f.code, f.statement, f.evidence, f.owner, f.vfrom::date, f.vuntil::date, f.vis::visibility, now() - interval '200 days' from (values
    ('FACT-03', 'Northbeam Sync is used by teams in 14 countries', 'CRM export 2026-10', 'Sales Ops', '2026-10-01', '2027-03-31', 'public'),
    ('FACT-05', 'Northbeam Vault starts at INR 499 per month', 'Pricing page v3', 'Marketing', '2025-01-01', '2026-06-30', 'public'),
    ('FACT-06', 'Northbeam Vault starts at INR 599 per month', 'Pricing page v4', 'Marketing', '2026-07-01', null, 'public'),
    ('FACT-07', 'Northbeam Sync SLA: 99.9% monthly uptime', 'SLA v2, clause 4.1', 'Legal', '2026-04-01', '2027-03-31', 'public'),
    ('FACT-08', 'Files are encrypted at rest with AES-256', 'Security whitepaper 2026', 'Security', '2026-01-01', null, 'public'),
    ('FACT-90', 'Internal target: 12000 customers by Q3', 'Board deck', 'CEO office', null, null, 'internal'),
    ('FACT-91', 'Northbeam Mobile launches in March 2027', 'Roadmap', 'Product', null, null, 'internal')
  ) as f(code, statement, evidence, owner, vfrom, vuntil, vis);

  insert into terminology (org_id, code, term, kind, replacement, owner_name)
  select v_org, t.code, t.term, t.kind::term_kind, t.repl, t.owner from (values
    ('TERM-01', 'Northbeam Sync', 'preferred', null, 'Marketing'),
    ('TERM-02', 'NB Sync', 'banned', 'Northbeam Sync', 'Marketing'),
    ('TERM-03', 'Northbeam Vault', 'preferred', null, 'Marketing'),
    ('TERM-04', 'cloud drive', 'banned', 'Northbeam Vault', 'Marketing'),
    ('TERM-31', 'Project Atlas', 'internal', null, 'Product'),
    ('TERM-32', 'Acme Retail', 'internal', null, 'Sales')
  ) as t(code, term, kind, repl, owner);

  insert into brand_assets (org_id, type, name, hex, font_name) values
    (v_org, 'color', 'Northbeam Navy', '#1B2A4A', null), (v_org, 'color', 'Signal Teal', '#14B8A6', null),
    (v_org, 'color', 'Cloud White', '#F8FAFC', null), (v_org, 'color', 'Ink Grey', '#334155', null),
    (v_org, 'font', 'Inter', null, 'Inter');

  perform private.demo_post(v_owner, v_reviewer, 'Spring sale LinkedIn post', 'linkedin',
    'Try NB Sync free for 30 days and keep your files in step.', 26,
    jsonb_build_array(nb || '{"status":"accepted"}'), false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Partner newsletter', 'email',
    'NB Sync now works offline. Delivery is guaranteed within one business day.', 24,
    jsonb_build_array(nb || '{"status":"accepted"}',
      '{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"guaranteed within one business day","why":"Service levels must not be described as guaranteed.","status":"dismissed","reason":"A delivery promise, not a service level."}'::jsonb),
    false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Agency banner copy', 'ad',
    'NB Sync: the revolutionary way to share files.', 21,
    jsonb_build_array(nb || '{"status":"rejected","reason":"Campaign artwork already printed."}', hype || '{"status":"accepted"}'), false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Webinar invite', 'email',
    'Seats are guaranteed for the first 100 sign-ups.', 18,
    jsonb_build_array('{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"guaranteed","why":"Service levels must not be described as guaranteed.","status":"dismissed","reason":"Event seats, not a service level."}'::jsonb),
    false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Customer story draft', 'web',
    'Teams moved to NB Sync in a week, and uptime is guaranteed.', 15,
    jsonb_build_array(nb || '{"status":"accepted"}',
      '{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"uptime is guaranteed","why":"Refer to the SLA instead.","status":"accepted"}'::jsonb),
    false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Product page update', 'web',
    'Northbeam Sync keeps your files in step across devices, with 99.9% monthly uptime backed by our SLA.', 12,
    '[]', true, '{FACT-07}');
  perform private.demo_post(v_owner, v_reviewer, 'Reliability LinkedIn post', 'linkedin',
    'Your team''s files stay in step: Northbeam Sync runs at 99.9% monthly uptime, backed by our SLA.', 10,
    '[]', true, '{FACT-07}');
  perform private.demo_post(v_owner, v_reviewer, 'Sales one-pager', 'brochure',
    'Northbeam Sync: 99.9% monthly uptime backed by our SLA. Files are encrypted at rest with AES-256.', 9,
    '[]', true, '{FACT-07,FACT-08}');
  perform private.demo_post(v_owner, v_reviewer, 'Event recap', 'press',
    'As our contract says, response times are guaranteed for enterprise plans.', 6,
    jsonb_build_array('{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"response times are guaranteed","why":"Refer to the SLA instead.","status":"waived","reason":"Quoting the contract; Legal approved."}'::jsonb),
    false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Holiday promo', 'instagram',
    'Unwrap NB Sync this season: the revolutionary file gift for your team.', 4,
    jsonb_build_array(nb || '{"status":"open"}', hype || '{"status":"open"}'), false, '{}');
  perform private.demo_post(v_owner, v_reviewer, 'Support page', 'web',
    'Replies are guaranteed within four hours for priority tickets.', 3,
    jsonb_build_array('{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"guaranteed within four hours","why":"Refer to the SLA instead.","status":"accepted"}'::jsonb),
    false, '{}');
  -- approved in June, while INR 499 was still the approved price (FACT-05 expired 2026-06-30)
  perform private.demo_post(v_owner, v_reviewer, 'Vault launch email', 'email',
    'Northbeam Vault starts at INR 499 per month. Keep your team''s files in one safe place.', (current_date - date '2026-06-10'),
    '[]', true, '{FACT-05}');
end $fn$;

revoke execute on function private.demo_post(uuid, uuid, text, text, text, int, jsonb, boolean, text[]) from public, anon, authenticated;
revoke execute on function private.reset_demo() from public, anon, authenticated;

select cron.unschedule('demo-reset') where exists (select 1 from cron.job where jobname = 'demo-reset');
select cron.schedule('demo-reset', '30 19 * * *', 'select private.reset_demo()');
