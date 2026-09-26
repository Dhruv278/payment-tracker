import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentTrack } from "@/components/payment-track";
import { Card, Figure, FigureRow, MilestoneBadge, PageHeader, ProjectBadge, buttonStyles, cn } from "@/components/ui";
import { summarizeProject, trackMilestones } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import type { Milestone, PaymentRequest, Project } from "@/lib/types";

type ClientProject = Project & { milestones: Milestone[]; payment_requests: PaymentRequest[] };

export async function generateMetadata({ params }: PageProps<"/portal/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

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
  const track = trackMilestones(project);

  return (
    <>
      <PageHeader
        back={{ href: "/portal", label: "Overview" }}
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <ProjectBadge status={project.status} />
            {project.start_date && (
              <span>
                {formatDate(project.start_date)} to {formatDate(project.end_date)}
              </span>
            )}
          </span>
        }
      />

      <Card className="mb-6">
        <PaymentTrack milestones={track} total={s.total} currency={project.currency} audience="client" />
      </Card>

      <FigureRow className="mb-8 lg:grid-cols-3">
        <Figure label="Project price" value={money(s.total)} />
        <Figure label="Paid" value={money(s.paid)} tone="paid" />
        <Figure label="Remaining" value={money(s.remaining)} />
      </FigureRow>

      {project.description && <p className="mb-8 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed text-graphite">{project.description}</p>}

      <h2 className="mb-3 text-lg font-semibold">Milestones</h2>
      {project.milestones.length === 0 ? (
        <p className="text-sm text-graphite">Milestones for this project haven&apos;t been set up yet.</p>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-rule bg-paper">
          {project.milestones.map((m, i) => {
            const request = project.payment_requests.find((r) => r.milestone_id === m.id);
            const status = track[i]?.status ?? "pending";
            return (
              <li key={m.id} className="flex flex-col gap-4 border-b border-rule-soft px-6 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <span
                    aria-hidden
                    className={cn(
                      "figures mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      status === "verified" ? "bg-paid text-white" : "border border-rule text-graphite",
                    )}
                  >
                    {status === "verified" ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    {m.description && <p className="mt-0.5 whitespace-pre-line text-sm text-graphite">{m.description}</p>}
                    {m.due_date && <p className="mt-0.5 text-xs text-mist">Target {formatDate(m.due_date)}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 pl-11 sm:pl-0">
                  <span className="figures font-semibold">{money(Number(m.amount))}</span>
                  <MilestoneBadge status={status} audience="client" />
                  {request && (
                    <Link href={`/portal/payments/${request.id}`} className={request.status === "requested" ? buttonStyles.primary : buttonStyles.secondary}>
                      {request.status === "requested" ? (request.rejection_reason ? "Update receipt" : "Pay now") : "View"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
