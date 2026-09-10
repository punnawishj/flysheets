"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(orderId: string, message: string): never {
  redirect(`/order/${orderId}?error=${encodeURIComponent(message)}`);
}

// Optional automatic verification via a Thai slip-checking API such as
// https://slipok.com (or swap in easyslip.com / slip2go.com). If no API
// key is configured, the order is simply left in "verifying" for the
// admin to approve by hand in /admin -- the app works fully either way.
async function tryAutoVerify(orderId: string, slipFile: File, expectedAmount: number) {
  const apiKey = process.env.SLIPOK_API_KEY;
  const branchId = process.env.SLIPOK_BRANCH_ID;
  if (!apiKey || !branchId) return; // manual review path

  try {
    const body = new FormData();
    body.append("files", slipFile);
    body.append("log", "true");
    body.append("amount", String(expectedAmount));

    const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: "POST",
      headers: { "x-authorization": apiKey },
      body,
    });
    const result = await res.json();

    if (res.ok && result?.success && Number(result?.data?.amount) === expectedAmount) {
      const admin = createAdminClient();
      await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
    }
    // A non-match or an error just leaves the order in "verifying" for
    // manual review -- never auto-reject, since false negatives here
    // (blurry photo, OCR hiccup) would block a real paying customer.
  } catch {
    // Network/API error -- fall back to manual review.
  }
}

export async function uploadSlip(orderId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.buyer_id !== user.id) fail(orderId, "ไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้");
  if (order.status !== "pending_payment") fail(orderId, "คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะรอชำระเงิน");

  const slipFile = formData.get("slip") as File | null;
  if (!slipFile || slipFile.size === 0) fail(orderId, "กรุณาแนบไฟล์สลิป");
  if (slipFile.size > 8 * 1024 * 1024) fail(orderId, "ไฟล์สลิปใหญ่เกิน 8MB กรุณาถ่ายรูปใหม่หรือบีบอัดไฟล์");

  const slipPath = `${user.id}/${orderId}-${Date.now()}-${slipFile.name}`;
  const { error: upErr } = await supabase.storage.from("slips").upload(slipPath, slipFile);
  if (upErr) fail(orderId, "อัปโหลดสลิปไม่สำเร็จ: " + upErr.message);

  // Buyers have no UPDATE policy on orders (see schema.sql) -- the admin
  // client performs this write after the ownership check above.
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "verifying", slip_path: slipPath })
    .eq("id", orderId);
  if (error) fail(orderId, "อัปเดตสถานะไม่สำเร็จ: " + error.message);

  await tryAutoVerify(orderId, slipFile, order.price);

  revalidatePath(`/order/${orderId}`);
}
