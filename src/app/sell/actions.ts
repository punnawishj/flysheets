"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (error) throw new Error("บันทึกไม่สำเร็จ: " + error.message);
  revalidatePath("/sell");
}

export async function createListing(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, is_seller")
    .eq("id", user.id)
    .single();
  if (!profile?.is_seller) throw new Error("ต้องสมัครเป็นผู้ขายก่อนจึงจะลงขายไฟล์ได้");

  const title = String(formData.get("title") || "").trim();
  const subject = String(formData.get("subject") || "อื่นๆ");
  const description = String(formData.get("description") || "").trim();
  const price = Math.max(0, Math.round(Number(formData.get("price")) || 0));
  const previewFile = formData.get("previewFile") as File | null;
  const fullFile = formData.get("fullFile") as File | null;

  if (!title || !price || !fullFile || fullFile.size === 0) {
    throw new Error("กรุณากรอกชื่อไฟล์ ราคา และแนบไฟล์ฉบับเต็ม");
  }

  let previewPath: string | null = null;
  if (previewFile && previewFile.size > 0) {
    previewPath = `${user.id}/${crypto.randomUUID()}-${previewFile.name}`;
    const { error: upErr } = await supabase.storage.from("previews").upload(previewPath, previewFile);
    if (upErr) throw new Error("อัปโหลดไฟล์ตัวอย่างไม่สำเร็จ: " + upErr.message);
  }

  const fullPath = `${user.id}/${crypto.randomUUID()}-${fullFile.name}`;
  const { error: fullErr } = await supabase.storage.from("full-files").upload(fullPath, fullFile);
  if (fullErr) throw new Error("อัปโหลดไฟล์ฉบับเต็มไม่สำเร็จ: " + fullErr.message);

  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    seller_name: profile.name,
    title,
    subject,
    description,
    price,
    preview_path: previewPath,
    full_path: fullPath,
  });

  if (error) throw new Error("บันทึกรายการไม่สำเร็จ: " + error.message);
  revalidatePath("/sell");
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
  if (error) throw new Error("ลบไม่สำเร็จ: " + error.message);
  revalidatePath("/sell");
}
