import { useState, useEffect } from "react";
import { superadmin, auth } from "./lib/api";

/* ============================================================================
   SuperAdmin — панель владельца платформы.
   Видит её только пользователь с role='superadmin'.
   Список компаний, создание, вкл/выкл, подписка, лимиты.
   ============================================================================ */
const FONT = "Inter, system-ui, sans-serif";
const C = {
  bg: "var(--c-bg,#0b0d12)", panel: "var(--c-panel,#14171f)", surface: "var(--c-surface,#1a1e28)",
  border: "var(--c-border,#232733)", text: "var(--c-text,#e8eaed)", muted: "var(--c-muted,#9aa0ad)",
  faint: "var(--c-faint,#6b7280)", blue: "var(--c-blue,#6366f1)", blueDark: "var(--c-blue-dark,#4f46e5)",
  green: "#22c55e", red: "#ef4444", amber: "#f59e0b",
};

const INDUSTRIES = [
  { value: "design", label: "Дизайн-студия" },
  { value: "vibecoding", label: "Вайбкодинг / разработка" },
  { value: "marketing", label: "Маркетинг" },
  { value: "producing", label: "Продюсирование" },
];

export default function SuperAdmin({ onSignOut }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true); setErr("");
    try { setCompanies(await superadmin.listCompanies()); }
    catch (e) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const daysLeft = (date) => {
    if (!date) return null;
    const d = Math.ceil((new Date(date) - new Date()) / 86400000);
    return d;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT, padding: "32px 28px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Панель платформы</div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Управление компаниями и подписками</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Новая компания</button>
            <button onClick={onSignOut} style={btnGhost}>Выйти</button>
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, margin: "24px 0" }}>
          <StatCard label="Всего компаний" value={companies.length} />
          <StatCard label="Активных" value={companies.filter((c) => c.active).length} color={C.green} />
          <StatCard label="Заблокировано" value={companies.filter((c) => !c.active).length} color={C.red} />
        </div>

        {err && <div style={errorBox}>{err}</div>}

        {/* список компаний */}
        {loading ? (
          <div style={{ color: C.faint, padding: 40, textAlign: "center" }}>Загрузка…</div>
        ) : companies.length === 0 ? (
          <div style={{ color: C.faint, padding: 40, textAlign: "center" }}>
            Пока нет компаний. Нажмите «Новая компания», чтобы создать первую.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {companies.map((c) => {
              const dl = daysLeft(c.subscription_until);
              const expired = dl !== null && dl < 0;
              return (
                <div key={c.id} style={card}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</span>
                      <Pill active={c.active} expired={expired} />
                      <span style={{ fontSize: 12, color: C.faint }}>
                        {INDUSTRIES.find((i) => i.value === c.industry)?.label || c.industry}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>👥 {c.userCount} / {c.max_users}</span>
                      <span>
                        Подписка: {c.subscription_until
                          ? new Date(c.subscription_until).toLocaleDateString("ru-RU")
                          : "—"}
                        {dl !== null && (
                          <span style={{ color: expired ? C.red : (dl <= 5 ? C.amber : C.faint), marginLeft: 6 }}>
                            {expired ? `(истекла ${-dl} дн. назад)` : `(${dl} дн.)`}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <CompanyActions company={c} onChange={load} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

// ---------- действия над компанией ----------
function CompanyActions({ company, onChange }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try { await superadmin.toggleActive(company.id, !company.active); await onChange(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };
  const extend = async () => {
    const d = prompt("Продлить подписку до (ГГГГ-ММ-ДД):", company.subscription_until || "");
    if (!d) return;
    setBusy(true);
    try { await superadmin.setSubscription(company.id, d); await onChange(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };
  const del = async () => {
    if (!confirm(`Удалить «${company.name}» со всеми данными? Это необратимо.`)) return;
    setBusy(true);
    try { await superadmin.deleteCompany(company.id); await onChange(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={toggle} disabled={busy} style={company.active ? btnWarn : btnGreen}>
        {company.active ? "Выключить" : "Включить"}
      </button>
      <button onClick={extend} disabled={busy} style={btnGhost}>Подписка</button>
      <button onClick={del} disabled={busy} style={btnDanger}>Удалить</button>
    </div>
  );
}

// ---------- модалка создания компании ----------
function CreateModal({ onClose, onCreated }) {
  const [f, setF] = useState({
    companyName: "", industry: "design",
    subscriptionDays: 30,
    adminName: "", adminEmail: "", adminPassword: "",
    maxUsers: 10,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const create = async () => {
    setErr(""); setBusy(true);
    try {
      const until = new Date();
      until.setDate(until.getDate() + Number(f.subscriptionDays || 30));
      await superadmin.createCompany({
        companyName: f.companyName,
        industry: f.industry,
        subscriptionUntil: until.toISOString().slice(0, 10),
        maxUsers: Number(f.maxUsers) || 10,
        adminName: f.adminName,
        adminEmail: f.adminEmail,
        adminPassword: f.adminPassword,
      });
      onCreated();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>Новая компания</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
          Создаём компанию и её руководителя. Он сразу сможет войти.
        </div>

        <Field label="Название компании">
          <input style={input} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Студия Пиксель" />
        </Field>
        <Field label="Тип деятельности">
          <select style={input} value={f.industry} onChange={(e) => set("industry", e.target.value)}>
            {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Подписка (дней)">
            <input style={input} type="number" value={f.subscriptionDays} onChange={(e) => set("subscriptionDays", e.target.value)} />
          </Field>
          <Field label="Лимит сотрудников">
            <input style={input} type="number" value={f.maxUsers} onChange={(e) => set("maxUsers", e.target.value)} />
          </Field>
        </div>

        <div style={{ height: 1, background: C.border, margin: "16px 0" }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 12 }}>Руководитель компании</div>

        <Field label="Имя">
          <input style={input} value={f.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="Имя Фамилия" />
        </Field>
        <Field label="Email (логин)">
          <input style={input} type="email" value={f.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} placeholder="boss@studio.kz" />
        </Field>
        <Field label="Пароль">
          <input style={input} value={f.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} placeholder="мин. 6 символов" />
        </Field>

        {err && <div style={errorBox}>{err}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>Отмена</button>
          <button onClick={create} disabled={busy} style={btnPrimary}>
            {busy ? "Создаём…" : "Создать компанию"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- мелкие компоненты ----------
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.border, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || C.text }}>{value}</div>
    </div>
  );
}
function Pill({ active, expired }) {
  const color = expired ? C.red : (active ? C.green : C.faint);
  const text = expired ? "Подписка истекла" : (active ? "Активна" : "Выключена");
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
      padding: "3px 9px", borderRadius: 7 }}>{text}</span>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

// ---------- стили ----------
const input = { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid " + C.border,
  background: C.surface, color: C.text, fontSize: 14, fontFamily: FONT, boxSizing: "border-box" };
const btnBase = { padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT, border: "none" };
const btnPrimary = { ...btnBase, background: C.blue, color: "#fff" };
const btnGhost = { ...btnBase, background: C.surface, color: C.text, border: "1px solid " + C.border };
const btnGreen = { ...btnBase, background: C.green, color: "#fff" };
const btnWarn = { ...btnBase, background: C.amber, color: "#fff" };
const btnDanger = { ...btnBase, background: "transparent", color: C.red, border: "1px solid " + C.red };
const card = { display: "flex", alignItems: "center", gap: 16, background: C.panel, border: "1px solid " + C.border,
  borderRadius: 14, padding: "16px 18px" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 100, padding: 20 };
const modal = { width: 460, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: "1px solid " + C.border,
  borderRadius: 18, padding: "26px 26px", fontFamily: FONT, color: C.text };
const errorBox = { color: C.red, fontSize: 13, background: `color-mix(in srgb, ${C.red} 12%, transparent)`,
  border: `1px solid color-mix(in srgb, ${C.red} 35%, transparent)`, borderRadius: 9, padding: "9px 12px", margin: "12px 0" };