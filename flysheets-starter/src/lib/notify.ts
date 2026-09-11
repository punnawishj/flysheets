// Optional email notification to the admin whenever a new order needs a
// manual slip review -- powered by Resend (https://resend.com). This
// follows the same pattern as SLIPOK_API_KEY / PROMPTPAY_ID elsewhere in
// this app: if the env vars below aren't set, this silently does
// nothing and the admin just checks /admin manually -- nothing breaks
// either way.
function escapeHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

export async function notifyAdminNewOrder(order: { id: string; listing_title: string; buyer_name: string; price: number }) {
  const apiKey = process.env.RESEND_API_KEY;
  // NOTIFY_EMAIL lets the admin receive these somewhere other than their
  // login email; falls back to ADMIN_EMAIL since that's who approves
  // orders anyway.
  const to = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  const tag = `[notify order=${order.id}]`;

  if (!apiKey || !to) {
    console.log(`${tag} skipped: RESEND_API_KEY or an admin email is not set`);
    return;
  }

  // Resend's shared "resend.dev" sending domain (no setup, no DNS
  // records) can only deliver to the email address the Resend account
  // itself was signed up with -- see
  // https://resend.com/docs/knowledge-base/403-error-resend-dev-domain.
  // That's exactly this use case (notifying yourself), so as long as the
  // admin signs up for Resend with the same address as NOTIFY_EMAIL /
  // ADMIN_EMAIL, zero extra setup (no custom domain, no DNS) is needed.
  // Verifying a real domain later and setting NOTIFY_FROM_EMAIL lifts
  // that restriction.
  const from = process.env.NOTIFY_FROM_EMAIL || "flysheets <onboarding@resend.dev>";

  const siteUrl = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const adminLink = siteUrl ? `${siteUrl}/admin` : null;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `มีคำสั่งซื้อใหม่รอตรวจสอบสลิป · ${order.listing_title}`,
        html: `
          <p>มีคำสั่งซื้อใหม่ที่ต้องตรวจสอบสลิปการโอนเงินด้วยตัวเอง (ระบบตรวจอัตโนมัติไม่ผ่านหรือยังไม่ได้ตั้งค่า)</p>
          <ul>
            <li>ไฟล์: ${escapeHtml(order.listing_title)}</li>
            <li>ผู้ซื้อ: ${escapeHtml(order.buyer_name)}</li>
            <li>ยอดเงิน: ฿${order.price.toLocaleString("th-TH")}</li>
          </ul>
          ${adminLink ? `<p><a href="${adminLink}">เปิดหน้าแอดมินเพื่อตรวจสอบ</a></p>` : `<p>เข้าไปที่หน้า /admin ของเว็บคุณเพื่อตรวจสอบ</p>`}
        `,
      }),
    });
    if (!res.ok) {
      console.error(`${tag} Resend responded with ${res.status}:`, await res.text());
      return;
    }
    console.log(`${tag} admin notification email sent`);
  } catch (err) {
    console.error(`${tag} failed to send admin notification email:`, err);
  }
}
