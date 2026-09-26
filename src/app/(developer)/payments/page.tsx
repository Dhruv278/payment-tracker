import Link from "next/link";
import { FilterTabs } from "@/components/filter-tabs";
import { Card, EmptyState, MilestoneBadge, PageHeader, Table, Td } from "@/components/ui";
import { listPayments } from "@/lib/queries";
import { displayName, formatDate, formatMoney, formatTotals, sumByCurrency } from "@/lib/format";

export const metadata = { title: "Invoices" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "proof_submitted", label: "To verify" },
  { value: "requested", label: "Sent" },
  { value: "verified", label: "Paid" },
];

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const { status } = await searchParams;
  const current = typeof status === "string" && FILTERS.some((f) => f.value === status) ? status : "";
  const payments = await listPayments({ status: current || undefined });
  const total = sumByCurrency(payments, (p) => p.amount, (p) => p.currency);

  return (
    <>
      <PageHeader title="Invoices" description="Every invoice you've sent and where it stands." />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterTabs filters={FILTERS} current={current} href={(v) => (v ? `/payments?status=${v}` : "/payments")} />
        {payments.length > 0 && (
          <p className="figures pt-2 text-sm text-graphite">
            {payments.length} invoice{payments.length > 1 ? "s" : ""} totalling <span className="font-semibold text-ink">{formatTotals(total)}</span>
          </p>
        )}
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No invoices here" description="Open a project and create an invoice when part of the work is done." />
      ) : (
        <Card>
          <Table head={["Last update", "Invoice", "Client", "Amount", "Status"]} align={["left", "left", "left", "right", "left"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="text-graphite">{formatDate(p.updated_at)}</Td>
                <Td>
                  <Link href={`/payments/${p.id}`} className="font-medium hover:underline">{p.milestone.title}</Link>
                  <p className="text-xs text-graphite">{p.project.name}</p>
                </Td>
                <Td>{displayName(p.client)}</Td>
                <Td align="right" className="font-semibold">{formatMoney(p.amount, p.currency)}</Td>
                <Td>
                  <MilestoneBadge status={p.status} />
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
