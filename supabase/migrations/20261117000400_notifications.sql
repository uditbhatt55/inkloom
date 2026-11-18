-- Round 3, improvement 2: in-app notifications for the review loop. Written only by database triggers, so no page
-- can skip one and no user can create one for someone else; each person reads and marks read only their own.
--  - a reviewer decides (approve, reject, request changes, waive) -> the item's author
--  - a comment -> the author's comment goes to the organisation's owners and reviewers; anyone else's to the author
--  - a new version (2 and later) -> owners and reviewers, so the changes get reviewed

create table public.notifications (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  item_id uuid references public.content_items on delete cascade,
  kind text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_unread on public.notifications (user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

/** Notifies `p_users` (minus the actor) about an item. */
create function private.notify(p_users uuid[], p_actor uuid, p_item uuid, p_kind text, p_body text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (org_id, user_id, item_id, kind, body)
  select i.org_id, u, i.id, p_kind, p_body
  from public.content_items i, unnest(p_users) u
  where i.id = p_item and u is not null and u is distinct from p_actor
$$;

create function private.reviewers_of(p_org uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.user_id), '{}') from public.memberships m where m.org_id = p_org and m.role in ('owner', 'reviewer')
$$;

create function private.notify_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_item public.content_items;
begin
  select * into v_item from public.content_items where id = new.item_id;
  perform private.notify(array[v_item.owner_id], new.author_id, new.item_id, new.decision::text,
    case new.decision
      when 'approve' then format('"%s" was approved.', v_item.title)
      when 'reject' then format('"%s" was rejected: %s', v_item.title, left(new.reason, 200))
      when 'request_changes' then format('Changes requested on "%s": %s', v_item.title, left(new.reason, 200))
      else format('A finding on "%s" was waived: %s', v_item.title, left(new.reason, 200)) end);
  return null;
end $$;
create trigger notify_decisions after insert on public.decisions for each row execute function private.notify_decision();

create function private.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_item public.content_items;
begin
  select * into v_item from public.content_items where id = new.item_id;
  perform private.notify(
    case when new.author_id = v_item.owner_id then private.reviewers_of(v_item.org_id) else array[v_item.owner_id] end,
    new.author_id, new.item_id, 'comment', format('New comment on "%s": %s', v_item.title, left(new.body, 200)));
  return null;
end $$;
create trigger notify_comments after insert on public.comments for each row execute function private.notify_comment();

create function private.notify_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_item public.content_items;
begin
  if new.n < 2 then return null; end if;
  select * into v_item from public.content_items where id = new.item_id;
  perform private.notify(private.reviewers_of(v_item.org_id), new.created_by, new.item_id, 'new_version',
    format('Version %s of "%s" is ready for review.', new.n, v_item.title));
  return null;
end $$;
create trigger notify_versions after insert on public.content_versions for each row execute function private.notify_version();

revoke execute on function private.notify(uuid[], uuid, uuid, text, text), private.reviewers_of(uuid),
  private.notify_decision(), private.notify_comment(), private.notify_version() from public, anon, authenticated;
