import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LoginButton from "@/components/LoginButton";
import { baht, formatDateTime } from "@/lib/money";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "รอชำระเงิน",
  verifying: "กำลังตรวจสอบสลิป",
  paid: "สำเร็จ",
  rejected: "ถูกปฏิเสธ",
};

export default async function PurchasesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="section" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--ink-soft)", marginBottom: 16 }}>เข้าสู่ระบบเพื่อดูไฟล์ที่คุณซื้อ</p>
        <LoginButton />
      </div>
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="section">
      <h2 style={{ fontSize: "1.4rem", marginBottom: 20 }}>ไฟล์ที่ซื้อแล้ว</h2>
      {orders && orders.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map((o) => (
            <div key={o.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{o.listing_title}</div>
                <div style={{ color: "var(--ink-faint)", fontSize: ".82rem" }}>
                  ผู้ขาย {o.seller_name} · {formatDateTime(o.created_at)} · ฿{baht(o.price)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                <Link href={`/order/${o.id}`} className="btn outline" style={{ padding: "6px 14px", fontSize: ".85rem" }}>
                  เปิดคำสั่งซื้อ
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          ยังไม่มีไฟล์ที่ซื้อ — <Link href="/" style={{ color: "var(--accent-strong)", fontWeight: 600 }}>เลือกซื้อชีท</Link>
        </div>
      )}
    </div>
  );
}
