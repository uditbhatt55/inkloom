-- Round 3, improvement 2: security audit log. activity_log (append-only, owner and reviewer read, nobody writes
-- directly) already records items, versions, runs, decisions, facts and clauses. Added here:
-- 1. sign-ins: a new Supabase Auth session is written once for every organisation the user belongs to;
-- 2. role changes: members added, removed or given another role, with the old and new role;
-- 3. terminology and brand-asset changes, which were missing.

alter table public.activity_log add column detail jsonb;

create function private.log_sign_in() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (org_id, actor_id, action, target_table, target_id, detail)
  select m.org_id, new.user_id, 'sign_in', 'sessions', new.user_id, jsonb_build_object('user_agent', left(new.user_agent, 200))
  from public.memberships m where m.user_id = new.user_id;
  return new;
exception when others then
  return new; -- logging must never stop anyone signing in
end $$;

do $$
begin
  if to_regclass('auth.sessions') is not null then
    create trigger log_sign_in after insert on auth.sessions for each row execute function private.log_sign_in();
  end if;
end $$;

create function private.log_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return null;
  end if;
  insert into public.activity_log (org_id, actor_id, action, target_table, target_id, detail)
  values (case when tg_op = 'DELETE' then old.org_id else new.org_id end, auth.uid(),
          case tg_op when 'INSERT' then 'member_added' when 'DELETE' then 'member_removed' else 'role_changed' end,
          'memberships', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
          jsonb_build_object('from', case when tg_op <> 'INSERT' then old.role end, 'to', case when tg_op <> 'DELETE' then new.role end));
  return null;
end $$;
create trigger log_memberships after insert or update or delete on public.memberships for each row execute function private.log_membership();

create trigger log_terms after insert or update on public.terminology for each row execute function public.log_activity();
create trigger log_assets after insert or update on public.brand_assets for each row execute function public.log_activity();

revoke execute on function private.log_sign_in(), private.log_membership() from public, anon, authenticated;
