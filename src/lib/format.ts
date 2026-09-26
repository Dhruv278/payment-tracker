export const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "SGD", "AED"] as const;

export function formatMoney(amount: number | string | null | undefined, currency: string): string {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export type CurrencyTotal = { currency: string; amount: number };

/** Sums amounts grouped by currency, sorted by currency code. Currencies are never mixed. */
export function sumByCurrency<T>(rows: T[], amount: (r: T) => number, currency: (r: T) => string): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const c = currency(row);
    totals.set(c, (totals.get(c) ?? 0) + Number(amount(row)));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, value]) => ({ currency: c, amount: Math.round(value * 100) / 100 }));
}

/** Joins per-currency totals ("$1,200 + ₹36,000"). Shows zero in the fallback currency when empty. */
export function formatTotals(totals: CurrencyTotal[], emptyCurrency = "USD"): string {
  if (totals.length === 0) return formatMoney(0, emptyCurrency);
  return totals.map((t) => formatMoney(t.amount, t.currency)).join(" + ");
}

export function displayName(p: { full_name: string; email: string }): string {
  return p.full_name || p.email;
}

/** YYYY-MM-DD for today in local time, for date input defaults. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
