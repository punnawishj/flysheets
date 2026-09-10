// Service-role Supabase client. This key BYPASSES Row Level Security
// entirely, so it must only ever be imported from server actions or
// route handlers (files with "use server" or under app/**/route.ts),
// and each function that uses it must do its own permission check
// first (see the actions.ts files next to each page for examples).
//
// Never import this file from a Client Component or expose the key to
// the browser.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
