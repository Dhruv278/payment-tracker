import Link from "next/link";
import { PaymentTrack } from "@/components/payment-track";
import { FilterTabs } from "@/components/filter-tabs";
import { ButtonLink, EmptyState, PageHeader, ProjectBadge } from "@/components/ui";
import { listProjects, summarizeProject, trackMilestones } from "@/lib/queries";
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
  const current = typeof status === "string" && FILTERS.some((f) => f.value === status) ? status : "";
  const projects = await listProjects({ status: current || undefined });

  return (
    <>
      <PageHeader title="Projects" actions={<ButtonLink href="/projects/new">New project</ButtonLink>} />
      <FilterTabs filters={FILTERS} current={current} href={(v) => (v ? `/projects?status=${v}` : "/projects")} />

      {projects.length === 0 ? (
        <EmptyState
          title={current ? "No projects with this status" : "No projects yet"}
          description="A project has a client and a price. You send invoices against it as the work gets done."
          action={<ButtonLink href="/projects/new">New project</ButtonLink>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-rule bg-paper">
          {projects.map((p) => {
            const s = summarizeProject(p);
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="grid grid-cols-1 gap-3 border-b border-rule-soft px-6 py-4 transition-colors last:border-b-0 hover:bg-desk/40 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-8">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="truncate font-semibold">{p.name}</p>
                    <ProjectBadge status={p.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-graphite">
                    {displayName(p.client)}
                    {p.client.company ? `, ${p.client.company}` : ""}
                  </p>
                </div>
                <div>
                  <div className="figures mb-2 flex justify-between gap-4 text-sm">
                    <span className="text-graphite">
                      <span className="font-semibold text-paid">{formatMoney(s.paid, p.currency)}</span> collected
                      {s.awaiting > 0 && <span>, {formatMoney(s.awaiting, p.currency)} requested</span>}
                    </span>
                    <span className="font-semibold">{formatMoney(s.total, p.currency)}</span>
                  </div>
                  <PaymentTrack milestones={trackMilestones(p)} total={s.total} currency={p.currency} size="sm" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
