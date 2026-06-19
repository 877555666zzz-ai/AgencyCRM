// ============================================================================
// telegram-reminders — рассылка напоминаний в Telegram (ТЗ 3.6)
// Запускается по расписанию (см. supabase/05_cron.sql, каждые 5 минут).
// Берёт из таблицы reminders все НЕотправленные записи, у которых время
// наступило (when_at <= now), находит telegram_id владельца и шлёт сообщение,
// затем помечает sent = true.
//
// Деплой:   supabase functions deploy telegram-reminders --no-verify-jwt
// Секрет:   supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC...
// (SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY подставляются автоматически)
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function sendTelegram(chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return r.ok;
}

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  // Напоминания, у которых наступило время и которые ещё не отправлены
  const { data: due, error } = await db
    .from("reminders")
    .select("id, type, title, target, when_at, owner, kind")
    .eq("sent", false)
    .lte("when_at", nowIso)
    .limit(200);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!due || due.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  // Соберём telegram_id владельцев одним запросом
  const owners = [...new Set(due.map((r) => r.owner).filter(Boolean))];
  const { data: profs } = await db
    .from("profiles")
    .select("id, telegram_id, name")
    .in("id", owners);
  const tgById = new Map((profs || []).map((p) => [p.id, p.telegram_id]));

  const emoji: Record<string, string> = { task: "✅", razbor: "🤝", interview: "🎙" };
  const sentIds: string[] = [];

  for (const r of due) {
    const chat = tgById.get(r.owner);
    if (!chat) continue; // у пользователя не привязан Telegram — пропускаем
    const when = r.kind === "1d" ? "завтра" : "через час";
    const text =
      `${emoji[r.type] || "🔔"} <b>Напоминание</b>\n` +
      `${r.title}\n` +
      (r.target ? `${r.target}\n` : "") +
      `🕒 ${when} (${new Date(r.when_at).toLocaleString("ru-RU")})`;
    const ok = await sendTelegram(chat, text);
    if (ok) sentIds.push(r.id);
  }

  if (sentIds.length) {
    await db.from("reminders").update({ sent: true }).in("id", sentIds);
  }
  return new Response(JSON.stringify({ checked: due.length, sent: sentIds.length }), { status: 200 });
});
