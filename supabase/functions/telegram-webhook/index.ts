// ============================================================================
// telegram-webhook — помогает привязать сотрудника к Telegram.
// Когда пользователь пишет боту /start, бот отвечает его chat_id, который
// админ вставляет в карточку пользователя (поле telegram_id) в CRM.
//
// Деплой:    supabase functions deploy telegram-webhook --no-verify-jwt
// Привязка:  curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook"
// ============================================================================
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

async function reply(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    const msg = update.message;
    if (msg && typeof msg.text === "string") {
      const chatId = msg.chat.id;
      if (msg.text.startsWith("/start") || msg.text.startsWith("/id")) {
        await reply(
          chatId,
          `👋 Это бот напоминаний <b>InsightLab CRM</b>.\n\n` +
            `Ваш Telegram ID: <code>${chatId}</code>\n\n` +
            `Передайте его администратору — он впишет ID в вашу карточку, ` +
            `и вы начнёте получать напоминания о разборах и интервью.`,
        );
      }
    }
  } catch (_e) { /* игнорируем некорректные апдейты */ }
  return new Response("ok", { status: 200 });
});
