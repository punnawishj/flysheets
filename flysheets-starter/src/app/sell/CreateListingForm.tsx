"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createListingRecord } from "./actions";

type Category = { id: string; parent_id: string | null; name: string; sort_order: number };

// Keeps only a plain ASCII extension like ".pdf" -- falls back to no
// extension at all if the filename is missing one or has anything
// Supabase Storage would reject.
function safeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export default function CreateListingForm({ userId, categories }: { userId: string; categories: Category[] }) {
  // The category tree is managed by the admin (see /admin/categories) and
  // fetched by the server component that renders this form. It's a flat
  // list of {id, parent_id, name} rows -- three levels deep in practice
  // (education level -> grade/year -> subject) -- so the three selects
  // below just filter it by parent_id and cascade from there.
  const level1Options = categories.filter((c) => c.parent_id === null);

  const [level1Id, setLevel1Id] = useState(level1Options[0]?.id ?? "");
  const level2Options = categories.filter((c) => c.parent_id === level1Id);
  const [level2Id, setLevel2Id] = useState(level2Options[0]?.id ?? "");
  const level3Options = categories.filter((c) => c.parent_id === level2Id);
  const [level3Id, setLevel3Id] = useState(level3Options[0]?.id ?? "");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function handleLevel1Change(id: string) {
    setLevel1Id(id);
    const nextLevel2 = categories.filter((c) => c.parent_id === id);
    const nextLevel2Id = nextLevel2[0]?.id ?? "";
    setLevel2Id(nextLevel2Id);
    const nextLevel3 = categories.filter((c) => c.parent_id === nextLevel2Id);
    setLevel3Id(nextLevel3[0]?.id ?? "");
  }

  function handleLevel2Change(id: string) {
    setLevel2Id(id);
    const nextLevel3 = categories.filter((c) => c.parent_id === id);
    setLevel3Id(nextLevel3[0]?.id ?? "");
  }

  const educationLevel = categories.find((c) => c.id === level1Id)?.name ?? "";
  const gradeLevel = categories.find((c) => c.id === level2Id)?.name ?? "";
  const subject = categories.find((c) => c.id === level3Id)?.name ?? "";
  const categoriesIncomplete = !educationLevel || !gradeLevel || !subject;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const price = Math.max(0, Math.round(Number(formData.get("price")) || 0));
    const previewFile = formData.get("previewFile") as File | null;
    const fullFile = formData.get("fullFile") as File | null;

    if (categoriesIncomplete) {
      setError("กรุณาเลือกหมวดหมู่ให้ครบ (ระดับการศึกษา, ระดับชั้น/ปี, วิชา)");
      return;
    }
    if (!title || !price || !fullFile || fullFile.size === 0) {
      setError("กรุณากรอกชื่อไฟล์ ราคา และแนบไฟล์ฉบับเต็ม");
      return;
    }
    if (fullFile.size > 20 * 1024 * 1024) {
      setError("ไฟล์ฉบับเต็มใหญ่เกิน 20MB กรุณาบีบอัดไฟล์ก่อนอัปโหลด");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // Upload straight from the browser to Supabase Storage. This request
    // goes directly to Supabase, not through our own server, so Vercel's
    // 4.5MB Function body limit never applies to it.
    //
    // Supabase Storage rejects object keys that contain non-ASCII
    // characters (Thai filenames), spaces, or certain punctuation with an
    // "Invalid key" error. The original filename is only cosmetic here --
    // the title the buyer sees comes from the "title" field, not the
    // filename -- so we build the storage key from a random id plus just
    // the file extension, which is always safe.
    let previewPath: string | null = null;
    if (previewFile && previewFile.size > 0) {
      previewPath = `${userId}/${crypto.randomUUID()}${safeExtension(previewFile.name)}`;
      const { error: upErr } = await supabase.storage.from("previews").upload(previewPath, previewFile);
      if (upErr) {
        setError("อัปโหลดไฟล์ตัวอย่างไม่สำเร็จ: " + upErr.message);
        setSubmitting(false);
        return;
      }
    }

    const fullPath = `${userId}/${crypto.randomUUID()}${safeExtension(fullFile.name)}`;
    const { error: fullErr } = await supabase.storage.from("full-files").upload(fullPath, fullFile);
    if (fullErr) {
      setError("อัปโหลดไฟล์ฉบับเต็มไม่สำเร็จ: " + fullErr.message);
      setSubmitting(false);
      return;
    }

    // Only the small text fields + the resulting storage paths go to our
    // server from here -- never the file bytes themselves.
    const result = await createListingRecord({
      title,
      educationLevel,
      gradeLevel,
      subject,
      description,
      price,
      previewPath,
      fullPath,
    });
    setSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    form.reset();
    handleLevel1Change(level1Options[0]?.id ?? "");
    router.push("/sell?created=1");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div
          style={{
            background: "var(--danger-soft)",
            color: "var(--danger)",
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 16,
            fontSize: ".9rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="title">ชื่อไฟล์</label>
        <input id="title" name="title" required placeholder="เช่น สรุปเนื้อหาก่อนสอบไฟนอล" />
      </div>

      {level1Options.length === 0 ? (
        <div
          style={{
            background: "var(--danger-soft)",
            color: "var(--danger)",
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 16,
            fontSize: ".85rem",
          }}
        >
          ยังไม่มีหมวดหมู่ในระบบ กรุณาให้แอดมินเพิ่มหมวดหมู่ที่หน้า /admin/categories ก่อน
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div className="field">
            <label htmlFor="level1">ระดับการศึกษา</label>
            <select id="level1" value={level1Id} onChange={(e) => handleLevel1Change(e.target.value)}>
              {level1Options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="level2">ระดับชั้น/ปี</label>
            {level2Options.length > 0 ? (
              <select id="level2" value={level2Id} onChange={(e) => handleLevel2Change(e.target.value)}>
                {level2Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ color: "var(--ink-faint)", fontSize: ".85rem", padding: "10px 0" }}>
                ยังไม่มีตัวเลือกในหมวดนี้
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="level3">วิชา</label>
            {level3Options.length > 0 ? (
              <select id="level3" value={level3Id} onChange={(e) => setLevel3Id(e.target.value)}>
                {level3Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ color: "var(--ink-faint)", fontSize: ".85rem", padding: "10px 0" }}>
                ยังไม่มีตัวเลือกในหมวดนี้
              </div>
            )}
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="description">รายละเอียด</label>
        <textarea id="description" name="description" rows={3} placeholder="เนื้อหาครอบคลุมอะไรบ้าง กี่หน้า" />
      </div>
      <div className="field">
        <label htmlFor="price">ราคา (บาท)</label>
        <input id="price" name="price" type="number" min={0} required placeholder="99" />
      </div>
      <div className="field">
        <label htmlFor="previewFile">ไฟล์ตัวอย่าง (แสดงหน้าเว็บ)</label>
        <input id="previewFile" name="previewFile" type="file" accept=".pdf,image/*" />
      </div>
      <div className="field">
        <label htmlFor="fullFile">ไฟล์ฉบับเต็ม (ต้องซื้อก่อนถึงดาวน์โหลดได้)</label>
        <input id="fullFile" name="fullFile" type="file" accept=".pdf" required />
      </div>
      <button type="submit" className="btn primary" disabled={submitting || categoriesIncomplete}>
        {submitting ? "กำลังอัปโหลด..." : "ลงขายชีทนี้"}
      </button>
    </form>
  );
}
