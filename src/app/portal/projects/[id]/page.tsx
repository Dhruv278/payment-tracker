import Link from "next/link";
import { notFound } from "next/navigation";
import { MilestoneBadge, PageHeader, ProgressBar, ProjectBadge, StatCard, buttonStyles } from "@/components/ui";
import { summarizeProject } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { milestoneStatus, type Milestone, type PaymentRequest, type Project } from "@/lib/types";

type ClientProject = Project & { milestones: Milestone[]; payment_requests: PaymentRequest[] };

export default async function ClientProjectPage({ params }: PageProps<"/portal/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, milestones(*), payment_requests(*)")
    .eq("id", id)
    .order("position", { referencedTable: "milestones" })
    .maybeSingle<ClientProject>();
  if (!project) notFound();

  const s = summarizeProject(project);
  const money = (n: number) => formatMoney(n, project.currency);

  return (
    <>
      <PageHeader title={project.name} description={<ProjectBadge status={project.status} />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Project price" value={money(s.total)} />
        <StatCard label="Paid" value={<span className="text-emerald-700">{money(s.paid)}</span>} />
        <StatCard label="Remaining" value={money(s.remaining)} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <ProgressBar value={s.paid} max={s.total} />
      </div>
      {project.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{project.description}</p>}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Milestones</h2>
      <div className="space-y-3">
        {project.milestones.map((m, i) => {
          const request = project.payment_requests.find((r) => r.milestone_id === m.id);
          return (
            <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Milestone {i + 1}</p>
                <p className="font-medium">{m.title}</p>
                {m.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{m.description}</p>}
                {m.due_date && <p className="mt-1 text-xs text-slate-500">Due {formatDate(m.due_date)}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{money(Number(m.amount))}</span>
                <MilestoneBadge status={milestoneStatus(request)} />
                {request && (
                  <Link href={`/portal/payments/${request.id}`} className={request.status === "requested" ? buttonStyles.primary : buttonStyles.secondary}>
                    {request.status === "requested" ? "Pay now" : "Details"}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {project.milestones.length === 0 && <p className="text-sm text-slate-500">No milestones yet.</p>}
      </div>
    </>
  );
}
