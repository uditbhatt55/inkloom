-- Fix: creating an item failed with 403 (RLS 42501) because the insert's
-- RETURNING check called private.can_see_item(), which reads content_items
-- from inside the same statement, so the new row is not visible yet.
-- Same rule as before, written against the row itself. Permissions unchanged:
-- the item's owner, or an owner/reviewer/creator/viewer of its org, can read it.
drop policy if exists items_read on public.content_items;
create policy items_read on public.content_items for select
  using (owner_id = auth.uid() or private.has_role(org_id, '{owner,reviewer,creator,viewer}'::member_role[]));
