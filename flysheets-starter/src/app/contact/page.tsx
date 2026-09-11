export const metadata = {
  title: "ติดต่อเรา · flysheets",
};

export default function ContactPage() {
  return (
    <div className="section" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 className="disp" style={{ fontSize: "1.6rem", marginBottom: 8 }}>
        ติดต่อเรา
      </h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
        มีปัญหาการใช้งาน การชำระเงิน หรือข้อสงสัยอื่นๆ ทักมาได้เลยตามช่องทางด้านล่าง
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <a
          href="https://lin.ee/y5ipUSz"
          target="_blank"
          rel="noopener noreferrer"
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#06C755",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: ".85rem",
              flexShrink: 0,
            }}
          >
            LINE
          </span>
          <span>
            <div style={{ fontWeight: 600 }}>แอดไลน์สอบถาม</div>
            <div style={{ color: "var(--ink-faint)", fontSize: ".9rem" }}>@mathpoonpun</div>
          </span>
        </a>

        <a
          href="https://www.facebook.com/share/1FVDGqAVos/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#1877F2",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "1.3rem",
              flexShrink: 0,
            }}
          >
            f
          </span>
          <span>
            <div style={{ fontWeight: 600 }}>เฟซบุ๊กเพจ</div>
            <div style={{ color: "var(--ink-faint)", fontSize: ".9rem" }}>คณิต by ปูนปั้น</div>
          </span>
        </a>
      </div>
    </div>
  );
}
