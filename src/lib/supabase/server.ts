// Server-side Supabase client for Server Components and Server Actions.
// It reads/writes the session from cookies and, like the browser client,
// is still bound by Row Level Security -- it acts AS the signed-in user,
// never as an admin.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies --
            // safe to ignore because the middleware below refreshes the
            // session on every request anyway.
          }
        },
      },
    }
  );
}
