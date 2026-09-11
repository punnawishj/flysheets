"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Optional automatic verification via a Thai slip-checking API such as
// https://slipok.com (or swap in easyslip.com / slip2go.com). If no API
// key is configured, the order is simply left in "verifying" for the
// admin to approve by hand in /admin -- the app works fully either way.
async function tryAutoVerify(orderId: string, slipPath: string, expectedAmount: number) {
  const apiKey = process.env.SLIPOK_API_KEY;
  const branchId = process.env.SLIPOK_BRANCH_ID;
  if (!apiKey || !branchId) return; // manual review path

  try {
    const admin = createAdminClient();
    const { data: blob, error: dlErr } = await admin.storage.from("slips").download(slipPath);
    if (dlErr || !blob) return;

    const body = new FormData();
    body.append("files", blob, "slip.jpg");
    body.append("log", "true");
    body.append("amount", String(expectedAmount));

    const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: "POST",
      headers: { "x-authorization": apiKey },
      body,
    });
    const result = await res.json();

    if (res.ok && result?.success && Number(result?.data?.amount) === expectedAmount) {
      await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
    }
    // A non-match or an error just leaves the order in "verifying" for
    // manual review -- never auto-reject, since false negatives here
    // (blurry photo, OCR hiccup) would block a real paying customer.
  } catch {
    // Network/API error -- fall back to manual review.
  }
}

// Only ever receives the order id and the storage path of a slip that's
// already been uploaded straight from the browser to Supabase Storage
// (see UploadSlipForm.tsx) -- never the image bytes themselves, so this
// never risks Vercel's 4.5MB Function body limit no matter how big the
// buyer's phone photo is.
export async function recordSlipUpload(orderId: string, slipPath: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.buyer_id !== user.id) return { error: "ไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้" };
  if (order.status !== "pending_payment") return { error: "คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะรอชำระเงิน" };

  // Buyers have no UPDATE policy on orders (see schema.sql) -- the admin
  // client performs this write after the ownership check above.
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "verifying", slip_path: slipPath })
    .eq("id", orderId);
  if (error) return { error: "อัปเดตสถานะไม่สำเร็จ: " + error.message };

  await tryAutoVerify(orderId, slipPath, order.price);

  revalidatePath(`/order/${orderId}`);
  return {};
}
