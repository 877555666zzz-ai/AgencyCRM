// ============================================================================
// api.js — мультитенантная версия (NEWPJ). ШАГ B.
// Вход + подписка + загрузка СТАДИЙ и ЛИДОВ компании + сохранение.
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

// ---------- контекст: профиль + компания + подписка ----------
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
    if (new Date(company.subscription_until) < today) { blocked = true; reason = "expired"; }
  }
  return { profile, company, blocked, reason, authUser, isSuperadmin: false };
}

// ---------- мапперы лида (БД <-> приложение) ----------
const fromLead = (r) => ({
  id: r.id, stage: r.stage_id, stageId: r.stage_id, pipelineId: r.pipeline_id,
  company: r.name || "", contact: r.contact || "", title: r.title || "",
  phone: r.phone || "", email: r.email || "", source: r.source || "",
  amount: Number(r.amount) || 0, owner: r.owner, nextTouch: r.next_touch,
  notes: r.notes || "", history: r.history || [],
  whatsapp: r.whatsapp || "", telegram: r.telegram || "", instagram: r.instagram || "",
  linkedin: r.linkedin || "", linkedinCompany: r.linkedin_company || "",
  website: r.website || "", bin: r.bin || "", city: r.city || "", employees: r.employees || "",
  custom: r.custom || {}, createdAt: r.created_at || null,
});

const toLeadRow = (l, companyId, pipelineId) => ({
  id: l.id, company_id: companyId, pipeline_id: l.pipelineId || pipelineId || null,
  stage_id: l.stage || l.stageId || null,
  name: l.company || "", contact: l.contact || "", title: l.title || "",
  phone: l.phone || "", email: l.email || "", source: l.source || "",
  amount: l.amount || 0, owner: l.owner || null, next_touch: l.nextTouch || null,
  notes: l.notes || "", history: l.history || [],
  whatsapp: l.whatsapp || null, telegram: l.telegram || null, instagram: l.instagram || null,
  linkedin: l.linkedin || null, linkedin_company: l.linkedinCompany || null,
  website: l.website || null, bin: l.bin || null, city: l.city || null, employees: l.employees || null,
  custom: l.custom || {},
});

// ---------- мапперы проекта ----------
const fromProject = (r) => ({
  id: r.id, stage: r.stage_id, stageId: r.stage_id, pipelineId: r.pipeline_id,
  name: r.name || "", clientLeadId: r.client_lead_id || null,
  figmaUrl: r.figma_url || "", githubUrl: r.github_url || "",
  briefUrl: r.brief_url || "", referencesUrl: r.references_url || "",
  whatsapp: r.whatsapp || "", telegram: r.telegram || "",
  description: r.description || "", deadline: r.deadline || null,
  amount: Number(r.amount) || 0, assignees: r.assignees || [], custom: r.custom || {},
  createdAt: r.created_at || null,
});
const toProjectRow = (p, companyId, pipelineId) => ({
  id: p.id, company_id: companyId, pipeline_id: p.pipelineId || pipelineId || null,
  stage_id: p.stage || p.stageId || null,
  name: p.name || "", client_lead_id: p.clientLeadId || null,
  figma_url: p.figmaUrl || null, github_url: p.githubUrl || null,
  brief_url: p.briefUrl || null, references_url: p.referencesUrl || null,
  whatsapp: p.whatsapp || null, telegram: p.telegram || null,
  description: p.description || null, deadline: p.deadline || null,
  amount: p.amount || 0, assignees: p.assignees || [], custom: p.custom || {},
});

// ---------- загрузка данных компании (стадии + лиды + юзеры) ----------
export async function loadDb() {
  const { data: au } = await supabase.auth.getUser();
  const authUser = au?.user;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", authUser.id).single();
  if (!profile || !profile.company_id) {
    // суперадмин или без компании — пустая заглушка
    return { users: [], leads: [], stages: [], pipelines: [], projects: [],
             respondents: [], notes: {}, tasks: [], reminders: [], __me: authUser.id, __company: null };
  }

  const companyId = profile.company_id;

  // грузим параллельно: профили компании, стадии, воронки, лиды
  const [profilesRes, stagesRes, pipesRes, leadsRes, projectsRes, companyRes, cfRes, fcRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("company_id", companyId),
    supabase.from("stages").select("*").eq("company_id", companyId).order("order_index"),
    supabase.from("pipelines").select("*").eq("company_id", companyId),
    supabase.from("leads").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("projects").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase.from("custom_fields").select("*").eq("company_id", companyId).order("order_index"),
    supabase.from("field_configs").select("*").eq("company_id", companyId),
  ]);

  const mapRole = (r) => (r === "superadmin" || r === "admin") ? "admin" : "sales";
  const users = (profilesRes.data || []).map((p) => ({
    id: p.id, name: p.name || p.email || "Сотрудник", role: mapRole(p.role),
    dbRole: p.role, telegram_id: "", email: p.email || "", active: p.active !== false,
  }));

  const stages = (stagesRes.data || []).map((s) => ({
    id: s.id, title: s.title, color: s.color, order: s.order_index,
    isWon: s.is_won, isLost: s.is_lost, pipelineId: s.pipeline_id,
  }));

  const pipelines = (pipesRes.data || []).map((p) => ({
    id: p.id, name: p.name, type: p.type, isDefault: p.is_default,
  }));

  const leads = (leadsRes.data || []).map(fromLead);
  const projects = (projectsRes.data || []).map(fromProject);

  return {
    users, stages, pipelines, leads, projects,
    respondents: [], notes: {}, tasks: [], reminders: [],
    __me: authUser.id, __company: companyId,
    __companyName: companyRes.data?.name || "",
    __brandName: companyRes.data?.brand_name || "",
    __logoUrl: companyRes.data?.logo_url || "",
    __maxUsers: companyRes.data?.max_users || 10,
    __inboundToken: companyRes.data?.inbound_token || "",
    __customFields: (cfRes.data || []).map((c) => ({
      id: c.id, entity: c.entity, key: c.key, label: c.label, type: c.type,
      options: c.options || [], order: c.order_index,
    })),
    __fieldConfigs: (fcRes.data || []).map((f) => ({
      entity: f.entity, fieldKey: f.field_key, label: f.label,
      rolesCanSee: f.roles_can_see || [], visible: f.visible !== false,
    })),
    __defaultPipeline: (pipelines.find((p) => p.type === "sales" && p.isDefault) || pipelines.find((p) => p.type === "sales") || pipelines[0])?.id || null,
    __projectPipeline: (pipelines.find((p) => p.type === "projects" && p.isDefault) || pipelines.find((p) => p.type === "projects"))?.id || null,
  };
}

