-- Round 3, improvement 2: tamper-proof approval.
-- 1. Knowledge revision. Every change to an organisation's guidelines, facts, terms or brand assets bumps
--    organizations.knowledge_rev; every audit run records the revision it was made against. A run with an older revision
--    is stale: the rules it checked against have changed since.
-- 2. Approval bound to what was reviewed. The database itself (not the page) checks that the version is the item's latest,
--    that it has an audit, and that the audit is not stale; it then stores the content hash, the run and the revision on
--    the decision, so an approval always says exactly what was approved.
-- shortcut: any change counts, including a typo fix; add a "material change" flag if re-audits become a burden.

alter table public.organizations add column knowledge_rev bigint not null default 0;
alter table public.audit_runs add column knowledge_rev bigint;
alter table public.decisions add column run_id uuid references public.audit_runs on delete set null,
  add column content_sha256 text, add column knowledge_rev bigint;

create function private.bump_knowledge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.organizations set knowledge_rev = knowledge_rev + 1
  where id = case when tg_op = 'DELETE' then old.org_id else new.org_id end;
  return null;
end $$;

create trigger clauses_rev after insert or update or delete on public.guideline_clauses for each row execute function private.bump_knowledge();
create trigger facts_rev after insert or update or delete on public.approved_facts for each row execute function private.bump_knowledge();
create trigger terms_rev after insert or update or delete on public.terminology for each row execute function private.bump_knowledge();
create trigger assets_rev after insert or update or delete on public.brand_assets for each row execute function private.bump_knowledge();

-- the run records the revision it was checked against; set by the database, whatever the caller sends
create function private.stamp_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.knowledge_rev := (select o.knowledge_rev from public.organizations o where o.id = new.org_id);
  return new;
end $$;
create trigger runs_stamp before insert on public.audit_runs for each row execute function private.stamp_run();
update public.audit_runs r set knowledge_rev = o.knowledge_rev from public.organizations o where o.id = r.org_id;

create or replace function public.apply_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_open_critical int;
  v_run public.audit_runs;
  v_version public.content_versions;
begin
  select * into v_version from public.content_versions v where v.id = new.version_id and v.item_id = new.item_id and v.org_id = new.org_id;
  if not found then
    raise exception 'version does not belong to this item' using errcode = 'P0001';
  end if;
  select * into v_run from public.audit_runs r where r.version_id = new.version_id order by r.created_at desc limit 1;
  -- what the decision was made on, filled in by the database (a caller cannot claim another hash or run)
  new.run_id := v_run.id;
  new.content_sha256 := v_version.sha256;
  new.knowledge_rev := v_run.knowledge_rev;

  if new.decision = 'approve' then
    if exists (select 1 from public.content_versions v where v.item_id = new.item_id and v.n > v_version.n) then
      raise exception 'approval blocked: not the latest version' using errcode = 'P0001';
    end if;
    if v_run.id is null then
      raise exception 'approval blocked: version not audited' using errcode = 'P0001';
    end if;
    if v_run.knowledge_rev is distinct from (select o.knowledge_rev from public.organizations o where o.id = new.org_id) then
      raise exception 'approval blocked: audit is stale' using errcode = 'P0001';
    end if;
    select count(*) into v_open_critical
    from public.findings f
    where f.run_id = v_run.id and f.status not in ('dismissed', 'waived', 'resolved') and f.severity = 'critical' and f.confidence <> 'low';
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

revoke execute on function private.bump_knowledge(), private.stamp_run() from public, anon, authenticated;
