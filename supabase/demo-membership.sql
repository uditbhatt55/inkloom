-- Join the Northbeam demo organisation after signing up. Run as postgres (SQL editor or `supabase db query`).
-- Replace the email; role is one of owner | reviewer | creator | agency | viewer.
insert into public.memberships (org_id, user_id, role)
select '00000000-0000-4000-8000-000000000001', u.id, 'owner'
from auth.users u
where u.email = 'you@example.com'
on conflict (org_id, user_id) do update set role = excluded.role;
