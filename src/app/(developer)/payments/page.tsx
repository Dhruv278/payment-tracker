import Link from "next/link";
import { Card, EmptyState, MilestoneBadge, PageHeader, Table, Td, cn } from "@/components/ui";
import { listPayments } from "@/lib/queries";
import { displayName, formatDate, formatMoney, formatTotals, sumByCurrency } from "@/lib/format";

export const metadata = { title: "Payments" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "proof_submitted", label: "To verify" },
  { value: "requested", label: "Awaiting client" },
  { value: "verified", label: "Paid" },
];

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const { status } = await searchParams;
  const current = typeof status === "string" && FILTERS.some((f) => f.value === status) ? status : "";
  const payments = await listPayments({ status: current || undefined });
  const total = sumByCurrency(payments, (p) => p.amount, (p) => p.currency);

  return (
    <>
      <PageHeader title="Payments" description="Every payment request you've sent, and where it stands." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/payments?status=${f.value}` : "/payments"}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", current === f.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <p className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-900">{formatTotals(total)}</span></p>
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No payments here" description="Request a payment from a project's milestone." />
      ) : (
        <Card>
          <Table head={["Updated", "Client", "Project / milestone", "Amount", "Status"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.updated_at)}</Td>
                <Td>{displayName(p.client)}</Td>
                <Td>
                  <Link href={`/payments/${p.id}`} className="font-medium text-slate-900 hover:underline">{p.project.name}</Link>
                  <p className="text-xs text-slate-500">{p.milestone.title}</p>
                </Td>
                <Td className="font-medium">{formatMoney(p.amount, p.currency)}</Td>
                <Td><MilestoneBadge status={p.status} /></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
