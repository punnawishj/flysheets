import { createClient } from "@/lib/supabase/server";
import ListingCard from "@/components/ListingCard";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? "";

  let query = supabase
    .from("listings")
    .select("id, title, subject, price, seller_name")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,subject.ilike.%${q}%,seller_name.ilike.%${q}%`);
  }

  const { data: listings, error } = await query;

  return (
    <div className="section">
      <h1 className="disp" style={{ fontSize: "2rem", marginBottom: 8 }}>
        ซื้อขายชีทสรุประหว่างเพื่อนนักศึกษา
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 24, maxWidth: "60ch" }}>
        ผู้ขายได้รับ 80% ของราคาขายทุกครั้ง โอนเข้าบัญชีให้ทุกสัปดาห์
      </p>

      <form style={{ marginBottom: 24 }}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อวิชา, รายวิชา, ผู้ขาย..."
          style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid var(--border)", width: "100%", maxWidth: 380 }}
        />
      </form>

      {error && <p style={{ color: "var(--danger)" }}>โหลดรายการไม่สำเร็จ: {error.message}</p>}

      {listings && listings.length > 0 ? (
        <div className="grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="empty">ยังไม่มีไฟล์ในระบบ — เป็นคนแรกที่ลงขายสิ!</div>
      )}
    </div>
  );
}
