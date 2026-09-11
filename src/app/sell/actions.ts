"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fail(message: string): never {
  redirect(`/sell?error=${encodeURIComponent(message)}`);
}

export async function becomeSeller(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const bank_name = String(formData.get("bankName") || "");
  const bank_account_number = String(formData.get("accountNumber") || "").trim();
  const bank_account_name = String(formData.get("accountName") || "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({ is_seller: true, bank_name, bank_account_number, bank_account_name })
    .eq("id", user.id);

  if (error) fail("บันทึกไม่สำเร็จ: " + error.message);
  revalidatePath("/sell");
}

// Only ever receives the listing's TEXT fields plus storage paths -- the
// actual PDF bytes are uploaded straight from the browser to Supabase
// Storage (see CreateListingForm.tsx) and never pass through this
// function. That matters on Vercel specifically: every Server Action is a
// Vercel Function under the hood, and Vercel Functions hard-cap the
// request body at 4.5MB with no way to raise it -- a real study-sheet PDF
// blows past that instantly. Routing the file straight to Supabase from
// the browser sidesteps that limit entirely, since the file never touches
// our own server.
export async function createListingRecord(input: {
  title: string;
  subject: string;
  description: string;
  price: number;
  previewPath: string | null;
  fullPath: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, is_seller")
    .eq("id", user.id)
    .single();
  if (!profile?.is_seller) return { error: "ต้องสมัครเป็นผู้ขายก่อนจึงจะลงขายไฟล์ได้" };

  const title = input.title.trim();
  const price = Math.max(0, Math.round(input.price || 0));
  if (!title || !price || !input.fullPath) {
    return { error: "กรุณากรอกชื่อไฟล์ ราคา และแนบไฟล์ฉบับเต็ม" };
  }

  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    seller_name: profile.name,
    title,
    subject: input.subject || "อื่นๆ",
    description: input.description?.trim() || "",
    price,
    preview_path: input.previewPath,
    full_path: input.fullPath,
  });

  if (error) return { error: "บันทึกรายการไม่สำเร็จ: " + error.message };

  revalidatePath("/sell");
  return {};
}

export async function deleteListing(listingId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // RLS (listings_update_own) guarantees this only ever touches the
  // caller's own listing even if someone tampers with the id client-side.
  const { error } = await supabase.from("listings").update({ active: false }).eq("id", listingId);
  if (error) fail("ลบไม่สำเร็จ: " + error.message);
  revalidatePath("/sell");
}
