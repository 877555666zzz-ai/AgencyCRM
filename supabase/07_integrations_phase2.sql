-- ============================================================================
-- 07 — Интеграции, Фаза 2 и 3 (ТЗ «Двусторонний коннектор»)
--
-- Добавляет:
--   • таблицу public.contacts        — приём контактов (inbound:contacts)
--   • таблицу public.crm_events      — приём событий  (inbound:events)
--   • таблицу public.webhook_deliveries — журнал отправленных вебхуков
--   • ТРИГГЕР на leads → при создании/изменении лида CRM САМА шлёт вебхуки
--     подписчикам (real-time, через pg_net), с подписью X-CRM-Signature
--     (HMAC-SHA256 тела по секрету подписки).
--
-- Требует расширения pgcrypto (hmac) и pg_net (http). Включаются ниже.
-- RLS: новые таблицы доступны только админам; edge-функция работает под
-- service_role и RLS обходит.
--
-- Запускать в Supabase → SQL Editor → Run. Безопасно перезапускать.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Контакты (inbound:contacts)
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text default '',
  company     text default '',
  phone       text default '',
  email       text default '',
  telegram    text default '',
  source      text default 'API',
  linked_lead text references public.leads(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- События / действия (inbound:events)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     text references public.leads(id) on delete set null,
  type        text default '',     -- message_sent, call_made, ...
  channel     text default '',     -- telegram, email, ...
  direction   text default '',     -- inbound | outbound
  text        text default '',
  status      text default '',
  source      text default 'API',
  occurred_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Журнал доставки вебхуков (видно в UI: что и куда отправили)
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.webhook_subscriptions(id) on delete set null,
  event           text,
  payload         jsonb,
  request_id      bigint,          -- id запроса pg_net (для отладки)
  created_at      timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_created on public.webhook_deliveries(created_at desc);
create index if not exists idx_crm_events_lead on public.crm_events(lead_id);
create index if not exists idx_contacts_phone on public.contacts(phone);

-- ---------------------------------------------------------------------------
-- RLS на новые таблицы (только админ; service_role обходит)
-- ---------------------------------------------------------------------------
alter table public.contacts            enable row level security;
alter table public.crm_events          enable row level security;
alter table public.webhook_deliveries  enable row level security;

drop policy if exists "admin manage contacts"  on public.contacts;
drop policy if exists "admin manage events"    on public.crm_events;
drop policy if exists "admin read deliveries"  on public.webhook_deliveries;

create policy "admin manage contacts" on public.contacts
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage events" on public.crm_events
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin read deliveries" on public.webhook_deliveries
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- ТРИГГЕР: отправка вебхуков при изменении лида
-- Определяет событие(я), формирует payload, рассылает всем активным
-- подпискам, у которых это событие в списке events. Подпись HMAC-SHA256.
-- ---------------------------------------------------------------------------
create or replace function public.leads_notify_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  evts     text[] := '{}';
  ev       text;
  payload  jsonb;
  body_txt text;
  sub      record;
  sig      text;
  rid      bigint;
begin
  -- какие события произошли
  if (tg_op = 'INSERT') then
    evts := array['lead.created'];
  elsif (tg_op = 'UPDATE') then
    if (new.stage is distinct from old.stage) then
      evts := evts || 'lead.stage_changed';
      if (new.stage = 'won')  then evts := evts || 'lead.won';  end if;
      if (new.stage = 'lost') then evts := evts || 'lead.lost'; end if;
    end if;
    if (new.owner is distinct from old.owner) then
      evts := evts || 'lead.assigned';
    end if;
    if (array_length(evts, 1) is null) then
      evts := array['lead.updated'];
    end if;
  end if;

  if (array_length(evts, 1) is null) then
    return coalesce(new, old);
  end if;

  foreach ev in array evts loop
    payload := jsonb_build_object(
      'event', ev,
      'timestamp', to_char((now() at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'data', (case
        when ev = 'lead.stage_changed' then jsonb_build_object(
          'lead_id', new.id, 'stage_from', old.stage, 'stage_to', new.stage,
          'user_id', new.owner, 'pipeline_id', '1')
        when ev = 'lead.assigned' then jsonb_build_object(
          'lead_id', new.id, 'user_id', new.owner, 'pipeline_id', '1')
        when ev in ('lead.won', 'lead.lost') then jsonb_build_object(
          'lead_id', new.id, 'stage_to', new.stage, 'user_id', new.owner, 'pipeline_id', '1')
        when ev = 'lead.created' then jsonb_build_object(
          'lead_id', new.id, 'company_name', new.company, 'contact_name', new.contact,
          'phone', new.phone, 'email', new.email, 'source', new.source,
          'stage_id', new.stage, 'user_id', new.owner, 'pipeline_id', '1')
        else jsonb_build_object(
          'lead_id', new.id, 'stage_id', new.stage, 'user_id', new.owner, 'pipeline_id', '1')
      end)
    );
    body_txt := payload::text;

    for sub in
      select * from public.webhook_subscriptions
      where active and ev = any(events)
    loop
      sig := encode(hmac(body_txt, coalesce(sub.secret, ''), 'sha256'), 'hex');
      begin
        select net.http_post(
          url     := sub.url,
          body    := payload,
          headers := jsonb_build_object(
                       'Content-Type', 'application/json',
                       'X-CRM-Signature', 'sha256=' || sig
                     )
        ) into rid;
      exception when others then
        rid := null;
      end;
      insert into public.webhook_deliveries(subscription_id, event, payload, request_id)
      values (sub.id, ev, payload, rid);
    end loop;
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_leads_webhooks on public.leads;
create trigger trg_leads_webhooks
  after insert or update on public.leads
  for each row execute function public.leads_notify_webhooks();

-- Готово. Теперь любое создание/изменение лида (из API или из интерфейса)
-- автоматически рассылает вебхуки подписчикам с подписью HMAC-SHA256.
