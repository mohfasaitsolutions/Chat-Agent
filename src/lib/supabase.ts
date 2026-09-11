import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/**
 * Server-side Supabase client using the service-role key.
 * Bypasses RLS — never import this from a "use client" file.
 */
export function supabaseAdmin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
