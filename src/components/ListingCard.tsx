import Link from "next/link";
import { baht } from "@/lib/money";

export type ListingRow = {
  id: string;
  title: string;
  subject: string;
  grade_level?: string | null;
  education_level?: string | null;
  price: number;
  seller_name: string;
};

export default function ListingCard({ listing }: { listing: ListingRow }) {
  const tag = [listing.grade_level, listing.subject].filter(Boolean).join(" · ") || listing.subject;
  return (
    <Link href={`/listing/${listing.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent-strong)" }}>{tag}</div>
      <div style={{ fontWeight: 600, margin: "6px 0 10px" }}>{listing.title}</div>
      <div style={{ fontSize: ".8rem", color: "var(--ink-faint)", marginBottom: 8 }}>โดย {listing.seller_name}</div>
      <div className="tab price">฿{baht(listing.price)}</div>
    </Link>
  );
}
