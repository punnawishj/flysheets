import Link from "next/link";
import { baht } from "@/lib/money";

export type ListingRow = {
  id: string;
  title: string;
  subject: string;
  price: number;
  seller_name: string;
};

export default function ListingCard({ listing }: { listing: ListingRow }) {
  return (
    <Link href={`/listing/${listing.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent-strong)" }}>{listing.subject}</div>
      <div style={{ fontWeight: 600, margin: "6px 0 10px" }}>{listing.title}</div>
      <div style={{ fontSize: ".8rem", color: "var(--ink-faint)", marginBottom: 8 }}>โดย {listing.seller_name}</div>
      <div className="tab price">฿{baht(listing.price)}</div>
    </Link>
  );
}
