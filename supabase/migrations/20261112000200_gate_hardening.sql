-- Hardening found while building the P3 score (decision D1, proposal §8):
-- 1. the approval gate only counted status='open', so a creator REJECTING a critical finding unblocked approval.
-- 2. a creator (item owner) could set their own finding to dismissed/waived/resolved through the update grant.

create or replace function public.apply_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_open_critical int;
begin
  if not exists (select 1 from public.content_versions v where v.id = new.version_id
                 and v.item_id = new.item_id and v.org_id = new.org_id) then
    raise exception 'version does not belong to this item' using errcode = 'P0001';
  end if;

  if new.decision = 'approve' then
    select count(*) into v_open_critical
    from public.findings f
    where f.status not in ('dismissed', 'waived', 'resolved') and f.severity = 'critical' and f.confidence <> 'low'
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

-- Only a reviewer/owner who is NOT the item's author may clear a finding when the change comes from a signed-in user.
-- Changes made by the waive trigger or the server (service role) run as another role and are not affected.
create or replace function public.guard_finding_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and new.status in ('dismissed', 'waived', 'resolved')
     and current_user = 'authenticated'
     and not exists (
       select 1 from public.audit_runs r
       join public.content_versions v on v.id = r.version_id
       join public.content_items i on i.id = v.item_id
       where r.id = new.run_id and private.has_role(i.org_id, '{owner,reviewer}') and i.owner_id <> auth.uid())
  then
    raise exception 'only a reviewer or owner (not the author) can dismiss, waive or resolve a finding' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger findings_guard_status before update on public.findings
  for each row execute function public.guard_finding_status();
