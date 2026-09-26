import Link from "next/link";
import { ButtonLink, Card, EmptyState, Field, Figure, FigureRow, Input, PageHeader, Select, Table, Td, buttonStyles, cn, MoneyLines } from "@/components/ui";
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
        description="Verified payments, filtered by the date the money reached you."
        actions={<ButtonLink variant="secondary" href={`/reports/export${query ? `?${query}` : ""}`} prefetch={false}>Export CSV</ButtonLink>}
      />

      <Card className="mb-6">
        <form aria-label="Report filters" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
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
            <Link
              key={p.label}
              href={presetHref(p.from, p.to)}
              aria-current={filters.from === p.from && filters.to === p.to ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                filters.from === p.from && filters.to === p.to ? "border-ink bg-ink text-white" : "border-rule text-graphite hover:border-graphite hover:text-ink",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </Card>

      <FigureRow className="lg:grid-cols-3">
        <Figure label="Verified payments" value={report.rows.length} />
        <Figure label="Clients paid" value={<MoneyLines totals={report.billed} />} />
        <Figure label="You received" value={<MoneyLines totals={report.net} />} tone="paid" hint="After fees and expenses, private to you" />
      </FigureRow>

      {report.rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No verified payments match these filters" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="By client">
              <Table head={["Client", "Payments", "Clients paid", "You received"]} align={["left", "right", "right", "right"]}>
                {report.byClient.map((g) => (
                  <tr key={g.key}>
                    <Td className="font-medium">{g.label}</Td>
                    <Td align="right">{g.count}</Td>
                    <Td align="right">{formatTotals(g.billed)}</Td>
                    <Td align="right" className="font-semibold text-paid">{formatTotals(g.net)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card title="By project">
              <Table head={["Project", "Payments", "Clients paid", "You received"]} align={["left", "right", "right", "right"]}>
                {report.byProject.map((g) => (
                  <tr key={g.key}>
                    <Td className="font-medium">{g.label}</Td>
                    <Td align="right">{g.count}</Td>
                    <Td align="right">{formatTotals(g.billed)}</Td>
                    <Td align="right" className="font-semibold text-paid">{formatTotals(g.net)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>

          <Card title="All payments" className="mt-6">
            <Table head={["Received", "Milestone", "Client", "Client paid", "You received", "Note"]} align={["left", "left", "left", "right", "right", "left"]}>
              {report.rows.map((r) => (
                <tr key={r.id}>
                  <Td className="text-graphite">{formatDate(r.earning.received_on)}</Td>
                  <Td>
                    <Link href={`/payments/${r.id}`} className="font-medium hover:underline">{r.milestone.title}</Link>
                    <p className="text-xs text-graphite">{r.project.name}</p>
                  </Td>
                  <Td>{displayName(r.client)}</Td>
                  <Td align="right">{formatMoney(r.amount, r.currency)}</Td>
                  <Td align="right" className="font-semibold text-paid">{formatMoney(r.earning.net_amount, r.earning.net_currency)}</Td>
                  <Td className="max-w-56 truncate text-graphite">{r.earning.note ?? ""}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
