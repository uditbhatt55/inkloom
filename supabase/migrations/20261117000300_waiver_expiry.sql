-- Round 3, improvement 2: waivers with an expiry date. A waiver may say until when the exception holds; after that the
-- finding counts as open again, so the approval gate blocks a critical one until someone re-decides it. A waiver applies
-- to the finding in this version only (a new version is audited afresh).

alter table public.decisions add column expires_at timestamptz,
  add constraint decisions_expiry_only_waive check (expires_at is null or decision = 'waive');

/** True when the finding's latest waiver has an expiry date that has passed. */
create function private.waiver_expired(p_finding uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select d.expires_at <= now() from public.decisions d
                   where d.finding_id = p_finding and d.decision = 'waive' order by d.created_at desc limit 1), false)
$$;

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

  if new.expires_at is not null and new.expires_at <= now() then
    raise exception 'waiver expiry must be in the future' using errcode = 'P0001';
  end if;

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
    where f.run_id = v_run.id and f.severity = 'critical' and f.confidence <> 'low'
      and (f.status not in ('dismissed', 'waived', 'resolved') or (f.status = 'waived' and private.waiver_expired(f.id)));
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

revoke execute on function private.waiver_expired(uuid) from public, anon, authenticated;
