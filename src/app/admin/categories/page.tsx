import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorBanner } from "@/components/Banner";
import { addCategory, deleteCategory } from "./actions";

type Category = { id: string; parent_id: string | null; name: string; sort_order: number };

function AddForm({ parentId, placeholder, label }: { parentId: string; placeholder: string; label: string }) {
  return (
    <form action={addCategory} style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <input type="hidden" name="parentId" value={parentId} />
      <input
        name="name"
        required
        placeholder={placeholder}
        aria-label={label}
        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", font: "inherit", fontSize: ".9rem" }}
      />
      <button type="submit" className="btn outline" style={{ padding: "6px 14px", fontSize: ".85rem" }}>
        เพิ่ม
      </button>
    </form>
  );
}

function DeleteButton({ id, warnCascade }: { id: string; warnCascade?: boolean }) {
  return (
    <form action={deleteCategory.bind(null, id)}>
      <button
        type="submit"
        className="btn outline"
        style={{ padding: "4px 12px", fontSize: ".78rem" }}
        title={warnCascade ? "ลบข้อมูลนี้จะลบหมวดหมู่ย่อยทั้งหมดข้างในด้วย" : undefined}
      >
        ลบ
      </button>
    </form>
  );
}

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

  // The category tree is public-readable (see schema.sql), so the
  // regular RLS-respecting client is enough here -- no need for the
  // service-role client just to read it.
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, parent_id, name, sort_order")
    .order("sort_order", { ascending: true });
  const categories: Category[] = categoriesData ?? [];

  const level1 = categories.filter((c) => c.parent_id === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  // How many currently-active listings sit at each exact (education
  // level, grade/year, subject) combination, so the admin can see what
  // deleting a leaf would leave behind -- deleting never touches past
  // listings themselves (see schema.sql), only the future choice.
  const { data: listings } = await supabase
    .from("listings")
    .select("education_level, grade_level, subject")
    .eq("active", true);
  const countByLeaf: Record<string, number> = {};
  for (const l of listings ?? []) {
    const key = `${l.education_level ?? ""}|${l.grade_level ?? ""}|${l.subject ?? ""}`;
    countByLeaf[key] = (countByLeaf[key] ?? 0) + 1;
  }

  return (
    <div className="section" style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/admin" style={{ color: "var(--ink-faint)", fontSize: ".85rem" }}>
        ← กลับไปแดชบอร์ดแอดมิน
      </Link>
      <h2 style={{ fontSize: "1.4rem", margin: "10px 0 6px" }}>จัดการหมวดหมู่</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", marginBottom: 18 }}>
        โครงสร้าง 3 ชั้น: ระดับการศึกษา (เช่น มัธยม/มหาลัย) → ระดับชั้น/ปี (เช่น ม.4/ปี 2) → วิชา
        ผู้ขายจะเห็นตัวเลือกเหล่านี้ตอนลงขายไฟล์ และหน้าแรกจะใช้จัดแถบหมวดหมู่ให้ผู้ซื้อกรองดู
      </p>

      <ErrorBanner message={searchParams.error} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {level1.map((edu) => {
          const grades = childrenOf(edu.id);
          return (
            <div key={edu.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "1.05rem" }}>{edu.name}</h3>
                <DeleteButton id={edu.id} warnCascade={grades.length > 0} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, paddingLeft: 16, borderLeft: "2px solid var(--border)" }}>
                {grades.map((grade) => {
                  const subjects = childrenOf(grade.id);
                  return (
                    <div key={grade.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: ".92rem" }}>{grade.name}</strong>
                        <DeleteButton id={grade.id} warnCascade={subjects.length > 0} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, paddingLeft: 16, borderLeft: "2px solid var(--border)" }}>
                        {subjects.map((subject) => {
                          const count = countByLeaf[`${edu.name}|${grade.name}|${subject.name}`] ?? 0;
                          return (
                            <div key={subject.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: ".85rem" }}>
                                {subject.name}
                                {count > 0 && (
                                  <span style={{ color: "var(--ink-faint)", fontSize: ".75rem" }}> · มีไฟล์ {count} รายการ</span>
                                )}
                              </span>
                              <DeleteButton id={subject.id} />
                            </div>
                          );
                        })}
                        <AddForm parentId={grade.id} placeholder={`เพิ่มวิชาใน "${grade.name}"`} label={`เพิ่มวิชาใน ${grade.name}`} />
                      </div>
                    </div>
                  );
                })}
                <AddForm parentId={edu.id} placeholder={`เพิ่มระดับชั้น/ปีใน "${edu.name}"`} label={`เพิ่มระดับชั้นใน ${edu.name}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: ".95rem", marginBottom: 4 }}>เพิ่มระดับการศึกษาใหม่</h3>
        <p style={{ color: "var(--ink-faint)", fontSize: ".8rem", marginBottom: 4 }}>
          ปกติมีแค่ "มัธยม" กับ "มหาลัย" แต่เพิ่มหมวดใหญ่อื่นได้ถ้าต้องการ เช่น "ประถม"
        </p>
        <AddForm parentId="" placeholder="เช่น ประถม" label="เพิ่มระดับการศึกษาใหม่" />
      </div>

      {level1.length === 0 && <div className="empty">ยังไม่มีหมวดหมู่ — เพิ่มระดับการศึกษาแรกด้านบนได้เลย</div>}
    </div>
  );
}
