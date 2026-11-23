begin;

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  dose text not null check (length(trim(dose)) between 1 and 150),
  current integer not null check (current between 0 and 100000),
  total integer not null check (total between 1 and 100000 and current <= total),
  schedules text[] not null check (cardinality(schedules) between 1 and 24),
  units_per_dose integer not null default 1 check (units_per_dose between 1 and 1000),
  instructions text not null default '' check (length(instructions) <= 500),
  color text not null default 'teal' check (color in ('teal','blue','amber','violet')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index medications_user_idx on public.medications(user_id);

create table public.dose_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id),
  name text not null,
  dose text not null,
  scheduled_date date not null,
  schedule_time text not null check (schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  taken_at timestamptz not null default now(),
  unique (user_id, medication_id, scheduled_date, schedule_time)
);
create index dose_records_user_idx on public.dose_records(user_id, taken_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null check (endpoint ~ '^https://'),
  subscription jsonb not null,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- Only the dispatcher can read or write delivery claims.
create table public.notification_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_date date not null,
  schedule_time text not null,
  claimed_at timestamptz not null default now(),
  primary key (subscription_id, medication_id, scheduled_date, schedule_time)
);

alter table public.medications enable row level security;
alter table public.dose_records enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
create policy medications_select on public.medications for select to authenticated using ((select auth.uid()) = user_id);
create policy medications_insert on public.medications for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medications_update on public.medications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy doses_select on public.dose_records for select to authenticated using ((select auth.uid()) = user_id);
create policy subscriptions_own on public.push_subscriptions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Validate schedule syntax and duplicates for all database writers.
create function public.validate_medication_schedule() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.schedules) t where t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    or cardinality(new.schedules) <> (select count(distinct t) from unnest(new.schedules) t)
  then raise exception 'Informe horários válidos e sem repetições.'; end if;
  return new;
end;
$$;
create trigger medication_schedule_validation before insert or update on public.medications for each row execute function public.validate_medication_schedule();

-- One transaction serializes confirmations and stock changes across devices.
create function public.confirm_medication_dose(p_medication_id uuid, p_schedule_time text, p_timezone text default 'America/Sao_Paulo')
returns uuid language plpgsql security definer set search_path = '' as $$
declare med public.medications; local_now timestamp; result_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.'; end if;
  local_now := now() at time zone p_timezone;
  select * into med from public.medications where id = p_medication_id and user_id = auth.uid() and archived_at is null for update;
  if not found then raise exception 'Medicamento não encontrado.'; end if;
  if not (p_schedule_time = any(med.schedules)) then raise exception 'Horário não cadastrado.'; end if;
  if p_schedule_time::time > local_now::time then raise exception 'O horário desta dose ainda não chegou.'; end if;
  if exists (select 1 from public.dose_records where medication_id = med.id and user_id = auth.uid() and scheduled_date = local_now::date and schedule_time = p_schedule_time) then raise exception 'Esta dose já foi registrada.'; end if;
  if med.current < med.units_per_dose then raise exception 'Estoque insuficiente. Confira a quantidade disponível.'; end if;
  insert into public.dose_records(user_id, medication_id, name, dose, scheduled_date, schedule_time)
  values(auth.uid(), med.id, med.name, med.dose, local_now::date, p_schedule_time) returning id into result_id;
  update public.medications set current = current - med.units_per_dose where id = med.id;
  return result_id;
end;
$$;
create function public.restock_medication(p_medication_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
declare med public.medications;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.'; end if;
  if p_quantity < 1 or p_quantity > 100000 then raise exception 'Quantidade inválida.'; end if;
  select * into med from public.medications where id = p_medication_id and user_id = auth.uid() and archived_at is null for update;
  if not found then raise exception 'Medicamento não encontrado.'; end if;
  if med.current + p_quantity > 100000 then raise exception 'A quantidade excede o limite de estoque.'; end if;
  update public.medications set current = current + p_quantity, total = greatest(total, current + p_quantity) where id = med.id;
end;
$$;
revoke all on public.medications, public.dose_records, public.push_subscriptions, public.notification_deliveries from anon;
revoke all on public.medications, public.dose_records, public.push_subscriptions, public.notification_deliveries from authenticated;
grant select, insert, update on public.medications to authenticated;
grant select on public.dose_records to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on function public.confirm_medication_dose(uuid,text,text) from public, anon;
revoke all on function public.restock_medication(uuid,integer) from public, anon;
grant execute on function public.confirm_medication_dose(uuid,text,text) to authenticated;
grant execute on function public.restock_medication(uuid,integer) to authenticated;
grant all on public.medications, public.dose_records, public.push_subscriptions, public.notification_deliveries to service_role;
commit;
