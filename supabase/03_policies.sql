-- ============================================================================
-- 03 — Row Level Security: права ролей из ТЗ 3.2 на уровне сервера
--   admin       — всё
--   sales       — только свои лиды (owner = он)
--   interviewer — только назначенные проекты и респонденты на них
-- Выполнять после 01 и 02.
-- ============================================================================

alter table public.profiles    enable row level security;
alter table public.leads       enable row level security;
alter table public.projects    enable row level security;
alter table public.respondents enable row level security;
alter table public.notes       enable row level security;
alter table public.tasks       enable row level security;
alter table public.reminders   enable row level security;

-- ---------- profiles ----------
-- Читать профили могут все авторизованные (нужны имена владельцев/интервьюеров).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- Себя обновить может каждый; чужие профили и роли — только admin.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- leads ----------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (public.is_admin() or owner = auth.uid());

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (public.is_admin() or owner = auth.uid());

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (public.is_admin() or owner = auth.uid())
  with check (public.is_admin() or owner = auth.uid());

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete to authenticated
  using (public.is_admin() or owner = auth.uid());

-- ---------- projects ----------
-- Видят: admin (все) и назначенные интервьюеры. Создаёт/удаляет/назначает — admin.
-- Интервьюер может ОБНОВЛЯТЬ свой проект (правка скрипта 3.5а).
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.can_access_project(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.can_access_project(id))
  with check (public.can_access_project(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.is_admin());

-- ---------- respondents ----------
-- Доступ привязан к проекту (admin — всё; интервьюер — на своих проектах).
drop policy if exists respondents_select on public.respondents;
create policy respondents_select on public.respondents
  for select to authenticated
  using (public.can_access_project(project));

drop policy if exists respondents_insert on public.respondents;
create policy respondents_insert on public.respondents
  for insert to authenticated
  with check (public.can_access_project(project));

drop policy if exists respondents_update on public.respondents;
create policy respondents_update on public.respondents
  for update to authenticated
  using (public.can_access_project(project))
  with check (public.can_access_project(project));

drop policy if exists respondents_delete on public.respondents;
create policy respondents_delete on public.respondents
  for delete to authenticated
  using (public.can_access_project(project));

-- ---------- notes (заметки интервью) ----------
drop policy if exists notes_all on public.notes;
create policy notes_all on public.notes
  for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.respondents r
      where r.id = respondent_id and public.can_access_project(r.project)
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.respondents r
      where r.id = respondent_id and public.can_access_project(r.project)
    )
  );

-- ---------- tasks ----------
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks
  for all to authenticated
  using (public.is_admin() or owner = auth.uid())
  with check (public.is_admin() or owner = auth.uid());

-- ---------- reminders ----------
drop policy if exists reminders_all on public.reminders;
create policy reminders_all on public.reminders
  for all to authenticated
  using (public.is_admin() or owner = auth.uid())
  with check (public.is_admin() or owner = auth.uid());
