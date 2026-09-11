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

// parentId is "" for a top-level category (education level, e.g. a third
// alongside มัธยม/มหาลัย) or the id of the category this one nests under
// (a grade/year under an education level, or a subject under a
// grade/year) -- the tree can be as deep as the admin wants, the app
// itself only ever reads the top 3 levels.
export async function addCategory(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const parentIdRaw = String(formData.get("parentId") || "").trim();
  const parentId = parentIdRaw || null;
  if (!name) fail("กรุณากรอกชื่อหมวดหมู่");

  const admin = createAdminClient();

  let query = admin.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data: existing } = await query.single();
  const nextSortOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await admin.from("categories").insert({ name, parent_id: parentId, sort_order: nextSortOrder });
  if (error) {
    // Postgres unique_violation (categories_top_level_name_uniq /
    // categories_child_name_uniq in schema.sql)
    if (error.code === "23505") fail(`มีหมวดหมู่ "${name}" อยู่แล้วในระดับนี้`);
    fail("เพิ่มหมวดหมู่ไม่สำเร็จ: " + error.message);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/sell");
  revalidatePath("/");
}

// Deleting a category cascades to everything nested under it (schema.sql
// declares parent_id with "on delete cascade") -- deleting "มัธยม" would
// also delete every grade and every subject listed under it. Listings
// already posted keep their original text either way (see the comment
// on the categories table in schema.sql), so this never touches past
// sales -- only what shows up as a choice going forward.
export async function deleteCategory(categoryId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", categoryId);
  if (error) fail("ลบหมวดหมู่ไม่สำเร็จ: " + error.message);

  revalidatePath("/admin/categories");
  revalidatePath("/sell");
  revalidatePath("/");
}
