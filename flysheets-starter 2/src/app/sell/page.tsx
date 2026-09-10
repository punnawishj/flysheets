import { createClient } from "@/lib/supabase/server";
import LoginButton from "@/components/LoginButton";
import { ErrorBanner, SuccessBanner } from "@/components/Banner";
import { BANKS, SUBJECTS } from "@/lib/constants";
import { baht, formatDateTime } from "@/lib/money";
import { becomeSeller, createListing, deleteListing } from "./actions";

export default async function SellPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="section" style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
        <h2 className="disp" style={{ fontSize: "1.5rem", marginBottom: 12 }}>อยากขายชีทของคุณไหม?</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>เข้าสู่ระบบก่อนเพื่อเริ่มสมัครเป็นผู้ขาย</p>
        <LoginButton />
      </div>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile?.is_seller) {
    return (
      <div className="section" style={{ maxWidth: 440, margin: "0 auto" }}>
        <h2 style={{ fontSize: "1.4rem", marginBottom: 6 }}>กรอกบัญชีธนาคารเพื่อรับเงิน</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", marginBottom: 18 }}>
          เราจะโอนยอดขาย 80% เข้าบัญชีนี้ให้ทุกสัปดาห์ หลังหักค่าธรรมเนียมแพลตฟอร์ม 20%
        </p>
        <ErrorBanner message={searchParams.error} />
        <form action={becomeSeller} className="card">
          <div className="field">
            <label htmlFor="bankName">ธนาคาร</label>
            <select id="bankName" name="bankName" required>
              {BANKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="accountNumber">เลขที่บัญชี</label>
            <input id="accountNumber" name="accountNumber" required placeholder="xxx-x-xxxxx-x" />
          </div>
          <div className="field">
            <label htmlFor="accountName">ชื่อบัญชี</label>
            <input id="accountName" name="accountName" required placeholder="ชื่อ-นามสกุลตามหน้าบัญชี" />
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%" }}>
            สมัครเป็นผู้ขาย
          </button>
        </form>
      </div>
    );
  }

  const { data: myListings } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const { data: myOrders } = await supabase
    .from("orders")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  const paidOrders = (myOrders ?? []).filter((o) => o.status === "paid");
  const totalSales = paidOrders.reduce((s, o) => s + o.price, 0);
  const pendingPayout = paidOrders.filter((o) => o.payout_status !== "paid").reduce((s, o) => s + o.seller_amount, 0);
  const paidOut = paidOrders.filter((o) => o.payout_status === "paid").reduce((s, o) => s + o.seller_amount, 0);

  return (
    <div className="section" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h2 style={{ fontSize: "1.4rem", marginBottom: 14 }}>สวัสดี {profile.name}</h2>
        <ErrorBanner message={searchParams.error} />
        <SuccessBanner message={searchParams.created ? "ลงขายชีทสำเร็จแล้ว!" : undefined} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="card"><div style={{ color: "var(--ink-faint)", fontSize: ".8rem" }}>ยอดขายสะสม</div><div className="tab" style={{ fontSize: "1.4rem", fontWeight: 700 }}>฿{baht(totalSales)}</div></div>
        <div className="card"><div style={{ color: "var(--ink-faint)", fontSize: ".8rem" }}>รอโอนงวดถัดไป</div><div className="tab price" style={{ fontSize: "1.4rem" }}>฿{baht(pendingPayout)}</div></div>
        <div className="card"><div style={{ color: "var(--ink-faint)", fontSize: ".8rem" }}>โอนแล้วสะสม</div><div className="tab" style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--success)" }}>฿{baht(paidOut)}</div></div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>อัปโหลดชีทใหม่</h3>
        <form action={createListing} encType="multipart/form-data">
          <div className="field">
            <label htmlFor="title">ชื่อไฟล์ / รายวิชา</label>
            <input id="title" name="title" required placeholder="เช่น สรุป Rock Mechanics ก่อนสอบไฟนอล" />
          </div>
          <div className="field">
            <label htmlFor="subject">หมวดหมู่</label>
            <select id="subject" name="subject">
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="description">รายละเอียด</label>
            <textarea id="description" name="description" rows={3} placeholder="เนื้อหาครอบคลุมอะไรบ้าง กี่หน้า" />
          </div>
          <div className="field">
            <label htmlFor="price">ราคา (บาท)</label>
            <input id="price" name="price" type="number" min={0} required placeholder="99" />
          </div>
          <div className="field">
            <label htmlFor="previewFile">ไฟล์ตัวอย่าง (แสดงหน้าเว็บ)</label>
            <input id="previewFile" name="previewFile" type="file" accept=".pdf,image/*" />
          </div>
          <div className="field">
            <label htmlFor="fullFile">ไฟล์ฉบับเต็ม (ต้องซื้อก่อนถึงดาวน์โหลดได้)</label>
            <input id="fullFile" name="fullFile" type="file" accept=".pdf" required />
          </div>
          <button type="submit" className="btn primary">ลงขายชีทนี้</button>
        </form>
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>ไฟล์ของฉัน ({myListings?.length ?? 0})</h3>
        {myListings && myListings.length > 0 ? (
          <div className="grid">
            {myListings.map((l) => (
              <div key={l.id} className="card">
                <div style={{ fontSize: ".72rem", color: "var(--accent-strong)", fontWeight: 700 }}>{l.subject}</div>
                <div style={{ fontWeight: 600, margin: "6px 0" }}>{l.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="tab price">฿{baht(l.price)}</span>
                  <form action={deleteListing.bind(null, l.id)}>
                    <button type="submit" className="btn outline" style={{ padding: "4px 12px", fontSize: ".8rem" }}>ลบ</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">ยังไม่มีไฟล์ที่ลงขาย</div>
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>ยอดขายและคิวจ่ายเงิน</h3>
        {myOrders && myOrders.length > 0 ? (
          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>ไฟล์</th><th>ผู้ซื้อ</th><th>ราคา</th><th>คุณได้รับ 80%</th><th>สถานะ</th><th>การจ่ายเงิน</th></tr>
              </thead>
              <tbody>
                {myOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.listing_title}</td>
                    <td>{o.buyer_name}</td>
                    <td className="tab">฿{baht(o.price)}</td>
                    <td className="tab price">฿{baht(o.seller_amount)}</td>
                    <td><span className={`pill ${o.status}`}>{statusLabel(o.status)}</span></td>
                    <td>{o.status === "paid" ? (o.payout_status === "paid" ? `โอนแล้ว ${formatDateTime(o.payout_at)}` : "รอรอบถัดไป") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">ยังไม่มีคำสั่งซื้อ</div>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  return { pending_payment: "รอชำระเงิน", verifying: "กำลังตรวจสอบสลิป", paid: "สำเร็จ", rejected: "ถูกปฏิเสธ" }[status] ?? status;
}
