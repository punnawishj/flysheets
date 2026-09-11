"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUBJECTS } from "@/lib/constants";
import { createListingRecord } from "./actions";

export default function CreateListingForm({ userId }: { userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const subject = String(formData.get("subject") || "อื่นๆ");
    const description = String(formData.get("description") || "").trim();
    const price = Math.max(0, Math.round(Number(formData.get("price")) || 0));
    const previewFile = formData.get("previewFile") as File | null;
    const fullFile = formData.get("fullFile") as File | null;

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
    let previewPath: string | null = null;
    if (previewFile && previewFile.size > 0) {
      previewPath = `${userId}/${crypto.randomUUID()}-${previewFile.name}`;
      const { error: upErr } = await supabase.storage.from("previews").upload(previewPath, previewFile);
      if (upErr) {
        setError("อัปโหลดไฟล์ตัวอย่างไม่สำเร็จ: " + upErr.message);
        setSubmitting(false);
        return;
      }
    }

    const fullPath = `${userId}/${crypto.randomUUID()}-${fullFile.name}`;
    const { error: fullErr } = await supabase.storage.from("full-files").upload(fullPath, fullFile);
    if (fullErr) {
      setError("อัปโหลดไฟล์ฉบับเต็มไม่สำเร็จ: " + fullErr.message);
      setSubmitting(false);
      return;
    }

    // Only the small text fields + the resulting storage paths go to our
    // server from here -- never the file bytes themselves.
    const result = await createListingRecord({ title, subject, description, price, previewPath, fullPath });
    setSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    form.reset();
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
        <label htmlFor="title">ชื่อไฟล์ / รายวิชา</label>
        <input id="title" name="title" required placeholder="เช่น สรุป Rock Mechanics ก่อนสอบไฟนอล" />
      </div>
      <div className="field">
        <label htmlFor="subject">หมวดหมู่</label>
        <select id="subject" name="subject">
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
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
      <button type="submit" className="btn primary" disabled={submitting}>
        {submitting ? "กำลังอัปโหลด..." : "ลงขายชีทนี้"}
      </button>
    </form>
  );
}
