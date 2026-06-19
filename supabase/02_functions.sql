-- ============================================================================
-- 02 — Вспомогательные функции для прав доступа (выполнять после 01)
-- SECURITY DEFINER, чтобы обращаться к profiles из политик других таблиц
-- без бесконечной рекурсии RLS.
-- ============================================================================

-- Текущий пользователь — администратор?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- Есть ли у текущего пользователя доступ к проекту?
-- admin — ко всем; интервьюер — если он назначен в interviewers проекта.
create or replace function public.can_access_project(pid text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.projects p,
             jsonb_array_elements_text(p.interviewers) e
        where p.id = pid and e = auth.uid()::text
      );
$$;

-- ----------------------------------------------------------------------------
-- Генератор напоминаний (ТЗ 3.6): за 1 день и за 1 час до интервью/задачи.
-- Идём от слотов респондентов и дедлайнов задач. id детерминированный, чтобы
-- не плодить дубликаты (on conflict do nothing). Вызывается по cron (см. 05).
-- ----------------------------------------------------------------------------
create or replace function public.generate_reminders()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- интервью по слотам респондентов
  insert into public.reminders (id, type, title, target, when_at, owner, kind)
  select 'rem_' || r.id || '_' || k.kind,
         'interview',
         'Интервью: ' || r.name,
         coalesce(p.client, ''),
         to_char((r.slot::timestamptz - k.offs) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         r.owner,
         k.kind
  from public.respondents r
  join public.projects p on p.id = r.project
  cross join (values (interval '1 day','1d'), (interval '1 hour','1h')) as k(offs, kind)
  where r.slot is not null
    and r.stage in ('slot','done','insight','loaded','screening','qualified')
    and (r.slot::timestamptz - k.offs) > now()
  on conflict (id) do nothing;

  -- задачи по дедлайнам
  insert into public.reminders (id, type, title, target, when_at, owner, kind)
  select 'rem_' || t.id || '_' || k.kind,
         'task',
         t.title,
         '',
         to_char((t.when_at::timestamptz - k.offs) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         t.owner,
         k.kind
  from public.tasks t
  cross join (values (interval '1 day','1d'), (interval '1 hour','1h')) as k(offs, kind)
  where t.when_at is not null and not t.done
    and (t.when_at::timestamptz - k.offs) > now()
  on conflict (id) do nothing;
end;
$$;
