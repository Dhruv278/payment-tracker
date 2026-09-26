import Link from "next/link";
import { ButtonLink, Card, EmptyState, PageHeader, ProjectBadge, ProgressBar, Table, Td, cn } from "@/components/ui";
import { listProjects, summarizeProject } from "@/lib/queries";
import { displayName, formatMoney } from "@/lib/format";

export const metadata = { title: "Projects" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const { status } = await searchParams;
  const current = typeof status === "string" ? status : "";
  const projects = await listProjects({ status: current || undefined });

  return (
    <>
      <PageHeader title="Projects" actions={<ButtonLink href="/projects/new">New project</ButtonLink>} />

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/projects?status=${f.value}` : "/projects"}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", current === f.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState title="No projects here" description="Create a project, set its price and add milestones." action={<ButtonLink href="/projects/new">New project</ButtonLink>} />
      ) : (
        <Card>
          <Table head={["Project", "Client", "Status", "Price", "Collected", "Awaiting", "Progress"]}>
            {projects.map((p) => {
              const s = summarizeProject(p);
              return (
                <tr key={p.id}>
                  <Td><Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:underline">{p.name}</Link></Td>
                  <Td>{displayName(p.client)}</Td>
                  <Td><ProjectBadge status={p.status} /></Td>
                  <Td>{formatMoney(s.total, p.currency)}</Td>
                  <Td className="text-emerald-700">{formatMoney(s.paid, p.currency)}</Td>
                  <Td>{s.awaiting ? formatMoney(s.awaiting, p.currency) : "—"}</Td>
                  <Td className="min-w-40"><ProgressBar value={s.paid} max={s.total} /></Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </>
  );
}
