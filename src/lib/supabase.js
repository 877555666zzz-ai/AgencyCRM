// ============================================================================
// supabase.js — клиент для нового проекта NEWPJ (мультитенантная CRM)
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://piimcaiabstnadguwrri.supabase.co";
const SUPABASE_KEY = "sb_publishable_kdg00yW3MRUPvJ15CaOcvQ_2-VpCtIh";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});