import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { baht, formatDateTime } from "@/lib/money";
import { ErrorBanner } from "@/components/Banner";
import UploadSlipForm from "./UploadSlipForm";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "รอชำระเงิน",
  verifying: "กำลังตรวจสอบสลิป",
  paid: "สำเร็จ",
  rejected: "ถูกปฏิเสธ",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div className="section empty">กรุณาเข้าสู่ระบบ</div>;

  const { data: order } = await supabase.from("orders").select("*").eq("id", params.id).single();
  if (!order || order.buyer_id !== user.id) {
    return <div className="section empty">ไม่พบคำสั่งซื้อนี้</div>;
  }

  let qrDataUrl: string | null = null;
  if (order.status === "pending_payment" && process.env.PROMPTPAY_ID) {
    const payload = generatePayload(process.env.PROMPTPAY_ID, { amount: order.price });
    qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
  }

  let downloadUrl: string | null = null;
  if (order.status === "paid") {
    const admin = createAdminClient();
    const { data } = await admin.storage.from("full-files").createSignedUrl(order.full_path, 60 * 10);
    downloadUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="section" style={{ maxWidth: 560, margin: "0 auto" }}>
      <ErrorBanner message={searchParams.error} />
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontSize: "1.15rem" }}>{order.listing_title}</h2>
          <span className={`pill ${order.status}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
        </div>
        <p style={{ color: "var(--ink-faint)", fontSize: ".85rem", marginBottom: 14 }}>
          ผู้ขาย {order.seller_name} · สั่งซื้อ {formatDateTime(order.created_at)}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
          <span>ยอดชำระ</span>
          <span className="tab">฿{baht(order.price)}</span>
        </div>
      </div>

      {order.status === "pending_payment" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14 }}>ชำระเงินผ่าน QR พร้อมเพย์</h3>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="PromptPay QR" style={{ display: "block", margin: "0 auto" }} />
          ) : (
            <p style={{ color: "var(--danger)", fontSize: ".85rem" }}>
              ยังไม่ได้ตั้งค่า PROMPTPAY_ID ใน .env.local — เพิ่มเบอร์/เลขประจำตัวพร้อมเพย์ของคุณก่อน
            </p>
          )}
          <UploadSlipForm orderId={order.id} userId={user.id} />
        </div>
      )}

      {order.status === "verifying" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 600 }}>🔎 กำลังตรวจสอบสลิป</p>
          <p style={{ color: "var(--ink-faint)", fontSize: ".85rem" }}>
            ถ้าตั้งค่า SlipOK ไว้ ระบบจะตรวจสอบอัตโนมัติภายในไม่กี่วินาที ถ้ายังไม่ได้ตั้งค่า แอดมินจะตรวจสอบและอนุมัติด้วยมือ
          </p>
        </div>
      )}

      {order.status === "paid" && (
        <div className="card" style={{ textAlign: "center", background: "var(--success-soft)" }}>
          <p style={{ fontWeight: 700, color: "var(--success)" }}>✓ ชำระเงินเรียบร้อย</p>
          <p style={{ color: "var(--ink-soft)", fontSize: ".85rem", marginBottom: 16 }}>ยืนยันแล้วเมื่อ {formatDateTime(order.paid_at)}</p>
          {downloadUrl && (
            <a href={downloadUrl} className="btn">ดาวน์โหลดไฟล์ฉบับเต็ม</a>
          )}
          <p style={{ color: "var(--ink-faint)", fontSize: ".75rem", marginTop: 10 }}>ลิงก์นี้หมดอายุใน 10 นาที เพื่อความปลอดภัย</p>
        </div>
      )}

      {order.status === "rejected" && (
        <div className="card" style={{ textAlign: "center", background: "var(--danger-soft)" }}>
          <p style={{ fontWeight: 700, color: "var(--danger)" }}>สลิปไม่ผ่านการตรวจสอบ</p>
          <p style={{ color: "var(--ink-soft)", fontSize: ".85rem" }}>ติดต่อผู้ขายหรือแอดมินหากคิดว่านี่เป็นความผิดพลาด</p>
        </div>
      )}
    </div>
  );
}
