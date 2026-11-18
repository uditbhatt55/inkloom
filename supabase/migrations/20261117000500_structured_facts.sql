-- Round 3, improvement 1: structured facts. Optional fields beside the fact's sentence, so the rule engine
-- (src/lib/rules/structured-facts.ts) compares figures by value, currency, period and region instead of by string.
-- A fact without fields keeps working as before. Changing a field counts as changing the fact (updated_at, fact impact).

alter table public.approved_facts
  add column metric text check (length(metric) <= 60),
  add column value numeric,
  add column unit text check (length(unit) <= 30),
  add column period text check (period in ('day', 'week', 'month', 'year')),
  add column currency text check (currency ~ '^[A-Z]{3}$'),
  add column region text check (length(region) <= 60),
  add column product text check (length(product) <= 120),
  add column condition text check (length(condition) <= 300);

create or replace function public.touch_fact() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.statement, new.valid_from, new.valid_until, new.visibility, new.metric, new.value, new.unit, new.period, new.currency, new.region, new.product, new.condition)
     is distinct from (old.statement, old.valid_from, old.valid_until, old.visibility, old.metric, old.value, old.unit, old.period, old.currency, old.region, old.product, old.condition) then
    new.updated_at := now();
  end if;
  return new;
end $$;
