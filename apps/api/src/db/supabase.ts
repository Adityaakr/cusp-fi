import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } from "../config/index.js";

let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

export function getAnonClient(): SupabaseClient {
  if (!_anon) {
    _anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _anon;
}
