// ============================================================================
// api.js — слой доступа к данным.
// Главная идея: приложение продолжает работать с тем же объектом `db`
// ({ users, leads, projects, respondents, notes, tasks, reminders }), что и в
// демо-версии. Здесь мы только:
//   • loadDb()    — собираем этот объект из Supabase (RLS уже отфильтрует доступ)
//   • persistDb() — сравниваем с прошлым состоянием и пишем изменения в БД
//   • auth-хелперы — вход/регистрация/сессия
// Поэтому весь UI и бизнес-логика приложения остаются нетронутыми.
// ============================================================================
import { supabase } from "./supabase";

// ---------- мапперы: строка БД (snake_case) <-> объект приложения (camelCase) ----------
const fromLead = (r) => ({
  id: r.id, company: r.company, contact: r.contact, title: r.title, phone: r.phone,
  email: r.email, source: r.source, stage: r.stage, owner: r.owner,
  nextTouch: r.next_touch, amount: Number(r.amount) || 0, notes: r.notes || "",
  history: r.history || [],
  bin: r.bin || "", city: r.city || "", employees: r.employees || "",
  linkedin: r.linkedin || "", linkedinCompany: r.linkedin_company || "",
  whatsapp: r.whatsapp || "", telegram: r.telegram || "",
  instagram: r.instagram || "", website: r.website || "",
});
const toLead = (l) => ({
  id: l.id, company: l.company, contact: l.contact, title: l.title, phone: l.phone,
  email: l.email, source: l.source, stage: l.stage, owner: l.owner,
  next_touch: l.nextTouch || null, amount: l.amount || 0, notes: l.notes || "",
  history: l.history || [],
  bin: l.bin || null, city: l.city || null, employees: l.employees || null,
  linkedin: l.linkedin || null, linkedin_company: l.linkedinCompany || null,
  whatsapp: l.whatsapp || null, telegram: l.telegram || null,
  instagram: l.instagram || null, website: l.website || null,
});

const fromProject = (r) => ({
  id: r.id, client: r.client, pkg: r.pkg, price: Number(r.price) || 0, start: r.start,
  deadline: r.deadline, interviewers: r.interviewers || [], mode: r.mode, status: r.status,
  planInterviews: r.plan_interviews || 0, script: r.script || null,
});
const toProject = (p) => ({
  id: p.id, client: p.client, pkg: p.pkg, price: p.price || 0, start: p.start || null,
  deadline: p.deadline || null, interviewers: p.interviewers || [], mode: p.mode,
  status: p.status, plan_interviews: p.planInterviews || 0, script: p.script || null,
});

const fromResp = (r) => ({
  id: r.id, name: r.name, phone: r.phone, project: r.project, screenStatus: r.screen_status,
  qualified: !!r.qualified, slot: r.slot, interviewStatus: r.interview_status, reward: r.reward,
  insight: !!r.insight, keyInsight: r.key_insight || "", recording: r.recording || "",
  stage: r.stage, owner: r.owner, notes: r.notes || "",
});
const toResp = (r) => ({
  id: r.id, name: r.name, phone: r.phone, project: r.project, screen_status: r.screenStatus,
  qualified: !!r.qualified, slot: r.slot || null, interview_status: r.interviewStatus,
  reward: r.reward, insight: !!r.insight, key_insight: r.keyInsight || "",
  recording: r.recording || "", stage: r.stage, owner: r.owner, notes: r.notes || "",
});

const fromTask = (r) => ({ id: r.id, type: r.type, title: r.title, when: r.when_at, done: !!r.done, owner: r.owner });
const toTask = (t) => ({ id: t.id, type: t.type, title: t.title, when_at: t.when || null, done: !!t.done, owner: t.owner });

// ---------- сборка db из Supabase ----------
export async function loadDb() {
  const { data: au } = await supabase.auth.getUser();
  const authUser = au?.user;
  if (!authUser) return null;

  const [profiles, leads, projects, respondents, notesRows, tasks, reminders] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("leads").select("*").order("created_at"),
    supabase.from("projects").select("*").order("created_at"),
    supabase.from("respondents").select("*").order("created_at"),
    supabase.from("notes").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("reminders").select("*"),
  ]);

  const users = (profiles.data || []).map((p) => ({
    id: p.id, name: p.name, role: p.role, telegram_id: p.telegram_id || "",
    email: p.email || "", active: p.active,
  }));
  const tgById = new Map(users.map((u) => [u.id, u.telegram_id]));

  const notes = {};
  (notesRows.data || []).forEach((n) => { notes[n.respondent_id] = n.data || {}; });

  const db = {
    users,
    leads: (leads.data || []).map(fromLead),
    projects: (projects.data || []).map(fromProject),
    respondents: (respondents.data || []).map(fromResp),
    notes,
    tasks: (tasks.data || []).map(fromTask),
    reminders: (reminders.data || []).map((r) => ({
      id: r.id, type: r.type, title: r.title, to: tgById.get(r.owner) || "",
      when: r.when_at, sent: !!r.sent, owner: r.owner,
    })),
    __me: authUser.id, // id текущего профиля — приложение выставит его как userId
  };
  return db;
}

