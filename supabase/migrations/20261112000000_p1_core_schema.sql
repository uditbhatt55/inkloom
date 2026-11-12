-- P1: core schema, row-level security and the approval gate (proposal §6.2, §8, §10.1)

create type public.member_role as enum ('owner', 'reviewer', 'creator', 'agency', 'viewer');
create type public.visibility as enum ('public', 'internal');
create type public.term_kind as enum ('preferred', 'banned', 'internal');
create type public.finding_category as enum ('tone', 'terminology', 'factual', 'claim', 'messaging', 'visual', 'accessibility', 'confidentiality');
create type public.severity as enum ('critical', 'major', 'minor', 'info');
create type public.confidence as enum ('high', 'medium', 'low');
create type public.finding_status as enum ('open', 'accepted', 'rejected', 'dismissed', 'waived', 'resolved');
create type public.item_status as enum ('draft', 'ai_audited', 'in_review', 'changes_requested', 'rejected', 'approved');
create type public.decision_kind as enum ('approve', 'reject', 'request_changes', 'waive');

-- ── tables ─────────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null,
  primary key (org_id, user_id)
);

create table public.guideline_clauses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text not null,
  category public.finding_category not null,
  text text not null,
  examples_do text[] not null default '{}',
  examples_dont text[] not null default '{}',
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  version int not null default 1,
  source_page int,
  fts tsvector generated always as (to_tsvector('english', code || ' ' || text)) stored,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);
create index on public.guideline_clauses using gin (fts);

create table public.approved_facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text not null,
  statement text not null,
  evidence_ref text,
  owner_name text,
  valid_from date,
  valid_until date,
  visibility public.visibility not null default 'public',
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table public.terminology (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text not null,
  term text not null,
  kind public.term_kind not null,
  replacement text,
  owner_name text,
  unique (org_id, code)
);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  type text not null check (type in ('color', 'font', 'logo')),
  name text not null,
  hex text check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  font_name text,
  file_path text,
  rules text
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  title text not null,
  channel text,
  audience public.visibility not null default 'public',
  status public.item_status not null default 'draft',
  owner_id uuid not null references auth.users,
  reviewer_id uuid references auth.users,
  created_at timestamptz not null default now()
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  item_id uuid not null references public.content_items on delete cascade,
  n int not null,
  text text,
  file_path text,
  sha256 text not null,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  unique (item_id, n)
);

create table public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  version_id uuid not null references public.content_versions on delete cascade,
  mode text not null check (mode in ('real', 'simulated')),
  model text,
  prompt_ver text,
  score int check (score between 0 and 100),
  ai_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  run_id uuid not null references public.audit_runs on delete cascade,
  category public.finding_category not null,
  severity public.severity not null,
  confidence public.confidence not null,
  quote text not null,
  start_offset int,
  end_offset int,
  clause_id uuid references public.guideline_clauses,
  fact_id uuid references public.approved_facts,
  term_id uuid references public.terminology,
  explanation text not null,
  suggestion text,
  status public.finding_status not null default 'open',
  decided_by uuid references auth.users,
  reason text
);

create table public.claim_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  version_id uuid not null references public.content_versions on delete cascade,
  fact_id uuid not null references public.approved_facts on delete cascade,
  quote text not null,
  matched_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  item_id uuid not null references public.content_items on delete cascade,
  finding_id uuid references public.findings on delete cascade,
  version_id uuid references public.content_versions on delete cascade,
  author_id uuid not null references auth.users,
  body text not null check (length(body) > 0),
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  item_id uuid not null references public.content_items on delete cascade,
  version_id uuid not null references public.content_versions,
  finding_id uuid references public.findings,
  decision public.decision_kind not null,
  reason text,
  author_id uuid not null references auth.users,
  created_at timestamptz not null default now(),
  -- reject, request changes and waive always need a written reason (§8.2)
  check (decision = 'approve' or length(coalesce(reason, '')) > 0),
  check (decision <> 'waive' or finding_id is not null)
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations on delete cascade,
  actor_id uuid,
  action text not null,
  target_table text not null,
  target_id uuid,
  at timestamptz not null default now()
);

