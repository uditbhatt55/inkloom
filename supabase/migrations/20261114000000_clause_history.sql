-- Knowledge Centre (P2): guideline clauses are versioned (proposal §8.3: "guidelines change only when the owner saves a
-- new version"). When an owner changes a clause's text, the database keeps the old text here and bumps the version,
-- so earlier findings can still show the rule as it was. The version number is never trusted from the client.

create table public.guideline_clause_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  clause_id uuid not null references public.guideline_clauses on delete cascade,
  version int not null,
  text text not null,
  changed_by uuid references auth.users,
  changed_at timestamptz not null default now(),
  unique (clause_id, version)
);
create index on public.guideline_clause_history (clause_id);

alter table public.guideline_clause_history enable row level security;
-- same readers as guideline_clauses; nobody writes directly, only the trigger below
create policy clause_history_read on public.guideline_clause_history for select to authenticated
  using (private.my_role(org_id) is not null);
revoke insert, update, delete on public.guideline_clause_history from anon, authenticated;

create or replace function public.version_clause() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- code, category and org never change: a different rule needs a new code
  new.org_id := old.org_id;
  new.code := old.code;
  new.category := old.category;
  if new.text is distinct from old.text then
    insert into public.guideline_clause_history (org_id, clause_id, version, text, changed_by)
    values (old.org_id, old.id, old.version, old.text, auth.uid());
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end $$;

create trigger clauses_version before update on public.guideline_clauses
  for each row execute function public.version_clause();
revoke execute on function public.version_clause() from public, anon, authenticated;
