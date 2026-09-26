import Link from "next/link";
import { PaymentTrack } from "@/components/payment-track";
import { ButtonLink, Card, EmptyState, Figure, FigureRow, MoneyLines, PageHeader } from "@/components/ui";
import { requireDeveloper } from "@/lib/auth";
import { listClients, listPayments, listProjects, listVerifiedPayments, summarizeProject, trackMilestones } from "@/lib/queries";
import { displayName, formatDate, formatMoney, formatTotals, sumByCurrency, today } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireDeveloper();
  const now = today();
  const monthStart = `${now.slice(0, 7)}-01`;
  const yearStart = `${now.slice(0, 4)}-01-01`;

  const [projects, payments, clients, verified] = await Promise.all([listProjects(), listPayments(), listClients(), listVerifiedPayments({})]);

  const live = projects.filter((p) => p.status !== "cancelled").map((p) => ({ p, s: summarizeProject(p) }));
  const contracted = sumByCurrency(live, (x) => x.s.total, (x) => x.p.currency);
  const collected = sumByCurrency(live, (x) => x.s.paid, (x) => x.p.currency);
  const outstanding = sumByCurrency(live, (x) => x.s.remaining, (x) => x.p.currency);
  const net = (rows: typeof verified) => sumByCurrency(rows, (r) => r.earning.net_amount, (r) => r.earning.net_currency);
  const netMonth = net(verified.filter((r) => r.earning.received_on >= monthStart));
  const netYear = net(verified.filter((r) => r.earning.received_on >= yearStart));

  const toVerify = payments.filter((p) => p.status === "proof_submitted");
  const awaiting = payments.filter((p) => p.status === "requested");
  const pendingClients = clients.filter((c) => c.status === "pending");
  const active = live.filter((x) => x.p.status === "active");
  const recent = [...verified].sort((a, b) => b.earning.received_on.localeCompare(a.earning.received_on)).slice(0, 5);

  const actionCount = toVerify.length + pendingClients.length;

  return (
    <>
      <PageHeader
        title={`Hello, ${profile.full_name.split(" ")[0] || "there"}`}
        description={actionCount ? `${actionCount} thing${actionCount > 1 ? "s" : ""} need${actionCount > 1 ? "" : "s"} your attention.` : "Nothing needs your attention right now."}
        actions={<ButtonLink href="/projects/new">New project</ButtonLink>}
      />

      {actionCount > 0 && (
        <Card tone="review" title="Needs your attention" className="mb-8">
          <ul className="-my-1 divide-y divide-rule-soft">
            {toVerify.map((p) => (
              <li key={p.id}>
                <Link href={`/payments/${p.id}`} className="group flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:underline">Verify payment: {p.milestone.title}</p>
                    <p className="truncate text-sm text-graphite">
                      {displayName(p.client)} sent a receipt for {p.project.name} on {formatDate(p.proof_submitted_at)}
                    </p>
                  </div>
                  <span className="figures shrink-0 font-semibold">{formatMoney(p.amount, p.currency)}</span>
                </Link>
              </li>
            ))}
            {pendingClients.map((c) => (
              <li key={c.id}>
                <Link href="/clients" className="group flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:underline">Approve client: {displayName(c)}</p>
                    <p className="truncate text-sm text-graphite">
                      {c.company ? `${c.company}, ` : ""}
                      {c.email}, signed up {formatDate(c.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-graphite">Review</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <FigureRow className="mb-8">
        <Figure label="Contracted" value={<MoneyLines totals={contracted} />} hint={`${live.length} project${live.length === 1 ? "" : "s"}, excluding cancelled`} />
        <Figure label="Collected from clients" value={<MoneyLines totals={collected} />} tone="paid" />
        <Figure label="Still to collect" value={<MoneyLines totals={outstanding} />} hint={awaiting.length ? `${awaiting.length} request${awaiting.length > 1 ? "s" : ""} awaiting payment` : undefined} />
        <Figure label="Net earned this month" value={<MoneyLines totals={netMonth} />} hint={`${now.slice(0, 4)} so far: ${formatTotals(netYear)}`} />
      </FigureRow>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Active projects</h2>
        <Link href="/projects" className="text-sm text-graphite hover:text-ink">All projects</Link>
      </div>
      {active.length === 0 ? (
        <EmptyState title="No active projects" description="Create a project for a client, set its price and split it into milestones." action={<ButtonLink href="/projects/new">New project</ButtonLink>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-rule bg-paper">
          {active.map(({ p, s }) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block border-b border-rule-soft px-6 py-4 transition-colors last:border-b-0 hover:bg-desk/40">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="font-semibold">
                  {p.name} <span className="font-normal text-graphite">for {displayName(p.client)}</span>
                </p>
                <p className="figures text-sm text-graphite">
                  <span className="font-semibold text-paid">{formatMoney(s.paid, p.currency)}</span> of {formatMoney(s.total, p.currency)}
                </p>
              </div>
              <div className="mt-3">
                <PaymentTrack milestones={trackMilestones(p)} total={s.total} currency={p.currency} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card title="Recently received" className="mt-8" actions={<Link href="/reports" className="text-sm text-graphite hover:text-ink">Reports</Link>}>
        {recent.length === 0 ? (
          <p className="text-sm text-graphite">Verified payments will show up here with what you actually received.</p>
        ) : (
          <ul className="-my-3 divide-y divide-rule-soft">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/payments/${p.id}`} className="group flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium group-hover:underline">{p.milestone.title}</p>
                    <p className="text-sm text-graphite">
                      {p.project.name}, received {formatDate(p.earning.received_on)}
                    </p>
                  </div>
                  <div className="figures shrink-0 text-right">
                    <p className="font-semibold text-paid">{formatMoney(p.earning.net_amount, p.earning.net_currency)}</p>
                    <p className="text-xs text-graphite">client paid {formatMoney(p.amount, p.currency)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
