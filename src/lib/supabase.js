// Клиент Supabase. Ключи берутся из .env (см. .env.example).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("[InsightLab] Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY в .env");
}

export const supabase = createClient(url, anon);
