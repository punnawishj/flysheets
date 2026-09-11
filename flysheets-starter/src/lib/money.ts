export const PLATFORM_FEE_RATE = 0.2; // flysheets keeps 20%, seller keeps 80%

export function splitPrice(price: number) {
  const commission = Math.round(price * PLATFORM_FEE_RATE);
  return { commission, sellerAmount: price - commission };
}

export function baht(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("th-TH");
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
