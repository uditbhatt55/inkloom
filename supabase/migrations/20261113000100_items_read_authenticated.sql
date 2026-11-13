-- Follow-up to 20261113000000: the recreated items_read policy had no role, so it also applied to anon, and an
-- anonymous select failed with "permission denied for function has_role" instead of returning no rows.
-- Same rule, limited to signed-in users like every other policy in P1.
drop policy if exists items_read on public.content_items;
create policy items_read on public.content_items for select to authenticated
  using (owner_id = auth.uid() or private.has_role(org_id, '{owner,reviewer,creator,viewer}'::public.member_role[]));
