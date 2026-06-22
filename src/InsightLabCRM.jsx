import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { loadDb, persistDb, resetDb, auth, integrations, loadContext } from "./lib/api";
import Login from "./Login";
import Blocked from "./Blocked";
import SuperAdmin from "./SuperAdmin";
import { motion, AnimatePresence } from "framer-motion";
import NocturneBackground from "./components/NocturneBackground";
import { ThemeProvider, ThemeToggle, useTheme } from "./components/theme";
import BrandMark from "./components/Logo";
import {
  BarChart3, Mic, Calendar as CalIcon, TrendingUp, Users as UsersIcon, Settings as SettingsIcon, LayoutDashboard,
  CalendarDays, Bell as BellIcon, Trash2,
  Coffee, FolderOpen, CheckCircle2, FileText, Lightbulb, Clock, Flame,
  Copy, Send, Mail, MessageCircle, Linkedin, Check, Instagram, Globe, Phone, ArrowUpRight,
} from "lucide-react";
import "./nocturne.css";

// премиум-иконки навбара (вместо эмодзи), цвет наследуется от кнопки (активная = синяя)
const NAV_ICONS = {
  sales: <BarChart3 size={17} strokeWidth={2} />,
  recruit: <Mic size={17} strokeWidth={2} />,
  calendar: <CalIcon size={17} strokeWidth={2} />,
  analytics: <TrendingUp size={17} strokeWidth={2} />,
  users: <UsersIcon size={17} strokeWidth={2} />,
  settings: <SettingsIcon size={17} strokeWidth={2} />,
  workspace: <LayoutDashboard size={17} strokeWidth={2} />,
};

// ============================================================================
// SECTION: core
// ============================================================================
// ============================================================================
// InsightLab CRM — ядро (дизайн-система, данные, утилиты, примитивы)
// ============================================================================

// ---------- Дизайн-система (3.9) ----------
// Дизайн-токены теперь ссылаются на CSS-переменные (см. nocturne.css).
// Переключение [data-theme="dark"|"light"] мгновенно перекрашивает весь интерфейс.
const C = {
  bg: "var(--c-bg)",
  text: "var(--c-text)",
  blue: "var(--c-blue)",
  blueDark: "var(--c-blue-dark)",
  blueLight: "var(--c-blue-light)",
  border: "var(--c-border)",
  borderStrong: "var(--c-border-strong)",
  muted: "var(--c-muted)",
  faint: "var(--c-faint)",
  surface: "var(--c-surface)",
  panel: "var(--c-panel)",
  green: "var(--c-green)",
  red: "var(--c-red)",
  amber: "var(--c-amber)",
  shadow: "var(--c-shadow)",
  shadowMd: "var(--c-shadow-md)",
  shadowLg: "var(--c-shadow-lg)",
  overlay: "var(--c-overlay)",
  hintBg: "var(--c-hint-bg)",
  hintBd: "var(--c-hint-bd)",
  hintTx: "var(--c-hint-tx)",
  glass: "var(--c-glass)",
  glassBorder: "var(--c-glass-border)",
  blueSoft: "var(--c-blue-soft)",
  glow: "var(--c-glow)",
  sheen: "var(--c-card-sheen)",
  rCard: "var(--r-card)",
  rTile: "var(--r-tile)",
  rCtl: "var(--r-ctl)",
  rPill: "var(--r-pill)",
  indigo: "var(--c-indigo)",
  pill: "var(--c-pill-bg)",
  pillInk: "var(--c-pill-ink)",
};

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ---------- Справочники ----------
const ROLES = {
  admin: "Админ",
  sales: "Менеджер по продажам",
  interviewer: "Интервьюер",
};

const SALES_STAGES = [
  { id: "new", title: "Новый" },
  { id: "in_work", title: "В работе" },
  { id: "demo_set", title: "Разбор-пари назначен" },
  { id: "demo_done", title: "Разбор проведён" },
  { id: "kp_sent", title: "КП отправлено" },
  { id: "negotiation", title: "Переговоры" },
  { id: "won", title: "Выиграно" },
  { id: "lost", title: "Проиграно" },
];

const RECRUIT_STAGES = [
  { id: "loaded", title: "Загружен" },
  { id: "screening", title: "На скрининге" },
  { id: "qualified", title: "Квалифицирован" },
  { id: "slot", title: "Слот забронирован" },
  { id: "done", title: "Интервью проведено" },
  { id: "insight", title: "Инсайт зафиксирован" },
];

const RECRUIT_SIDE = [
  { id: "no_answer", title: "Не дозвонились" },
  { id: "refused", title: "Отказ" },
  { id: "no_show", title: "Неявка" },
];

const SOURCES = ["LinkedIn", "Робот", "Таргет", "Реферал"];
const PACKAGES = ["Экспресс", "Полное", "Месячное"];
const RESP_MODES = { A: "Режим A — база клиента", B: "Режим B — собираем сами" };
const REWARD_TYPES = ["Нет", "Купон такси", "Другое"];

const PACKAGE_PRICE = { "Экспресс": 350000, "Полное": 900000, "Месячное": 1800000 };

// ---------- Утилиты ----------
const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const fmtMoney = (n) =>
  (n || 0).toLocaleString("ru-RU") + " ₸";
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
};
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};
const normPhone = (p) => (p || "").replace(/[^\d+]/g, "").replace(/^8/, "+7");
const daysBetween = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000);

// ---------- Парсер скрипта (3.5а) ----------
// Правила разметки:
//   # Заголовок            -> новый блок/слайд
//   1. / - / *  вопрос      -> вопрос блока
//   > подсказка             -> подсказка ведущему
function detectBlockType(title) {
  const t = (title || "").toLowerCase();
  if (/критери|оцен|скрининг|квалиф/.test(t)) return "criteria";
  if (/вступл|введен|инструкц|правил|приветств|знаком/.test(t)) return "instruction";
  return "questions";
}

function parseScript(raw) {
  const lines = (raw || "").split(/\r?\n/);
  const blocks = [];
  let current = null;
  const pushCurrent = () => { if (current) blocks.push(current); };

  for (let line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      pushCurrent();
      const title = t.replace(/^#+\s*/, "").trim();
      current = {
        id: uid("blk"),
        order: blocks.length,
        type: detectBlockType(title),
        title: title || "Без названия",
        hint: "",
        questions: [],
      };
    } else if (t.startsWith(">")) {
      const hint = t.replace(/^>\s*/, "").trim();
      if (!current) {
        current = { id: uid("blk"), order: 0, type: "instruction", title: "Подсказки", hint, questions: [] };
      } else {
        current.hint = current.hint ? current.hint + "\n" + hint : hint;
      }
    } else {
      const q = t.replace(/^(\d+[\.\)]|[-*•])\s*/, "").trim();
      if (!current) {
        current = { id: uid("blk"), order: 0, type: "questions", title: "Вопросы", hint: "", questions: [] };
      }
      if (q) current.questions.push(q);
    }
  }
  pushCurrent();
  return blocks.map((b, i) => ({ ...b, order: i }));
}

const BLOCK_TYPE_LABEL = {
  questions: "Вопросы",
  instruction: "Инструкция",
  criteria: "Критерии",
};

// ---------- Хранилище: данные из Supabase (RLS на сервере) ----------
// Сохраняем снимок последнего загруженного/записанного состояния, чтобы
// persistDb писал в БД только реальные изменения (диф).
let __prevDb = null;
const __clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

async function loadState() {
  const db = await loadDb();      // null, если нет активной сессии
  __prevDb = __clone(db);
  return db;
}

async function saveState(state) {
  await persistDb(state, __prevDb);
  __prevDb = __clone(state);
}

async function resetStorage() {
  await resetDb();
}

// ---------- CSV / XLSX (3.7) ----------
function exportRows(rows, columns, filename, format) {
  const data = rows.map((r) => {
    const o = {};
    columns.forEach((c) => { o[c.label] = c.get(r); });
    return o;
  });
  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    XLSX.writeFile(wb, filename + ".xlsx");
  } else {
    const csv = Papa.unparse(data);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }
}

function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
          resolve(rows);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: reject,
      });
    }
  });
}

// ============================================================================
// UI-примитивы
// ============================================================================
function Btn({ children, variant = "primary", size = "md", style, ...p }) {
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 13 },
    md: { padding: "9px 16px", fontSize: 14 },
    lg: { padding: "12px 22px", fontSize: 15 },
  };
  const variants = {
    primary: { background: C.pill, color: C.pillInk, border: "1px solid transparent" },
    ghost: { background: C.surface, color: C.text, border: "1px solid " + C.borderStrong },
    soft: { background: C.blueLight, color: C.blueDark, border: "1px solid " + C.blueLight },
    danger: { background: C.surface, color: C.red, border: "1px solid #F3C2C2" },
    plain: { background: "transparent", color: C.muted, border: "1px solid transparent" },
  };
  return (
    <button
      {...p}
      style={{
        ...sizes[size], ...variants[variant],
        borderRadius: C.rPill, fontWeight: 600, cursor: "pointer",
        fontFamily: FONT, transition: "all .18s cubic-bezier(.22,.61,.36,1)", whiteSpace: "nowrap",
        display: "inline-flex", alignItems: "center", gap: 7,
        ...(variant === "primary" ? { boxShadow: "0 8px 22px -10px rgba(20,20,40,0.45)" } : null), ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; if (variant === "primary" || variant === "ghost") e.currentTarget.style.boxShadow = C.shadowMd; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = variant === "primary" ? "0 8px 22px -10px rgba(20,20,40,0.45)" : "none"; }}
    >
      {children}
    </button>
  );
}

function Badge({ children, color = C.blue, bg = C.blueLight, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11.5, fontWeight: 600, color, background: bg,
      padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", ...style,
    }}>{children}</span>
  );
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 5 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 14,
  border: "1px solid " + C.borderStrong, fontSize: 14, fontFamily: FONT,
  color: C.text, outline: "none", boxSizing: "border-box", background: C.panel,
  transition: "border-color .18s, box-shadow .18s",
};
function Input(props) {
  return <input {...props} style={{ ...inputStyle, ...props.style }}
    onFocus={(e) => { e.target.style.borderColor = C.blue; e.target.style.boxShadow = "0 0 0 4px " + C.blueSoft; }}
    onBlur={(e) => { e.target.style.borderColor = C.borderStrong; e.target.style.boxShadow = "none"; }} />;
}
function Textarea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, ...props.style }}
    onFocus={(e) => { e.target.style.borderColor = C.blue; e.target.style.boxShadow = "0 0 0 4px " + C.blueSoft; }}
    onBlur={(e) => { e.target.style.borderColor = C.borderStrong; e.target.style.boxShadow = "none"; }} />;
}
function Select({ options, ...props }) {
  return (
    <select {...props} style={{ ...inputStyle, cursor: "pointer", ...props.style }}>
      {options.map((o) =>
        typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

function Modal({ open, onClose, title, children, width = 560, footer }) {
  if (!open) return null;
  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: C.overlay,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 1000, padding: "5vh 16px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, backgroundImage: C.sheen, borderRadius: 22, width: "100%", maxWidth: width,
        boxShadow: C.shadowLg, overflow: "hidden", border: "1px solid " + C.border, margin: "auto",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid " + C.border,
        }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", fontSize: 22, cursor: "pointer",
            color: C.faint, lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: 24, maxHeight: "78vh", overflowY: "auto" }}>{children}</div>
        {footer && <div style={{
          padding: "16px 24px", borderTop: "1px solid " + C.border,
          display: "flex", justifyContent: "flex-end", gap: 10, background: C.panel,
        }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

function Panel({ children, style, pad = 20 }) {
  return (
    <div className="glass-card" style={{ padding: pad, ...style }}>{children}</div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <Panel pad={20} style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || C.text, lineHeight: 1, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>{sub}</div>}
    </Panel>
  );
}

function EmptyState({ icon, title, text }) {
  const isNode = icon && typeof icon !== "string";
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: C.faint }}>
      {isNode ? (
        <div style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: 15, display: "grid", placeItems: "center", background: C.panel, border: "1px solid " + C.border, color: C.muted }}>{icon}</div>
      ) : (
        <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      )}
      <div style={{ fontWeight: 700, color: C.muted, marginBottom: 4 }}>{title}</div>
      {text && <div style={{ fontSize: 13 }}>{text}</div>}
    </div>
  );
}

// ============================================================================
// SECTION: seed
// ============================================================================
// ============================================================================
// Seed-данные (реалистичные, чтобы все воронки/слайдер/аналитика работали сразу)
// ============================================================================

const dShift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};
const dShiftDate = (days) => dShift(days).slice(0, 10);

const SCRIPT_TEXT = `# Вступление
> Поприветствуйте, представьтесь, скажите что разговор займёт ~40 минут и записывается с согласия.
- Расскажите коротко про вашу компанию и вашу роль в ней.
- За что вы отвечаете в течение рабочего дня?

# Про текущий процесс
> Если говорят «проблем нет» — переспросить про последний конкретный случай.
1. Как у вас сейчас устроен процесс работы с клиентами?
2. Какими инструментами пользуетесь?
3. Что в этом процессе раздражает больше всего?
4. Опишите последний раз, когда что-то пошло не так.

# Про потребности
1. Если бы у вас была волшебная палочка — что бы вы изменили?
2. Что вы уже пробовали, чтобы это решить?
3. Сколько времени/денег это сейчас стоит?

# Критерии квалификации
> Это слайд для интервьюера — оценка после разговора.
- Принимает ли респондент решения о покупке?
- Есть ли у компании бюджет?
- Актуальна ли проблема прямо сейчас?

# Завершение
> Поблагодарите, расскажите про следующий шаг и вознаграждение.
- Кого ещё посоветуете для интервью?`;

