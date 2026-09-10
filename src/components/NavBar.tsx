import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";

export default async function NavBar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === process.env.ADMIN_EMAIL;

  return (
    <div className="shell nav">
      <Link href="/" className="brand disp">
        flysheets<span style={{ color: "var(--accent)" }}>.</span>
      </Link>
      <div className="spacer" />
      <Link href="/sell" className="link">ขายไฟล์</Link>
      <Link href="/purchases" className="link">ไฟล์ที่ซื้อ</Link>
      {isAdmin && <Link href="/admin" className="link">แอดมิน</Link>}
      {user ? (
        <span style={{ marginLeft: 14 }}>
          <LogoutButton />
        </span>
      ) : (
        <span style={{ marginLeft: 14 }}>
          <LoginButton />
        </span>
      )}
    </div>
  );
}
