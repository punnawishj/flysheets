"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminNewOrder } from "@/lib/notify";

// Optional automatic verification via a Thai slip-checking API such as
// https://slipok.com (or swap in easyslip.com / slip2go.com). If no API
// key is configured, the order is simply left in "verifying" for the
// admin to approve by hand in /admin -- the app works fully either way.
// Returns true only when it actually marked the order paid, so the
// caller knows whether the admin still needs to be notified.
async function tryAutoVerify(orderId: string, slipPath: string, expectedAmount: number): Promise<boolean> {
  const apiKey = process.env.SLIPOK_API_KEY;
  const branchId = process.env.SLIPOK_BRANCH_ID;
  const tag = `[SlipOK order=${orderId}]`;

  if (!apiKey || !branchId) {
    // This is the expected, silent path when auto-verify was never
    // configured -- but it's also EXACTLY what happens if the env vars
    // are misspelled, weren't added to the Production environment, or
    // were added without redeploying. Logging here means a look at the
    // Vercel Function logs can always tell the two apart.
    console.log(`${tag} skipped: SLIPOK_API_KEY or SLIPOK_BRANCH_ID is not set in this deployment`);
    return false;
  }

  try {
    const admin = createAdminClient();
    const { data: blob, error: dlErr } = await admin.storage.from("slips").download(slipPath);
    if (dlErr || !blob) {
      console.error(`${tag} could not download slip from storage:`, dlErr);
      return false;
    }

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
    console.log(`${tag} SlipOK responded (status ${res.status}):`, JSON.stringify(result));

    if (res.ok && result?.success && Number(result?.data?.amount) === expectedAmount) {
      await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);
      console.log(`${tag} auto-verified and marked paid`);
      return true;
    }
    console.log(
      `${tag} not auto-verified (expected ${expectedAmount}, got ${result?.data?.amount}) -- left for manual review`
    );
    // A non-match or an error just leaves the order in "verifying" for
    // manual review -- never auto-reject, since false negatives here
    // (blurry photo, OCR hiccup) would block a real paying customer.
    return false;
  } catch (err) {
    // Network/API error -- fall back to manual review.
    console.error(`${tag} SlipOK request threw:`, err);
    return false;
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

  const autoVerified = await tryAutoVerify(orderId, slipPath, order.price);

  // Only bother the admin's inbox when a human actually needs to look at
  // this -- SlipOK already resolved it above, no email needed.
  if (!autoVerified) {
    await notifyAdminNewOrder({
      id: orderId,
      listing_title: order.listing_title,
      buyer_name: order.buyer_name,
      price: order.price,
    });
  }

  revalidatePath(`/order/${orderId}`);
  return {};
}
