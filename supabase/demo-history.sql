-- Brand Health demo history for the Northbeam demo org (milestone M5: "works on seeded history", demo storyline §12.4).
-- Run AFTER seed.sql and demo-membership.sql, as postgres (SQL editor). Replace the two emails first.
-- 12 posts over the last 30 days (plus one from June): runs are marked "simulated" so nobody mistakes them for real
-- AI output. Approvals go through the real approval-gate trigger. Running it twice does nothing the second time.
--
-- What it shows on /health:
--   recurring: TERM-02 ("NB Sync") is the top mistake; CLAIM-02 and PACK-HYPE follow
--   unclear:   CLAIM-02 is dismissed or waived in 3 of 5 decisions (60%)
--   fact impact: an approved June email relies on FACT-05 (INR 499, expired 2026-06-30); three approved posts rely on
--                FACT-07, so editing FACT-07 in the Knowledge Centre makes them appear as "Changed"

create or replace function pg_temp.post(
  p_owner uuid, p_reviewer uuid, p_title text, p_channel text, p_text text, p_days_ago int,
  p_findings jsonb, p_approve boolean, p_facts text[]
) returns void language plpgsql as $$
declare
  v_org constant uuid := '00000000-0000-4000-8000-000000000001';
  v_at timestamptz := now() - make_interval(days => p_days_ago);
  v_item uuid; v_version uuid; v_run uuid; f jsonb;
begin
  insert into public.content_items (org_id, title, channel, owner_id, status, created_at)
  values (v_org, p_title, p_channel, p_owner, 'ai_audited', v_at) returning id into v_item;
  insert into public.content_versions (org_id, item_id, n, text, sha256, created_by, created_at)
  values (v_org, v_item, 1, p_text, encode(sha256(convert_to(p_text, 'UTF8')), 'hex'), p_owner, v_at) returning id into v_version;
  insert into public.audit_runs (org_id, version_id, mode, model, prompt_ver, score, ai_available, requested_by, created_at)
  values (v_org, v_version, 'simulated', 'simulated', 'v1-draft', 100, true, p_owner, v_at) returning id into v_run;

  for f in select * from jsonb_array_elements(p_findings) loop
    insert into public.findings (org_id, run_id, category, severity, confidence, quote, start_offset, end_offset,
                                 clause_id, fact_id, term_id, rule_code, source, explanation, status, decided_by, reason)
    values (v_org, v_run, (f->>'category')::public.finding_category, (f->>'severity')::public.severity,
            (f->>'confidence')::public.confidence, f->>'quote',
            strpos(p_text, f->>'quote') - 1, strpos(p_text, f->>'quote') - 1 + length(f->>'quote'),
            (select id from public.guideline_clauses where org_id = v_org and code = f->>'rule'),
            (select id from public.approved_facts where org_id = v_org and code = f->>'rule'),
            (select id from public.terminology where org_id = v_org and code = f->>'rule'),
            f->>'rule', coalesce(f->>'source', 'rule'), f->>'why', (f->>'status')::public.finding_status,
            case when f->>'status' = 'open' then null else p_reviewer end, f->>'reason');
  end loop;

  insert into public.claim_links (org_id, version_id, fact_id, quote, matched_at)
  select v_org, v_version, a.id, coalesce(substring(p_text from '\d+(?:[.,]\d+)*%?'), a.code), v_at
  from public.approved_facts a where a.org_id = v_org and a.code = any(p_facts);

  if p_approve then
    insert into public.decisions (org_id, item_id, version_id, author_id, decision, created_at)
    values (v_org, v_item, v_version, p_reviewer, 'approve', v_at + interval '1 day');
  end if;
end $$;

do $$
declare
  v_owner uuid := (select id from auth.users where email = 'owner@example.com');       -- the content author
  v_reviewer uuid := (select id from auth.users where email = 'reviewer@example.com'); -- approves and decides findings
  nb constant jsonb := '{"rule":"TERM-02","category":"terminology","severity":"major","confidence":"high","quote":"NB Sync","why":"Banned product name; use Northbeam Sync."}';
  hype constant jsonb := '{"rule":"PACK-HYPE","category":"tone","severity":"minor","confidence":"medium","quote":"revolutionary","why":"Hype word; say what it does."}';
