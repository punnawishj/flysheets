"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordSlipUpload } from "./actions";

export default function UploadSlipForm({ orderId, userId }: { orderId: string; userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const file = new FormData(form).get("slip") as File | null;
    if (!file || file.size === 0) {
      setError("กรุณาแนบไฟล์สลิป");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("ไฟล์สลิปใหญ่เกิน 8MB กรุณาถ่ายรูปใหม่หรือบีบอัดไฟล์");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // Straight from the browser to Supabase Storage -- see the comment in
    // actions.ts for why this has to bypass our own server.
    const slipPath = `${userId}/${orderId}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("slips").upload(slipPath, file);
    if (upErr) {
      setError("อัปโหลดสลิปไม่สำเร็จ: " + upErr.message);
      setSubmitting(false);
      return;
    }

    const result = await recordSlipUpload(orderId, slipPath);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
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
        <label htmlFor="slip">อัปโหลดสลิปโอนเงิน</label>
        <input id="slip" name="slip" type="file" accept="image/*" required />
      </div>
      <button type="submit" className="btn primary" style={{ width: "100%" }} disabled={submitting}>
        {submitting ? "กำลังอัปโหลด..." : "ยืนยันการชำระเงิน"}
      </button>
    </form>
  );
}