// ---------- сохранение лидов (диф) ----------
function diff(prev, next) {
  const prevMap = new Map((prev || []).map((x) => [x.id, x]));
  const nextMap = new Map((next || []).map((x) => [x.id, x]));
  const upserts = [], deletes = [];
  for (const [id, item] of nextMap) {
    const before = prevMap.get(id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) upserts.push(item);
  }
  for (const id of prevMap.keys()) if (!nextMap.has(id)) deletes.push(id);
  return { upserts, deletes };
}

export async function persistDb(next, prev) {
  if (!prev || !next) return;
  const companyId = next.__company;
  if (!companyId) return; // суперадмин — не пишем

  const pipelineId = next.__defaultPipeline;
  const { upserts, deletes } = diff(prev.leads, next.leads);

  if (upserts.length) {
    const rows = upserts.map((l) => toLeadRow(l, companyId, pipelineId));
    const { error } = await supabase.from("leads").upsert(rows);
    if (error) console.warn("[persist] leads upsert:", error.message);
  }
  if (deletes.length) {
    const { error } = await supabase.from("leads").delete().in("id", deletes);
    if (error) console.warn("[persist] leads delete:", error.message);
  }

  // проекты
  const projPipeline = next.__projectPipeline;
  const { upserts: pUp, deletes: pDel } = diff(prev.projects, next.projects);
  if (pUp.length) {
    const rows = pUp.map((p) => toProjectRow(p, companyId, projPipeline));
    const { error } = await supabase.from("projects").upsert(rows);
    if (error) console.warn("[persist] projects upsert:", error.message);
  }
  if (pDel.length) {
    const { error } = await supabase.from("projects").delete().in("id", pDel);
    if (error) console.warn("[persist] projects delete:", error.message);
  }

  // профили (изменения ролей/имён)
  const { upserts: uUp } = diff(prev.users, next.users);
  if (uUp.length) {
    const rows = uUp.map((u) => ({
      id: u.id, name: u.name, active: u.active,
    }));
    const { error } = await supabase.from("profiles").upsert(rows);
    if (error) console.warn("[persist] profiles:", error.message);
  }
}

export async function resetDb() { /* noop */ }

// ---------- создание нового лида (с генерацией id) ----------
export function newLeadId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    "lead_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}
export function newProjectId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    "proj_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

// ---------- комментарии проектов ----------
export const projectComments = {
  list: async (projectId) => {
    const { data, error } = await supabase
      .from("project_comments").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },
  add: async (companyId, projectId, text, authorName) => {
    const { data: au } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_comments").insert({
      company_id: companyId, project_id: projectId,
      author: au?.user?.id || null, author_name: authorName || "", text,
    });
    if (error) throw error;
  },
  remove: async (id) => {
    const { error } = await supabase.from("project_comments").delete().eq("id", id);
    if (error) throw error;
  },
};

// ============================================================================
// СУПЕРАДМИН: управление компаниями
// ============================================================================
// ============================================================================
// КОМАНДА: управление сотрудниками компании (Этап 5)
// ============================================================================
// ============================================================================
// БРЕНДИНГ компании (Этап 3 ч.2)
// ============================================================================
// ============================================================================
// КАСТОМНЫЕ ПОЛЯ (Этап 3 ч.3)
// ============================================================================
// ============================================================================
// ПРАВА НА ПОЛЯ по ролям (Задача 7 — RBAC per field)
// ============================================================================
// roles_can_see: пустой массив = видят все. Иначе — только перечисленные роли.
export const fieldAccess = {
  // сохранить настройку поля: какие роли видят
  set: async (companyId, entity, fieldKey, label, rolesCanSee) => {
    const { error } = await supabase.from("field_configs").upsert({
      company_id: companyId, entity, field_key: fieldKey, label,
      roles_can_see: rolesCanSee, visible: true,
    }, { onConflict: "company_id,entity,field_key" });
    if (error) throw error;
  },
  reset: async (companyId, entity, fieldKey) => {
    const { error } = await supabase.from("field_configs")
      .delete().eq("company_id", companyId).eq("entity", entity).eq("field_key", fieldKey);
    if (error) throw error;
  },
};

