import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { baht, formatDateTime } from "@/lib/money";
import { ErrorBanner } from "@/components/Banner";
import { approveOrder, rejectOrder, markPayoutPaid } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return <div className="section empty">หน้านี้สำหรับแอดมินเท่านั้น</div>;
  }

  // The signed-in admin still only has normal RLS access as themself, so
  // reading every user's orders here goes through the service-role
  // client -- gated by the email check just above, not by RLS.
  const admin = createAdminClient();
  const { data: orders } = await admin.from("orders").select("*").order("created_at", { ascending: false });
  const allOrders = orders ?? [];

  const paidOrders = allOrders.filter((o) => o.status === "paid");
  const totalSales = paidOrders.reduce((s, o) => s + o.price, 0);
  const totalCommission = paidOrders.reduce((s, o) => s + o.commission, 0);
  const owed = paidOrders.filter((o) => o.payout_status !== "paid").reduce((s, o) => s + o.seller_amount, 0);

  const verifyingOrders = allOrders.filter((o) => o.status === "verifying");
  const slipUrls: Record<string, string | null> = {};
  for (const o of verifyingOrders) {
    if (o.slip_path) {
      const { data } = await admin.storage.from("slips").createSignedUrl(o.slip_path, 600);
      slipUrls[o.id] = data?.signedUrl ?? null;
    }
  }

  const bySeller: Record<string, { sellerName: string; sellerId: string; total: number; orderIds: string[]; bankLine: string }> = {};
  for (const o of paidOrders.filter((o) => o.payout_status !== "paid")) {
    if (!bySeller[o.seller_id]) {
      const { data: profile } = await admin.from("profiles").select("bank_name, bank_account_number, bank_account_name").eq("id", o.seller_id).single();
      bySeller[o.seller_id] = {
        sellerName: o.seller_name,
        sellerId: o.seller_id,
        total: 0,
        orderIds: [],
        bankLine: profile ? `${profile.bank_name} · ${profile.bank_account_number} · ${profile.bank_account_name}` : "ไม่มีข้อมูลบัญชี",
      };
    }
    bySeller[o.seller_id].total += o.seller_amount;
    bySeller[o.seller_id].orderIds.push(o.id);
  }
  const queue = Object.values(bySeller).sort((a, b) => b.total - a.total);

  const history = allOrders.filter((o) => o.payout_status === "paid").sort((a, b) => (b.payout_at ?? "").localeCompare(a.payout_at ?? ""));

  return (
    <div className="section" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: "1.4rem" }}>แดชบอร์ดแอดมิน</h2>
          <Link href="/admin/categories" className="btn outline" style={{ padding: "8px 14px", fontSize: ".85rem" }}>
            จัดการหมวดหมู่
          </Link>
        </div>
        <ErrorBanner message={searchParams.error} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="card"><div style={{ color: "var(--ink-faint)", fontSize: ".8rem" }}>ยอดขายรวม</div><div className="tab" style={{ fontSize: "1.4rem", fontWeight: 700 }}>฿{baht(totalSales)}</div></div>
        <div className="card"><div style={{ color: "var(--ink-faint)", fontSize: ".8rem" }}>รายได้ค่าคอมมิชชั่น (20%)</div><div className="tab" style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent-strong)" }}>฿{baht(totalCommission)}</div></div>
        <div className="card"><div style={{ color: "var(--ink-faint)", fontSize: ".8rem" }}>ค้างจ่ายผู้ขาย</div><div className="tab price" style={{ fontSize: "1.4rem" }}>฿{baht(owed)}</div></div>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>รอตรวจสอบสลิป</h3>
        <p style={{ color: "var(--ink-faint)", fontSize: ".82rem", marginBottom: 14 }}>
          รายการที่นี่ผ่าน SlipOK อัตโนมัติไปแล้วจะไม่ปรากฏ — เหลือเฉพาะที่ต้องตรวจด้วยตา (หรือทั้งหมด ถ้ายังไม่ได้ตั้งค่า SLIPOK_API_KEY)
        </p>
        {verifyingOrders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {verifyingOrders.map((o) => (
              <div key={o.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{o.listing_title} · ฿{baht(o.price)}</div>
                  <div style={{ color: "var(--ink-faint)", fontSize: ".82rem" }}>ผู้ซื้อ {o.buyer_name} · {formatDateTime(o.created_at)}</div>
                  {slipUrls[o.id] && (
                    <a href={slipUrls[o.id]!} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 600, fontSize: ".85rem" }}>
                      ดูสลิป
                    </a>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <form action={approveOrder.bind(null, o.id)}>
                    <button type="submit" className="btn success" style={{ padding: "8px 14px", fontSize: ".85rem" }}>อนุมัติ</button>
                  </form>
                  <form action={rejectOrder.bind(null, o.id)}>
                    <button type="submit" className="btn outline" style={{ padding: "8px 14px", fontSize: ".85rem" }}>ปฏิเสธ</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">ไม่มีรายการรอตรวจสอบ</div>
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>คิวจ่ายเงินผู้ขายรายสัปดาห์</h3>
        <p style={{ color: "var(--ink-faint)", fontSize: ".82rem", marginBottom: 14 }}>โอนเงินจริงผ่านแอปธนาคารของคุณเอง แล้วกดทำเครื่องหมายว่าจ่ายแล้ว</p>
        {queue.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {queue.map((q) => (
              <div key={q.sellerId} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{q.sellerName}</div>
                  <div style={{ color: "var(--ink-faint)", fontSize: ".82rem" }}>{q.bankLine} · {q.orderIds.length} ออเดอร์</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="tab price" style={{ fontSize: "1.1rem" }}>฿{baht(q.total)}</span>
                  <form action={markPayoutPaid.bind(null, q.sellerId, q.orderIds.join(","))}>
                    <button type="submit" className="btn success" style={{ padding: "8px 14px", fontSize: ".85rem" }}>ทำเครื่องหมายว่าจ่ายแล้ว</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">ไม่มีรายการค้างจ่าย</div>
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>ประวัติการโอนจ่าย</h3>
        {history.length > 0 ? (
          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>ผู้ขาย</th><th>ไฟล์</th><th>ยอดโอน</th><th>วันที่โอน</th></tr></thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.id}>
                    <td>{o.seller_name}</td>
                    <td>{o.listing_title}</td>
                    <td className="tab">฿{baht(o.seller_amount)}</td>
                    <td>{formatDateTime(o.payout_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">ยังไม่มีประวัติการโอน</div>
        )}
      </div>
    </div>
  );
}
