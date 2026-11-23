begin;

-- Existing claims were treated as completed by the previous dispatcher.
alter table public.notification_deliveries
  add column delivered_at timestamptz,
  add column claim_token uuid not null default gen_random_uuid();
update public.notification_deliveries set delivered_at = claimed_at;
create index notification_deliveries_medication_idx on public.notification_deliveries(medication_id);
create index notification_deliveries_claimed_idx on public.notification_deliveries(claimed_at);

-- An abandoned attempt can be retried within the dispatcher's three-minute window.
-- Each attempt owns a token, so an old worker cannot release a newer claim.
create function public.claim_notification_delivery(p_subscription_id uuid, p_medication_id uuid, p_scheduled_date date, p_schedule_time text)
returns uuid language sql security definer set search_path = '' as $$
  insert into public.notification_deliveries as delivery
    (subscription_id, medication_id, scheduled_date, schedule_time)
  values (p_subscription_id, p_medication_id, p_scheduled_date, p_schedule_time)
  on conflict (subscription_id, medication_id, scheduled_date, schedule_time)
  do update set claimed_at = now(), claim_token = gen_random_uuid()
  where delivery.delivered_at is null and delivery.claimed_at < now() - interval '45 seconds'
  returning claim_token;
$$;
revoke all on function public.claim_notification_delivery(uuid,uuid,date,text) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid,uuid,date,text) to service_role;
commit;
