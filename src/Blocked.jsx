import { auth } from "./lib/api";
const FONT = "Inter, system-ui, sans-serif";

const MESSAGES = {
  expired: {
    title: "Подписка истекла",
    text: "Срок действия подписки вашей компании закончился. Чтобы продолжить работу, свяжитесь с вашим менеджером для продления.",
  },
  inactive: {
    title: "Доступ приостановлен",
    text: "Доступ к системе временно приостановлен. Пожалуйста, свяжитесь с вашим менеджером для уточнения деталей.",
  },
  "no-company": {
    title: "Аккаунт не настроен",
    text: "Ваш аккаунт ещё не привязан к компании. Свяжитесь с администратором, чтобы получить доступ.",
  },
};

export default function Blocked({ reason = "expired" }) {
  const m = MESSAGES[reason] || MESSAGES.expired;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, background: "var(--c-bg, #0b0d12)", color: "var(--c-text, #e8eaed)", padding: 24,
    }}>
      <div style={{
        width: 440, borderRadius: 22, padding: "40px 36px", textAlign: "center",
        background: "var(--c-panel, #14171f)", border: "1px solid var(--c-border, #232733)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: "0 auto 22px",
          display: "grid", placeItems: "center",
          background: "color-mix(in srgb, var(--c-red, #ef4444) 14%, transparent)",
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
            stroke="var(--c-red, #ef4444)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 12, letterSpacing: -0.3 }}>{m.title}</div>
        <div style={{ fontSize: 14, color: "var(--c-muted, #9aa0ad)", lineHeight: 1.6, marginBottom: 28 }}>{m.text}</div>

        <button onClick={() => auth.signOut().then(() => window.location.reload())}
          style={{
            width: "100%", padding: "13px", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
            borderRadius: 12, border: "1px solid var(--c-border, #232733)",
            background: "var(--c-surface, #1a1e28)", color: "var(--c-text, #e8eaed)", fontFamily: FONT,
          }}>
          Выйти
        </button>
      </div>
    </div>
  );
}