"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/");
  return user;
}

export async function approveOrder(orderId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function rejectOrder(orderId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("orders").update({ status: "rejected" }).eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function markPayoutPaid(sellerId: string, orderIdsCsv: string) {
  await requireAdmin();
  const orderIds = orderIdsCsv.split(",").filter(Boolean);
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ payout_status: "paid", payout_at: new Date().toISOString() })
    .eq("seller_id", sellerId)
    .in("id", orderIds);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
