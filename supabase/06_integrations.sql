-- ============================================================================
-- 06 — Интеграции: API-токены, подписки на вебхуки, журнал запросов
-- ТЗ «Двусторонний интеграционный коннектор», Фаза 1.
-- Выполнять после 01–03 (нужна функция public.is_admin()).
--
-- Идея: внешние сервисы (InsightLab, сайт-форма, и т.п.) обращаются к Edge-
-- функции `crm-api` по токену. Управление токенами — из приложения (только
-- админ). Сам токен (plaintext) НЕ хранится — только его SHA-256-хеш.
-- ============================================================================

-- ---------- API-токены ----------
create table if not exists public.api_tokens (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- человекочитаемое имя ("InsightLab Лидген")
  prefix        text not null,                 -- видимая часть (sk-crm-xxxxxxxx) для опознания в списке
  token_hash    text not null unique,          -- SHA-256(полный токен) в hex; plaintext не храним
  scopes        text[] not null default '{}',  -- inbound:leads, outbound:pipelines, outbound:users, ...
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  request_count bigint  not null default 0,
  revoked       boolean not null default false,
  expires_at    timestamptz                    -- null = бессрочный
);

-- ---------- Подписки на вебхуки (доставка событий — следующая фаза) ----------
create table if not exists public.webhook_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  events      text[] not null default '{}',    -- lead.created, lead.stage_changed, lead.won, ...
  secret      text,                             -- для подписи HMAC-SHA256
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Журнал запросов API (аудит, ТЗ §7) ----------
create table if not exists public.api_audit_log (
  id          bigserial primary key,
  token_id    uuid references public.api_tokens(id) on delete set null,
  method      text,
  path        text,
  status      int,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists api_audit_token_idx on public.api_audit_log (token_id, created_at desc);

-- ---------- RLS ----------
-- Управлять токенами/вебхуками и читать аудит может только админ (через приложение).
-- Edge-функция работает под service_role и RLS обходит — ей политики не мешают.
alter table public.api_tokens          enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.api_audit_log       enable row level security;

drop policy if exists "admin manage tokens"   on public.api_tokens;
drop policy if exists "admin manage webhooks" on public.webhook_subscriptions;
drop policy if exists "admin read audit"      on public.api_audit_log;

create policy "admin manage tokens" on public.api_tokens
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin manage webhooks" on public.webhook_subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin read audit" on public.api_audit_log
  for select using (public.is_admin());

-- ---------- Счётчик использования токена (вызывается Edge-функцией) ----------
-- SECURITY DEFINER: функция работает под service_role, RLS не мешает.
create or replace function public.touch_token(t_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.api_tokens
     set last_used_at = now(), request_count = request_count + 1
   where id = t_id;
$$;
