-- ============================================================================
-- InsightLab CRM — СХЕМА БАЗЫ ДАННЫХ (Supabase / PostgreSQL)
-- Выполнять в Supabase → SQL Editor по порядку: 01 → 02 → 03 → (04 опц.) → 05
-- ----------------------------------------------------------------------------
-- Соответствие модели данных ТЗ 3.3. Первичные ключи строковые (text), чтобы
-- принимать id, сгенерированные на фронте (lead_xxx, proj_xxx и т.д.) без
-- дополнительного маппинга. Вложенные структуры (история активностей, скрипт,
-- список интервьюеров) хранятся как jsonb — это 1:1 повторяет форму данных в
-- приложении и не требует переписывать UI.
-- ============================================================================

-- Профили пользователей. id = auth.users.id (uuid), создаётся триггером при
-- регистрации. Роль по умолчанию 'sales'; первого пользователя делаем admin
-- вручную (см. README, шаг "Первый администратор").
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  role        text not null default 'sales' check (role in ('admin','sales','interviewer')),
  telegram_id text,
  email       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Лиды / сделки (воронка продаж 3.4)
create table if not exists public.leads (
  id          text primary key,
  company     text not null default '',
  contact     text default '',
  title       text default '',
  phone       text default '',
  email       text default '',
  source      text default 'Робот',
  stage       text not null default 'new',
  owner       uuid references public.profiles(id) on delete set null,
  next_touch  text,
  amount      numeric default 0,
  notes       text default '',
  history     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists leads_owner_idx on public.leads(owner);

-- Проекты (созданные из выигранных сделок 3.4)
create table if not exists public.projects (
  id              text primary key,
  client          text not null default '',
  pkg             text default 'Экспресс',
  price           numeric default 0,
  start           text,
  deadline        text,
  interviewers    jsonb not null default '[]'::jsonb,  -- массив uuid профилей
  mode            text default 'B',                    -- A = база клиента, B = собираем сами
  status          text default 'active',
  plan_interviews integer default 0,
  script          jsonb,                               -- { id, name, blocks[] }
  created_at      timestamptz not null default now()
);

-- Респонденты (воронка рекрутинга 3.5)
create table if not exists public.respondents (
  id               text primary key,
  name             text not null default '',
  phone            text default '',
  project          text references public.projects(id) on delete cascade,
  screen_status    text default '—',
  qualified        boolean default false,
  slot             text,
  interview_status text default '—',
  reward           text default 'Нет',
  insight          boolean default false,
  key_insight      text default '',
  recording        text default '',
  stage            text not null default 'loaded',
  owner            uuid references public.profiles(id) on delete set null,
  notes            text default '',
  created_at       timestamptz not null default now()
);
create index if not exists respondents_project_idx on public.respondents(project);
create index if not exists respondents_owner_idx on public.respondents(owner);

-- Заметки интервью: одна строка на респондента, data = { blockId: text } (3.5в)
create table if not exists public.notes (
  respondent_id text primary key references public.respondents(id) on delete cascade,
  data          jsonb not null default '{}'::jsonb
);

-- Задачи / активности (3.3)
create table if not exists public.tasks (
  id      text primary key,
  type    text default 'task',
  title   text default '',
  when_at text,
  done    boolean default false,
  owner   uuid references public.profiles(id) on delete cascade
);
create index if not exists tasks_owner_idx on public.tasks(owner);

-- Напоминания для Telegram-бота (3.6). kind: '1d' | '1h'; sent — отправлено ли.
create table if not exists public.reminders (
  id      text primary key,
  type    text default 'interview',  -- task | razbor | interview
  title   text default '',
  target  text default '',
  when_at text,
  sent    boolean default false,
  owner   uuid references public.profiles(id) on delete cascade,
  kind    text default '1h'
);
create index if not exists reminders_due_idx on public.reminders(sent, when_at);

-- Автосоздание профиля при регистрации нового пользователя в Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    'sales'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