function buildSeed() {
  const users = [
    { id: "u_admin", name: "Айгерим (Админ)", role: "admin", telegram_id: "@aigerim_il", email: "admin@insightlab.kz", active: true },
    { id: "u_sales1", name: "Данияр Сейтказы", role: "sales", telegram_id: "@daniyar_s", email: "daniyar@insightlab.kz", active: true },
    { id: "u_sales2", name: "Мадина Ким", role: "sales", telegram_id: "@madina_k", email: "madina@insightlab.kz", active: true },
    { id: "u_int1", name: "Тимур Абаев", role: "interviewer", telegram_id: "@timur_a", email: "timur@insightlab.kz", active: true },
    { id: "u_int2", name: "Алия Жакупова", role: "interviewer", telegram_id: "@aliya_zh", email: "aliya@insightlab.kz", active: true },
  ];

  const mkActivity = (type, title, when, done, owner) => ({
    id: uid("act"), type, title, when, done, owner,
  });

  const leads = [
    {
      id: uid("lead"), company: "Kaspi Bank", contact: "Ержан Тулегенов", title: "Head of Product",
      phone: "+7 701 222 33 44", email: "erzhan@kaspi.kz", source: "LinkedIn",
      stage: "negotiation", owner: "u_sales1", nextTouch: dShiftDate(1),
      amount: 1800000, notes: "Интересует месячный пакет, 12 интервью.",
      history: [
        mkActivity("call", "Первый звонок — заинтересованы", dShift(-12), true, "u_sales1"),
        mkActivity("demo", "Разбор-пари проведён", dShift(-6), true, "u_sales1"),
        mkActivity("email", "Отправлено КП", dShift(-3), true, "u_sales1"),
      ],
    },
    {
      id: uid("lead"), company: "Chocofamily", contact: "Сауле Нурлан", title: "CMO",
      phone: "+7 705 111 22 33", email: "saule@choco.kz", source: "Реферал",
      stage: "demo_done", owner: "u_sales1", nextTouch: dShiftDate(2),
      amount: 900000, notes: "Нужно понять отток в подписке.",
      history: [
        mkActivity("call", "Скрипт-звонок", dShift(-8), true, "u_sales1"),
        mkActivity("demo", "Разбор-пари — зашло", dShift(-2), true, "u_sales1"),
      ],
    },
    {
      id: uid("lead"), company: "Halyk Bank", contact: "Бекзат Омаров", title: "CX Lead",
      phone: "+7 707 444 55 66", email: "bekzat@halyk.kz", source: "Робот",
      stage: "demo_set", owner: "u_sales2", nextTouch: dShiftDate(0),
      amount: 350000, notes: "Робот пометил «горячий». Разбор завтра.",
      history: [mkActivity("call", "Подтвердили слот разбора", dShift(-1), true, "u_sales2")],
    },
    {
      id: uid("lead"), company: "Arbuz.kz", contact: "Жанна Ли", title: "Founder",
      phone: "+7 700 999 88 77", email: "zhanna@arbuz.kz", source: "Таргет",
      stage: "in_work", owner: "u_sales1", nextTouch: dShiftDate(3),
      amount: 350000, notes: "Греем, попросили кейсы.",
      history: [mkActivity("email", "Отправлены кейсы", dShift(-2), true, "u_sales1")],
    },
    {
      id: uid("lead"), company: "Beeline KZ", contact: "Аскар Дюсенов", title: "Product Owner",
      phone: "+7 708 333 22 11", email: "askar@beeline.kz", source: "LinkedIn",
      stage: "new", owner: "u_sales2", nextTouch: dShiftDate(1),
      amount: 900000, notes: "Входящий из формы.",
      history: [],
    },
    {
      id: uid("lead"), company: "Forte Bank", contact: "Динара Касым", title: "Research Lead",
      phone: "+7 701 555 66 77", email: "dinara@forte.kz", source: "Реферал",
      stage: "kp_sent", owner: "u_sales1", nextTouch: dShiftDate(2),
      amount: 900000, notes: "Сравнивают с конкурентом.",
      history: [mkActivity("email", "КП v2 отправлено", dShift(-1), true, "u_sales1")],
    },
    {
      id: uid("lead"), company: "Magnum", contact: "Руслан Ахметов", title: "Head of Insights",
      phone: "+7 705 777 88 99", email: "ruslan@magnum.kz", source: "Таргет",
      stage: "lost", owner: "u_sales2", nextTouch: null,
      amount: 350000, notes: "Ушли к ин-хаус команде.",
      history: [mkActivity("call", "Отказ — делают сами", dShift(-5), true, "u_sales2")],
    },
  ];

  const scriptBlocks = parseScript(SCRIPT_TEXT);

  const projects = [
    {
      id: "proj_1", client: "Технодом", pkg: "Полное", price: PACKAGE_PRICE_LOCAL["Полное"],
      start: dShiftDate(-10), deadline: dShiftDate(8), interviewers: ["u_int1", "u_int2"],
      mode: "B", status: "active", planInterviews: 12,
      script: { id: "scr_1", name: "Гайд: онлайн-покупки бытовой техники", blocks: scriptBlocks },
    },
    {
      id: "proj_2", client: "Kolesa Group", pkg: "Экспресс", price: PACKAGE_PRICE_LOCAL["Экспресс"],
      start: dShiftDate(-4), deadline: dShiftDate(4), interviewers: ["u_int1"],
      mode: "A", status: "active", planInterviews: 5,
      script: { id: "scr_2", name: "Экспресс-гайд: продавцы авто", blocks: parseScript(SCRIPT_TEXT) },
    },
    {
      id: "proj_3", client: "Jusan Bank", pkg: "Месячное", price: PACKAGE_PRICE_LOCAL["Месячное"],
      start: dShiftDate(-2), deadline: dShiftDate(26), interviewers: ["u_int2"],
      mode: "B", status: "active", planInterviews: 20,
      script: { id: "scr_3", name: "Гайд: цифровой банкинг МСБ", blocks: [] },
    },
  ];

  const rNames = ["Айдос Б.", "Гульнара С.", "Ержан К.", "Мадина Т.", "Нурлан А.", "Сабина Ж.", "Олег П.", "Камила Р.", "Дамир Е.", "Асель М.", "Виктор Н.", "Динара О."];
  const respondents = [];
  const notes = {};
  rNames.forEach((nm, i) => {
    const proj = i < 7 ? "proj_1" : i < 10 ? "proj_2" : "proj_3";
    const owner = proj === "proj_3" ? "u_int2" : (i % 2 ? "u_int2" : "u_int1");
    let stage = "loaded";
    const r = Math.random();
    if (i < 3) stage = "done";
    else if (i < 5) stage = "insight";
    else if (i < 7) stage = "slot";
    else if (i < 9) stage = "qualified";
    else if (i < 10) stage = "screening";
    const id = uid("resp");
    const done = stage === "done" || stage === "insight";
    respondents.push({
      id, name: nm, phone: "+7 70" + (i % 8) + " " + (100 + i) + " " + (10 + i) + " " + (20 + i),
      project: proj, screenStatus: i < 9 ? "Пройден" : "В процессе",
      qualified: i < 9, slot: i < 9 ? dShift(i - 2) : null,
      interviewStatus: done ? "Проведено" : (stage === "slot" ? "Забронировано" : "—"),
      reward: i % 3 === 0 ? "Купон такси" : "Нет",
      insight: stage === "insight",
      keyInsight: stage === "insight" ? "Цена решает только после доверия к доставке — сначала смотрят отзывы и сроки." : "",
      recording: done ? "https://drive.example/rec/" + id : "",
      stage, owner, notes: "",
    });
    if (done) {
      notes[id] = {};
      scriptBlocks.forEach((b) => {
        if (b.type === "questions") notes[id][b.id] = "Ответы респондента по блоку «" + b.title + "» (демо-заметка).";
      });
    }
  });

  const tasks = [
    { id: uid("task"), type: "task", title: "Перезвонить Kaspi по КП", when: dShift(0), done: false, owner: "u_sales1", refType: "lead" },
    { id: uid("task"), type: "demo", title: "Разбор-пари: Halyk Bank", when: dShift(0), done: false, owner: "u_sales2", refType: "lead" },
    { id: uid("task"), type: "interview", title: "Интервью: " + respondents[5].name + " (Технодом)", when: dShift(0), done: false, owner: respondents[5].owner, refType: "respondent", refId: respondents[5].id },
    { id: uid("task"), type: "interview", title: "Интервью: " + respondents[6].name + " (Технодом)", when: dShift(1), done: false, owner: respondents[6].owner, refType: "respondent", refId: respondents[6].id },
    { id: uid("task"), type: "task", title: "Импортировать результаты робота (Jusan)", when: dShift(1), done: false, owner: "u_int2", refType: "project" },
    { id: uid("task"), type: "interview", title: "Интервью: " + respondents[8].name + " (Kolesa)", when: dShift(2), done: false, owner: respondents[8].owner, refType: "respondent", refId: respondents[8].id },
  ];

  const reminders = [
    { id: uid("rem"), to: "@timur_a", text: "Завтра в 11:00 интервью с " + respondents[6].name + " (проект Технодом).", when: dShift(1), sent: false, kind: "interview_1d" },
    { id: uid("rem"), to: "@daniyar_s", text: "Сегодня разбор-пари не запланирован, но есть задача: перезвонить Kaspi.", when: dShift(0), sent: true, kind: "task" },
    { id: uid("rem"), to: "@madina_k", text: "Через 1 час: разбор-пари с Halyk Bank.", when: dShift(0), sent: false, kind: "demo_1h" },
  ];

  return { users, leads, projects, respondents, notes, tasks, reminders };
}

// локальная таблица цен (дублируется, чтобы seed был самодостаточным)
const PACKAGE_PRICE_LOCAL = { "Экспресс": 350000, "Полное": 900000, "Месячное": 1800000 };

// ============================================================================
// SECTION: compA
// ============================================================================
// ============================================================================
// Компоненты A: Header, Nav, Kanban, карточки Lead/Respondent, конвертация
// ============================================================================

// ---------- Логотип ----------
function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.text }}>
      <BrandMark height={22} />
      <span style={{
        fontSize: 9.5, color: C.faint, fontWeight: 700, letterSpacing: 1.6,
        textTransform: "uppercase", padding: "2px 7px", borderRadius: 6,
        background: C.panel, border: "1px solid " + C.border,
      }}>CRM</span>
    </div>
  );
}

// ---------- Header с переключателем роли (демонстрация 3 интерфейсов) ----------
function Header({ user, users, onSwitchUser, nav, current, onNav, query, setQuery, notifications = [], onSignOut }) {
  const initials = (user.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const [userMenu, setUserMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  return (
    <header style={{
      background: C.glass, backdropFilter: "blur(18px) saturate(140%)", WebkitBackdropFilter: "blur(18px) saturate(140%)",
      borderBottom: "1px solid " + C.glassBorder,
      padding: "0 24px", display: "flex", alignItems: "center",
      gap: 18, height: 64, position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ color: C.text, flexShrink: 0 }}><Logo height={22} /></div>
      <nav style={{ display: "flex", gap: 3, overflowX: "auto" }}>
        {nav.map((n) => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            border: "none", background: current === n.id ? C.blueLight : "transparent",
            color: current === n.id ? C.blueDark : C.muted, fontWeight: 600, fontSize: 13.5,
            padding: "9px 14px", borderRadius: 999, cursor: "pointer", fontFamily: FONT,
            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, transition: "all .18s",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center" }}>{NAV_ICONS[n.id] || n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      {current === "sales" && setQuery && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 999,
          background: C.surface, border: "1px solid " + C.border, minWidth: 210, maxWidth: 260,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по лидам…"
            style={{ border: "none", outline: "none", background: "transparent", fontFamily: FONT, fontSize: 13, color: C.text, width: "100%" }} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ThemeToggle />
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button title="Уведомления" onClick={() => { setNotifOpen((v) => !v); setUserMenu(false); }} style={{
            width: 40, height: 40, borderRadius: "50%", border: "1px solid " + C.borderStrong, background: C.surface,
            color: C.muted, cursor: "pointer", display: "inline-grid", placeItems: "center", position: "relative",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            {notifications.length > 0 && (
              <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: C.red, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 0 0 2px " + C.glass }}>{notifications.length}</span>
            )}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
              <div style={{ position: "absolute", top: 48, right: 0, zIndex: 61, width: 320, maxHeight: 420, overflowY: "auto",
                background: C.surface, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadowLg }}>
                <div style={{ padding: "13px 15px 9px", fontSize: 13.5, fontWeight: 700, color: C.text, borderBottom: "1px solid " + C.border, position: "sticky", top: 0, background: C.surface }}>
                  Уведомления{notifications.length > 0 ? " · " + notifications.length : ""}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: "28px 16px", textAlign: "center", color: C.faint, fontSize: 13 }}>Новых уведомлений нет</div>
                ) : notifications.map((n) => {
                  const col = n.kind === "lead" ? C.green : n.kind === "demo" ? C.indigo : n.kind === "interview" ? C.blue : n.kind === "call" ? C.green : C.amber;
                  return (
                    <button key={n.id} onClick={() => { onNav(n.page); setNotifOpen(false); }}
                      style={{ display: "flex", alignItems: "flex-start", gap: 11, width: "100%", textAlign: "left",
                        padding: "11px 15px", border: "none", borderBottom: "1px solid " + C.border, cursor: "pointer", background: "transparent", fontFamily: FONT }}>
                      <span style={{ width: 9, height: 9, borderRadius: 9, background: col, marginTop: 4, flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.muted }}>{n.title}</span>
                        <span style={{ display: "block", fontSize: 13.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {/* аватар → меню смены пользователя */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setUserMenu((v) => !v)} title={user.name + " · " + ROLES[user.role]}
            style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center",
              fontSize: 13.5, fontWeight: 700, color: "#fff", letterSpacing: 0.3, border: "none", cursor: "pointer", padding: 0,
              background: "linear-gradient(140deg,#5B5BFF,#7A7AFF)",
              boxShadow: "0 4px 12px -3px rgba(45,45,90,0.45), inset 0 1px 0 rgba(255,255,255,0.35)" }}>{initials}</button>
          {userMenu && (
            <>
              <div onClick={() => setUserMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
              <div style={{ position: "absolute", top: 48, right: 0, zIndex: 61, minWidth: 240,
                background: C.surface, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadowLg, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.faint }}>Сменить пользователя</div>
                {users.filter((u) => u.active).map((u) => (
                  <button key={u.id} onClick={() => { onSwitchUser(u.id); setUserMenu(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      padding: "10px 14px", border: "none", cursor: "pointer", fontFamily: FONT,
                      background: u.id === user.id ? C.blueSoft : "transparent" }}>
                    <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 700, color: "#fff", background: "linear-gradient(140deg,#5B5BFF,#7A7AFF)" }}>
                      {(u.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{ROLES[u.role]}{u.id === user.id ? " · текущий" : ""}</span>
                    </span>
                  </button>
                ))}
                {onSignOut && (
                  <button onClick={() => { setUserMenu(false); onSignOut(); }}
                    style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                      padding: "11px 14px", border: "none", borderTop: "1px solid " + C.border, cursor: "pointer", fontFamily: FONT,
                      background: "transparent", color: C.red, fontWeight: 600, fontSize: 13.5 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Выйти из аккаунта
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------- Канбан (drag-and-drop) ----------
function KanbanCard({ children, onDragStart, onClick, accent }) {
  const ac = accent || C.blue;
  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={(e) => { document.body.classList.add("dragging"); onDragStart && onDragStart(e); }}
      onDragEnd={() => document.body.classList.remove("dragging")}
      onClick={onClick}
      style={{
        background: "var(--g-card)",
        backdropFilter: "blur(var(--g-blur)) saturate(140%)", WebkitBackdropFilter: "blur(var(--g-blur)) saturate(140%)",
        boxShadow: "inset 3px 0 0 " + ac + ", var(--g-shadow)",
        borderRadius: 16, padding: 14, marginBottom: 12, cursor: "grab",
        transition: "transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s, border-color .2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "inset 3px 0 0 " + ac + ", var(--g-shadow-hi)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "inset 3px 0 0 " + ac + ", var(--g-shadow)"; e.currentTarget.style.transform = "none"; }}
    >{children}</div>
  );
}

function KanbanScroller({ children }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const dir = useRef(0);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);
  const refresh = () => {
    const el = ref.current; if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    refresh();
    const onUp = () => { dir.current = 0; };
    window.addEventListener("dragend", onUp);
    window.addEventListener("drop", onUp);
    return () => { window.removeEventListener("dragend", onUp); window.removeEventListener("drop", onUp); if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);
  const loop = () => {
    const el = ref.current;
    if (el && dir.current) { el.scrollLeft += dir.current * 30; refresh(); raf.current = requestAnimationFrame(loop); }
    else { raf.current = null; }
  };
  const onDragOver = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, edge = 110;
    dir.current = x < edge ? -1 : x > r.width - edge ? 1 : 0;
    if (dir.current && !raf.current) raf.current = requestAnimationFrame(loop);
  };
  const arrow = (d) => () => { ref.current?.scrollBy({ left: d * 320, behavior: "smooth" }); setTimeout(refresh, 350); };
  const arrowBtn = (d, show) => (
    <button onClick={arrow(d)} disabled={!show} aria-label={d < 0 ? "Прокрутить влево" : "Прокрутить вправо"} style={{
      flexShrink: 0, width: 34, height: 34, alignSelf: "center", borderRadius: 999,
      border: "1px solid " + C.borderStrong, background: C.surface, color: show ? C.text : C.faint,
      cursor: show ? "pointer" : "default", opacity: show ? 1 : 0.35, fontSize: 17, lineHeight: 1,
      boxShadow: C.shadow, transition: "opacity .15s",
    }}>{d < 0 ? "‹" : "›"}</button>
  );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {arrowBtn(-1, canL)}
      <div ref={ref} onDragOver={onDragOver} onScroll={refresh}
        style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, flex: 1, scrollBehavior: "smooth" }}>
        {children}
      </div>
      {arrowBtn(1, canR)}
    </div>
  );
}

function KanbanBoard({ stages, items, getStage, renderCard, onMove, sideStages, dotColor, onAddToStage, onDelete }) {
  const [over, setOver] = useState(null);
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [moveTo, setMoveTo] = useState("");
  const colItems = (sid) => items.filter((it) => getStage(it) === sid);
  const allStages = [...stages, ...(sideStages || [])];
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSel(new Set(items.map((it) => it.id)));
  const selectStage = (sid) => setSel((s) => { const n = new Set(s); colItems(sid).forEach((it) => n.add(it.id)); return n; });
  const clearSel = () => { setSel(new Set()); setMoveTo(""); };
  const exitSel = () => { setSelMode(false); clearSel(); };
  const bulkMove = (sid) => { if (!sid) return; sel.forEach((id) => onMove(id, sid)); clearSel(); };
  const bulkDelete = () => { if (!sel.size) return; if (!confirm("Удалить выбранные карточки (" + sel.size + ")? Действие необратимо.")) return; onDelete && onDelete([...sel]); clearSel(); };
  const onDrop = (sid) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    if (id) onMove(id, sid);
    setOver(null);
  };
  const Column = (st, isSide) => {
    const dc = dotColor ? dotColor(st.id) : (isSide ? C.amber : C.blue);
    return (
    <div key={st.id}
      onDragOver={(e) => { e.preventDefault(); setOver(st.id); }}
      onDragLeave={() => setOver((o) => (o === st.id ? null : o))}
      onDrop={onDrop(st.id)}
      style={{ minWidth: 268, width: 268, flexShrink: 0, opacity: isSide ? 0.96 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 6px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, background: dc, flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{st.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {selMode && colItems(st.id).length > 0 && (
            <button onClick={() => selectStage(st.id)} title={"Выбрать все в «" + st.title + "»"}
              style={{ fontSize: 11, fontWeight: 700, color: C.blueDark, background: C.blueLight, border: "none",
                borderRadius: 7, padding: "3px 9px", cursor: "pointer", fontFamily: FONT }}>
              Выбрать
            </button>
          )}
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, background: "var(--g-col)", borderRadius: 999, padding: "2px 10px", border: "1px solid var(--g-col-border)" }}>
            {colItems(st.id).length}
          </span>
        </div>
      </div>
      <div style={{
        minHeight: 46, borderRadius: C.rTile, padding: over === st.id ? 8 : 0,
        background: over === st.id ? "var(--g-col-over)" : "transparent",
        transition: "background .15s, padding .15s",
      }}>
        {colItems(st.id).map((it) => {
          const card = renderCard(it, (e) => e.dataTransfer.setData("id", it.id));
          if (!selMode) return card;
          const isSel = sel.has(it.id);
          return (
            <div key={it.id} style={{ position: "relative" }}>
              {card}
              <div onClick={(e) => { e.stopPropagation(); toggle(it.id); }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 12, borderRadius: 16, cursor: "pointer", zIndex: 5,
                  background: isSel ? "color-mix(in srgb, " + C.blue + " 14%, transparent)" : "transparent",
                  border: "2px solid " + (isSel ? C.blue : "transparent") }}>
                <span style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 6,
                  border: "2px solid " + (isSel ? C.blue : C.borderStrong), background: isSel ? C.blue : C.surface,
                  color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 }}>{isSel ? "✓" : ""}</span>
              </div>
            </div>
          );
        })}
        {onAddToStage && !selMode && (
          <button onClick={() => onAddToStage(st.id)} className="add-plate" style={{ marginTop: 2 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Добавить
          </button>
        )}
      </div>
    </div>
    );
  };
  return (
    <div>
      {onDelete && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap", padding: "0 6px", marginLeft: 8 }}>
          {!selMode ? (
            <Btn variant="ghost" size="sm" onClick={() => setSelMode(true)}>Выбрать</Btn>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Выбрано: {sel.size}</span>
              <Btn variant="ghost" size="sm" onClick={selectAll}>Выбрать все</Btn>
              <Btn variant="ghost" size="sm" onClick={clearSel}>Снять</Btn>
              <Select value={moveTo} onChange={(e) => bulkMove(e.target.value)}
                options={[{ value: "", label: "Перенести в…" }, ...allStages.map((s) => ({ value: s.id, label: s.title }))]}
                style={{ width: 190 }} disabled={!sel.size} />
              <Btn variant="danger" size="sm" onClick={bulkDelete} disabled={!sel.size}>Удалить ({sel.size})</Btn>
              <Btn variant="plain" size="sm" onClick={exitSel}>Выход</Btn>
            </>
          )}
        </div>
      )}
      <KanbanScroller>{stages.map((s) => Column(s, false))}</KanbanScroller>
      {sideStages && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Боковые статусы</div>
          <KanbanScroller>{sideStages.map((s) => Column(s, true))}</KanbanScroller>
        </div>
      )}
    </div>
  );
}

// ---------- Сообщение клиенту + кнопки отправки (3.3) ----------
function MessageComposer({ lead, value, disabled, onChange }) {
  const [copied, setCopied] = useState(false);
  const MAX = 300;
  const msg = value || "";
  const text = msg.trim();

  // нормализация телефона для wa.me (только цифры)
  const phoneDigits = (lead.phone || "").replace(/[^\d]/g, "");
  const tg = (lead.telegram || "").replace(/^@/, "").trim();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
    } catch (_) {
      // запасной способ, если clipboard API недоступен
      const ta = document.createElement("textarea");
      ta.value = msg; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const openWith = async (url) => {
    // копируем текст в буфер, затем открываем канал (для TG/LinkedIn вставишь вручную)
    if (text) { try { await navigator.clipboard.writeText(msg); } catch (_) {} }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const enc = encodeURIComponent(msg);

  // каналы, куда можно подставить ТЕКСТ сообщения (WhatsApp, Почта)
  const waUrl = phoneDigits ? `https://wa.me/${phoneDigits}${text ? `?text=${enc}` : ""}` : null;
  const mailUrl = lead.email ? `mailto:${lead.email}${text ? `?body=${enc}` : ""}` : null;

  const btn = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px",
    borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
    border: "1px solid " + (active ? C.border : C.border),
    background: active ? C.surface : C.panel,
    color: active ? C.text : C.faint,
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.5,
  });

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>Сообщение</span>
        <span style={{ fontSize: 11.5, color: msg.length > MAX ? C.red : C.faint }}>{msg.length} / {MAX}</span>
      </div>
      <Textarea
        rows={4}
        value={msg}
        maxLength={MAX}
        disabled={disabled}
        placeholder="Персональное сообщение клиенту…"
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={copy} disabled={!text}
          style={{ ...btn(!!text), background: copied ? C.blueLight : (text ? C.surface : C.panel), color: copied ? C.blueDark : (text ? C.text : C.faint), borderColor: copied ? C.blue : C.border }}>
          {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}
          {copied ? "Скопировано" : "Скопировать"}
        </button>

        <button type="button" onClick={() => waUrl && openWith(waUrl)} disabled={!waUrl}
          title={waUrl ? "Открыть WhatsApp (текст подставится)" : "Нет телефона"} style={btn(!!waUrl)}>
          <MessageCircle size={14} strokeWidth={1.8} /> WhatsApp
        </button>

        <button type="button" onClick={() => mailUrl && openWith(mailUrl)} disabled={!mailUrl}
          title={mailUrl ? "Открыть письмо (текст подставится)" : "Нет email"} style={btn(!!mailUrl)}>
          <Mail size={14} strokeWidth={1.8} /> Почта
        </button>
      </div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 7, lineHeight: 1.4 }}>
        «Скопировать» — текст в буфер. WhatsApp и Почта подставят текст сами. Остальные каналы — в блоке выше.
      </div>
    </div>
  );
}

// ---------- Строка канала связи (премиум-дизайн) ----------
function ChannelRow({ iconBg, icon, label, value, sub, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: C.surface, borderRadius: 16, marginBottom: 10, border: "1px solid " + C.border, boxShadow: "0 1px 3px rgba(16,24,40,0.04)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 13, background: iconBg || C.panel, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, color: C.text, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

// крупная кнопка-действие канала (с опциональной стрелкой ↗)
function ChActionBtn({ onClick, color, light, arrow, children }) {
  const filled = !!color;
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 12,
      border: filled ? "none" : "1px solid " + C.borderStrong,
      background: filled ? color : C.surface,
      color: filled ? "#fff" : C.text, cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FONT, whiteSpace: "nowrap",
      boxShadow: filled ? "0 1px 2px rgba(16,24,40,0.18)" : "none",
    }}>{children}{arrow && <ArrowUpRight size={15} strokeWidth={2.2} />}</button>
  );
}

// поле только для чтения с кнопкой «копировать» (для БИН и т.п.)
function CopyField({ label, value }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value || ""); } catch (_) {}
    setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <Field label={label}>
      <div style={{ position: "relative" }}>
        <Input value={value || ""} disabled style={{ paddingRight: 40 }} />
        {value && (
          <button type="button" onClick={copy} title="Копировать" style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            border: "none", background: "transparent", cursor: "pointer", color: done ? C.green : C.faint, padding: 4,
          }}>{done ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.8} />}</button>
        )}
      </div>
    </Field>
  );
}

