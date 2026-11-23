begin;
alter table public.medications alter column current type numeric(12,3), alter column total type numeric(12,3), alter column units_per_dose type numeric(12,3);
alter table public.medications drop constraint medications_units_per_dose_check;
alter table public.medications add constraint medications_units_per_dose_check check (units_per_dose between 0.001 and 1000);
alter table public.medications add column stock_unit text not null default 'unidades' check (stock_unit in ('unidades','mL','gotas'));
drop function public.restock_medication(uuid,integer);
create function public.restock_medication(p_medication_id uuid, p_quantity numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare med public.medications;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.'; end if;
  if p_quantity is null or p_quantity < 0.001 or p_quantity > 100000 or p_quantity <> round(p_quantity,3) then raise exception 'Quantidade inválida. Use até 3 casas decimais.'; end if;
  select * into med from public.medications where id = p_medication_id and user_id = auth.uid() and archived_at is null for update;
  if not found then raise exception 'Medicamento não encontrado.'; end if;
  if med.current + p_quantity > 100000 then raise exception 'A quantidade excede o limite de estoque.'; end if;
  update public.medications set current = current + p_quantity, total = greatest(total, current + p_quantity) where id = med.id;
end;
$$;
revoke all on function public.restock_medication(uuid,numeric) from public, anon;
grant execute on function public.restock_medication(uuid,numeric) to authenticated;
create or replace function public.validate_medication_schedule() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.schedules) t where t is null or t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    or cardinality(new.schedules) <> (select count(distinct t) from unnest(new.schedules) t)
  then raise exception 'Informe horários válidos e sem repetições.'; end if;
  return new;
end;
$$;
commit;