export const customFields = {
  add: async (companyId, entity, label, type, options, orderIndex) => {
    const key = "cf_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("custom_fields").insert({
      company_id: companyId, entity, key, label,
      type: type || "text", options: options || [], order_index: orderIndex || 0,
    });
    if (error) throw error;
    return key;
  },
  update: async (id, fields) => {
    const { error } = await supabase.from("custom_fields").update(fields).eq("id", id);
    if (error) throw error;
  },
  remove: async (id) => {
    const { error } = await supabase.from("custom_fields").delete().eq("id", id);
    if (error) throw error;
  },
};

export const branding = {
  update: async (companyId, fields) => {
    const { error } = await supabase.from("companies").update(fields).eq("id", companyId);
    if (error) throw error;
  },
  // загрузка файла логотипа в Storage → возвращает публичный URL
  uploadLogo: async (companyId, file) => {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${companyId}/logo_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true, contentType: file.type || "image/png",
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    return data.publicUrl;
  },
};

// ============================================================================
// СТАДИИ: редактор воронки (Этап 3)
// ============================================================================
export const pipelineEditor = {
  // добавить стадию в воронку
  addStage: async (companyId, pipelineId, title, color, orderIndex) => {
    const { data, error } = await supabase.from("stages").insert({
      company_id: companyId, pipeline_id: pipelineId,
      title, color: color || "#6366f1", order_index: orderIndex,
      is_won: false, is_lost: false,
    }).select().single();
    if (error) throw error;
    return data;
  },
  // обновить стадию (название/цвет/флаги)
  updateStage: async (id, fields) => {
    const { error } = await supabase.from("stages").update(fields).eq("id", id);
    if (error) throw error;
  },
  // удалить стадию (лиды этой стадии надо предварительно перенести)
  deleteStage: async (id) => {
    const { error } = await supabase.from("stages").delete().eq("id", id);
    if (error) throw error;
  },
  // сохранить порядок стадий (массив id в нужном порядке)
  reorderStages: async (orderedIds) => {
    const updates = orderedIds.map((id, i) =>
      supabase.from("stages").update({ order_index: i }).eq("id", id));
    await Promise.all(updates);
  },
};

export const team = {
  // добавить сотрудника (через Edge Function)
  addEmployee: async (payload) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const url = supabase.supabaseUrl + "/functions/v1/add-employee";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка добавления сотрудника");
    return data;
  },
  // изменить роль/имя/активность
  updateMember: async (id, fields) => {
    const { error } = await supabase.from("profiles").update(fields).eq("id", id);
    if (error) throw error;
  },
  // удалить сотрудника (профиль; auth-юзер остаётся, но без доступа к компании)
  removeMember: async (id) => {
    const { error } = await supabase.from("profiles").update({ company_id: null, active: false }).eq("id", id);
    if (error) throw error;
  },
};

export const superadmin = {
  listCompanies: async () => {
    const { data: companies, error } = await supabase
      .from("companies").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const { data: profiles } = await supabase.from("profiles").select("company_id");
    const counts = {};
    (profiles || []).forEach((p) => { if (p.company_id) counts[p.company_id] = (counts[p.company_id] || 0) + 1; });
    return (companies || []).map((c) => ({ ...c, userCount: counts[c.id] || 0 }));
  },
  createCompany: async (payload) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const url = supabase.supabaseUrl + "/functions/v1/admin-create-company";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка создания компании");
    return data;
  },
  toggleActive: async (companyId, active) => {
    const { error } = await supabase.from("companies").update({ active }).eq("id", companyId);
    if (error) throw error;
  },
  setSubscription: async (companyId, untilDate) => {
    const { error } = await supabase.from("companies").update({ subscription_until: untilDate }).eq("id", companyId);
    if (error) throw error;
  },
  setMaxUsers: async (companyId, maxUsers) => {
    const { error } = await supabase.from("companies").update({ max_users: maxUsers }).eq("id", companyId);
    if (error) throw error;
  },
  deleteCompany: async (companyId) => {
    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) throw error;
  },
};

// integrations — заглушки (подключим в Этапе 6)
export const integrations = {
  listTokens: async () => [],
  createToken: async () => { throw new Error("Интеграции — Этап 6"); },
  revokeToken: async () => {}, deleteToken: async () => {},
  listWebhooks: async () => [], createWebhook: async () => { throw new Error("Интеграции — Этап 6"); },
  deleteWebhook: async () => {}, listAudit: async () => [], listDeliveries: async () => [],
};