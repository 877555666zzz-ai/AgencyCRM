// ============================================================================
// api.js — мультитенантная версия (NEWPJ). ШАГ A.
// Вход + профиль + компания + проверка подписки.
// loadDb/persistDb/integrations пока ЗАГЛУШКИ (чтобы старый CRMApp не падал).
// Реальную загрузку данных под новую схему подключим следующим шагом.
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

  // суперадмин — без компании, доступ всегда
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
// ЗАГЛУШКИ совместимости со старым CRMApp (Шаг A).
// Возвращают пустые данные, чтобы интерфейс не падал.
// На следующем шаге заменим на реальную загрузку под новую схему.
// ============================================================================
const EMPTY_DB = {
  users: [], leads: [], projects: [], respondents: [],
  notes: {}, tasks: [], reminders: [], __me: null,
};

export async function loadDb() {
  const { data: au } = await supabase.auth.getUser();
  if (!au?.user) return null;
  return { ...EMPTY_DB, __me: au.user.id };
}

export async function persistDb(_next, _prev) {
  // Шаг A: запись отключена (схема ещё не подключена). Ничего не делаем.
}

export async function resetDb() { /* noop */ }

// integrations — заглушки (старый раздел «Интеграции» не должен падать)
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