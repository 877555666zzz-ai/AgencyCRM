// ============================================================================
// crm-api — внешний REST-API CRM (ТЗ «Двусторонний коннектор», Фаза 1)
//
// Аутентификация: заголовок  Authorization: Bearer sk-crm-...
//   Токен хешируется SHA-256 и сверяется с public.api_tokens (token_hash).
//   Проверяются: не отозван, не истёк, есть нужный scope. Каждый запрос
//   увеличивает request_count и пишется в api_audit_log.
//
// Эндпоинты:
//   ВХОДЯЩИЕ:
//   POST /inbound/lead            scope inbound:leads     — принять лид
//   POST /inbound/contact         scope inbound:contacts  — принять контакт
//   POST /inbound/event           scope inbound:events    — записать событие
//   POST /inbound/batch           scope по object_type    — массовая загрузка
//   ИСХОДЯЩИЕ:
//   GET  /pipelines               scope outbound:pipelines— список воронок
//   GET  /pipelines/:id/stages    scope outbound:pipelines— стадии воронки
//   GET  /users?active=true       scope outbound:users    — список пользователей
//   GET  /leads?stage_id=&phone=&email=&limit=  scope outbound:leads — лиды
//   GET  /leads/:id               scope outbound:leads    — один лид
//   ВЕБХУКИ:
//   POST   /webhooks/subscriptions       scope webhooks:subscribe — подписаться
//   GET    /webhooks/subscriptions       scope webhooks:subscribe — список
//   DELETE /webhooks/subscriptions/:id   scope webhooks:subscribe — удалить
//   (саму отправку вебхуков делает триггер БД из 07_integrations_phase2.sql)
//
//   Rate limit: 120 запросов/мин на токен → иначе 429.
//
// Деплой:  supabase functions deploy crm-api --no-verify-jwt
//   (--no-verify-jwt обязателен: авторизация у нас своя, по API-токену)
//   SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY подставляются автоматически.
//
// Базовый URL после деплоя:
//   https://<project-ref>.supabase.co/functions/v1/crm-api
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Стадии воронки продаж (зеркало SALES_STAGES в приложении)
const SALES_STAGES = [
  { id: "new", name: "Новый", sort: 10 },
  { id: "in_work", name: "В работе", sort: 20 },
  { id: "demo_set", name: "Разбор-пари назначен", sort: 30 },
  { id: "demo_done", name: "Разбор проведён", sort: 40 },
  { id: "kp_sent", name: "КП отправлено", sort: 50 },
  { id: "negotiation", name: "Переговоры", sort: 60 },
  { id: "won", name: "Выиграно", sort: 70 },
  { id: "lost", name: "Проиграно", sort: 80 },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hasScope(scopes: string[], needed: string): boolean {
  if (scopes.includes(needed)) return true;
  const [dir] = needed.split(":"); // inbound | outbound
  return scopes.includes(dir + ":any");
}

function firstVal(v: unknown): string {
  // принимает "строку" или [{ value, type }] → первое value
  if (Array.isArray(v)) return String(v[0]?.value ?? v[0] ?? "").trim();
  return String(v ?? "").trim();
}

// ---- результат записи одного объекта ----
type WriteResult = { status: "created" | "duplicate" | "error"; id?: string; error?: string };

// Создать лид (с дедупликацией по phone/email). Используется и одиночным
// эндпоинтом, и batch-загрузкой.
async function insertLead(b: Record<string, unknown>): Promise<WriteResult> {
  const phone = firstVal(b.phone);
  const email = firstVal(b.email);
  const company = String(b.company_name ?? b.company ?? "").trim() || "—";
  const contact = String(b.contact_name ?? b.contact ?? "").trim();

  if (phone || email) {
    const orParts: string[] = [];
    if (phone) orParts.push(`phone.eq.${phone}`);
    if (email) orParts.push(`email.eq.${email}`);
    const { data: dups } = await db.from("leads").select("id").or(orParts.join(",")).limit(1);
    if (dups && dups.length) return { status: "duplicate", id: dups[0].id };
  }

  let owner: string | null = null;
  const assigned = String(b.assigned_to ?? "").trim();
  if (assigned) {
    const { data: p } = await db.from("profiles").select("id").eq("id", assigned).maybeSingle();
    if (p) owner = p.id;
  }
  if (!owner) {
    const { data: adm } = await db.from("profiles").select("id").eq("role", "admin").eq("active", true).limit(1);
    owner = adm?.[0]?.id ?? null;
  }

  const stage = String(b.stage_id ?? "new").trim();
  const validStage = SALES_STAGES.some((s) => s.id === stage) ? stage : "new";
  const id = "lead_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);

  const row = {
    id, company, contact, title: String(b.title ?? "").trim(),
    phone, email, source: String(b.source ?? "API").trim() || "API",
    stage: validStage, owner, next_touch: today, amount: 0,
    notes: String(b.comment ?? b.notes ?? "").trim(),
    history: [{ id: "act_" + crypto.randomUUID().slice(0, 8), type: "task", title: "Создан через API", when: new Date().toISOString(), done: true, owner }],
  };
  const { error } = await db.from("leads").insert(row);
  if (error) return { status: "error", error: error.message };
  return { status: "created", id };
}

// Создать контакт (дедуп по phone/email).
async function insertContact(b: Record<string, unknown>): Promise<WriteResult> {
  const phone = firstVal(b.phone);
  const email = firstVal(b.email);
  if (phone || email) {
    const orParts: string[] = [];
    if (phone) orParts.push(`phone.eq.${phone}`);
    if (email) orParts.push(`email.eq.${email}`);
    const { data: dups } = await db.from("contacts").select("id").or(orParts.join(",")).limit(1);
    if (dups && dups.length) return { status: "duplicate", id: dups[0].id };
  }
  const row = {
    name: String(b.name ?? "").trim(),
    company: String(b.company ?? "").trim(),
    phone, email,
    telegram: String(b.telegram ?? "").trim(),
    source: String(b.source ?? "API").trim() || "API",
    linked_lead: String(b.linked_lead ?? "").trim() || null,
  };
  const { data, error } = await db.from("contacts").insert(row).select("id").single();
  if (error) return { status: "error", error: error.message };
  return { status: "created", id: data.id };
}

// Записать событие.
async function insertEvent(b: Record<string, unknown>): Promise<WriteResult> {
  const row = {
    lead_id: String(b.lead_id ?? "").trim() || null,
    type: String(b.type ?? "").trim(),
    channel: String(b.channel ?? "").trim(),
    direction: String(b.direction ?? "").trim(),
    text: String(b.text ?? "").trim(),
    status: String(b.status ?? "").trim(),
    source: String(b.source ?? "API").trim() || "API",
    occurred_at: b.timestamp ? String(b.timestamp) : null,
  };
  const { data, error } = await db.from("crm_events").insert(row).select("id").single();
  if (error) return { status: "error", error: error.message };
  return { status: "created", id: data.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  // путь после имени функции: /functions/v1/crm-api/<...> → /<...>
  let path = url.pathname;
  const marker = "/crm-api";
  const at = path.indexOf(marker);
  if (at >= 0) path = path.slice(at + marker.length);
  path = path.replace(/\/+$/, "") || "/";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  // ---------- аутентификация по токену ----------
  const auth = req.headers.get("authorization") || "";
  const raw = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return json({ error: "Unauthorized" }, 401);

  const hash = await sha256hex(raw);
  const { data: tok } = await db
    .from("api_tokens")
    .select("id, scopes, revoked, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!tok || tok.revoked) return json({ error: "Unauthorized" }, 401);
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) return json({ error: "Unauthorized" }, 401);

  const scopes: string[] = tok.scopes || [];

  // вспомогалка: залогировать запрос + обновить счётчик токена (best-effort)
  const finish = async (status: number, body: unknown) => {
    await Promise.allSettled([
      db.from("api_audit_log").insert({ token_id: tok.id, method: req.method, path, status, ip }),
      db.rpc("touch_token", { t_id: tok.id }),
    ]);
    return json(body as object, status);
  };

  const need = (scope: string) => hasScope(scopes, scope);

  // ---------- rate limiting: не более RATE_LIMIT запросов/мин на токен ----------
  const RATE_LIMIT = 120;
  {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db
      .from("api_audit_log")
      .select("*", { count: "exact", head: true })
      .eq("token_id", tok.id)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return finish(429, { error: "Too Many Requests" });
  }

  try {
    // ===================== ВХОДЯЩИЙ КАНАЛ =====================
    // POST /inbound/lead
    if (req.method === "POST" && path === "/inbound/lead") {
      if (!need("inbound:leads")) return finish(403, { error: "Forbidden: scope inbound:leads required" });
      const b = await req.json().catch(() => ({}));
      const r = await insertLead(b);
      if (r.status === "duplicate") return finish(409, { id: r.id, status: "duplicate", message: "Already exists" });
      if (r.status === "error") return finish(400, { error: r.error });
      return finish(201, { id: r.id, status: "created", created_at: new Date().toISOString() });
    }

    // POST /inbound/contact
    if (req.method === "POST" && path === "/inbound/contact") {
      if (!need("inbound:contacts")) return finish(403, { error: "Forbidden: scope inbound:contacts required" });
      const b = await req.json().catch(() => ({}));
      const r = await insertContact(b);
      if (r.status === "duplicate") return finish(409, { id: r.id, status: "duplicate", message: "Already exists" });
      if (r.status === "error") return finish(400, { error: r.error });
      return finish(201, { id: r.id, status: "created", created_at: new Date().toISOString() });
    }

    // POST /inbound/event
    if (req.method === "POST" && path === "/inbound/event") {
      if (!need("inbound:events")) return finish(403, { error: "Forbidden: scope inbound:events required" });
      const b = await req.json().catch(() => ({}));
      const r = await insertEvent(b);
      if (r.status === "error") return finish(400, { error: r.error });
      return finish(201, { id: r.id, status: "created" });
    }

    // POST /inbound/batch  { object_type, items[], on_duplicate }
    if (req.method === "POST" && path === "/inbound/batch") {
      const b = await req.json().catch(() => ({}));
      const ot = String(b.object_type ?? "lead").trim();
      const scopeNeeded = ot === "lead" ? "inbound:leads"
        : ot === "contact" ? "inbound:contacts"
        : ot === "event" ? "inbound:events"
        : "inbound:any";
      if (!need(scopeNeeded)) return finish(403, { error: `Forbidden: scope ${scopeNeeded} required` });
      const items = Array.isArray(b.items) ? b.items : [];
      let created = 0, duplicates = 0, errors = 0;
      const error_details: Array<{ index: number; reason: string }> = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const r = ot === "contact" ? await insertContact(it)
          : ot === "event" ? await insertEvent(it)
          : await insertLead(it);
        if (r.status === "created") created++;
        else if (r.status === "duplicate") duplicates++;
        else { errors++; error_details.push({ index: i, reason: r.error || "error" }); }
      }
      return finish(200, { created, duplicates, errors, error_details });
    }

    // ===================== ИСХОДЯЩИЙ КАНАЛ =====================
    // GET /pipelines
    if (req.method === "GET" && path === "/pipelines") {
      if (!need("outbound:pipelines")) return finish(403, { error: "Forbidden: scope outbound:pipelines required" });
      return finish(200, [{ id: "1", name: "Воронка продаж", stages_count: SALES_STAGES.length }]);
    }

    // GET /pipelines/:id/stages
    const mStages = path.match(/^\/pipelines\/([^/]+)\/stages$/);
    if (req.method === "GET" && mStages) {
      if (!need("outbound:pipelines")) return finish(403, { error: "Forbidden: scope outbound:pipelines required" });
      return finish(200, SALES_STAGES);
    }

    // GET /users
    if (req.method === "GET" && path === "/users") {
      if (!need("outbound:users")) return finish(403, { error: "Forbidden: scope outbound:users required" });
      let q = db.from("profiles").select("id, name, role, email, active");
      if (url.searchParams.get("active") === "true") q = q.eq("active", true);
      const { data, error } = await q;
      if (error) return finish(500, { error: error.message });
      return finish(200, data);
    }

    // GET /leads/:id
    const mLead = path.match(/^\/leads\/([^/]+)$/);
    if (req.method === "GET" && mLead) {
      if (!need("outbound:leads")) return finish(403, { error: "Forbidden: scope outbound:leads required" });
      const { data, error } = await db.from("leads").select("*").eq("id", mLead[1]).maybeSingle();
      if (error) return finish(500, { error: error.message });
      if (!data) return finish(404, { error: "Not Found" });
      return finish(200, data);
    }

    // GET /leads?stage_id=&phone=&email=&created_after=&limit=
    if (req.method === "GET" && path === "/leads") {
      if (!need("outbound:leads")) return finish(403, { error: "Forbidden: scope outbound:leads required" });
      const sp = url.searchParams;
      let q = db.from("leads").select("*", { count: "exact" });
      if (sp.get("stage_id")) q = q.eq("stage", sp.get("stage_id"));
      if (sp.get("phone")) q = q.eq("phone", sp.get("phone"));
      if (sp.get("email")) q = q.eq("email", sp.get("email"));
      if (sp.get("created_after")) q = q.gte("created_at", sp.get("created_after"));
      const limit = Math.min(parseInt(sp.get("limit") || "50", 10) || 50, 200);
      q = q.order("created_at", { ascending: false }).limit(limit);
      const { data, count, error } = await q;
      if (error) return finish(500, { error: error.message });
      return finish(200, { total: count ?? data?.length ?? 0, items: data });
    }

    // ===================== ВЕБХУКИ (подписки) =====================
    // POST /webhooks/subscriptions — зарегистрировать подписку
    if (req.method === "POST" && path === "/webhooks/subscriptions") {
      if (!need("webhooks:subscribe")) return finish(403, { error: "Forbidden: scope webhooks:subscribe required" });
      const b = await req.json().catch(() => ({}));
      const wurl = String(b.url ?? "").trim();
      if (!wurl) return finish(400, { error: "url required" });
      const events = Array.isArray(b.events) ? b.events.map((e: unknown) => String(e)) : [];
      const { data, error } = await db
        .from("webhook_subscriptions")
        .insert({ url: wurl, events, secret: b.secret ? String(b.secret) : null, active: true })
        .select("id, events")
        .single();
      if (error) return finish(400, { error: error.message });
      return finish(201, { id: data.id, status: "active", events: data.events });
    }

    // GET /webhooks/subscriptions — список подписок
    if (req.method === "GET" && path === "/webhooks/subscriptions") {
      if (!need("webhooks:subscribe")) return finish(403, { error: "Forbidden: scope webhooks:subscribe required" });
      const { data, error } = await db
        .from("webhook_subscriptions")
        .select("id, url, events, active, created_at")
        .order("created_at", { ascending: false });
      if (error) return finish(500, { error: error.message });
      return finish(200, { items: data });
    }

    // DELETE /webhooks/subscriptions/:id — удалить подписку
    const mSub = path.match(/^\/webhooks\/subscriptions\/([^/]+)$/);
    if (req.method === "DELETE" && mSub) {
      if (!need("webhooks:subscribe")) return finish(403, { error: "Forbidden: scope webhooks:subscribe required" });
      const { error } = await db.from("webhook_subscriptions").delete().eq("id", mSub[1]);
      if (error) return finish(400, { error: error.message });
      return finish(200, { status: "deleted" });
    }

    return finish(404, { error: "Not Found", path });
  } catch (e) {
    return json({ error: "Internal Server Error", detail: String(e) }, 500);
  }
});
