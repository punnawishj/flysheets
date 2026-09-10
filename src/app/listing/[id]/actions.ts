"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { splitPrice } from "@/lib/money";

export async function buyListing(listingId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Re-read the listing server-side so the price/commission are computed
  // from the real current price, never from anything the browser sent.
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();
  if (listingErr || !listing) throw new Error("ไม่พบไฟล์นี้");
  if (listing.seller_id === user.id) throw new Error("คุณเป็นผู้ขายไฟล์นี้ ไม่สามารถซื้อไฟล์ของตัวเองได้");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const { commission, sellerAmount } = splitPrice(listing.price);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      listing_id: listing.id,
      listing_title: listing.title,
      full_path: listing.full_path,
      buyer_id: user.id,
      buyer_name: profile?.name ?? user.email,
      seller_id: listing.seller_id,
      seller_name: listing.seller_name,
      price: listing.price,
      commission,
      seller_amount: sellerAmount,
    })
    .select("id")
    .single();

  if (error || !order) throw new Error("สร้างคำสั่งซื้อไม่สำเร็จ: " + error?.message);

  redirect(`/order/${order.id}`);
}
