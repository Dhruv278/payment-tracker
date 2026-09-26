import Link from "next/link";
import { ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select, StatCard, Table, Td, buttonStyles } from "@/components/ui";
import { buildReport, datePresets, parseReportFilters } from "@/lib/reports";
import { listClients, listProjects } from "@/lib/queries";
import { displayName, formatDate, formatMoney, formatTotals } from "@/lib/format";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const params = await searchParams;
  const filters = parseReportFilters(params);
  const [report, clients, projects] = await Promise.all([buildReport(filters), listClients(), listProjects()]);

  const query = new URLSearchParams(
    Object.entries({ from: filters.from, to: filters.to, client: filters.clientId, project: filters.projectId }).filter(
      (e): e is [string, string] => Boolean(e[1]),
    ),
  ).toString();
  const presetHref = (from: string, to: string) => {
    const q = new URLSearchParams(query);
    q.set("from", from);
    q.set("to", to);
    return `/reports?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Verified payments by the date you received the money."
        actions={<ButtonLink variant="secondary" href={`/reports/export${query ? `?${query}` : ""}`} prefetch={false}>Export CSV</ButtonLink>}
      />

      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Field label="Client" name="client">
            <Select id="client" name="client" defaultValue={filters.clientId ?? ""}>
              <option value="">All clients</option>
              {clients.filter((c) => c.status === "approved").map((c) => (
                <option key={c.id} value={c.id}>{displayName(c)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Project" name="project">
            <Select id="project" name="project" defaultValue={filters.projectId ?? ""}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="From" name="from">
            <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
          </Field>
          <Field label="To" name="to">
            <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
          </Field>
          <div className="flex gap-2">
            <button className={buttonStyles.primary}>Apply</button>
            <Link href="/reports" className={buttonStyles.ghost}>Reset</Link>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {datePresets().map((p) => (
            <Link key={p.label} href={presetHref(p.from, p.to)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900">
              {p.label}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Payments" value={report.rows.length} />
        <StatCard label="Billed & collected" value={formatTotals(report.billed)} hint="What clients paid" />
        <StatCard label="Net earned (private)" value={<span className="text-emerald-700">{formatTotals(report.net)}</span>} hint="What you actually received" />
      </div>

      {report.rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No verified payments match these filters" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="By client">
              <Table head={["Client", "#", "Billed", "Net"]}>
                {report.byClient.map((g) => (
                  <tr key={g.key}>
                    <Td className="font-medium">{g.label}</Td>
                    <Td>{g.count}</Td>
                    <Td>{formatTotals(g.billed)}</Td>
                    <Td className="text-emerald-700">{formatTotals(g.net)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card title="By project">
              <Table head={["Project", "#", "Billed", "Net"]}>
                {report.byProject.map((g) => (
                  <tr key={g.key}>
                    <Td className="font-medium">{g.label}</Td>
                    <Td>{g.count}</Td>
                    <Td>{formatTotals(g.billed)}</Td>
                    <Td className="text-emerald-700">{formatTotals(g.net)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>

          <Card title="Payments" className="mt-6">
            <Table head={["Received", "Client", "Project", "Milestone", "Billed", "Net", "Note"]}>
              {report.rows.map((r) => (
                <tr key={r.id}>
                  <Td>{formatDate(r.earning.received_on)}</Td>
                  <Td>{displayName(r.client)}</Td>
                  <Td>{r.project.name}</Td>
                  <Td><Link href={`/payments/${r.id}`} className="hover:underline">{r.milestone.title}</Link></Td>
                  <Td>{formatMoney(r.amount, r.currency)}</Td>
                  <Td className="font-medium text-emerald-700">{formatMoney(r.earning.net_amount, r.earning.net_currency)}</Td>
                  <Td className="max-w-56 truncate text-slate-500">{r.earning.note ?? ""}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
