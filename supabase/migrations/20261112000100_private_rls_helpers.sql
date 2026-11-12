-- Move RLS helpers out of the API-exposed public schema (advisor lints 0028/0029).
-- Policies keep working: they reference functions by OID, not by name.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.my_role(uuid) set schema private;
alter function public.has_role(uuid, public.member_role[]) set schema private;
alter function public.can_see_item(uuid) set schema private;

create or replace function private.has_role(p_org uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role(p_org) = any (p_roles), false)
$$;

create or replace function private.can_see_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.content_items i
    where i.id = p_item
      and (private.has_role(i.org_id, '{owner,reviewer,creator,viewer}') or i.owner_id = auth.uid())
  )
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
