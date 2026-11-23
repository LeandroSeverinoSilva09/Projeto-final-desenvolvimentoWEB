begin;
alter table public.medications drop constraint medications_check;
alter table public.medications add constraint medications_capacity_check check (total between 0.001 and 100000 and current <= total);
commit;
