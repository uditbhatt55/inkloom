-- Atomic burst limit for audits (src/lib/audit/usage-cap.ts). Counting audit_runs let a few simultaneous requests slip past
-- the limit, because a run is only written after the audit. Each attempt is now recorded up front, under a per-user lock,
-- so parallel requests are counted one after another. Server only (service role); no client can read or call it.

create table public.audit_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index audit_attempts_user_time on public.audit_attempts (user_id, created_at);
alter table public.audit_attempts enable row level security;
-- no policies: anon and authenticated see nothing; the service role bypasses RLS
revoke all on public.audit_attempts from anon, authenticated;

/** Attempts this user made since p_since (this one not included), then records this one. */
create function public.record_audit_attempt(p_user uuid, p_since timestamptz) returns int
language plpgsql set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('audit_attempt:' || p_user::text));
  select count(*)::int into n from audit_attempts where user_id = p_user and created_at >= p_since;
  insert into audit_attempts (user_id) values (p_user);
  delete from audit_attempts where user_id = p_user and created_at < now() - interval '1 day';
  return n;
end $$;
revoke execute on function public.record_audit_attempt(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.record_audit_attempt(uuid, timestamptz) to service_role;
