import "server-only";
import { listVerifiedPayments, type VerifiedPaymentRow } from "@/lib/queries";
import { displayName, sumByCurrency, today, type CurrencyTotal } from "@/lib/format";

export type ReportFilters = { from?: string; to?: string; clientId?: string; projectId?: string };

type Group = { key: string; label: string; count: number; billed: CurrencyTotal[]; net: CurrencyTotal[] };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export function parseReportFilters(params: Record<string, string | string[] | undefined>): ReportFilters {
  return {
    from: isDate(params.from) ? params.from : undefined,
    to: isDate(params.to) ? params.to : undefined,
    clientId: isId(params.client) ? params.client : undefined,
    projectId: isId(params.project) ? params.project : undefined,
  };
}

function group(rows: VerifiedPaymentRow[], key: (r: VerifiedPaymentRow) => string, label: (r: VerifiedPaymentRow) => string): Group[] {
  const map = new Map<string, VerifiedPaymentRow[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return [...map.entries()]
    .map(([k, list]) => ({
      key: k,
      label: label(list[0]),
      count: list.length,
      billed: sumByCurrency(list, (r) => r.amount, (r) => r.currency),
      net: sumByCurrency(list, (r) => r.earning.net_amount, (r) => r.earning.net_currency),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function buildReport(filters: ReportFilters) {
  const rows = (await listVerifiedPayments(filters)).sort((a, b) => b.earning.received_on.localeCompare(a.earning.received_on));
  return {
    rows,
    billed: sumByCurrency(rows, (r) => r.amount, (r) => r.currency),
    net: sumByCurrency(rows, (r) => r.earning.net_amount, (r) => r.earning.net_currency),
    byClient: group(rows, (r) => r.client.id, (r) => displayName(r.client)),
    byProject: group(rows, (r) => r.project.id, (r) => r.project.name),
  };
}

/** Preset date ranges, including the Indian financial year (Apr–Mar). */
export function datePresets() {
  const now = today();
  const [y, m] = now.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
  const prevMonthYear = m === 1 ? y - 1 : y;
  const prevMonth = m === 1 ? 12 : m - 1;
  const fyStart = m >= 4 ? y : y - 1;

  return [
    { label: "This month", from: `${y}-${pad(m)}-01`, to: now },
    { label: "Last month", from: `${prevMonthYear}-${pad(prevMonth)}-01`, to: `${prevMonthYear}-${pad(prevMonth)}-${lastDay(prevMonthYear, prevMonth)}` },
    { label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}`, from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` },
    { label: `FY ${fyStart - 1}-${String(fyStart).slice(2)}`, from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` },
    { label: `Year ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
  ];
}
