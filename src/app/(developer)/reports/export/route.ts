import type { NextRequest } from "next/server";
import { authorizeDeveloper } from "@/lib/auth";
import { buildReport, parseReportFilters } from "@/lib/reports";
import { displayName, today } from "@/lib/format";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const dev = await authorizeDeveloper();
  if (!dev) return new Response("Unauthorized", { status: 401 });

  const filters = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { rows } = await buildReport(filters);

  const header = [
    "Received on", "Client", "Company", "Project", "Milestone",
    "Billed amount", "Billed currency", "Net amount", "Net currency",
    "Client paid on", "Client reference", "Verified at", "Note",
  ];
  const lines = rows.map((r) =>
    [
      r.earning.received_on, displayName(r.client), r.client.company, r.project.name, r.milestone.title,
      r.amount, r.currency, r.earning.net_amount, r.earning.net_currency,
      r.client_paid_on, r.client_reference, r.verified_at, r.earning.note,
    ]
      .map(csvCell)
      .join(","),
  );

  return new Response([header.map(csvCell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
