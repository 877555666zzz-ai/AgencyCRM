// ============================================================================
// api.js — мультитенантная версия (NEWPJ). ШАГ A.
// Вход + профиль + компания + проверка подписки.
// loadDb грузит текущего пользователя (чтобы CRMApp не падал).
// Остальные данные (лиды/проекты/стадии) подключим следующим шагом.
// ============================================================================
import { supabase } from "./supabase";

// ---------- авторизация ----------
export const auth = {
  getSession: () => supabase.auth.getSession(),
  onChange: (cb) => supabase.auth.onAuthStateChange((_e, session) => cb(session)),
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signUp: (email, password, name) =>
    supabase.auth.signUp({ email, password, options: { data: { name } } }),
  signOut: () => supabase.auth.signOut(),
};

// ---------- контекст пользователя: профиль + компания + подписка ----------
// { profile, company, blocked, reason, isSuperadmin } | null
export async function loadContext() {
  const { data: au } = await supabase.auth.getUser();
  const authUser = au?.user;
  if (!authUser) return null;

  const { data: profile, error: pErr } = await supabase
    .from("profiles").select("*").eq("id", authUser.id).single();

  if (pErr || !profile) {
    return { profile: null, company: null, blocked: false, reason: "no-profile", authUser };
  }

  if (profile.role === "superadmin") {
    return { profile, company: null, blocked: false, reason: null, authUser, isSuperadmin: true };
  }

  if (!profile.company_id) {
    return { profile, company: null, blocked: true, reason: "no-company", authUser };
  }

  const { data: company } = await supabase
    .from("companies").select("*").eq("id", profile.company_id).single();

  if (!company) {
    return { profile, company: null, blocked: true, reason: "no-company", authUser };
  }

  let blocked = false, reason = null;
  if (!company.active) { blocked = true; reason = "inactive"; }
  else if (company.subscription_until) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const until = new Date(company.subscription_until);
    if (until < today) { blocked = true; reason = "expired"; }
  }

  return { profile, company, blocked, reason, authUser, isSuperadmin: false };
}

// ============================================================================
// loadDb — ШАГ A: грузим только текущего пользователя в users.
// Роль маппим в старые значения, чтобы навигация CRMApp работала:
//   superadmin/admin -> admin (видит все разделы)
//   остальные -> sales
// Лиды/проекты/прочее пока пустые (подключим в Шаге B).
// ============================================================================
export async function loadDb() {
  const { data: au } = await supabase.auth.getUser();
  const authUser = au?.user;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", authUser.id).single();

  // маппинг новой роли в старую систему навигации InsightLab
  const mapRole = (r) => {
    if (r === "superadmin" || r === "admin") return "admin";
    if (r === "manager") return "sales";
    return "sales";
  };

  const me = profile ? {
    id: profile.id,
    name: profile.name || profile.email || "Пользователь",
    role: mapRole(profile.role),
    telegram_id: "",
    email: profile.email || "",
    active: profile.active !== false,
  } : {
    id: authUser.id, name: authUser.email || "Пользователь",
    role: "admin", telegram_id: "", email: authUser.email || "", active: true,
  };

  return {
    users: [me],
    leads: [], projects: [], respondents: [],
    notes: {}, tasks: [], reminders: [],
    __me: me.id,
  };
}

export async function persistDb(_next, _prev) {
  // Шаг A: запись отключена. Подключим в Шаге B.
}

export async function resetDb() { /* noop */ }

// integrations — заглушки (раздел «Интеграции» не должен падать)
export const integrations = {
  listTokens: async () => [],
  createToken: async () => { throw new Error("Интеграции подключим на следующем шаге"); },
  revokeToken: async () => {},
  deleteToken: async () => {},
  listWebhooks: async () => [],
  createWebhook: async () => { throw new Error("Интеграции подключим на следующем шаге"); },
  deleteWebhook: async () => {},
  listAudit: async () => [],
  listDeliveries: async () => [],
};