// ---------- Карточка лида (полная, с историей) ----------
function LeadDetail({ lead, users, allLeads = [], canEdit, onSave, onClose, onConvert, onPick }) {
  const [l, setL] = useState({ ...lead });
  const [act, setAct] = useState({ type: "call", title: "" });
  const [q, setQ] = useState("");
  const set = (k, v) => setL((p) => ({ ...p, [k]: v }));
  // синхронизируем форму при переключении лида в списке слева
  useEffect(() => { setL({ ...lead }); }, [lead.id]);
  const addActivity = () => {
    if (!act.title.trim()) return;
    const a = { id: uid("act"), type: act.type, title: act.title, when: nowISO(), done: true, owner: l.owner };
    setL((p) => ({ ...p, history: [...(p.history || []), a] }));
    setAct({ type: "call", title: "" });
  };
  const stageTitle = SALES_STAGES.find((s) => s.id === l.stage)?.title;

  // --- каналы связи (показываем только заполненные) ---
  const waDigits = (l.whatsapp || l.phone || "").replace(/[^\d]/g, "");
  const phoneDigits = (l.phone || "").replace(/[^\d]/g, "");
  const tgRaw = (l.telegram || "").trim();
  const tgUrl = tgRaw
    ? (tgRaw.startsWith("http") ? tgRaw : (tgRaw.startsWith("@") ? "https://t.me/" + tgRaw.slice(1) : "https://t.me/" + tgRaw))
    : null;
  const igRaw = (l.instagram || "").trim();
  const igUrl = igRaw
    ? (igRaw.startsWith("http") ? igRaw : "https://instagram.com/" + igRaw.replace(/^@/, ""))
    : null;
  const normUrl = (u) => { u = (u || "").trim(); if (!u) return null; return u.startsWith("http") ? u : "https://" + u; };
  const liUrl = normUrl(l.linkedin);
  const liCompUrl = normUrl(l.linkedinCompany);
  const siteUrl = normUrl(l.website);
  const open = (u) => u && window.open(u, "_blank", "noopener,noreferrer");

  const hasAnyChannel = phoneDigits || l.whatsapp || tgUrl || igUrl || liUrl || liCompUrl || siteUrl || l.email;

  // список номеров (телефон + whatsapp, если разные) и счётчик каналов
  const phoneList = [...new Set([l.phone, l.whatsapp].map((x) => (x || "").trim()).filter(Boolean))];
  const channelCount = [(phoneDigits || waDigits), tgUrl, igUrl, liUrl, liCompUrl, siteUrl, l.email].filter(Boolean).length;

  // лиды той же стадии, что и открытый (для списка слева)
  const sameStage = allLeads.filter((x) => x.stage === lead.stage);
  const ql = q.trim().toLowerCase();
  const listLeads = ql
    ? sameStage.filter((x) => (x.company || "").toLowerCase().includes(ql) || (x.contact || "").toLowerCase().includes(ql) || (x.city || "").toLowerCase().includes(ql))
    : sameStage;

  return (
    <Modal open onClose={onClose} width={listLeads.length > 1 ? 960 : 620} title={l.company || "Новый лид"}
      footer={canEdit && (
        <>
          {l.stage !== "won" && <Btn variant="ghost" onClick={() => { onSave(l); onClose(); }}>Сохранить</Btn>}
          {l.stage === "won"
            ? <Btn onClick={() => onConvert(l)}>Конвертировать в проект →</Btn>
            : <Btn onClick={() => { onSave({ ...l, stage: "won" }); onConvert({ ...l, stage: "won" }); }}>Выиграно → создать проект</Btn>}
        </>
      )}>
      <div style={{ display: listLeads.length > 1 ? "grid" : "block", gridTemplateColumns: listLeads.length > 1 ? "240px 1fr" : "1fr", gap: 20 }}>
        {/* ---- список лидов слева (та же стадия) ---- */}
        {listLeads.length > 1 && (
          <div style={{ borderRight: "1px solid " + C.border, paddingRight: 16, maxHeight: "62vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{stageTitle}</span>
              <Badge color={C.blueDark} bg={C.blueLight}>{sameStage.length}</Badge>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск…"
              style={{ ...inputStyle, marginBottom: 10, fontSize: 13, padding: "8px 12px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {listLeads.map((x) => {
                const active = x.id === l.id;
                return (
                  <button key={x.id} type="button" onClick={() => { if (canEdit) onSave(l); onPick && onPick(x); }}
                    style={{
                      textAlign: "left", border: "none", borderRadius: 10, padding: "9px 11px", cursor: "pointer",
                      background: active ? C.blueLight : "transparent", fontFamily: FONT,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.blueDark : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.company || "Без названия"}</div>
                    <div style={{ fontSize: 11.5, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[x.city, x.employees].filter(Boolean).join(" · ") || x.contact || "—"}
                    </div>
                  </button>
                );
              })}
              {!listLeads.length && <div style={{ fontSize: 12.5, color: C.faint, padding: "8px 0" }}>Ничего не найдено</div>}
            </div>
          </div>
        )}

        {/* ---- сама карточка ---- */}
        <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Компания"><Input value={l.company} disabled={!canEdit} onChange={(e) => set("company", e.target.value)} /></Field>
        </div>
        <CopyField label="БИН" value={l.bin} />
        <Field label="Город"><Input value={l.city || ""} disabled={!canEdit} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Руководитель"><Input value={l.contact} disabled={!canEdit} onChange={(e) => set("contact", e.target.value)} /></Field>
        <Field label="Должность / роль"><Input value={l.title} disabled={!canEdit} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Размер компании"><Input value={l.employees || ""} disabled={!canEdit} onChange={(e) => set("employees", e.target.value)} /></Field>
        <Field label="Источник"><Select disabled={!canEdit} value={l.source} options={SOURCES} onChange={(e) => set("source", e.target.value)} /></Field>
        <Field label="Стадия"><Select disabled={!canEdit} value={l.stage} options={SALES_STAGES.map((s) => ({ value: s.id, label: s.title }))} onChange={(e) => set("stage", e.target.value)} /></Field>
        <Field label="Ответственный"><Select disabled={!canEdit} value={l.owner} options={users.filter((u) => u.role === "sales" || u.role === "admin").map((u) => ({ value: u.id, label: u.name }))} onChange={(e) => set("owner", e.target.value)} /></Field>
        <Field label="Дата следующего касания"><Input type="date" value={l.nextTouch || ""} disabled={!canEdit} onChange={(e) => set("nextTouch", e.target.value)} /></Field>
        <Field label="Оценочная сумма сделки, ₸"><Input type="number" value={l.amount} disabled={!canEdit} onChange={(e) => set("amount", +e.target.value)} /></Field>
      </div>

      {/* ----- Каналы связи (премиум) ----- */}
      <div style={{ marginTop: 22, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Каналы связи</span>
          {channelCount > 0 && <Badge color={C.blueDark} bg={C.blueLight}>{channelCount}</Badge>}
        </div>
        {!hasAnyChannel && (
          <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>
            Контактов пока нет. Заполните телефон, Telegram, LinkedIn, сайт или email — здесь появятся кнопки.
          </div>
        )}

        {(phoneDigits || waDigits) && (
          <ChannelRow iconBg="#EEF0FF" icon={<Phone size={20} strokeWidth={2} style={{ color: "#5B6CFF" }} />}
            label="Телефон" value={phoneList.join(" · ")} sub={phoneList.length > 1 ? phoneList.length + " номера" : null}
            actions={<>
              {phoneDigits && <ChActionBtn onClick={() => open("tel:+" + phoneDigits)}><Phone size={15} strokeWidth={2.2} /> Позвонить</ChActionBtn>}
              {waDigits && <ChActionBtn color="#25D366" onClick={() => open("https://wa.me/" + waDigits)}><MessageCircle size={15} strokeWidth={2.2} /> WhatsApp</ChActionBtn>}
            </>} />
        )}
        {tgUrl && (
          <ChannelRow iconBg="#E3F2FB" icon={<Send size={20} strokeWidth={2} style={{ color: "#0088cc" }} />}
            label="Telegram" value={tgRaw}
            actions={<ChActionBtn color="#0088cc" arrow onClick={() => open(tgUrl)}>Открыть</ChActionBtn>} />
        )}
        {igUrl && (
          <ChannelRow iconBg="linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)" icon={<Instagram size={20} strokeWidth={2} style={{ color: "#fff" }} />}
            label="Instagram" value={igRaw}
            actions={<ChActionBtn color="#E1306C" arrow onClick={() => open(igUrl)}>Открыть</ChActionBtn>} />
        )}
        {liUrl && (
          <ChannelRow iconBg="#E5F0FB" icon={<Linkedin size={20} strokeWidth={2} style={{ color: "#0A66C2" }} />}
            label="LinkedIn — руководитель" value={l.contact || "Профиль"}
            actions={<ChActionBtn color="#0A66C2" arrow onClick={() => open(liUrl)}>Профиль</ChActionBtn>} />
        )}
        {liCompUrl && (
          <ChannelRow iconBg="#E5F0FB" icon={<Linkedin size={20} strokeWidth={2} style={{ color: "#0A66C2" }} />}
            label="LinkedIn — компания" value={l.company || "Страница"}
            actions={<ChActionBtn color="#0A66C2" arrow onClick={() => open(liCompUrl)}>Страница</ChActionBtn>} />
        )}
        {siteUrl && (
          <ChannelRow iconBg="#EEF1F4" icon={<Globe size={20} strokeWidth={2} style={{ color: "#475467" }} />}
            label="Сайт" value={l.website}
            actions={<ChActionBtn color="#1D2939" arrow onClick={() => open(siteUrl)}>Открыть</ChActionBtn>} />
        )}
        {l.email && (
          <ChannelRow iconBg="#EEF1F4" icon={<Mail size={20} strokeWidth={2} style={{ color: "#475467" }} />}
            label="Email" value={l.email}
            actions={<ChActionBtn onClick={() => open("mailto:" + l.email)}>Написать</ChActionBtn>} />
        )}
      </div>

      <MessageComposer lead={l} value={l.notes} disabled={!canEdit} onChange={(v) => set("notes", v)} />

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>История активностей</div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Select value={act.type} options={[
              { value: "call", label: "Звонок" }, { value: "email", label: "Письмо" },
              { value: "demo", label: "Разбор-пари" }, { value: "task", label: "Задача" }]}
              onChange={(e) => setAct((p) => ({ ...p, type: e.target.value }))} style={{ width: 150 }} />
            <Input placeholder="Что произошло…" value={act.title} onChange={(e) => setAct((p) => ({ ...p, title: e.target.value }))} />
            <Btn onClick={addActivity}>Добавить</Btn>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(l.history || []).slice().reverse().map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", background: C.panel, borderRadius: 9 }}>
              <Badge>{ {call:"Звонок",email:"Письмо",demo:"Разбор",task:"Задача",interview:"Интервью"}[a.type] || a.type }</Badge>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>{a.title}</span>
              <span style={{ fontSize: 11.5, color: C.faint }}>{fmtDateTime(a.when)}</span>
            </div>
          ))}
          {(!l.history || !l.history.length) && <div style={{ fontSize: 13, color: C.faint }}>Активностей пока нет.</div>}
        </div>
      </div>
        </div>{/* конец карточки */}
      </div>{/* конец grid список+карточка */}
    </Modal>
  );
}

// ---------- Конвертация лида → проект (3.4) ----------
function ConvertModal({ lead, users, onClose, onCreate }) {
  const [p, setP] = useState({
    client: lead.company, pkg: "Полное", mode: "B",
    deadline: todayISO(), interviewers: [], planInterviews: 12,
  });
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const toggleInt = (id) => setP((x) => ({
    ...x, interviewers: x.interviewers.includes(id) ? x.interviewers.filter((i) => i !== id) : [...x.interviewers, id],
  }));
  return (
    <Modal open onClose={onClose} width={560} title={"Конвертация в проект: " + lead.company}
      footer={<><Btn variant="ghost" onClick={onClose}>Отмена</Btn>
        <Btn disabled={!p.interviewers.length} onClick={() => p.interviewers.length && onCreate({ ...p, price: PACKAGE_PRICE[p.pkg] })}>Создать проект</Btn></>}>
      <Field label="Клиент"><Input value={p.client} onChange={(e) => set("client", e.target.value)} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Тип пакета"><Select value={p.pkg} options={PACKAGES} onChange={(e) => set("pkg", e.target.value)} /></Field>
        <Field label="Цена, ₸"><Input value={PACKAGE_PRICE[p.pkg]} disabled /></Field>
        <Field label="Режим респондентов"><Select value={p.mode} options={[{ value: "A", label: RESP_MODES.A }, { value: "B", label: RESP_MODES.B }]} onChange={(e) => set("mode", e.target.value)} /></Field>
        <Field label="План интервью"><Input type="number" value={p.planInterviews} onChange={(e) => set("planInterviews", +e.target.value)} /></Field>
        <Field label="Дедлайн"><Input type="date" value={p.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
      </div>
      <Field label="Ответственный интервьюер" hint="(обязательно — он увидит этот проект у себя)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {users.filter((u) => u.role === "interviewer").map((u) => (
            <button key={u.id} onClick={() => toggleInt(u.id)} style={{
              border: "1px solid " + (p.interviewers.includes(u.id) ? C.blue : C.border),
              background: p.interviewers.includes(u.id) ? C.blueLight : C.surface,
              color: p.interviewers.includes(u.id) ? C.blueDark : C.muted,
              padding: "7px 13px", borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: FONT,
            }}>{u.name}</button>
          ))}
          {!users.some((u) => u.role === "interviewer") && (
            <div style={{ fontSize: 12.5, color: C.faint }}>Нет интервьюеров. Назначьте роль «Интервьюер» в разделе «Пользователи».</div>
          )}
        </div>
      </Field>
    </Modal>
  );
}

