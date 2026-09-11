import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "flysheets",
  description: "ตลาดซื้อขายชีทสรุป PDF ระหว่างนักศึกษา",
};

// Explicit on purpose: without this, some mobile browsers fall back to
// rendering the page at a wide "desktop" viewport and then shrinking it
// to fit the screen, which is exactly what makes buttons and layout look
// cramped/tiny on a phone even though the CSS itself is responsive.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <NavBar />
        <main className="shell">{children}</main>
        <footer style={{ textAlign: "center", color: "var(--ink-faint)", padding: "40px 0", fontSize: ".85rem" }}>
          flysheets © {new Date().getFullYear()} ·{" "}
          <Link href="/contact" style={{ color: "var(--ink-faint)", textDecoration: "underline" }}>
            ติดต่อเรา
          </Link>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
