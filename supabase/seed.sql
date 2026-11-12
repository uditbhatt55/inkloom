-- Northbeam Cloud demo organisation (fictional; proposal §5.2, §12.4). Loaded by `supabase db reset`.
-- Starter set written by the team so the audit route, demo mode and tests have real data. ChatGPT Prompt 1
-- (CHATGPT_PROMPTS.md) will extend it; keep the codes below stable because recordings and tests cite them.
-- Users are not seeded: sign up, then run supabase/demo-membership.sql with your email to join as owner.

insert into public.organizations (id, name, demo)
values ('00000000-0000-4000-8000-000000000001', 'Northbeam Cloud (demo)', true)
on conflict (id) do nothing;

with o as (select '00000000-0000-4000-8000-000000000001'::uuid as id)
insert into public.guideline_clauses (org_id, code, category, text, examples_do, examples_dont)
select o.id, c.code, c.category::public.finding_category, c.text, c.dos, c.donts from o, (values
  ('CLAIM-01', 'claim', 'Every number in public copy (uptime, customers, savings, speed) must match an approved fact.', array['99.9% monthly uptime (FACT-07)'], array['99.99% uptime', '10x faster']),
  ('CLAIM-02', 'claim', 'Do not describe service levels as guaranteed; refer to the SLA.', array['backed by our SLA'], array['guaranteed uptime', '100% reliable']),
  ('CLAIM-03', 'claim', 'Do not call Northbeam the best, #1 or market leader unless an approved fact supports it.', array['used by teams in 14 countries'], array['India''s #1 sync platform']),
  ('CLAIM-04', 'claim', 'Do not claim legal compliance (GDPR, DPDP, HIPAA). Describe the security feature instead.', array['data encrypted at rest with AES-256'], array['fully GDPR-compliant']),
  ('TONE-01', 'tone', 'Professional and plain: no slang, no exclamation-mark hype in B2B channels.', array['It keeps your files in step.'], array['It''s the bomb!', 'Insane deal!!!']),
  ('TONE-02', 'tone', 'Speak to the customer as "you"; avoid "users" in marketing copy.', array['your team'], array['our users']),
  ('MSG-01', 'messaging', 'Lead with the customer benefit (files in step across devices), then the feature.', array[]::text[], array[]::text[]),
  ('ACC-01', 'accessibility', 'Every image needs alt text; text on images needs 4.5:1 contrast (3:1 for large text).', array[]::text[], array[]::text[]),
  ('VIS-01', 'visual', 'Use only the brand palette and the Inter typeface.', array[]::text[], array[]::text[])
) as c(code, category, text, dos, donts)
on conflict (org_id, code) do nothing;

with o as (select '00000000-0000-4000-8000-000000000001'::uuid as id)
insert into public.approved_facts (org_id, code, statement, evidence_ref, owner_name, valid_from, valid_until, visibility)
select o.id, f.code, f.statement, f.evidence, f.owner, f.vfrom::date, f.vuntil::date, f.vis::public.visibility from o, (values
  ('FACT-03', 'Northbeam Sync is used by teams in 14 countries', 'CRM export 2026-10', 'Sales Ops', '2026-10-01', '2027-03-31', 'public'),
  ('FACT-05', 'Northbeam Vault starts at INR 499 per month', 'Pricing page v3', 'Marketing', '2025-01-01', '2026-06-30', 'public'),
  ('FACT-06', 'Northbeam Vault starts at INR 599 per month', 'Pricing page v4', 'Marketing', '2026-07-01', null, 'public'),
  ('FACT-07', 'Northbeam Sync SLA: 99.9% monthly uptime', 'SLA v2, clause 4.1', 'Legal', '2026-04-01', '2027-03-31', 'public'),
  ('FACT-08', 'Files are encrypted at rest with AES-256', 'Security whitepaper 2026', 'Security', '2026-01-01', null, 'public'),
  ('FACT-90', 'Internal target: 12000 customers by Q3', 'Board deck', 'CEO office', null, null, 'internal'),
  ('FACT-91', 'Northbeam Mobile launches in March 2027', 'Roadmap', 'Product', null, null, 'internal')
) as f(code, statement, evidence, owner, vfrom, vuntil, vis)
on conflict (org_id, code) do nothing;

with o as (select '00000000-0000-4000-8000-000000000001'::uuid as id)
insert into public.terminology (org_id, code, term, kind, replacement, owner_name)
select o.id, t.code, t.term, t.kind::public.term_kind, t.repl, t.owner from o, (values
  ('TERM-01', 'Northbeam Sync', 'preferred', null, 'Marketing'),
  ('TERM-02', 'NB Sync', 'banned', 'Northbeam Sync', 'Marketing'),
  ('TERM-03', 'Northbeam Vault', 'preferred', null, 'Marketing'),
  ('TERM-04', 'cloud drive', 'banned', 'Northbeam Vault', 'Marketing'),
  ('TERM-31', 'Project Atlas', 'internal', null, 'Product'),
  ('TERM-32', 'Acme Retail', 'internal', null, 'Sales')
) as t(code, term, kind, repl, owner)
on conflict (org_id, code) do nothing;

insert into public.brand_assets (org_id, type, name, hex, font_name)
select '00000000-0000-4000-8000-000000000001', a.type, a.name, a.hex, a.font from (values
  ('color', 'Northbeam Navy', '#1B2A4A', null),
  ('color', 'Signal Teal', '#14B8A6', null),
  ('color', 'Cloud White', '#F8FAFC', null),
  ('color', 'Ink Grey', '#334155', null),
  ('font', 'Inter', null, 'Inter')
) as a(type, name, hex, font)
where not exists (select 1 from public.brand_assets b where b.org_id = '00000000-0000-4000-8000-000000000001');