-- ── helpers (security definer so policies don't recurse into memberships RLS) ──
create function public.my_role(p_org uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.memberships where org_id = p_org and user_id = auth.uid()
$$;

create function public.has_role(p_org uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(p_org) = any (p_roles), false)
$$;

create function public.can_see_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.content_items i
    where i.id = p_item
      and (public.has_role(i.org_id, '{owner,reviewer,creator,viewer}') or i.owner_id = auth.uid())
  )
$$;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.guideline_clauses enable row level security;
alter table public.approved_facts enable row level security;
alter table public.terminology enable row level security;
alter table public.brand_assets enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.audit_runs enable row level security;
alter table public.findings enable row level security;
alter table public.claim_links enable row level security;
alter table public.comments enable row level security;
alter table public.decisions enable row level security;
alter table public.activity_log enable row level security;

create policy org_read on public.organizations for select to authenticated
  using (public.my_role(id) is not null);

create policy members_read on public.memberships for select to authenticated
  using (public.my_role(org_id) is not null);
create policy members_owner_write on public.memberships for all to authenticated
  using (public.has_role(org_id, '{owner}')) with check (public.has_role(org_id, '{owner}'));

-- knowledge base: owner edits; everyone reads public; internal only owner/reviewer (§8.1)
create policy clauses_read on public.guideline_clauses for select to authenticated
  using (public.my_role(org_id) is not null);
create policy clauses_write on public.guideline_clauses for all to authenticated
  using (public.has_role(org_id, '{owner}')) with check (public.has_role(org_id, '{owner}'));

create policy facts_read on public.approved_facts for select to authenticated
  using (public.has_role(org_id, '{owner,reviewer}')
      or (visibility = 'public' and public.my_role(org_id) is not null));
create policy facts_write on public.approved_facts for all to authenticated
  using (public.has_role(org_id, '{owner}')) with check (public.has_role(org_id, '{owner}'));

create policy terms_read on public.terminology for select to authenticated
  using (public.has_role(org_id, '{owner,reviewer}')
      or (kind <> 'internal' and public.my_role(org_id) is not null));
create policy terms_write on public.terminology for all to authenticated
  using (public.has_role(org_id, '{owner}')) with check (public.has_role(org_id, '{owner}'));

create policy assets_read on public.brand_assets for select to authenticated
  using (public.my_role(org_id) is not null);
create policy assets_write on public.brand_assets for all to authenticated
  using (public.has_role(org_id, '{owner}')) with check (public.has_role(org_id, '{owner}'));

-- content: agency sees only its own items; viewers read-only
create policy items_read on public.content_items for select to authenticated
  using (public.can_see_item(id));
create policy items_insert on public.content_items for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(org_id, '{owner,reviewer,creator,agency}'));
create policy items_update on public.content_items for update to authenticated
  using (owner_id = auth.uid() or public.has_role(org_id, '{owner,reviewer}'));
-- status changes only through decisions (trigger below), never by direct update
revoke update on public.content_items from authenticated;
grant update (title, channel, audience, reviewer_id) on public.content_items to authenticated;

create policy versions_read on public.content_versions for select to authenticated
  using (public.can_see_item(item_id));
create policy versions_insert on public.content_versions for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_item(item_id)
    and public.has_role(org_id, '{owner,reviewer,creator,agency}'));
revoke update, delete on public.content_versions from authenticated;

-- runs, findings and claim links are written by the server (service role) only
create policy runs_read on public.audit_runs for select to authenticated
  using (exists (select 1 from public.content_versions v where v.id = version_id and public.can_see_item(v.item_id)));
