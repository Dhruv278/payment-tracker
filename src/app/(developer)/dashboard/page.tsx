import Link from "next/link";
import { ButtonLink, Card, EmptyState, MilestoneBadge, PageHeader, StatCard, Table, Td } from "@/components/ui";
import { listClients, listPayments, listProjects, listVerifiedPayments, summarizeProject } from "@/lib/queries";
import { displayName, formatDate, formatMoney, formatTotals, sumByCurrency, today } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const now = today();
  const monthStart = `${now.slice(0, 7)}-01`;
  const yearStart = `${now.slice(0, 4)}-01-01`;

  const [projects, openPayments, clients, earnedAllTime] = await Promise.all([
    listProjects(),
    listPayments(),
    listClients(),
    listVerifiedPayments({}),
  ]);

  const liveProjects = projects.filter((p) => p.status !== "cancelled");
  const summaries = liveProjects.map((p) => ({ project: p, s: summarizeProject(p) }));
  const contracted = sumByCurrency(summaries, (x) => x.s.total, (x) => x.project.currency);
  const received = sumByCurrency(summaries, (x) => x.s.paid, (x) => x.project.currency);
  const outstanding = sumByCurrency(summaries, (x) => x.s.remaining, (x) => x.project.currency);

  const net = (rows: typeof earnedAllTime) => sumByCurrency(rows, (r) => r.earning.net_amount, (r) => r.earning.net_currency);
  const netMonth = net(earnedAllTime.filter((r) => r.earning.received_on >= monthStart));
  const netYear = net(earnedAllTime.filter((r) => r.earning.received_on >= yearStart));

  const toVerify = openPayments.filter((p) => p.status === "proof_submitted");
  const awaitingClient = openPayments.filter((p) => p.status === "requested");
  const pendingClients = clients.filter((c) => c.status === "pending");

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything you've billed, collected and earned."
        actions={<ButtonLink href="/projects/new">New project</ButtonLink>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contracted" value={formatTotals(contracted)} hint={`${liveProjects.length} projects (excl. cancelled)`} />
        <StatCard label="Collected" value={formatTotals(received)} hint="Verified client payments" />
        <StatCard label="Outstanding" value={formatTotals(outstanding)} hint="Contracted minus collected" />
        <StatCard label="Net earned this month" value={formatTotals(netMonth)} hint={`This year: ${formatTotals(netYear)}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Proofs to verify (${toVerify.length})`} actions={<Link href="/payments?status=proof_submitted" className="text-xs text-slate-500 hover:text-slate-900">View all</Link>}>
          {toVerify.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing to verify right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {toVerify.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/payments/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-slate-600">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.project.name} — {p.milestone.title}</p>
                      <p className="text-xs text-slate-500">{displayName(p.client)} · submitted {formatDate(p.proof_submitted_at)}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatMoney(p.amount, p.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Waiting on clients (${awaitingClient.length})`} actions={<Link href="/payments?status=requested" className="text-xs text-slate-500 hover:text-slate-900">View all</Link>}>
          {awaitingClient.length === 0 ? (
            <p className="text-sm text-slate-500">No unpaid payment requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {awaitingClient.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/payments/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-slate-600">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.project.name} — {p.milestone.title}</p>
                      <p className="text-xs text-slate-500">{displayName(p.client)} · requested {formatDate(p.requested_at)}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatMoney(p.amount, p.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {pendingClients.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {pendingClients.length} client{pendingClients.length > 1 ? "s are" : " is"} waiting for approval.{" "}
          <Link href="/clients" className="font-semibold underline">Review now</Link>
        </div>
      )}

      <Card title="Active projects" className="mt-6">
        {summaries.filter((x) => x.project.status === "active").length === 0 ? (
          <EmptyState title="No active projects" action={<ButtonLink href="/projects/new">Create a project</ButtonLink>} />
        ) : (
          <Table head={["Project", "Client", "Price", "Collected", "Outstanding"]}>
            {summaries
              .filter((x) => x.project.status === "active")
              .map(({ project, s }) => (
                <tr key={project.id}>
                  <Td><Link href={`/projects/${project.id}`} className="font-medium text-slate-900 hover:underline">{project.name}</Link></Td>
                  <Td>{displayName(project.client)}</Td>
                  <Td>{formatMoney(s.total, project.currency)}</Td>
                  <Td className="text-emerald-700">{formatMoney(s.paid, project.currency)}</Td>
                  <Td>{formatMoney(s.remaining, project.currency)}</Td>
                </tr>
              ))}
          </Table>
        )}
      </Card>

      <Card title="Recently received" className="mt-6">
        {earnedAllTime.length === 0 ? (
          <p className="text-sm text-slate-500">No verified payments yet.</p>
        ) : (
          <Table head={["Received", "Project / milestone", "Billed", "Net to you", ""]}>
            {earnedAllTime.slice(0, 5).map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.earning.received_on)}</Td>
                <Td>{p.project.name} — {p.milestone.title}</Td>
                <Td>{formatMoney(p.amount, p.currency)}</Td>
                <Td className="font-medium text-emerald-700">{formatMoney(p.earning.net_amount, p.earning.net_currency)}</Td>
                <Td><MilestoneBadge status="verified" /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
