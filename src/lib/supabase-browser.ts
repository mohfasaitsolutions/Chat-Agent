"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser client (anon key) — used only for Realtime subscriptions.
 * All reads/writes still go through this app's API routes.
 */
let client: ReturnType<typeof createClient> | null = null;

export function supabaseBrowser() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