// ---------- Карточка респондента (3.5) ----------
function RespondentDetail({ resp, project, users, canEdit, onSave, onClose, onStartInterview }) {
  const [r, setR] = useState({ ...resp });
  const set = (k, v) => setR((p) => ({ ...p, [k]: v }));
  return (
    <Modal open onClose={onClose} width={580} title={r.name}
      footer={<>
        {canEdit && <Btn variant="ghost" onClick={() => { onSave(r); onClose(); }}>Сохранить</Btn>}
        {canEdit && project?.script?.blocks?.length > 0 &&
          <Btn onClick={() => onStartInterview(r)}>▶ Начать интервью</Btn>}
      </>}>
      {(!project?.script?.blocks?.length) && (
        <div style={{ background: C.hintBg, border: "1px solid " + C.hintBd, color: C.amber, padding: "9px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
          У проекта ещё нет скрипта — загрузите его во вкладке «Скрипт», чтобы запустить интервью.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Имя"><Input value={r.name} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Телефон"><Input value={r.phone} disabled={!canEdit} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Статус скрининга"><Input value={r.screenStatus} disabled={!canEdit} onChange={(e) => set("screenStatus", e.target.value)} /></Field>
        <Field label="Квалифицирован"><Select value={r.qualified ? "Да" : "Нет"} options={["Да", "Нет"]} disabled={!canEdit} onChange={(e) => set("qualified", e.target.value === "Да")} /></Field>
        <Field label="Слот (дата/время)"><Input type="datetime-local" value={r.slot ? r.slot.slice(0, 16) : ""} disabled={!canEdit} onChange={(e) => set("slot", e.target.value)} /></Field>
        <Field label="Статус интервью"><Select value={r.interviewStatus} options={["—", "Забронировано", "Проведено", "Неявка", "Отказ"]} disabled={!canEdit} onChange={(e) => set("interviewStatus", e.target.value)} /></Field>
        <Field label="Тип вознаграждения"><Select value={r.reward} options={REWARD_TYPES} disabled={!canEdit} onChange={(e) => set("reward", e.target.value)} /></Field>
        <Field label="Ответственный"><Select value={r.owner} options={users.filter((u) => u.role === "interviewer").map((u) => ({ value: u.id, label: u.name }))} disabled={!canEdit} onChange={(e) => set("owner", e.target.value)} /></Field>
      </div>
      <Field label="Ссылка на запись"><Input value={r.recording} placeholder="https://…" disabled={!canEdit} onChange={(e) => set("recording", e.target.value)} /></Field>
      <Field label="Ключевой инсайт" hint="На этом поле строятся бонус интервьюеру и метрика insight rate">
        <Textarea rows={2} value={r.keyInsight} disabled={!canEdit} onChange={(e) => set("keyInsight", e.target.value)} />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: canEdit ? "pointer" : "default" }}>
        <input type="checkbox" checked={r.insight} disabled={!canEdit} onChange={(e) => set("insight", e.target.checked)} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Флаг «инсайт»</span>
      </label>
      <Field label="Заметки" hint="(отдельно от заметок интервью по блокам)"><Textarea rows={2} value={r.notes} disabled={!canEdit} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

// ============================================================================
// SECTION: compB
// ============================================================================
// ============================================================================
// Компоненты B: ProjectView (+Скрипт), InterviewerWorkspace, InterviewSlider
// ============================================================================

// ---------- Вкладка «Скрипт» проекта (3.5а) ----------
function ScriptTab({ project, canEdit, onSaveScript }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(project.script?.blocks || []);
  const [name, setName] = useState(project.script?.name || "");
  const [showPaste, setShowPaste] = useState(!(project.script?.blocks?.length));

  const doParse = () => {
    const blocks = parseScript(raw);
    if (blocks.length) { setPreview(blocks); setShowPaste(false); }
  };
  const move = (i, dir) => {
    const arr = [...preview];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setPreview(arr.map((b, k) => ({ ...b, order: k })));
  };
  const rename = (i, v) => setPreview((p) => p.map((b, k) => (k === i ? { ...b, title: v } : b)));
  const retype = (i, v) => setPreview((p) => p.map((b, k) => (k === i ? { ...b, type: v } : b)));
  const del = (i) => setPreview((p) => p.filter((_, k) => k !== i).map((b, k) => ({ ...b, order: k })));
  const save = () => onSaveScript({ id: project.script?.id || uid("scr"), name: name || "Скрипт проекта", blocks: preview });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Field label="Название скрипта"><Input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} style={{ width: 360 }} /></Field>
        {canEdit && <Btn variant="ghost" size="sm" onClick={() => setShowPaste((s) => !s)}>{showPaste ? "Скрыть ввод" : "Вставить / заменить текст"}</Btn>}
      </div>

      {showPaste && canEdit && (
        <Panel style={{ marginBottom: 16, background: C.panel }}>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
            Вставьте текст скрипта. Разметка:&nbsp;
            <code style={{ background: C.surface, padding: "1px 5px", borderRadius: 4 }}># Заголовок</code> — новый слайд,&nbsp;
            <code style={{ background: C.surface, padding: "1px 5px", borderRadius: 4 }}>1. / -</code> — вопрос,&nbsp;
            <code style={{ background: C.surface, padding: "1px 5px", borderRadius: 4 }}>&gt; подсказка</code> — ведущему.
          </div>
          <Textarea rows={8} value={raw} placeholder={"# Про компанию\n1. Чем занимаетесь?\n> Если молчат — переспросить про роль"} onChange={(e) => setRaw(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
          <div style={{ marginTop: 10 }}><Btn onClick={doParse}>Разобрать на слайды →</Btn></div>
        </Panel>
      )}

      {preview.length === 0 ? (
        <EmptyState icon={<FileText size={24} strokeWidth={1.6} />} title="Скрипт ещё не загружен" text="Вставьте текст вопросов — система разобьёт его на слайды." />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Превью слайдов · {preview.length}</div>
            {canEdit && <Btn onClick={save}>Сохранить скрипт</Btn>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {preview.map((b, i) => (
              <Panel key={b.id} pad={16} style={{ borderLeft: "3px solid " + C.blue }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.faint, letterSpacing: 1 }}>
                    {String(i + 1).padStart(2, "0")} / {String(preview.length).padStart(2, "0")}
                  </span>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <Mini onClick={() => move(i, -1)}>↑</Mini>
                      <Mini onClick={() => move(i, 1)}>↓</Mini>
                      <Mini onClick={() => del(i)} danger>✕</Mini>
                    </div>
                  )}
                </div>
                {canEdit
                  ? <Input value={b.title} onChange={(e) => rename(i, e.target.value)} style={{ fontWeight: 700, marginBottom: 8 }} />
                  : <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 8 }}>{b.title}</div>}
                {canEdit
                  ? <Select value={b.type} options={Object.entries(BLOCK_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} onChange={(e) => retype(i, e.target.value)} style={{ marginBottom: 10, fontSize: 12 }} />
                  : <Badge style={{ marginBottom: 10 }}>{BLOCK_TYPE_LABEL[b.type]}</Badge>}
                {b.hint && <div style={{ fontSize: 12, color: C.amber, background: C.hintBg, padding: "6px 9px", borderRadius: 7, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Lightbulb size={13} strokeWidth={1.8} style={{ flexShrink: 0 }} /> {b.hint}</div>}
                <ol style={{ margin: 0, paddingLeft: 18, color: C.text }}>
                  {b.questions.map((q, qi) => <li key={qi} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.45 }}>{q}</li>)}
                </ol>
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function Mini({ children, onClick, danger }) {
  return <button onClick={onClick} style={{
    width: 24, height: 24, borderRadius: 6, border: "1px solid " + C.border,
    background: C.surface, cursor: "pointer", color: danger ? C.red : C.muted, fontSize: 12, lineHeight: 1,
  }}>{children}</button>;
}

// ---------- Карточка респондента в канбане рекрутинга ----------
function RespCard(resp, onDragStart, onClick) {
  const overdue = false;
  return (
    <KanbanCard key={resp.id} accent={resp.insight ? C.green : C.blue} onDragStart={onDragStart} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: C.text }}>{resp.name}</div>
        {resp.insight && <Badge color={C.green} bg="#E7F6EE">★ инсайт</Badge>}
      </div>
      <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{resp.phone}</div>
      {resp.slot && <div style={{ fontSize: 11.5, color: C.blueDark, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}><Clock size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} /> {fmtDateTime(resp.slot)}</div>}
    </KanbanCard>
  );
}

// ---------- ProjectView (вид по одному проекту, 3.5б) ----------
function ProjectView({ project, users, respondents, canEditScript, canConduct,
  onMoveResp, onOpenResp, onSaveScript, onBack, onDeleteResp }) {
  const [tab, setTab] = useState("overview");
  const projResp = respondents.filter((r) => r.project === project.id);
  const doneCount = projResp.filter((r) => r.stage === "done" || r.stage === "insight").length;
  const progress = project.planInterviews ? Math.round((doneCount / project.planInterviews) * 100) : 0;
  const ints = users.filter((u) => project.interviewers.includes(u.id)).map((u) => u.name).join(", ");

  return (
    <div>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {onBack && <Btn variant="ghost" size="sm" onClick={onBack}>← К общему виду</Btn>}
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>{project.client}</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <Badge>{project.pkg}</Badge>
            <Badge color={project.mode === "A" ? C.blueDark : C.amber} bg={project.mode === "A" ? C.blueLight : "#FFF6E9"}>{RESP_MODES[project.mode]}</Badge>
            <Badge color={C.muted} bg={C.panel}>Дедлайн {fmtDate(project.deadline)}</Badge>
            <Badge color={C.muted} bg={C.panel}>Интервьюеры: {ints || "—"}</Badge>
          </div>
        </div>
      </div>

      {/* прогресс */}
      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Прогресс рекрутинга</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>{doneCount} / {project.planInterviews} интервью · {progress}%</span>
        </div>
        <div style={{ height: 9, background: C.panel, borderRadius: 20, overflow: "hidden" }}>
          <div style={{ width: progress + "%", height: "100%", background: C.blue, borderRadius: 20, transition: "width .4s" }} />
        </div>
      </Panel>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid " + C.border, marginBottom: 18 }}>
        {[["overview", "Респонденты"], ["script", "Скрипт"], ["schedule", "Расписание"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            border: "none", background: "transparent", fontFamily: FONT, fontSize: 14, fontWeight: 600,
            color: tab === id ? C.blue : C.muted, padding: "10px 16px", cursor: "pointer",
            borderBottom: "2px solid " + (tab === id ? C.blue : "transparent"), marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === "overview" && !projResp.length && <EmptyState icon={<UsersIcon size={24} strokeWidth={1.7} />} title="Респондентов пока нет" text="Импортируйте список во вкладке «Импорт/Экспорт»." />}
      {tab === "script" && <ScriptTab project={project} canEdit={canEditScript} onSaveScript={onSaveScript} />}
      {tab === "schedule" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projResp.filter((r) => r.slot).sort((a, b) => new Date(a.slot) - new Date(b.slot)).map((r) => (
            <Panel key={r.id} pad={14} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.faint }}>{fmtDateTime(r.slot)} · {r.interviewStatus}</div>
              </div>
              {canConduct && project.script?.blocks?.length > 0 && r.stage !== "done" && r.stage !== "insight" &&
                <Btn size="sm" onClick={() => onOpenResp(r)}>Открыть</Btn>}
            </Panel>
          ))}
          {!projResp.some((r) => r.slot) && <EmptyState icon={<CalendarDays size={24} strokeWidth={1.7} />} title="Слотов пока нет" />}
        </div>
      )}
      </div>
      {tab === "overview" && projResp.length > 0 && (
        <KanbanBoard stages={RECRUIT_STAGES} items={projResp} getStage={(r) => r.stage}
          renderCard={(r, ds) => RespCard(r, ds, () => onOpenResp(r))} onMove={onMoveResp} onDelete={onDeleteResp} />
      )}
    </div>
  );
}

// ---------- Рабочее пространство интервьюера: общий вид (3.5б) ----------
function InterviewerHome({ user, projects, respondents, tasks, onOpenProject, onOpenResp }) {
  const myProjects = projects.filter((p) => p.interviewers.includes(user.id));
  const myResp = respondents.filter((r) => r.owner === user.id);
  const today = new Date().toISOString().slice(0, 10);
  const todayInts = myResp.filter((r) => r.slot && r.slot.slice(0, 10) === today);
  const upcoming = myResp.filter((r) => r.slot && r.slot.slice(0, 10) > today).sort((a, b) => new Date(a.slot) - new Date(b.slot)).slice(0, 5);
  const myTasks = tasks.filter((t) => t.owner === user.id && !t.done);

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Домашний экран</h2>
      <p style={{ margin: "0 0 20px", color: C.muted, fontSize: 14 }}>Сводно по всем вашим проектам.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Интервью сегодня · {todayInts.length}</div>
          {todayInts.length ? todayInts.map((r) => (
            <div key={r.id} onClick={() => onOpenResp(r)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 11px", background: C.blueLight, borderRadius: 9, marginBottom: 8, cursor: "pointer" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</span>
              <span style={{ fontSize: 12.5, color: C.blueDark }}>{fmtDateTime(r.slot).split(",")[1] || fmtDateTime(r.slot)}</span>
            </div>
          )) : <EmptyState icon={<Coffee size={24} strokeWidth={1.6} />} title="На сегодня интервью нет" />}
        </Panel>
        <Panel>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ближайшие слоты</div>
          {upcoming.length ? upcoming.map((r) => (
            <div key={r.id} onClick={() => onOpenResp(r)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 11px", borderBottom: "1px solid " + C.border, cursor: "pointer" }}>
              <span style={{ fontSize: 13.5 }}>{r.name}</span>
              <span style={{ fontSize: 12.5, color: C.faint }}>{fmtDateTime(r.slot)}</span>
            </div>
          )) : <EmptyState icon={<CalendarDays size={24} strokeWidth={1.6} />} title="Слотов пока нет" />}
        </Panel>
      </div>

      <Panel style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Мои проекты</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
          {myProjects.map((p) => {
            const pr = respondents.filter((r) => r.project === p.id);
            const done = pr.filter((r) => r.stage === "done" || r.stage === "insight").length;
            return (
              <div key={p.id} onClick={() => onOpenProject(p.id)} style={{
                border: "1px solid " + C.border, borderRadius: 11, padding: 14, cursor: "pointer", transition: "border-color .15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.blue)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{p.client}</div>
                <Badge>{p.pkg}</Badge>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>{done} / {p.planInterviews} интервью · до {fmtDate(p.deadline)}</div>
              </div>
            );
          })}
          {!myProjects.length && <EmptyState icon={<FolderOpen size={24} strokeWidth={1.6} />} title="Проектов пока не назначено" />}
        </div>
      </Panel>

      <Panel>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Задачи · {myTasks.length}</div>
        {myTasks.length ? myTasks.map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + C.border }}>
            <span style={{ fontSize: 13.5 }}>{t.title}</span>
            <span style={{ fontSize: 12, color: C.faint }}>{fmtDate(t.when)}</span>
          </div>
        )) : <EmptyState icon={<CheckCircle2 size={24} strokeWidth={1.6} />} title="Задач нет" />}
      </Panel>
    </div>
  );
}

// ---------- Режим проведения интервью: слайдер (3.5в) ----------
function InterviewSlider({ respondent, project, initialNotes, onSaveNote, onFinish, onClose }) {
  const { theme } = useTheme();
  const blocks = project.script?.blocks || [];
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1); // visual only: slide direction
  const [notes, setNotes] = useState(initialNotes || {});
  const [finishing, setFinishing] = useState(false);
  const [keyInsight, setKeyInsight] = useState(respondent.keyInsight || "");
  const [insightFlag, setInsightFlag] = useState(respondent.insight || false);
  const saveTimer = useRef(null);

  const block = blocks[idx];
  const go = (d) => { setDir(d); setIdx((i) => Math.max(0, Math.min(blocks.length - 1, i + d))); };

  // автосохранение заметки (debounce при наборе) + сохранение при перелистывании
  const setNote = (blockId, text) => {
    setNotes((p) => ({ ...p, [blockId]: text }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSaveNote(respondent.id, blockId, text), 500);
  };
  const flush = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); }
    if (block) onSaveNote(respondent.id, block.id, notes[block.id] || "");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (finishing) return;
      if (e.key === "ArrowRight") { flush(); go(1); }
      if (e.key === "ArrowLeft") { flush(); go(-1); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!blocks.length) return null;

  const pct = Math.round(((idx + 1) / blocks.length) * 100);
  const bar = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 30px" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", flexDirection: "column", fontFamily: FONT, color: "var(--c-text)", background: "var(--c-bg-grad)", overflow: "hidden" }}>
      <NocturneBackground theme={theme} />

      {/* верхняя панель */}
      <div className="n-glass" style={{ ...bar, position: "relative", zIndex: 2, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--c-blue)", letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>
            {String(idx + 1).padStart(2, "0")} <span style={{ color: "var(--c-faint)" }}>/ {String(blocks.length).padStart(2, "0")}</span>
          </span>
          <span style={{ width: 1, height: 18, background: "var(--c-border-strong)" }} />
          <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--c-text)" }}>{block.title}</span>
          <Badge>{BLOCK_TYPE_LABEL[block.type]}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Респондент: <b style={{ color: "var(--c-text)" }}>{respondent.name}</b> · {project.client}</span>
          <ThemeToggle size={34} />
          <Btn variant="ghost" size="sm" onClick={() => { flush(); setDir(-1); setIdx(0); }}>↺ Заново</Btn>
          <Btn variant="ghost" size="sm" onClick={() => { flush(); onClose(); }}>Свернуть</Btn>
        </div>
      </div>
      {/* прогресс */}
      <div style={{ height: 3, background: "var(--c-border)", position: "relative", zIndex: 2 }}>
        <div style={{ width: pct + "%", height: "100%", background: "linear-gradient(90deg,var(--c-blue-dark),var(--c-blue))", boxShadow: "0 0 12px var(--c-glow)", transition: "width .45s cubic-bezier(.22,.61,.36,1)" }} />
      </div>

      {/* контент слайда */}
      <div style={{ flex: 1, overflowY: "auto", padding: "clamp(28px,5vh,56px) 30px", display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: dir >= 0 ? 28 : -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir >= 0 ? -22 : 22 }}
            transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ width: "100%", maxWidth: 1120, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 44, alignContent: "start" }}
          >
            {/* левая колонка: вопросы */}
            <div>
              <h1 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 800, color: "var(--c-text)", margin: "0 0 24px", lineHeight: 1.12, letterSpacing: -0.5 }}>{block.title}</h1>
              {block.hint && (
                <div style={{ background: "var(--c-hint-bg)", border: "1px solid var(--c-hint-bd)", color: "var(--c-hint-tx)", padding: "13px 17px", borderRadius: 13, marginBottom: 26, fontSize: 14.5, lineHeight: 1.55, display: "flex", gap: 10 }}>
                  <Lightbulb size={18} strokeWidth={1.8} style={{ flexShrink: 0 }} /><span>{block.hint}</span>
                </div>
              )}
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {block.questions.map((q, i) => (
                  <li key={i} style={{ display: "flex", gap: 16, marginBottom: 18 }}>
                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 30, background: "var(--c-blue-soft)", border: "1px solid rgba(45,156,219,0.3)", color: "var(--c-blue-dark)", fontSize: 13.5, fontWeight: 800, display: "grid", placeItems: "center" }}>{i + 1}</span>
                    <span style={{ fontSize: 19, lineHeight: 1.5, color: "var(--c-text)", textWrap: "pretty" }}>{q}</span>
                  </li>
                ))}
                {!block.questions.length && <li style={{ color: "var(--c-faint)", fontSize: 16 }}>В этом блоке нет вопросов — это слайд-инструкция.</li>}
              </ol>
            </div>
            {/* правая колонка: заметки */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-muted)" }}>Заметки по блоку</span>
                <span style={{ fontSize: 11.5, color: "var(--c-green)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--c-green)", boxShadow: "0 0 8px var(--c-green)" }} />автосохранение
                </span>
              </div>
              <textarea
                className="n-in"
                value={notes[block.id] || ""}
                onChange={(e) => setNote(block.id, e.target.value)}
                onBlur={flush}
                placeholder="Пишите ответы респондента своими словами по ходу разговора…"
                style={{ minHeight: "min(52vh,420px)", resize: "vertical", lineHeight: 1.65, fontSize: 15.5, padding: "16px 18px" }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* навигация */}
      <div className="n-glass" style={{ ...bar, padding: "16px 30px", position: "relative", zIndex: 2, borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
        <Btn variant="ghost" onClick={() => { flush(); go(-1); }} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.4 : 1 }}>← Назад</Btn>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {blocks.map((_, i) => (
            <span key={i} onClick={() => { flush(); setDir(i >= idx ? 1 : -1); setIdx(i); }} style={{
              width: i === idx ? 26 : 9, height: 9, borderRadius: 9, cursor: "pointer", transition: "all .28s cubic-bezier(.22,.61,.36,1)",
              background: i === idx ? "var(--c-blue)" : (notes[blocks[i].id] ? "var(--c-green)" : "var(--c-border-strong)"),
              boxShadow: i === idx ? "0 0 10px var(--c-glow)" : "none",
            }} />
          ))}
        </div>
        {idx < blocks.length - 1
          ? <Btn onClick={() => { flush(); go(1); }}>Далее →</Btn>
          : <Btn onClick={() => { flush(); setFinishing(true); }} style={{ background: C.green, borderColor: C.green }}>Завершить интервью ✓</Btn>}
      </div>

      {/* завершение: фиксация инсайта */}
      {finishing && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, background: "var(--c-overlay)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "nFadeUp .25s both" }}>
          <div className="n-glass" style={{ borderRadius: 18, padding: 28, width: "100%", maxWidth: 520, animation: "nScaleIn .3s cubic-bezier(.22,.61,.36,1) both" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 800, color: "var(--c-text)" }}>Завершение интервью</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--c-muted)" }}>Все заметки собраны в карточку. Зафиксируйте ключевой инсайт.</p>
            <Field label="Ключевой инсайт">
              <Textarea rows={3} value={keyInsight} onChange={(e) => setKeyInsight(e.target.value)} placeholder="Главный вывод из разговора…" />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 20 }}>
              <input type="checkbox" checked={insightFlag} onChange={(e) => setInsightFlag(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--c-blue)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>Поставить флаг «инсайт» (учитывается в insight rate и бонусе)</span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setFinishing(false)}>Вернуться</Btn>
              <Btn onClick={() => onFinish(respondent.id, keyInsight, insightFlag)} style={{ background: C.green, borderColor: C.green }}>Готово</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION: compC
