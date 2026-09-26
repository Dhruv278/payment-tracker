import Link from "next/link";
import { Card, EmptyState, MilestoneBadge, PageHeader, ProgressBar, ProjectBadge, Table, Td, buttonStyles } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { listPayments, listProjects, summarizeProject } from "@/lib/queries";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function PortalPage() {
  const profile = await requireClient();
  const [projects, payments] = await Promise.all([listProjects(), listPayments()]);
  const toPay = payments.filter((p) => p.status === "requested");

  return (
    <>
      <PageHeader title={`Hi, ${profile.full_name || "there"}`} description="Your projects, payment requests and payment history." />

      {toPay.length > 0 && (
        <Card title={`Payments due (${toPay.length})`} className="mb-6 border-amber-200">
          <ul className="divide-y divide-slate-100">
            {toPay.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{p.project.name} — {p.milestone.title}</p>
                  <p className="text-xs text-slate-500">
                    Requested {formatDate(p.requested_at)}
                    {p.rejection_reason && <span className="text-amber-700"> · previous proof needs updating</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(p.amount, p.currency)}</span>
                  <Link href={`/portal/payments/${p.id}`} className={buttonStyles.primary}>Pay & upload proof</Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold">Projects</h2>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Projects your developer creates for you will appear here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const s = summarizeProject(p);
            return (
              <Link key={p.id} href={`/portal/projects/${p.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{p.name}</p>
                  <ProjectBadge status={p.status} />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">{formatMoney(s.paid, p.currency)}</span> paid of {formatMoney(s.total, p.currency)}
                </p>
                <div className="mt-2"><ProgressBar value={s.paid} max={s.total} /></div>
              </Link>
            );
          })}
        </div>
      )}

      <Card title="Payment history" className="mt-6">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payment requests yet.</p>
        ) : (
          <Table head={["Requested", "Project / milestone", "Amount", "Status"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.requested_at)}</Td>
                <Td>
                  <Link href={`/portal/payments/${p.id}`} className="font-medium text-slate-900 hover:underline">{p.project.name}</Link>
                  <p className="text-xs text-slate-500">{p.milestone.title}</p>
                </Td>
                <Td className="font-medium">{formatMoney(p.amount, p.currency)}</Td>
                <Td><MilestoneBadge status={p.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