// ---------- запись изменений (диф со старым состоянием) ----------
function diff(prev, next, key = "id") {
  const prevMap = new Map((prev || []).map((x) => [x[key], x]));
  const nextMap = new Map((next || []).map((x) => [x[key], x]));
  const upserts = [], deletes = [];
  for (const [id, item] of nextMap) {
    const before = prevMap.get(id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) upserts.push(item);
  }
  for (const id of prevMap.keys()) if (!nextMap.has(id)) deletes.push(id);
  return { upserts, deletes };
}

async function syncTable(table, prev, next, toRow) {
  const { upserts, deletes } = diff(prev, next);
  if (upserts.length) {
    const { error } = await supabase.from(table).upsert(upserts.map(toRow));
    if (error) console.warn(`[persist] upsert ${table}:`, error.message);
  }
  if (deletes.length) {
    const { error } = await supabase.from(table).delete().in("id", deletes);
    if (error) console.warn(`[persist] delete ${table}:`, error.message);
  }
}

export async function persistDb(next, prev) {
  if (!prev) return; // первая загрузка — писать нечего
  await syncTable("leads", prev.leads, next.leads, toLead);
  await syncTable("projects", prev.projects, next.projects, toProject);
  await syncTable("respondents", prev.respondents, next.respondents, toResp);
  await syncTable("tasks", prev.tasks, next.tasks, toTask);

  // reminders: пишем только sent/owner-поля (создаёт их генератор в БД)
  await syncTable("reminders", prev.reminders, next.reminders, (r) => ({
    id: r.id, type: r.type, title: r.title, when_at: r.when || null,
    sent: !!r.sent, owner: r.owner, kind: r.kind || "1h",
  }));

  // profiles: только обновление существующих (новые логины создаются регистрацией)
  const existing = new Set((prev.users || []).map((u) => u.id));
  const changedUsers = (next.users || []).filter((u) => {
    const before = (prev.users || []).find((x) => x.id === u.id);
    return existing.has(u.id) && (!before || JSON.stringify(before) !== JSON.stringify(u));
  });
  if (changedUsers.length) {
    const { error } = await supabase.from("profiles").upsert(changedUsers.map((u) => ({
      id: u.id, name: u.name, role: u.role, telegram_id: u.telegram_id || null,
      email: u.email || null, active: u.active,
    })));
    if (error) console.warn("[persist] upsert profiles:", error.message);
  }

  // notes: объект { respId: { blockId: text } }
  const prevNotes = prev.notes || {}, nextNotes = next.notes || {};
  const noteUpserts = [];
  for (const rid of Object.keys(nextNotes)) {
    if (JSON.stringify(prevNotes[rid]) !== JSON.stringify(nextNotes[rid])) {
      noteUpserts.push({ respondent_id: rid, data: nextNotes[rid] });
    }
  }
  if (noteUpserts.length) {
    const { error } = await supabase.from("notes").upsert(noteUpserts);
    if (error) console.warn("[persist] upsert notes:", error.message);
  }
}

// resetStorage больше не нужен в проде; оставлено для совместимости вызова.
export async function resetDb() { /* в проде сброс делает админ через SQL */ }

// ---------- авторизация ----------
export const auth = {
  getSession: () => supabase.auth.getSession(),
  onChange: (cb) => supabase.auth.onAuthStateChange((_e, session) => cb(session)),
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signUp: (email, password, name) =>
    supabase.auth.signUp({ email, password, options: { data: { name } } }),
  signOut: () => supabase.auth.signOut(),
};

// ---------- интеграции: API-токены (ТЗ «Двусторонний коннектор») ----------
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const integrations = {
  // список токенов (без самого секрета — его нет в БД, только хеш)
  listTokens: async () => {
    const { data, error } = await supabase.from("api_tokens")
      .select("id, name, prefix, scopes, created_at, last_used_at, request_count, revoked, expires_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  // создать токен: генерим sk-crm-<40hex>, в БД пишем только SHA-256-хеш, возвращаем полный токен ОДИН раз
  createToken: async (name, scopes) => {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const rand = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const token = "sk-crm-" + rand;
    const token_hash = await sha256hex(token);
    const { error } = await supabase.from("api_tokens").insert({ name, prefix: token.slice(0, 14), token_hash, scopes });
    if (error) throw error;
    return token;
  },
  revokeToken: async (id) => {
    const { error } = await supabase.from("api_tokens").update({ revoked: true }).eq("id", id);
    if (error) throw error;
  },
  deleteToken: async (id) => {
    const { error } = await supabase.from("api_tokens").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- вебхуки (подписки на события CRM) ----
  listWebhooks: async () => {
    const { data, error } = await supabase.from("webhook_subscriptions")
      .select("id, url, events, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  createWebhook: async (url, events, secret) => {
    const { error } = await supabase.from("webhook_subscriptions")
      .insert({ url, events, secret: secret || null, active: true });
    if (error) throw error;
  },
  deleteWebhook: async (id) => {
    const { error } = await supabase.from("webhook_subscriptions").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- журнал запросов к API (audit log) ----
  listAudit: async (limit = 50) => {
    const { data, error } = await supabase.from("api_audit_log")
      .select("id, method, path, status, ip, created_at, api_tokens(name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ---- журнал доставки вебхуков ----
  listDeliveries: async (limit = 50) => {
    const { data, error } = await supabase.from("webhook_deliveries")
      .select("id, event, created_at, webhook_subscriptions(url)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};