import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorBanner } from "@/components/Banner";
import { addCategory, deleteCategory } from "./actions";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return <div className="section empty">หน้านี้สำหรับแอดมินเท่านั้น</div>;
  }

  // The category list is public-readable (see schema.sql), so the
  // regular RLS-respecting client is enough here -- no need for the
  // service-role client just to read it.
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  // Every listing currently posted under each category name, so the
  // admin can see at a glance what deleting one would leave behind
  // (existing listings keep their subject text either way -- see the
  // comment in schema.sql -- but it's worth knowing before deleting).
  const { data: listings } = await supabase.from("listings").select("subject").eq("active", true);
  const countBySubject: Record<string, number> = {};
  for (const l of listings ?? []) {
    countBySubject[l.subject] = (countBySubject[l.subject] ?? 0) + 1;
  }

  return (
    <div className="section" style={{ maxWidth: 520, margin: "0 auto" }}>
      <Link href="/admin" style={{ color: "var(--ink-faint)", fontSize: ".85rem" }}>
        ← กลับไปแดชบอร์ดแอดมิน
      </Link>
      <h2 style={{ fontSize: "1.4rem", margin: "10px 0 6px" }}>จัดการหมวดหมู่</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", marginBottom: 18 }}>
        หมวดหมู่เหล่านี้คือตัวเลือกที่ผู้ขายจะเห็นตอนลงขายไฟล์ใหม่ในหน้า "ขายไฟล์"
      </p>

      <ErrorBanner message={searchParams.error} />

      <form action={addCategory} className="card" style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input
          name="name"
          required
          placeholder="ชื่อหมวดหมู่ใหม่ เช่น ฟิสิกส์"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", font: "inherit" }}
        />
        <button type="submit" className="btn primary">
          เพิ่ม
        </button>
      </form>

      {categories && categories.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                {(countBySubject[c.name] ?? 0) > 0 && (
                  <div style={{ color: "var(--ink-faint)", fontSize: ".78rem" }}>
                    มีไฟล์ที่ลงขายอยู่ในหมวดนี้ {countBySubject[c.name]} รายการ
                  </div>
                )}
              </div>
              <form action={deleteCategory.bind(null, c.id)}>
                <button type="submit" className="btn outline" style={{ padding: "6px 14px", fontSize: ".85rem" }}>
                  ลบ
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">ยังไม่มีหมวดหมู่ — เพิ่มอันแรกด้านบนได้เลย</div>
      )}
    </div>
  );
}
