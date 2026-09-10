import { createClient } from "@/lib/supabase/server";
import { baht } from "@/lib/money";
import LoginButton from "@/components/LoginButton";
import { buyListing } from "./actions";

export default async function ListingPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!listing) {
    return <div className="section empty">ไม่พบไฟล์นี้ อาจถูกลบไปแล้ว</div>;
  }

  let previewUrl: string | null = null;
  if (listing.preview_path) {
    const { data } = supabase.storage.from("previews").getPublicUrl(listing.preview_path);
    previewUrl = data.publicUrl;
  }

  const isOwner = user?.id === listing.seller_id;

  return (
    <div className="section" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32 }}>
      <div>
        <div style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--accent-strong)" }}>{listing.subject}</div>
        <h1 style={{ fontSize: "1.6rem", margin: "10px 0" }}>{listing.title}</h1>
        <p style={{ color: "var(--ink-faint)", marginBottom: 20 }}>โดย {listing.seller_name}</p>

        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="btn outline">
            เปิดไฟล์ตัวอย่าง
          </a>
        ) : (
          <p style={{ color: "var(--ink-faint)" }}>ผู้ขายยังไม่แนบไฟล์ตัวอย่าง</p>
        )}

        <h3 style={{ marginTop: 24, marginBottom: 8 }}>รายละเอียด</h3>
        <p style={{ whiteSpace: "pre-wrap", color: "var(--ink-soft)" }}>
          {listing.description || "ไม่มีคำอธิบายเพิ่มเติมจากผู้ขาย"}
        </p>
      </div>

      <div className="card" style={{ height: "fit-content" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ color: "var(--ink-faint)" }}>ราคาไฟล์</span>
          <span className="tab price" style={{ fontSize: "1.4rem" }}>฿{baht(listing.price)}</span>
        </div>
        {isOwner ? (
          <div className="pill paid">นี่คือไฟล์ของคุณ</div>
        ) : user ? (
          <form action={buyListing.bind(null, listing.id)}>
            <button type="submit" className="btn primary" style={{ width: "100%" }}>
              ซื้อไฟล์นี้
            </button>
          </form>
        ) : (
          <LoginButton />
        )}
      </div>
    </div>
  );
}
