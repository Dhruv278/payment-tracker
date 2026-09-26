import Link from "next/link";
import { PaymentTrack } from "@/components/payment-track";
import { Card, EmptyState, MilestoneBadge, PageHeader, ProjectBadge, buttonStyles } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { listPayments, listProjects, summarizeProject, trackMilestones } from "@/lib/queries";
import { formatDate, formatMoney, formatTotals, sumByCurrency } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function PortalPage() {
  const profile = await requireClient();
  const [projects, payments] = await Promise.all([listProjects(), listPayments()]);
  const due = payments.filter((p) => p.status === "requested");
  const inReview = payments.filter((p) => p.status === "proof_submitted");
  const dueTotal = sumByCurrency(due, (p) => p.amount, (p) => p.currency);

  return (
    <>
      <PageHeader title={`Welcome, ${profile.full_name.split(" ")[0] || "there"}`} description="Your projects and payments at a glance." />

      {due.length > 0 ? (
        <Card tone="due" className="mb-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="text-sm text-graphite">Amount due</p>
              <p className="figures mt-1 text-4xl font-semibold tracking-[-0.02em]">{formatTotals(dueTotal)}</p>
            </div>
            <p className="text-sm text-graphite">
              {due.length} unpaid invoice{due.length > 1 ? "s" : ""}
            </p>
          </div>
          <ul className="mt-6 divide-y divide-rule-soft border-t border-rule-soft">
            {due.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{p.milestone.title}</p>
                  <p className="text-sm text-graphite">
                    {p.project.name}, sent {formatDate(p.requested_at)}
                  </p>
                  {p.rejection_reason && <p className="mt-1 text-sm text-[#8a5a12]">Please upload a new payment confirmation.</p>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="figures text-lg font-semibold">{formatMoney(p.amount, p.currency)}</span>
                  <Link href={`/portal/payments/${p.id}`} className={buttonStyles.primary}>
                    {p.rejection_reason ? "Upload new confirmation" : "Pay now"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : projects.length === 0 ? null : (
        <Card tone={inReview.length ? "review" : "paid"} className="mb-8">
          <p className="text-lg font-semibold">{inReview.length ? "Nothing to pay right now" : "You're all paid up"}</p>
          <p className="mt-1 text-[0.9375rem] text-graphite">
            {inReview.length
              ? `${inReview.length} payment${inReview.length > 1 ? "s are" : " is"} being verified. You'll get an email once confirmed.`
              : "We'll email you when the next invoice is ready."}
          </p>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold">Projects</h2>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" description="When a project is set up for you, it will appear here with its invoices and payments." />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const s = summarizeProject(p);
            return (
              <Link
                key={p.id}
                href={`/portal/projects/${p.id}`}
                className="block rounded-xl border border-rule bg-paper px-6 py-5 transition-colors hover:border-mist"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <p className="truncate font-semibold">{p.name}</p>
                    <ProjectBadge status={p.status} />
                  </div>
                  <p className="figures text-sm text-graphite">
                    <span className="font-semibold text-ink">{formatMoney(s.paid, p.currency)}</span> of {formatMoney(s.total, p.currency)} paid
                  </p>
                </div>
                <div className="mt-4">
                  <PaymentTrack milestones={trackMilestones(p)} total={s.total} currency={p.currency} size="sm" audience="client" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {payments.length > 0 && (
        <Card title="Invoices" className="mt-8">
          <ul className="-my-3 divide-y divide-rule-soft">
            {payments.map((p) => (
              <li key={p.id}>
                <Link href={`/portal/payments/${p.id}`} className="group flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium group-hover:underline">{p.milestone.title}</p>
                    <p className="text-sm text-graphite">
                      {p.project.name}, sent {formatDate(p.requested_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="figures font-semibold">{formatMoney(p.amount, p.currency)}</span>
                    <MilestoneBadge status={p.status} audience="client" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
