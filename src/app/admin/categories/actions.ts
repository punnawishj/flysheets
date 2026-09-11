"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string): never {
  redirect(`/admin/categories?error=${encodeURIComponent(message)}`);
}

// Every action here re-checks the signed-in user against ADMIN_EMAIL
// itself -- it never trusts that only an admin could have reached this
// form, since a server action is a public URL regardless of which page
// links to it.
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    fail("หน้านี้สำหรับแอดมินเท่านั้น");
  }
}

export async function addCategory(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  if (!name) fail("กรุณากรอกชื่อหมวดหมู่");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextSortOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await admin.from("categories").insert({ name, sort_order: nextSortOrder });
  if (error) {
    // Postgres unique_violation
    if (error.code === "23505") fail(`มีหมวดหมู่ "${name}" อยู่แล้ว`);
    fail("เพิ่มหมวดหมู่ไม่สำเร็จ: " + error.message);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/sell");
}

export async function deleteCategory(categoryId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", categoryId);
  if (error) fail("ลบหมวดหมู่ไม่สำเร็จ: " + error.message);

  revalidatePath("/admin/categories");
  revalidatePath("/sell");
}