create policy findings_read on public.findings for select to authenticated
  using (exists (select 1 from public.audit_runs r join public.content_versions v on v.id = r.version_id
                 where r.id = run_id and public.can_see_item(v.item_id)));
create policy claims_read on public.claim_links for select to authenticated
  using (exists (select 1 from public.content_versions v where v.id = version_id and public.can_see_item(v.item_id)));
-- creators accept/reject suggestions: only status + reason
create policy findings_decide on public.findings for update to authenticated
  using (exists (select 1 from public.audit_runs r join public.content_versions v on v.id = r.version_id
                 join public.content_items i on i.id = v.item_id
                 where r.id = run_id and (i.owner_id = auth.uid() or public.has_role(i.org_id, '{owner,reviewer}'))));
revoke update on public.findings from authenticated;
grant update (status, reason, decided_by) on public.findings to authenticated;

create policy comments_read on public.comments for select to authenticated
  using (public.can_see_item(item_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_item(item_id)
    and not public.has_role(org_id, '{viewer}'));
revoke update, delete on public.comments from authenticated;

create policy decisions_read on public.decisions for select to authenticated
  using (public.can_see_item(item_id));
-- only owner/reviewer decide, never on their own work (§8.1)
create policy decisions_insert on public.decisions for insert to authenticated
  with check (author_id = auth.uid() and public.has_role(org_id, '{owner,reviewer}')
    and not exists (select 1 from public.content_items i where i.id = item_id and i.owner_id = auth.uid()));
revoke update, delete on public.decisions from authenticated;

create policy log_read on public.activity_log for select to authenticated
  using (public.has_role(org_id, '{owner,reviewer}'));
revoke insert, update, delete on public.activity_log from authenticated, anon;

-- ── approval gate + state change (§7.5, §8) ────────────────────────────
create function public.apply_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_open_critical int;
begin
  if not exists (select 1 from public.content_versions v where v.id = new.version_id
                 and v.item_id = new.item_id and v.org_id = new.org_id) then
    raise exception 'version does not belong to this item' using errcode = 'P0001';
  end if;

  if new.decision = 'approve' then
    -- open criticals on the latest run of the decided version
    select count(*) into v_open_critical
    from public.findings f
    where f.status = 'open' and f.severity = 'critical' and f.confidence <> 'low'
      and f.run_id = (select r.id from public.audit_runs r where r.version_id = new.version_id
                      order by r.created_at desc limit 1);
    if v_open_critical > 0 then
      raise exception 'approval blocked: % open critical finding(s)', v_open_critical using errcode = 'P0001';
    end if;
  end if;

  if new.decision = 'waive' then
    update public.findings set status = 'waived', reason = new.reason, decided_by = new.author_id
    where id = new.finding_id and org_id = new.org_id;
  else
    update public.content_items set status = case new.decision
        when 'approve' then 'approved'::public.item_status
        when 'reject' then 'rejected'::public.item_status
        else 'changes_requested'::public.item_status end
    where id = new.item_id;
  end if;
  return new;
end $$;

create trigger decisions_apply before insert on public.decisions
  for each row execute function public.apply_decision();

-- ── append-only activity log ───────────────────────────────────────────
create function public.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (org_id, actor_id, action, target_table, target_id)
  values (new.org_id, auth.uid(), lower(tg_op), tg_table_name, new.id);
  return new;
end $$;

create trigger log_items after insert or update on public.content_items for each row execute function public.log_activity();
create trigger log_versions after insert on public.content_versions for each row execute function public.log_activity();
create trigger log_runs after insert on public.audit_runs for each row execute function public.log_activity();
create trigger log_decisions after insert on public.decisions for each row execute function public.log_activity();
create trigger log_facts after insert or update on public.approved_facts for each row execute function public.log_activity();
create trigger log_clauses after insert or update on public.guideline_clauses for each row execute function public.log_activity();

-- helpers are for policies only
revoke execute on function public.apply_decision(), public.log_activity() from public, anon, authenticated;
