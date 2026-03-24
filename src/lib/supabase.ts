import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create a dummy client if env vars aren't set (build time)
// Real client gets created at runtime when env vars are available
export const supabase: SupabaseClient = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new Proxy({} as SupabaseClient, {
      get: () => () => ({ data: null, error: { message: "Supabase not configured" } }),
    }) as SupabaseClient);

export const isSupabaseConfigured = !!supabaseUrl;
