import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ListingCard from "@/components/ListingCard";

type SearchParams = { q?: string; edu?: string; grade?: string; subject?: string };

function tabHref(base: SearchParams, overrides: SearchParams) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.edu) params.set("edu", merged.edu);
  if (merged.grade) params.set("grade", merged.grade);
  if (merged.subject) params.set("subject", merged.subject);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? "";
  const edu = searchParams.edu?.trim() ?? "";
  const grade = searchParams.grade?.trim() ?? "";
  const subject = searchParams.subject?.trim() ?? "";

  // The category tab bar reads straight off the same "categories" tree
  // the admin manages at /admin/categories (education level -> grade/year
  // -> subject) -- each row below is the CHILDREN of whatever's selected
  // one level up, so the tabs always match what's actually configured
  // instead of a hardcoded list.
  const { data: level1Categories } = await supabase
    .from("categories")
    .select("id, name")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  let level2Categories: { id: string; name: string }[] = [];
  if (edu) {
    const eduRow = (level1Categories ?? []).find((c) => c.name === edu);
    if (eduRow) {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("parent_id", eduRow.id)
        .order("sort_order", { ascending: true });
      level2Categories = data ?? [];
    }
  }

  let level3Categories: { id: string; name: string }[] = [];
  if (edu && grade) {
    const gradeRow = level2Categories.find((c) => c.name === grade);
    if (gradeRow) {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("parent_id", gradeRow.id)
        .order("sort_order", { ascending: true });
      level3Categories = data ?? [];
    }
  }

  let query = supabase
    .from("listings")
    .select("id, title, subject, grade_level, education_level, price, seller_name")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,subject.ilike.%${q}%,seller_name.ilike.%${q}%`);
  }
  if (edu) query = query.eq("education_level", edu);
  if (grade) query = query.eq("grade_level", grade);
  if (subject) query = query.eq("subject", subject);

  const { data: listings, error } = await query;

  return (
    <div className="section">
      <h1 className="disp" style={{ fontSize: "2rem", marginBottom: 8 }}>
        ซื้อขายชีทสรุประหว่างเพื่อนนักเรียน-นักศึกษา
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 24, maxWidth: "60ch" }}>
        สร้างรายได้จากการขายชีทคุณเองได้ที่นี่
      </p>

      <form style={{ marginBottom: 24 }}>
        {edu && <input type="hidden" name="edu" value={edu} />}
        {grade && <input type="hidden" name="grade" value={grade} />}
        {subject && <input type="hidden" name="subject" value={subject} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อวิชา, รายวิชา, ผู้ขาย..."
          style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid var(--border)", width: "100%", maxWidth: 380 }}
        />
      </form>

      {level1Categories && level1Categories.length > 0 && (
        <div className="tag-row">
          <Link href={tabHref({ q }, { edu: "", grade: "", subject: "" })} className={`tag ${!edu ? "active" : ""}`}>
            ทั้งหมด
          </Link>
          {level1Categories.map((c) => (
            <Link
              key={c.id}
              href={tabHref({ q }, { edu: c.name, grade: "", subject: "" })}
              className={`tag ${edu === c.name ? "active" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {edu && level2Categories.length > 0 && (
        <div className="tag-row">
          <Link href={tabHref({ q, edu }, { grade: "", subject: "" })} className={`tag ${!grade ? "active" : ""}`}>
            ทั้งหมด
          </Link>
          {level2Categories.map((c) => (
            <Link
              key={c.id}
              href={tabHref({ q, edu }, { grade: c.name, subject: "" })}
              className={`tag ${grade === c.name ? "active" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {edu && grade && level3Categories.length > 0 && (
        <div className="tag-row">
          <Link href={tabHref({ q, edu, grade }, { subject: "" })} className={`tag ${!subject ? "active" : ""}`}>
            ทั้งหมด
          </Link>
          {level3Categories.map((c) => (
            <Link
              key={c.id}
              href={tabHref({ q, edu, grade }, { subject: c.name })}
              className={`tag ${subject === c.name ? "active" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {error && <p style={{ color: "var(--danger)" }}>โหลดรายการไม่สำเร็จ: {error.message}</p>}

      {listings && listings.length > 0 ? (
        <div className="grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="empty">ไม่พบไฟล์ที่ตรงกับตัวกรองนี้</div>
      )}
    </div>
  );
}
