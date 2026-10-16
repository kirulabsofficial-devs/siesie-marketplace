import { createClient } from "@supabase/supabase-js";
import { LIVE_BACKEND } from "./runtime";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = LIVE_BACKEND && url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }) },
}) : null;
export function requireSupabase() {
  if (!supabase) throw new Error("The Supabase connection has not been configured.");
  return supabase;
}
