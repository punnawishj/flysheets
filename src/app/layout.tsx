import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "flysheets",
  description: "ตลาดซื้อขายชีทสรุป PDF ระหว่างนักศึกษา",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <NavBar />
        <main className="shell">{children}</main>
        <footer style={{ textAlign: "center", color: "var(--ink-faint)", padding: "40px 0", fontSize: ".85rem" }}>
          flysheets © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
