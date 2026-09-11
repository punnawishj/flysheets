"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginButton() {
  const supabase = createClient();

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <button className="btn primary" onClick={signIn} type="button">
      เข้าสู่ระบบด้วย Google
    </button>
  );
}
