// Browser-side Supabase client. Uses the public anon key, so every query
// it makes is filtered by the Row Level Security policies in
// supabase/schema.sql -- it can never see more than the signed-in user
// is allowed to.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
