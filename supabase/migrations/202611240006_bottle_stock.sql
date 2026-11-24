begin;

-- Drop doses stay in gotas. Bottle stock is a separate, user-reported observation.
-- Keep legacy numeric balances intact; never infer a bottle level or a drops/mL ratio.
alter table public.medications add column stock_level text not null default 'unknown'
  check (stock_level in ('full','half','low','empty','unknown'));

create or replace function public.confirm_medication_dose(p_medication_id uuid, p_schedule_time text, p_timezone text default 'America/Sao_Paulo')
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
  if med.stock_unit = 'gotas' then
    if med.stock_level = 'empty' then raise exception 'O frasco foi marcado como vazio. Confira e atualize o frasco em Meus remédios.'; end if;
  elsif med.current < med.units_per_dose then
    raise exception 'Estoque insuficiente. Confira a quantidade disponível.';
  end if;
  insert into public.dose_records(user_id, medication_id, name, dose, scheduled_date, schedule_time)
  values(auth.uid(), med.id, med.name, med.dose, local_now::date, p_schedule_time) returning id into result_id;
  if med.stock_unit <> 'gotas' then
    update public.medications set current = current - med.units_per_dose where id = med.id;
  end if;
  return result_id;
end;
$$;

create or replace function public.restock_medication(p_medication_id uuid, p_quantity numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare med public.medications;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.'; end if;
  if p_quantity is null or p_quantity < 0.001 or p_quantity > 100000 or p_quantity <> round(p_quantity,3) then raise exception 'Quantidade inválida. Use até 3 casas decimais.'; end if;
  select * into med from public.medications where id = p_medication_id and user_id = auth.uid() and archived_at is null for update;
  if not found then raise exception 'Medicamento não encontrado.'; end if;
  if med.stock_unit = 'gotas' then raise exception 'Para gotas, atualize como está o frasco em Meus remédios.'; end if;
  if med.current + p_quantity > 100000 then raise exception 'A quantidade excede o limite de estoque.'; end if;
  update public.medications set current = current + p_quantity, total = greatest(total, current + p_quantity) where id = med.id;
end;
$$;

commit;