// ============================================================================
// ============================================================================
// Компоненты C: Calendar, Reminders, ImportExport, Analytics, Users, Settings
// ============================================================================

// ---------- Календарь + Telegram-напоминания (3.6) ----------
function CalendarView({ user, tasks, respondents, leads, reminders, onToggleReminder, isAdmin }) {
  // личные события: задачи + интервью (слоты) + разборы-пари
  const events = [];
  tasks.filter((t) => isAdmin || t.owner === user.id).forEach((t) =>
    events.push({ when: t.when, title: t.title, type: t.type }));
  respondents.filter((r) => (isAdmin || r.owner === user.id) && r.slot).forEach((r) =>
    events.push({ when: r.slot, title: "Интервью: " + r.name, type: "interview" }));
  events.sort((a, b) => new Date(a.when) - new Date(b.when));

  // неделя
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
  const typeColor = { interview: C.blue, demo: C.amber, task: C.muted, call: C.green, email: C.faint };

  const myReminders = reminders.filter((r) => isAdmin || r.to === user.telegram_id);

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 23, fontWeight: 700, letterSpacing: -0.5 }}>Календарь и напоминания</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Panel>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ближайшая неделя</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {week.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const dayEv = events.filter((e) => (e.when || "").slice(0, 10) === iso);
              const isToday = iso === todayISO();
              return (
                <div key={iso} style={{ border: "1px solid " + (isToday ? C.blue : C.border), borderRadius: 9, padding: 7, minHeight: 96, background: isToday ? C.blueLight : C.surface }}>
                  <div style={{ fontSize: 10.5, color: C.faint, fontWeight: 700, textTransform: "uppercase" }}>{d.toLocaleDateString("ru-RU", { weekday: "short" })}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isToday ? C.blueDark : C.text, marginBottom: 5 }}>{d.getDate()}</div>
                  {dayEv.slice(0, 3).map((e, i) => (
                    <div key={i} style={{ fontSize: 9.5, padding: "2px 4px", borderRadius: 4, marginBottom: 3, background: C.surface, borderLeft: "2px solid " + (typeColor[e.type] || C.blue), color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                  ))}
                  {dayEv.length > 3 && <div style={{ fontSize: 9.5, color: C.faint }}>+{dayEv.length - 3}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "20px 0 10px" }}>Повестка</div>
          {events.length ? events.slice(0, 12).map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.border }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: typeColor[e.type] || C.blue }} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{e.title}</span>
              <span style={{ fontSize: 12, color: C.faint }}>{fmtDateTime(e.when)}</span>
            </div>
          )) : <EmptyState icon={<CalendarDays size={24} strokeWidth={1.7} />} title="Событий нет" />}
        </Panel>

        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Telegram-напоминания</span>
            <Badge color={C.blueDark} bg={C.blueLight}>бот</Badge>
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 14 }}>
            За день и за 1 час до интервью/разбора + задачи с дедлайном. Отправка — через Telegram Bot API (edge-функция).
          </div>
          {myReminders.map((r) => (
            <div key={r.id} style={{ border: "1px solid " + C.border, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.blueDark }}>{r.to}</span>
                <Badge color={r.sent ? C.green : C.amber} bg={r.sent ? "#E7F6EE" : "#FFF6E9"}>{r.sent ? "отправлено" : "в очереди"}</Badge>
              </div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{r.text}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 11.5, color: C.faint }}>{fmtDateTime(r.when)}</span>
                {!r.sent && <Btn size="sm" variant="soft" onClick={() => onToggleReminder(r.id)}>Отметить отправленным</Btn>}
              </div>
            </div>
          ))}
          {!myReminders.length && <EmptyState icon={<BellIcon size={24} strokeWidth={1.7} />} title="Напоминаний нет" />}
        </Panel>
      </div>
    </div>
  );
}

