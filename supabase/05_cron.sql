-- ============================================================================
-- 05 — Расписание рассылки напоминаний (каждые 5 минут)
-- Включает расширения и вызывает edge-функцию telegram-reminders через pg_net.
-- ПЕРЕД выполнением замените:
--   <PROJECT_REF>     — реф вашего проекта (из URL Supabase, напр. abcd1234)
--   <SERVICE_ROLE_KEY> — Settings → API → service_role key
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- снять старое расписание, если перезапускаем
select cron.unschedule('insightlab-reminders')
where exists (select 1 from cron.job where jobname = 'insightlab-reminders');

select cron.schedule(
  'insightlab-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/telegram-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Генерация напоминаний из слотов/задач — каждые 10 минут
select cron.unschedule('insightlab-gen-reminders')
where exists (select 1 from cron.job where jobname = 'insightlab-gen-reminders');

select cron.schedule(
  'insightlab-gen-reminders',
  '*/10 * * * *',
  $$ select public.generate_reminders(); $$
);
