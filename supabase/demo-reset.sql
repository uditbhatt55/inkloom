-- Puts the Northbeam demo organisation back to its seeded state (judges share the demo accounts and may edit anything).
-- Run as postgres (SQL editor), then the two files below in this order, in separate runs:
--   1. supabase/demo-reset.sql    (this file: clears posts, rules, facts, terms and colours of the demo org only)
--   2. supabase/seed.sql          (the original 9 rules, 7 facts, 6 terms, 5 brand assets)
--   3. supabase/demo-history.sql  (12 posts, 4 approved; first replace owner@example.com / reviewer@example.com with
--                                  demo-owner@northbeam.example / demo-reviewer@northbeam.example)
-- Users and memberships are kept, so the "Try the demo" buttons keep working. Other organisations are never touched.
-- Deleting the posts cascades to versions, audit runs, findings, claim links, comments and decisions; deleting the rules
-- cascades to their version history. Safe to run twice.

do $$
declare v_org constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.organizations where id = v_org and demo) then
    raise exception 'The demo organisation was not found; nothing was changed.';
  end if;
  delete from public.content_items   where org_id = v_org;
  delete from public.activity_log    where org_id = v_org;
  delete from public.guideline_clauses where org_id = v_org;
  delete from public.approved_facts  where org_id = v_org;
  delete from public.terminology     where org_id = v_org;
  delete from public.brand_assets    where org_id = v_org;
end $$;