// ---------- Импорт / Экспорт (3.7) ----------
const LEAD_FIELDS = [
  { key: "company", label: "Компания", syn: ["компания", "company", "организация", "юр.лицо", "клиент"] },
  { key: "bin", label: "БИН", syn: ["бин", "bin", "иин"] },
  { key: "city", label: "Город", syn: ["город", "city", "регион"] },
  { key: "employees", label: "Сотрудников", syn: ["сотрудник", "размер", "штат", "employees"] },
  { key: "phone", label: "Телефон", syn: ["телефон", "phone", "тел", "номер"] },
  { key: "contact", label: "Контактное лицо", syn: ["руководитель", "контакт", "лпр", "contact", "имя", "фио", "директор"] },
  { key: "title", label: "Должность", syn: ["должность", "роль", "title", "position"] },
  { key: "linkedin", label: "LinkedIn руковод.", syn: ["linkedin руковод", "linkedin рук", "профиль linkedin", "linkedin лпр"] },
  { key: "linkedinCompany", label: "LinkedIn компании", syn: ["linkedin компан", "страница linkedin", "linkedin company"] },
  { key: "whatsapp", label: "WhatsApp", syn: ["whatsapp", "ватсап", "вотсап", "wa"] },
  { key: "telegram", label: "Telegram", syn: ["telegram", "телеграм", "тг", "tg"] },
  { key: "instagram", label: "Instagram", syn: ["instagram", "инстаграм", "инста", "ig"] },
  { key: "website", label: "Сайт", syn: ["сайт", "website", "site", "web", "url", "домен"] },
  { key: "email", label: "Email / Почта", syn: ["email", "почта", "mail", "e-mail"] },
  { key: "source", label: "Источник", syn: ["источник", "source", "канал"] },
  { key: "notes", label: "Заметки / Сообщение", syn: ["заметка", "заметки", "сообщение", "notes", "комментарий", "примечание"] },
];
const RESP_FIELDS = [
  { key: "name", label: "Имя" }, { key: "phone", label: "Телефон" },
  { key: "screenStatus", label: "Статус скрининга" }, { key: "interviewStatus", label: "Статус интервью" },
  { key: "reward", label: "Вознаграждение" }, { key: "notes", label: "Заметки" },
];

function ImportExportModal({ kind, existing, projectId, projects = [], onClose, onImport }) {
  const fields = kind === "lead" ? LEAD_FIELDS : RESP_FIELDS;
  const [proj, setProj] = useState(projectId || projects[0]?.id || "");
  const [rows, setRows] = useState(null);
  const [cols, setCols] = useState([]);
  const [map, setMap] = useState({});
  const [result, setResult] = useState(null);

  const autoMap = (columns) => {
    const m = {};
    const used = new Set();
    const norm = (s) => s.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
    fields.forEach((f) => {
      const syns = (f.syn || [f.label]).map(norm);
      // ищем колонку, чьё имя содержит один из синонимов; пропускаем уже занятые
      const hit = columns.find((c) => {
        if (used.has(c)) return false;
        const nc = norm(c);
        return syns.some((s) => nc.includes(s));
      });
      if (hit) { m[f.key] = hit; used.add(hit); }
    });
    return m;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseImportFile(file);
      if (!data.length) return;
      const columns = Object.keys(data[0]);
      setRows(data); setCols(columns); setMap(autoMap(columns)); setResult(null);
    } catch (err) { alert("Не удалось прочитать файл: " + err.message); }
  };

  const runImport = () => {
    const existingPhones = new Set(existing.map((x) => normPhone(x.phone)));
    const seen = new Set();
    let added = 0, dup = 0;
    const items = [];
    rows.forEach((row) => {
      const obj = {};
      fields.forEach((f) => { if (map[f.key]) obj[f.key] = String(row[map[f.key]] ?? "").trim(); });
      const ph = normPhone(obj.phone);
      if (ph && (existingPhones.has(ph) || seen.has(ph))) { dup++; return; }
      if (ph) seen.add(ph);
      items.push(obj);
      added++;
    });
    onImport(items, proj);
    setResult({ added, dup, total: rows.length });
  };

  return (
    <Modal open onClose={onClose} width={620}
      title={"Импорт " + (kind === "lead" ? "лидов" : "респондентов")}>
      {!rows && (
        <div style={{ border: "2px dashed " + C.borderStrong, borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><FileText size={30} strokeWidth={1.6} style={{ color: C.muted }} /></div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Загрузите CSV или XLSX</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>Дедупликация по номеру телефона включена автоматически</div>
          <label style={{ display: "inline-block" }}>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            <span style={{ background: C.blue, color: "#fff", padding: "10px 20px", borderRadius: 9, fontWeight: 600, cursor: "pointer", display: "inline-block" }}>Выбрать файл</span>
          </label>
        </div>
      )}

      {rows && !result && (
        <>
          {kind === "resp" && (
            <div style={{ marginBottom: 16, padding: 12, background: C.panel, borderRadius: 10, border: "1px solid " + C.border }}>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>В какой проект</span>
                <Select value={proj} options={projects.length ? projects.map((p) => ({ value: p.id, label: p.client })) : [{ value: "", label: "Нет проектов" }]} onChange={(e) => setProj(e.target.value)} />
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>Респонденты добавятся в выбранный проект.</div>
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Маппинг полей · найдено строк: {rows.length}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {fields.map((f) => (
              <div key={f.key} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
                <Select value={map[f.key] || ""} options={[{ value: "", label: "— не импортировать —" }, ...cols.map((c) => ({ value: c, label: c }))]}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Btn variant="ghost" onClick={() => setRows(null)}>← Другой файл</Btn>
            <Btn onClick={runImport} disabled={kind === "resp" && !proj}>Импортировать {rows.length} строк</Btn>
          </div>
        </>
      )}

      {result && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><CheckCircle2 size={40} strokeWidth={1.6} style={{ color: C.green }} /></div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Импорт завершён</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{result.added}</div><div style={{ fontSize: 12, color: C.faint }}>добавлено</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: C.amber }}>{result.dup}</div><div style={{ fontSize: 12, color: C.faint }}>дублей пропущено</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: C.muted }}>{result.total}</div><div style={{ fontSize: 12, color: C.faint }}>всего в файле</div></div>
          </div>
          <div style={{ marginTop: 20 }}><Btn onClick={onClose}>Готово</Btn></div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Аналитика (3.8) ----------
const CHART_COLORS = ["#2D9CDB", "#27AE60", "#F2994A", "#9B51E0", "#56CCF2", "#EB5757"];

function Analytics({ role, user, leads, projects, respondents, users }) {
  // Палитра графиков: recharts красит SVG-атрибутами, где var() не работает,
  // поэтому используем реальные hex, зависящие от текущей темы.
  const { theme: __theme } = useTheme();
  const CK = __theme === "dark"
    ? { axis: "#9DABC0", grid: "rgba(255,255,255,0.10)", blue: "#2D9CDB", green: "#3FB97F", tipBg: "#141C2B", tipBd: "rgba(255,255,255,0.14)", text: "#E6EDF5", sub: "#9DABC0", cursor: "rgba(255,255,255,0.05)" }
    : { axis: "#6B7785", grid: "#E6EBF0", blue: "#2D9CDB", green: "#27AE60", tipBg: "#FFFFFF", tipBd: "#E6EBF0", text: "#2D2D2D", sub: "#6B7785", cursor: "rgba(45,156,219,0.08)" };
  const scope = role === "sales" ? leads.filter((l) => l.owner === user.id) : leads;
  const respScope = role === "interviewer" ? respondents.filter((r) => r.owner === user.id) : respondents;

  // --- продажи ---
  const byStage = SALES_STAGES.filter((s) => s.id !== "lost").map((s) => ({
    name: s.title.length > 12 ? s.title.slice(0, 11) + "…" : s.title,
    Лиды: scope.filter((l) => l.stage === s.id).length,
  }));
  const won = scope.filter((l) => l.stage === "won").length;
  const lost = scope.filter((l) => l.stage === "lost").length;
  const winRate = won + lost ? Math.round((won / (won + lost)) * 100) : 0;
  const pipeline = scope.filter((l) => !["won", "lost"].includes(l.stage)).reduce((s, l) => s + (l.amount || 0), 0);
  const closed = scope.filter((l) => l.stage === "won").reduce((s, l) => s + (l.amount || 0), 0);
  const demos = scope.reduce((s, l) => s + (l.history || []).filter((a) => a.type === "demo").length, 0);

  // --- рекрутинг ---
  const interviewers = users.filter((u) => u.role === "interviewer" && (role !== "interviewer" || u.id === user.id));
  const perInterviewer = interviewers.map((u) => ({
    name: u.name.split(" ")[0],
    Интервью: respScope.filter((r) => r.owner === u.id && (r.stage === "done" || r.stage === "insight")).length,
  }));
  const totalDone = respScope.filter((r) => r.stage === "done" || r.stage === "insight").length;
  const noShow = respScope.filter((r) => r.interviewStatus === "Неявка").length;
  const noShowPct = respScope.length ? Math.round((noShow / respScope.length) * 100) : 0;
  const withInsight = respScope.filter((r) => r.insight).length;
  const insightRate = totalDone ? Math.round((withInsight / totalDone) * 100) : 0;
  const modeShare = [
    { name: "Режим A (база клиента)", value: projects.filter((p) => p.mode === "A").length },
    { name: "Режим B (собираем сами)", value: projects.filter((p) => p.mode === "B").length },
  ];
  const avgRecruitDays = projects.length
    ? Math.round(projects.reduce((s, p) => s + Math.max(0, daysBetween(p.start, todayISO())), 0) / projects.length)
    : 0;

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px", color: C.text }}>{title}</h3>
      {children}
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Аналитика</h2>

      {role !== "interviewer" && (
        <Section title="Продажи">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard label="Win rate" value={winRate + "%"} sub={won + " выиграно / " + lost + " проиграно"} accent={C.green} />
            <StatCard label="Пайплайн" value={fmtMoney(pipeline)} sub="в активных стадиях" />
            <StatCard label="Закрытая выручка" value={fmtMoney(closed)} accent={C.blue} />
            <StatCard label="Разборов-пари" value={demos} sub="всего проведено" />
          </div>
          <Panel>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Лиды по стадиям воронки</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byStage} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CK.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: CK.axis }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: CK.axis }} allowDecimals={false} />
                <Tooltip cursor={{ fill: CK.cursor }} contentStyle={{ background: CK.tipBg, border: "1px solid " + CK.tipBd, borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }} itemStyle={{ color: CK.text }} labelStyle={{ color: CK.sub }} />
                <Bar dataKey="Лиды" fill={CK.blue} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Section>
      )}

      {role !== "sales" && (
        <Section title="Рекрутинг и доставка">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard label="Интервью проведено" value={totalDone} accent={C.blue} />
            <StatCard label="Insight rate" value={insightRate + "%"} sub={withInsight + " с инсайтом"} accent={C.green} />
            <StatCard label="% неявок" value={noShowPct + "%"} accent={noShowPct > 20 ? C.red : C.text} />
            <StatCard label="Ср. дней на рекрутинг" value={avgRecruitDays} sub="по активным проектам" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Проведено интервью на интервьюера</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={perInterviewer} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CK.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: CK.axis }} />
                  <YAxis tick={{ fontSize: 11, fill: CK.axis }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: CK.cursor }} contentStyle={{ background: CK.tipBg, border: "1px solid " + CK.tipBd, borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }} itemStyle={{ color: CK.text }} labelStyle={{ color: CK.sub }} />
                  <Bar dataKey="Интервью" fill={CK.green} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Проекты: режим A vs B</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={modeShare} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={70} label>
                    {modeShare.map((e, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        </Section>
      )}
    </div>
  );
}