begin
  if v_owner is null or v_reviewer is null then
    raise exception 'Set both emails at the top of the DO block to existing users in the Northbeam demo org.';
  end if;
  if exists (select 1 from public.content_items where org_id = '00000000-0000-4000-8000-000000000001' and title = 'Spring sale LinkedIn post') then
    raise notice 'Demo history already present; nothing to do.';
    return;
  end if;

  -- the facts were seeded after these back-dated posts; date their last change before the history starts, so only a
  -- real edit in the Knowledge Centre marks them "changed"
  update public.approved_facts set updated_at = now() - interval '200 days'
  where org_id = '00000000-0000-4000-8000-000000000001';

  perform pg_temp.post(v_owner, v_reviewer, 'Spring sale LinkedIn post', 'linkedin',
    'Try NB Sync free for 30 days and keep your files in step.', 26,
    jsonb_build_array(nb || '{"status":"accepted"}'), false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Partner newsletter', 'email',
    'NB Sync now works offline. Delivery is guaranteed within one business day.', 24,
    jsonb_build_array(nb || '{"status":"accepted"}',
      '{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"guaranteed within one business day","why":"Service levels must not be described as guaranteed.","status":"dismissed","reason":"A delivery promise, not a service level."}'::jsonb),
    false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Agency banner copy', 'ad',
    'NB Sync: the revolutionary way to share files.', 21,
    jsonb_build_array(nb || '{"status":"rejected","reason":"Campaign artwork already printed."}', hype || '{"status":"accepted"}'), false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Webinar invite', 'email',
    'Seats are guaranteed for the first 100 sign-ups.', 18,
    jsonb_build_array('{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"guaranteed","why":"Service levels must not be described as guaranteed.","status":"dismissed","reason":"Event seats, not a service level."}'::jsonb),
    false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Customer story draft', 'web',
    'Teams moved to NB Sync in a week, and uptime is guaranteed.', 15,
    jsonb_build_array(nb || '{"status":"accepted"}',
      '{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"uptime is guaranteed","why":"Refer to the SLA instead.","status":"accepted"}'::jsonb),
    false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Product page update', 'web',
    'Northbeam Sync keeps your files in step across devices, with 99.9% monthly uptime backed by our SLA.', 12,
    '[]', true, '{FACT-07}');
  perform pg_temp.post(v_owner, v_reviewer, 'Reliability LinkedIn post', 'linkedin',
    'Your team''s files stay in step: Northbeam Sync runs at 99.9% monthly uptime, backed by our SLA.', 10,
    '[]', true, '{FACT-07}');
  perform pg_temp.post(v_owner, v_reviewer, 'Sales one-pager', 'brochure',
    'Northbeam Sync: 99.9% monthly uptime backed by our SLA. Files are encrypted at rest with AES-256.', 9,
    '[]', true, '{FACT-07,FACT-08}');
  perform pg_temp.post(v_owner, v_reviewer, 'Event recap', 'press',
    'As our contract says, response times are guaranteed for enterprise plans.', 6,
    jsonb_build_array('{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"response times are guaranteed","why":"Refer to the SLA instead.","status":"waived","reason":"Quoting the contract; Legal approved."}'::jsonb),
    false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Holiday promo', 'instagram',
    'Unwrap NB Sync this season: the revolutionary file gift for your team.', 4,
    jsonb_build_array(nb || '{"status":"open"}', hype || '{"status":"open"}'), false, '{}');
  perform pg_temp.post(v_owner, v_reviewer, 'Support page', 'web',
    'Replies are guaranteed within four hours for priority tickets.', 3,
    jsonb_build_array('{"rule":"CLAIM-02","category":"claim","severity":"major","confidence":"high","quote":"guaranteed within four hours","why":"Refer to the SLA instead.","status":"accepted"}'::jsonb),
    false, '{}');
  -- approved in June, while INR 499 was still the approved price (FACT-05 expired 2026-06-30)
  perform pg_temp.post(v_owner, v_reviewer, 'Vault launch email', 'email',
    'Northbeam Vault starts at INR 499 per month. Keep your team''s files in one safe place.', (current_date - date '2026-06-10'),
    '[]', true, '{FACT-05}');

  raise notice 'Demo history added: 12 posts, 4 approved.';
end $$;