// ---------- Управление пользователями (admin) ----------
function UsersView({ users, onSave }) {
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: -0.5 }}>Пользователи</h2>
        <Btn onClick={() => setEdit({ id: uid("u"), name: "", role: "interviewer", telegram_id: "", email: "", active: true })}>+ Добавить</Btn>
      </div>
      <Panel pad={0} style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.panel }}>
            {["Имя", "Роль", "Telegram", "Email", "Статус", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 12, fontWeight: 700, color: C.muted }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid " + C.border }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13.5 }}>{u.name}</td>
                <td style={{ padding: "12px 16px" }}><Badge>{ROLES[u.role]}</Badge></td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: C.blueDark }}>{u.telegram_id}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>{u.email}</td>
                <td style={{ padding: "12px 16px" }}>
                  <Badge color={u.active ? C.green : C.faint} bg={u.active ? "#E7F6EE" : C.panel}>{u.active ? "активен" : "выключен"}</Badge>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}><Btn variant="ghost" size="sm" onClick={() => setEdit(u)}>Изменить</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {edit && <UserEdit user={edit} onClose={() => setEdit(null)} onSave={(u) => { onSave(u); setEdit(null); }} />}
    </div>
  );
}
function UserEdit({ user, onClose, onSave }) {
  const [u, setU] = useState({ ...user });
  const set = (k, v) => setU((p) => ({ ...p, [k]: v }));
  return (
    <Modal open onClose={onClose} width={460} title={user.name ? "Редактирование" : "Новый пользователь"}
      footer={<><Btn variant="ghost" onClick={onClose}>Отмена</Btn><Btn onClick={() => onSave(u)}>Сохранить</Btn></>}>
      <Field label="Имя"><Input value={u.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Роль"><Select value={u.role} options={Object.entries(ROLES).map(([v, l]) => ({ value: v, label: l }))} onChange={(e) => set("role", e.target.value)} /></Field>
      <Field label="Telegram ID" hint="на этот @username приходят напоминания"><Input value={u.telegram_id} onChange={(e) => set("telegram_id", e.target.value)} /></Field>
      <Field label="Email"><Input value={u.email} onChange={(e) => set("email", e.target.value)} /></Field>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={u.active} onChange={(e) => set("active", e.target.checked)} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Активен</span>
      </label>
    </Modal>
  );
}

// ---------- Настройки и интеграции (admin) ----------
const API_SCOPES = [
  { id: "inbound:leads", label: "Приём лидов (запись в CRM)" },
  { id: "inbound:contacts", label: "Приём контактов" },
  { id: "inbound:events", label: "Приём событий/действий" },
  { id: "outbound:leads", label: "Чтение лидов" },
  { id: "outbound:pipelines", label: "Чтение воронок и стадий" },
  { id: "outbound:users", label: "Чтение пользователей" },
  { id: "webhooks:subscribe", label: "Подписка на вебхуки (события CRM)" },
];

function IntegrationsPanel() {
  const [tokens, setTokens] = useState(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sel, setSel] = useState(() => new Set(["inbound:leads", "outbound:pipelines", "outbound:users"]));
  const [issued, setIssued] = useState(null); // показанный один раз токен
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const apiBase = (import.meta.env.VITE_SUPABASE_URL || "https://<project>.supabase.co") + "/functions/v1/crm-api";

  const load = async () => {
    try { setTokens(await integrations.listTokens()); setErr(""); }
    catch (e) { setErr("Не удалось загрузить токены. Выполните SQL 06_integrations.sql в Supabase. (" + e.message + ")"); setTokens([]); }
  };
  useEffect(() => { load(); }, []);

  const toggleScope = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const create = async () => {
    if (!name.trim() || !sel.size) return;
    setBusy(true);
    try {
      const tok = await integrations.createToken(name.trim(), [...sel]);
      setIssued(tok); setName(""); setCreating(false); await load();
    } catch (e) { setErr("Не удалось создать токен: " + e.message); }
    setBusy(false);
  };
  const revoke = async (id) => { if (!confirm("Отозвать токен? Сервис сразу потеряет доступ.")) return; await integrations.revokeToken(id); await load(); };
  const del = async (id) => { if (!confirm("Удалить токен из списка?")) return; await integrations.deleteToken(id); await load(); };
  const copy = async (text) => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
    } catch { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand("copy"); document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
    else alert("Не удалось скопировать автоматически. Выделите токен мышкой и нажмите Cmd+C.");
  };

  const fmt = (d) => d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <Panel style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Интеграции и API-токены</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>Подключение внешних сервисов (InsightLab, сайт-форма, любой API) к воронке.</div>
        </div>
        <Btn size="sm" onClick={() => { setCreating(true); setIssued(null); }}>+ Добавить токен</Btn>
      </div>

      <div style={{ fontSize: 12, color: C.muted, background: C.panel, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 12px", margin: "10px 0 16px", wordBreak: "break-all" }}>
        Базовый URL API: <b style={{ color: C.text }}>{apiBase}</b>
        <div style={{ marginTop: 4, color: C.faint }}>Пример: <code>POST {apiBase}/inbound/lead</code> с заголовком <code>Authorization: Bearer sk-crm-…</code></div>
      </div>

      {issued && (
        <div style={{ border: "1px solid " + C.green, background: "#E7F6EE", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.green, marginBottom: 6 }}>Токен создан — скопируйте сейчас, больше он не покажется:</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code onClick={(e) => { const r = document.createRange(); r.selectNodeContents(e.currentTarget); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }} style={{ flex: 1, minWidth: 0, fontSize: 13, background: "#fff", border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", wordBreak: "break-all", userSelect: "all", cursor: "text" }}>{issued}</code>
            <Btn size="sm" variant="soft" onClick={() => copy(issued)}>{copied ? "Скопировано ✓" : "Копировать"}</Btn>
          </div>
        </div>
      )}

      {err && <div style={{ fontSize: 12.5, color: C.red, marginBottom: 12 }}>{err}</div>}

      {tokens === null ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>Загрузка…</div>
      ) : tokens.length === 0 ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>Токенов пока нет. Создайте первый — и подключите внешний сервис.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tokens.map((t) => (
            <div key={t.id} style={{ border: "1px solid " + C.border, borderRadius: 10, padding: 12, opacity: t.revoked ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</span>
                    <code style={{ fontSize: 12, color: C.muted }}>{t.prefix}…</code>
                    {t.revoked
                      ? <Badge color={C.red} bg="#FBEAEA">отозван</Badge>
                      : <Badge color={C.green} bg="#E7F6EE">активен</Badge>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    {(t.scopes || []).map((s) => <Badge key={s} color={C.blueDark} bg={C.blueLight}>{s}</Badge>)}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7 }}>
                    Создан {fmt(t.created_at)} · Последний запрос: {fmt(t.last_used_at)} · Запросов: {t.request_count ?? 0}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!t.revoked && <Btn size="sm" variant="ghost" onClick={() => revoke(t.id)}>Отозвать</Btn>}
                  <Btn size="sm" variant="plain" onClick={() => del(t.id)}>Удалить</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Modal open onClose={() => setCreating(false)} width={480} title="Новый API-токен"
          footer={<><Btn variant="ghost" onClick={() => setCreating(false)}>Отмена</Btn><Btn onClick={create} disabled={busy || !name.trim() || !sel.size}>{busy ? "Создаём…" : "Создать токен"}</Btn></>}>
          <Field label="Название" hint="чтобы понимать, какой сервис подключён">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр. InsightLab Лидген" />
          </Field>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "8px 0 8px" }}>Права доступа (scopes)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {API_SCOPES.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
                <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggleScope(s.id)} />
                <span>{s.label} <code style={{ fontSize: 11.5, color: C.faint }}>{s.id}</code></span>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </Panel>
  );
}

const WEBHOOK_EVENTS = [
  { id: "lead.created", label: "Лид создан" },
  { id: "lead.stage_changed", label: "Лид сменил стадию" },
  { id: "lead.won", label: "Лид выигран" },
  { id: "lead.lost", label: "Лид проигран" },
  { id: "lead.assigned", label: "Сменился ответственный" },
  { id: "lead.updated", label: "Лид изменён" },
];

function WebhooksPanel() {
  const [subs, setSubs] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [evs, setEvs] = useState(() => new Set(["lead.created", "lead.stage_changed", "lead.won", "lead.lost"]));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setSubs(await integrations.listWebhooks());
      setDeliveries(await integrations.listDeliveries(20));
      setErr("");
    } catch (e) { setErr("Не удалось загрузить вебхуки. Выполните SQL 07_integrations_phase2.sql. (" + e.message + ")"); setSubs([]); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (id) => setEvs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const create = async () => {
    if (!url.trim() || !evs.size) return;
    setBusy(true);
    try { await integrations.createWebhook(url.trim(), [...evs], secret.trim()); setUrl(""); setSecret(""); setCreating(false); await load(); }
    catch (e) { setErr("Не удалось создать подписку: " + e.message); }
    setBusy(false);
  };
  const del = async (id) => { if (!confirm("Удалить подписку на вебхук?")) return; await integrations.deleteWebhook(id); await load(); };
  const fmt = (d) => d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <Panel style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Вебхуки (исходящие события)</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>CRM сама отправит POST на ваш URL при событиях лида. Подпись <code>X-CRM-Signature</code> (HMAC-SHA256).</div>
        </div>
        <Btn size="sm" onClick={() => setCreating(true)}>+ Добавить вебхук</Btn>
      </div>

      {err && <div style={{ fontSize: 12.5, color: C.red, margin: "8px 0" }}>{err}</div>}

      {subs === null ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>Загрузка…</div>
      ) : subs.length === 0 ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>Подписок пока нет. Добавьте URL — и CRM будет уведомлять его о событиях.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {subs.map((s) => (
            <div key={s.id} style={{ border: "1px solid " + C.border, borderRadius: 10, padding: 12, opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, wordBreak: "break-all" }}>{s.url}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    {(s.events || []).map((e) => <Badge key={e} color={C.blueDark} bg={C.blueLight}>{e}</Badge>)}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7 }}>Создан {fmt(s.created_at)}</div>
                </div>
                <Btn size="sm" variant="plain" onClick={() => del(s.id)}>Удалить</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {deliveries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Последние отправки</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {deliveries.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: C.faint, padding: "4px 0", borderBottom: "1px solid " + C.border, flexWrap: "wrap" }}>
                <span><Badge color={C.blueDark} bg={C.blueLight}>{d.event}</Badge> <span style={{ wordBreak: "break-all" }}>{d.webhook_subscriptions?.url || "—"}</span></span>
                <span>{fmt(d.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {creating && (
        <Modal open onClose={() => setCreating(false)} width={480} title="Новый вебхук"
          footer={<><Btn variant="ghost" onClick={() => setCreating(false)}>Отмена</Btn><Btn onClick={create} disabled={busy || !url.trim() || !evs.size}>{busy ? "Создаём…" : "Создать"}</Btn></>}>
          <Field label="URL получателя" hint="куда CRM будет слать POST">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/crm" />
          </Field>
          <Field label="Секрет для подписи (необязательно)" hint="им подписывается тело запроса (HMAC-SHA256)">
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="my-webhook-secret" />
          </Field>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "8px 0 8px" }}>События</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
                <input type="checkbox" checked={evs.has(e.id)} onChange={() => toggle(e.id)} />
                <span>{e.label} <code style={{ fontSize: 11.5, color: C.faint }}>{e.id}</code></span>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </Panel>
  );
}

function ApiLogPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = async () => {
    try { setRows(await integrations.listAudit(50)); setErr(""); }
    catch (e) { setErr("Не удалось загрузить журнал. (" + e.message + ")"); setRows([]); }
  };
  useEffect(() => { load(); }, []);
  const fmt = (d) => d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  const statusColor = (s) => s >= 500 ? C.red : s >= 400 ? "#B45309" : C.green;
  const statusBg = (s) => s >= 500 ? "#FBEAEA" : s >= 400 ? "#FEF3C7" : "#E7F6EE";

  return (
    <Panel style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Журнал запросов к API</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>Последние обращения внешних сервисов к вашему API.</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={load}>Обновить</Btn>
      </div>

      {err && <div style={{ fontSize: 12.5, color: C.red, margin: "8px 0" }}>{err}</div>}

      {rows === null ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>Загрузка…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "10px 0" }}>Запросов пока не было.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto auto", gap: 10, alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + C.border }}>
              <Badge color={statusColor(r.status)} bg={statusBg(r.status)}>{r.status}</Badge>
              <span style={{ fontWeight: 700, color: C.muted, minWidth: 44 }}>{r.method}</span>
              <code style={{ color: C.text, wordBreak: "break-all" }}>{r.path}</code>
              <span style={{ color: C.faint }}>{r.api_tokens?.name || "—"}</span>
              <span style={{ color: C.faint, whiteSpace: "nowrap" }}>{fmt(r.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SettingsView({ onReset, isAdmin }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 23, fontWeight: 700, letterSpacing: -0.5 }}>Настройки и интеграции</h2>
      {isAdmin && <IntegrationsPanel />}
      {isAdmin && <WebhooksPanel />}
      {isAdmin && <ApiLogPanel />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: isAdmin ? 16 : 0 }}>
        <Panel>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Telegram-бот</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>Напоминания о задачах, разборах и интервью.</div>
          <Field label="Bot token"><Input placeholder="123456:ABC-DEF…" /></Field>
          <Field label="Webhook / edge-функция"><Input placeholder="https://<project>.functions.supabase.co/tg-remind" /></Field>
          <Btn variant="soft">Проверить соединение</Btn>
        </Panel>
        <Panel>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Supabase (бэкенд)</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>Postgres + Auth + RLS + Storage для записей интервью.</div>
          <Field label="Project URL"><Input placeholder="https://xxxx.supabase.co" /></Field>
          <Field label="Anon key"><Input placeholder="eyJhbGciOi…" /></Field>
          <Btn variant="soft">Сохранить ключи</Btn>
        </Panel>
        <Panel>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Импорт результатов роботов</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>CSV-импорт респондентов с проставленными статусами — на вкладке «Импорт/Экспорт» каждого проекта.</div>
          <Badge color={C.green} bg="#E7F6EE">обычный CSV-импорт</Badge>
        </Panel>
        <Panel>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Данные демо</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>Сбросить все локальные данные и вернуть исходный seed.</div>
          <Btn variant="danger" onClick={onReset}>Сбросить демо-данные</Btn>
        </Panel>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION: app
// ============================================================================
// ============================================================================
// App — состояние, persist, маршрутизация по ролям и правам (3.1–3.2)
// ============================================================================

const PAGE = { background: "transparent", minHeight: "100vh", fontFamily: FONT, color: C.text, zoom: 0.8 };
const fontStyle = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; } body { margin: 0; }
  ::-webkit-scrollbar { height: 10px; width: 10px; } ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--c-border-strong); border-radius: 20px; border: 3px solid transparent; background-clip: padding-box; }`;

function CRMApp({ onSignOut }) {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [page, setPage] = useState("sales");

  // навигационное/модальное состояние
  const [openLead, setOpenLead] = useState(null);
  const [convertLead, setConvertLead] = useState(null);
  const [openResp, setOpenResp] = useState(null);
  const [activeProject, setActiveProject] = useState(null); // id (admin drill-in / interviewer per-project)
  const [interviewMode, setInterviewMode] = useState(null); // {respId}
  const [importKind, setImportKind] = useState(null); // {kind, projectId?}
  const [salesQuery, setSalesQuery] = useState("");        // visual: search leads
  const [salesActiveOnly, setSalesActiveOnly] = useState(false); // visual: Активные/Все
  const saveT = useRef(null);

  // загрузка
  useEffect(() => {
    let alive = true;
    loadState().then((saved) => {
      if (!alive || !saved) return;
      setDb(saved);
      setUserId(saved.__me || saved.users[0].id);
    });
    return () => { alive = false; };
  }, []);

  // персист (debounce)
  useEffect(() => {
    if (!db) return;
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(() => saveState(db), 400);
  }, [db]);

  if (!db || !userId) {
    return <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.faint }}>Загрузка InsightLab CRM…</div>
    </div>;
  }

  const user = db.users.find((u) => u.id === userId);
  const role = user.role;
  const isAdmin = role === "admin";

  const patch = (changes) => setDb((d) => ({ ...d, ...changes }));
  const upd = (key, id, fn) => setDb((d) => ({ ...d, [key]: d[key].map((x) => (x.id === id ? fn(x) : x)) }));

  // ---------- навигация по ролям ----------
  const NAV = {
    admin: [
      { id: "sales", label: "Продажи", },
      { id: "recruit", label: "Рекрутинг", },
      { id: "calendar", label: "Календарь", },
      { id: "analytics", label: "Аналитика", },
      { id: "users", label: "Пользователи", },
      { id: "settings", label: "Настройки", },
    ],
    sales: [
      { id: "sales", label: "Продажи", },
      { id: "calendar", label: "Календарь", },
      { id: "analytics", label: "Аналитика", },
    ],
    interviewer: [
      { id: "workspace", label: "Рабочее пространство", },
      { id: "calendar", label: "Календарь", },
      { id: "analytics", label: "Аналитика", },
    ],
  };
  const nav = NAV[role];
  const validPage = nav.some((n) => n.id === page) ? page : nav[0].id;

  const switchUser = (id) => {
    const u = db.users.find((x) => x.id === id);
    setUserId(id);
    setActiveProject(null); setOpenLead(null); setOpenResp(null);
    setPage(NAV[u.role][0].id);
  };

  // ---------- данные с учётом прав (3.2) ----------
  const visibleLeads = isAdmin ? db.leads : db.leads.filter((l) => l.owner === userId);
  // --- уведомления для колокольчика (живые события) ---
  const notifications = (() => {
    const today = todayISO();
    const mine = (o) => isAdmin || o === userId;
    const out = [];
    (db.leads || []).filter((l) => l.stage === "new" && mine(l.owner)).forEach((l) =>
      out.push({ id: "ln_" + l.id, kind: "lead", page: "sales", title: "Новый лид", sub: l.company || "Без названия" }));
    (db.leads || []).filter((l) => l.stage === "demo_set" && mine(l.owner)).forEach((l) =>
      out.push({ id: "ld_" + l.id, kind: "demo", page: "sales", title: "Разбор-пари назначен", sub: l.company || "Без названия" }));
    (db.tasks || []).filter((t) => !t.done && (t.when || "").slice(0, 10) === today && mine(t.owner)).forEach((t) =>
      out.push({ id: "lt_" + t.id, kind: t.type, page: "calendar", title: "Сегодня", sub: t.title }));
    return out;
  })();
  // визуальные фильтры воронки (поиск + Активные/Все) — не трогают данные
  const _lq = salesQuery.trim().toLowerCase();
  const displayLeads = visibleLeads.filter((l) => {
    if (salesActiveOnly && ["won", "lost"].includes(l.stage)) return false;
    if (!_lq) return true;
    return [l.company, l.contact, l.title, l.source].filter(Boolean).some((v) => String(v).toLowerCase().includes(_lq));
  });
  const visibleProjects = isAdmin ? db.projects
    : role === "interviewer" ? db.projects.filter((p) => p.interviewers.includes(userId))
    : [];
  const projectById = (id) => db.projects.find((p) => p.id === id);

  // ---------- действия: лиды ----------
  const moveLead = (id, stage) => {
    upd("leads", id, (l) => ({ ...l, stage, history: [...(l.history || []), { id: uid("act"), type: "task", title: "Перемещён → " + (SALES_STAGES.find((s) => s.id === stage)?.title), when: nowISO(), done: true, owner: l.owner }] }));
    if (stage === "won") { const l = db.leads.find((x) => x.id === id); if (l) setConvertLead({ ...l, stage }); }
  };
  const saveLead = (l) => db.leads.some((x) => x.id === l.id) ? upd("leads", l.id, () => l) : patch({ leads: [...db.leads, l] });
  const deleteLeads = (ids) => { const s = new Set(ids); patch({ leads: db.leads.filter((l) => !s.has(l.id)) }); };
  const createProjectFromLead = (lead, form) => {
    const proj = {
      id: uid("proj"), client: form.client, pkg: form.pkg, price: form.price,
      start: todayISO(), deadline: form.deadline, interviewers: form.interviewers,
      mode: form.mode, status: "active", planInterviews: form.planInterviews,
      script: { id: uid("scr"), name: "Скрипт: " + form.client, blocks: [] },
    };
    patch({ projects: [...db.projects, proj] });
    upd("leads", lead.id, (l) => ({ ...l, stage: "won" }));
    setConvertLead(null); setOpenLead(null);
  };

  // ---------- действия: респонденты ----------
  const moveResp = (id, stage) => {
    upd("respondents", id, (r) => {
      const next = { ...r, stage };
      if (stage === "done") next.interviewStatus = "Проведено";
      if (stage === "insight") { next.interviewStatus = "Проведено"; next.insight = true; }
      if (stage === "no_show") next.interviewStatus = "Неявка";
      if (stage === "refused") next.interviewStatus = "Отказ";
      return next;
    });
  };
  const saveResp = (r) => upd("respondents", r.id, () => r);
  const deleteResps = (ids) => { const s = new Set(ids); patch({ respondents: db.respondents.filter((r) => !s.has(r.id)) }); };
  // удалить проект целиком (вместе с его респондентами; заметки удалит каскад БД)
  const deleteProject = (id) => {
    patch({
      projects: db.projects.filter((p) => p.id !== id),
      respondents: db.respondents.filter((r) => r.project !== id),
    });
  };
  const saveScript = (projectId, script) => upd("projects", projectId, (p) => ({ ...p, script }));

  // ---------- интервью: заметки + завершение ----------
  const saveNote = (respId, blockId, text) => setDb((d) => ({
    ...d, notes: { ...d.notes, [respId]: { ...(d.notes?.[respId] || {}), [blockId]: text } },
  }));
  const finishInterview = (respId, keyInsight, insightFlag) => {
    upd("respondents", respId, (r) => ({
      ...r, stage: insightFlag ? "insight" : "done",
      interviewStatus: "Проведено", keyInsight, insight: insightFlag,
    }));
    setInterviewMode(null); setOpenResp(null);
  };

  // ---------- импорт ----------
  const doImport = (items, projId) => {
    if (importKind.kind === "lead") {
      patch({ leads: [...db.leads, ...items.map((it) => ({
        id: uid("lead"), company: it.company || "—", contact: it.contact || "", title: it.title || "",
        phone: it.phone || "", email: it.email || "", source: SOURCES.includes(it.source) ? it.source : "Робот",
        stage: "new", owner: userId, nextTouch: todayISO(), amount: 0, notes: it.notes || "", history: [],
        bin: it.bin || "", city: it.city || "", employees: it.employees || "",
        linkedin: it.linkedin || "", linkedinCompany: it.linkedinCompany || "",
        whatsapp: it.whatsapp || "", telegram: it.telegram || "",
        instagram: it.instagram || "", website: it.website || "",
      }))] });
    } else {
      const pid = projId || importKind.projectId;
      patch({ respondents: [...db.respondents, ...items.map((it) => ({
        id: uid("resp"), name: it.name || "—", phone: it.phone || "", project: pid,
        screenStatus: it.screenStatus || "—", qualified: false, slot: null,
        interviewStatus: it.interviewStatus || "—", reward: it.reward || "Нет",
        insight: false, keyInsight: "", recording: "", stage: "loaded", owner: userId, notes: it.notes || "",
      }))] });
    }
  };

  const reset = async () => {
    if (!confirm("Перезагрузить данные из базы?")) return;
    const fresh = await loadState();
    if (fresh) { setDb(fresh); setUserId(fresh.__me || fresh.users[0].id); }
    setActiveProject(null); setPage("settings");
  };

  // экспорт лидов
  const exportLeads = (fmt) => exportRows(visibleLeads, [
    { label: "Компания", get: (l) => l.company }, { label: "Контакт", get: (l) => l.contact },
    { label: "Должность", get: (l) => l.title }, { label: "Телефон", get: (l) => l.phone },
    { label: "Email", get: (l) => l.email }, { label: "Источник", get: (l) => l.source },
    { label: "Стадия", get: (l) => SALES_STAGES.find((s) => s.id === l.stage)?.title },
    { label: "Сумма", get: (l) => l.amount }, { label: "Заметки", get: (l) => l.notes },
  ], "leads_insightlab", fmt);

  // ---------- карточка лида в канбане ----------
  const leadCard = (l, ds) => {
    const won = l.stage === "won", lost = l.stage === "lost";
    const accent = won ? C.green : lost ? C.red : C.blue;
    const hot = l.nextTouch && l.nextTouch <= todayISO() && !won && !lost;
    const touchLabel = !l.nextTouch ? "Без касания" : (l.nextTouch === todayISO() ? "Сегодня" : "касание " + fmtDate(l.nextTouch));
    return (
    <KanbanCard key={l.id} onDragStart={ds} onClick={() => setOpenLead(l)} accent={accent}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, color: C.text }}>{l.company}</div>
        <button className="lead-more" onClick={(e) => { e.stopPropagation(); setOpenLead(l); }}
          title="Открыть" style={{
            flexShrink: 0, width: 26, height: 26, marginTop: -2, marginRight: -2, borderRadius: "50%",
            border: "1px solid " + C.border, background: C.surface, color: C.muted, cursor: "pointer",
            display: "grid", placeItems: "center", opacity: 0, transition: "opacity .15s, background .15s",
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
        </button>
      </div>
      {(l.contact || l.title) && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.35 }}>{[l.contact, l.title].filter(Boolean).join(" · ")}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, background: "var(--g-col)", border: "1px solid var(--g-col-border)", padding: "2px 8px", borderRadius: 999 }}>{l.source}</span>
        {hot && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: C.amber }}><Flame size={12} strokeWidth={2} /> Горячий</span>}
        <span style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(l.amount)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 11.5, fontWeight: 600, color: won ? C.green : accent }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
        {touchLabel}
      </div>
    </KanbanCard>
    );
  };

  // ====================== Рендер страниц ======================
  let content = null;

  if (validPage === "sales") {
    const _act = visibleLeads.filter((l) => !["won", "lost"].includes(l.stage));
    const _won = visibleLeads.filter((l) => l.stage === "won");
    const _lost = visibleLeads.filter((l) => l.stage === "lost");
    const _winRate = _won.length + _lost.length ? Math.round((_won.length / (_won.length + _lost.length)) * 100) : 0;
    const _pipeline = _act.reduce((s, l) => s + (l.amount || 0), 0);
    const _revenue = _won.reduce((s, l) => s + (l.amount || 0), 0);
    const _avg = _won.length ? Math.round(_revenue / _won.length) : (_act.length ? Math.round(_pipeline / _act.length) : 0);
    const mln = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + " млн ₸" : fmtMoney(n);
    const stageColor = (id) => ({ new: C.faint, in_work: C.indigo, demo_set: C.indigo, demo_done: C.blue, kp_sent: C.amber, negotiation: C.amber, won: C.green, lost: C.red }[id] || C.blue);
    const Kpi = ({ label, value, accent, sub, grad }) => (
      <div className="glass-card" style={{ flex: 1, minWidth: 0, padding: "20px 22px", ...(grad ? { background: "linear-gradient(150deg, color-mix(in srgb, " + C.blue + " 14%, var(--g-card)), var(--g-card))" } : null) }}>
        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent || C.text, letterSpacing: -0.6, lineHeight: 1, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        {sub && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, fontSize: 12, fontWeight: 600, color: C.muted }}>
          <span style={{ width: 7, height: 7, borderRadius: 7, background: accent || C.muted }} />{sub}</div>}
      </div>
    );
    content = (
      <>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: -0.9, color: C.text }}>Продажи</h2>
            <div style={{ fontSize: 14.5, color: C.muted, marginTop: 6 }}>Воронка лидов · {_act.length} активных сделок на {mln(_pipeline)}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="seg-toggle">
              <button className={salesActiveOnly ? "on" : ""} onClick={() => setSalesActiveOnly(true)}>Активные</button>
              <button className={!salesActiveOnly ? "on" : ""} onClick={() => setSalesActiveOnly(false)}>Все</button>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => exportLeads("csv")}>↓ CSV</Btn>
            <Btn variant="ghost" size="sm" onClick={() => exportLeads("xlsx")}>↓ XLSX</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setImportKind({ kind: "lead" })}>↑ Импорт</Btn>
            <Btn onClick={() => setOpenLead({ id: uid("lead"), company: "", contact: "", title: "", phone: "", email: "", source: "LinkedIn", stage: "new", owner: userId, nextTouch: todayISO(), amount: 0, notes: "", history: [] })}>+ Лид</Btn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 26, flexWrap: "wrap" }}>
          <Kpi label="Win-rate" value={_winRate + "%"} accent={C.green} sub={_won.length + " выиграно / " + _lost.length + " проиграно"} />
          <Kpi label="Пайплайн" value={mln(_pipeline)} sub={_act.length + " активных"} />
          <Kpi label="Выручка" value={mln(_revenue)} accent={C.indigo} sub={_won.length + " закрыто"} />
          <Kpi label="Средний чек" value={mln(_avg)} sub="по сделкам" grad />
        </div>
        </div>
        <KanbanBoard stages={SALES_STAGES} items={displayLeads} getStage={(l) => l.stage} renderCard={leadCard} onMove={moveLead}
          dotColor={stageColor} onDelete={deleteLeads}
          onAddToStage={(stage) => setOpenLead({ id: uid("lead"), company: "", contact: "", title: "", phone: "", email: "", source: "LinkedIn", stage, owner: userId, nextTouch: todayISO(), amount: 0, notes: "", history: [] })} />
      </>
    );
  }

  else if (validPage === "recruit") { // admin
    if (activeProject) {
      const p = projectById(activeProject);
      content = <ProjectView project={p} users={db.users} respondents={db.respondents}
        canEditScript={true} canConduct={true}
        onMoveResp={moveResp} onOpenResp={setOpenResp} onDeleteResp={deleteResps}
        onSaveScript={(s) => saveScript(p.id, s)} onBack={() => setActiveProject(null)} />;
    } else {
      content = (
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <PageHead title="Рекрутинг" sub="Все проекты доставки">
            <Btn variant="ghost" size="sm" onClick={() => setImportKind({ kind: "resp", projectId: db.projects[0]?.id })}>↑ Импорт респондентов</Btn>
          </PageHead>
          <ProjectsGrid projects={visibleProjects} users={db.users} respondents={db.respondents} onOpen={setActiveProject} onDelete={isAdmin ? deleteProject : undefined} />
        </div>
      );
    }
  }

  else if (validPage === "workspace") { // interviewer
    if (activeProject) {
      const p = projectById(activeProject);
      content = (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => setImportKind({ kind: "resp", projectId: p.id })}>↑ Импорт респондентов</Btn>
          </div>
          <ProjectView project={p} users={db.users} respondents={db.respondents}
            canEditScript={false} canConduct={true}
            onMoveResp={moveResp} onOpenResp={setOpenResp} onDeleteResp={deleteResps}
            onSaveScript={(s) => saveScript(p.id, s)} onBack={() => setActiveProject(null)} />
        </>
      );
    } else {
      content = <InterviewerHome user={user} projects={db.projects} respondents={db.respondents} tasks={db.tasks}
        onOpenProject={(id) => setActiveProject(id)} onOpenResp={setOpenResp} />;
    }
  }

  else if (validPage === "calendar") {
    content = <CalendarView user={user} tasks={db.tasks} respondents={db.respondents} leads={db.leads}
      reminders={db.reminders} isAdmin={isAdmin}
      onToggleReminder={(id) => upd("reminders", id, (r) => ({ ...r, sent: true }))} />;
  }

  else if (validPage === "analytics") {
    content = <Analytics role={role} user={user} leads={db.leads} projects={db.projects} respondents={db.respondents} users={db.users} />;
  }

  else if (validPage === "users") content = <UsersView users={db.users} onSave={saveLeadUser} />;
  else if (validPage === "settings") content = <SettingsView onReset={reset} isAdmin={isAdmin} />;

  function saveLeadUser(u) {
    db.users.some((x) => x.id === u.id) ? upd("users", u.id, () => u) : patch({ users: [...db.users, u] });
  }

  // активное интервью (полноэкранный слайдер)
  const interviewResp = interviewMode && db.respondents.find((r) => r.id === interviewMode.respId);
  const interviewProject = interviewResp && projectById(interviewResp.project);

  return (
    <div style={PAGE}>
      <style>{fontStyle}</style>
      <button onClick={onSignOut} title="Выйти"
        style={{ position: "fixed", top: 14, right: 18, zIndex: 50, border: "1px solid " + C.border,
          background: C.surface, color: C.muted, borderRadius: 8, padding: "6px 12px",
          fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Выйти
      </button>
      <Header user={user} users={isAdmin ? db.users : [user]} onSwitchUser={switchUser} nav={nav} current={validPage} onNav={(p) => { setPage(p); setActiveProject(null); }} query={salesQuery} setQuery={setSalesQuery} notifications={notifications} onSignOut={onSignOut} />
      <main style={{ maxWidth: ["sales", "recruit"].includes(validPage) ? "100%" : 1280, margin: "0 auto", padding: "26px 24px 80px" }}>{content}</main>

      {/* Модалки */}
      {openLead && (
        <LeadDetail lead={openLead} users={db.users} allLeads={db.leads}
          canEdit={isAdmin || (role === "sales" && (openLead.owner === userId || !db.leads.some((x) => x.id === openLead.id)))}
          onSave={saveLead} onClose={() => setOpenLead(null)}
          onPick={(l) => setOpenLead(l)}
          onConvert={(l) => { setOpenLead(null); setConvertLead(l); }} />
      )}
      {convertLead && (
        <ConvertModal lead={convertLead} users={db.users} onClose={() => setConvertLead(null)}
          onCreate={(form) => createProjectFromLead(convertLead, form)} />
      )}
      {openResp && (
        <RespondentDetail resp={openResp} project={projectById(openResp.project)} users={db.users}
          canEdit={isAdmin || openResp.owner === userId}
          onSave={saveResp} onClose={() => setOpenResp(null)}
          onStartInterview={(r) => { setOpenResp(null); setInterviewMode({ respId: r.id }); }} />
      )}
      {importKind && (
        <ImportExportModal kind={importKind.kind} projectId={importKind.projectId} projects={db.projects}
          existing={importKind.kind === "lead" ? db.leads : db.respondents}
          onClose={() => setImportKind(null)} onImport={doImport} />
      )}
      {interviewResp && interviewProject && (
        <InterviewSlider respondent={interviewResp} project={interviewProject}
          initialNotes={db.notes?.[interviewResp.id] || {}}
          onSaveNote={saveNote} onFinish={finishInterview} onClose={() => setInterviewMode(null)} />
      )}
    </div>
  );
}

// ---------- мелкие хелперы рендера ----------
function PageHead({ title, sub, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: -0.5, color: C.text }}>{title}</h2>
        {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>
    </div>
  );
}

function ProjectsGrid({ projects, users, respondents, onOpen, onDelete }) {
  if (!projects.length) return <EmptyState icon={<FolderOpen size={24} strokeWidth={1.6} />} title="Проектов нет" text="Выиграйте лид в воронке продаж — создастся проект." />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
      {projects.map((p) => {
        const pr = respondents.filter((r) => r.project === p.id);
        const done = pr.filter((r) => r.stage === "done" || r.stage === "insight").length;
        const pct = p.planInterviews ? Math.round((done / p.planInterviews) * 100) : 0;
        const ints = users.filter((u) => p.interviewers.includes(u.id)).map((u) => u.name.split(" ")[0]).join(", ");
        return (
          <Panel key={p.id} style={{ cursor: "pointer" }} >
            <div onClick={() => onOpen(p.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{p.client}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Badge>{p.pkg}</Badge>
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить проект «${p.client}»?\n\nБудут безвозвратно удалены сам проект и все его респонденты (${pr.length} шт.) вместе с заметками. Это действие нельзя отменить.`)) onDelete(p.id); }}
                      title="Удалить проект"
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = C.red; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = C.faint; e.currentTarget.style.borderColor = C.border; }}
                      style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid " + C.border, background: C.surface, borderRadius: 8, cursor: "pointer", color: C.faint, padding: 0, transition: "color .15s, border-color .15s" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                <Badge color={p.mode === "A" ? C.blueDark : C.amber} bg={p.mode === "A" ? C.blueLight : "#FFF6E9"}>Режим {p.mode}</Badge>
                <Badge color={C.muted} bg={C.panel}>до {fmtDate(p.deadline)}</Badge>
              </div>
              <div style={{ height: 8, background: C.panel, borderRadius: 20, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: pct + "%", height: "100%", background: C.blue }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.faint }}>
                <span>{done} / {p.planInterviews} интервью</span><span>{pct}%</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Интервьюеры: {ints || "—"}</div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

// ============================================================================
// Авторизация: пока нет сессии — показываем экран входа; после входа — CRM.
// ============================================================================
function AppInner() {
  const [session, setSession] = useState(undefined); // undefined = проверяем
  const [ctx, setCtx] = useState(undefined);         // контекст: профиль+компания+подписка

  useEffect(() => {
    auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = auth.onChange((s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // после входа грузим контекст (компания, подписка)
  useEffect(() => {
    if (!session) { setCtx(undefined); return; }
    let alive = true;
    loadContext().then((c) => { if (alive) setCtx(c); });
    return () => { alive = false; };
  }, [session]);

  const loadingScreen = (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT, color: C.faint }}>
      Загрузка…
    </div>
  );

  if (session === undefined) return loadingScreen;
  if (!session) return <Login />;
  if (ctx === undefined) return loadingScreen;       // ждём контекст
  if (ctx && ctx.isSuperadmin) return <SuperAdmin onSignOut={() => auth.signOut()} />;
  if (ctx && ctx.blocked) return <Blocked reason={ctx.reason} />;
  return <CRMApp key={session.user.id} onSignOut={() => auth.signOut()} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}