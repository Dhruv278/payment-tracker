import Link from "next/link";
import { notFound } from "next/navigation";
import { addMilestone, deleteMilestone, updateMilestone } from "@/actions/projects";
import { requestPayment } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PaymentTrack } from "@/components/payment-track";
import { ButtonLink, Card, EmptyState, Field, Figure, FigureRow, Input, MilestoneBadge, PageHeader, ProjectBadge, Textarea, buttonStyles, cn } from "@/components/ui";
import { summarizeProject, trackMilestones } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatDate, formatMoney } from "@/lib/format";
import type { Milestone, PaymentRequest, Profile, Project } from "@/lib/types";

type ProjectDetail = Project & {
  client: Pick<Profile, "id" | "full_name" | "email" | "company">;
  milestones: Milestone[];
  payment_requests: PaymentRequest[];
};

export async function generateMetadata({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, client:profiles!projects_client_id_fkey(id, full_name, email, company), milestones(*), payment_requests(*)")
    .eq("id", id)
    .order("position", { referencedTable: "milestones" })
    .maybeSingle<ProjectDetail>();
  if (!project) notFound();

  const s = summarizeProject(project);
  const money = (n: number) => formatMoney(n, project.currency);
  const track = trackMilestones(project);
  const unallocated = s.total - s.milestoneTotal;
  const nextToRequest = track.findIndex((m) => m.status === "pending");

  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: "Projects" }}
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <Link href={`/clients/${project.client.id}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
              {displayName(project.client)}
            </Link>
            <ProjectBadge status={project.status} />
            {project.start_date && (
              <span>
                {formatDate(project.start_date)} to {formatDate(project.end_date)}
              </span>
            )}
          </span>
        }
        actions={<ButtonLink variant="secondary" href={`/projects/${project.id}/edit`}>Edit project</ButtonLink>}
      />

      <Card className="mb-6">
        <PaymentTrack milestones={track} total={s.total} currency={project.currency} />
        {unallocated < 0 && (
          <p className="mt-3 text-sm text-danger">Milestones add up to {money(-unallocated)} more than the project price.</p>
        )}
      </Card>

      <FigureRow className="mb-8">
        <Figure label="Project price" value={money(s.total)} />
        <Figure label="Collected" value={money(s.paid)} tone="paid" />
        <Figure label="Requested, not yet paid" value={money(s.awaiting)} tone={s.awaiting ? "due" : undefined} />
        <Figure label="Remaining" value={money(s.remaining)} />
      </FigureRow>

      {project.description && <p className="mb-8 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed text-graphite">{project.description}</p>}

      <h2 className="mb-3 text-lg font-semibold">Milestones</h2>
      {project.milestones.length === 0 ? (
        <EmptyState title="No milestones yet" description="Split the price into milestones below, then request payment as each one is delivered." />
      ) : (
        <ol className="overflow-hidden rounded-xl border border-rule bg-paper">
          {project.milestones.map((m, index) => {
            const request = project.payment_requests.find((r) => r.milestone_id === m.id);
            const status = track[index]?.status ?? "pending";
            return (
              <li key={m.id} className="border-b border-rule-soft px-6 py-5 last:border-b-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span
                      aria-hidden
                      className={cn(
                        "figures mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        status === "verified" ? "bg-paid text-white" : "border border-rule text-graphite",
                      )}
                    >
                      {status === "verified" ? "✓" : index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{m.title}</p>
                      {m.description && <p className="mt-0.5 whitespace-pre-line text-sm text-graphite">{m.description}</p>}
                      <p className="mt-1 text-sm text-graphite">
                        {request
                          ? request.status === "verified"
                            ? `Paid, confirmed ${formatDate(request.verified_at)}`
                            : request.status === "proof_submitted"
                              ? `Receipt received ${formatDate(request.proof_submitted_at)}`
                              : `Requested ${formatDate(request.requested_at)}${request.rejection_reason ? ", receipt rejected and waiting for a new one" : ""}`
                          : m.due_date
                            ? `Target ${formatDate(m.due_date)}`
                            : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-11 sm:pl-0">
                    <span className="figures text-lg font-semibold">{money(Number(m.amount))}</span>
                    <MilestoneBadge status={status} />
                  </div>
                </div>

                <div className="mt-4 pl-11">
                  {request ? (
                    <Link href={`/payments/${request.id}`} className={request.status === "proof_submitted" ? buttonStyles.primary : buttonStyles.secondary}>
                      {request.status === "proof_submitted" ? "Review receipt" : "View payment"}
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <details className="group">
                        <summary className={cn(index === nextToRequest ? buttonStyles.primary : buttonStyles.secondary, "cursor-pointer list-none")}>Request payment</summary>
                        <ActionForm action={requestPayment} className="mt-4 max-w-xl rounded-lg border border-rule bg-desk/40 p-5">
                          <input type="hidden" name="milestone_id" value={m.id} />
                          <p className="text-sm text-graphite">
                            {displayName(project.client)} will get an email asking for <span className="figures font-semibold text-ink">{money(Number(m.amount))}</span>.
                          </p>
                          <Field label="Wise payment link" name={`wise_${m.id}`} hint="The link from your Wise payment request or invoice.">
                            <Input id={`wise_${m.id}`} name="wise_link" type="url" placeholder="https://wise.com/pay/…" />
                          </Field>
                          <Field label="Invoice" name={`invoice_${m.id}`} hint="Optional. PDF or image, up to 4 MB.">
                            <Input id={`invoice_${m.id}`} name="invoice" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
                          </Field>
                          <Field label="Message to client" name={`msg_${m.id}`} hint="Optional">
                            <Textarea id={`msg_${m.id}`} name="message" rows={2} placeholder="Phase 1 is live on staging. Invoice attached." />
                          </Field>
                          <SubmitButton pendingLabel="Sending…">Send payment request</SubmitButton>
                        </ActionForm>
                      </details>
                      <details>
                        <summary className="cursor-pointer list-none text-sm text-graphite hover:text-ink">Edit or delete</summary>
                        <ActionForm action={updateMilestone} className="mt-4 max-w-xl rounded-lg border border-rule p-5">
                          <input type="hidden" name="milestone_id" value={m.id} />
                          <MilestoneFields milestone={m} currency={project.currency} />
                          <div className="flex flex-wrap gap-2">
                            <SubmitButton variant="secondary">Save milestone</SubmitButton>
                          </div>
                        </ActionForm>
                        <ActionForm action={deleteMilestone} className="mt-2">
                          <input type="hidden" name="milestone_id" value={m.id} />
                          <SubmitButton variant="ghost" className="!text-danger" confirm={`Delete milestone "${m.title}"?`}>
                            Delete milestone
                          </SubmitButton>
                        </ActionForm>
                      </details>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {project.milestones.length === 0 ? (
        <Card title="Add the first milestone" className="mt-6 max-w-2xl">
          <AddMilestoneForm projectId={project.id} currency={project.currency} suggestedAmount={unallocated > 0 ? unallocated : undefined} />
        </Card>
      ) : (
        <details className="mt-4" open={unallocated > 0 || undefined}>
          <summary className={cn(buttonStyles.secondary, "cursor-pointer list-none")}>Add a milestone</summary>
          <Card className="mt-3 max-w-2xl">
            {unallocated > 0 && (
              <p className="mb-4 text-sm text-graphite">
                <span className="figures font-semibold text-ink">{money(unallocated)}</span> of the price isn&apos;t in a milestone yet.
              </p>
            )}
            <AddMilestoneForm projectId={project.id} currency={project.currency} suggestedAmount={unallocated > 0 ? unallocated : undefined} />
          </Card>
        </details>
      )}
    </>
  );
}

function AddMilestoneForm({ projectId, currency, suggestedAmount }: { projectId: string; currency: string; suggestedAmount?: number }) {
  return (
    <ActionForm action={addMilestone} resetOnSuccess>
      <input type="hidden" name="project_id" value={projectId} />
      <MilestoneFields currency={currency} suggestedAmount={suggestedAmount} />
      <SubmitButton pendingLabel="Adding…">Add milestone</SubmitButton>
    </ActionForm>
  );
}

function MilestoneFields({ milestone, currency, suggestedAmount }: { milestone?: Milestone; currency: string; suggestedAmount?: number }) {
  const key = milestone?.id ?? "new";
  return (
    <>
      <Field label="Title" name={`title_${key}`}>
        <Input id={`title_${key}`} name="title" defaultValue={milestone?.title} placeholder="Phase 1: authentication and dashboard" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Amount (${currency})`} name={`amount_${key}`}>
          <Input id={`amount_${key}`} name="amount" type="number" min="0.01" step="0.01" defaultValue={milestone?.amount ?? suggestedAmount} placeholder="400" required />
        </Field>
        <Field label="Target date" name={`due_${key}`} hint="Optional">
          <Input id={`due_${key}`} name="due_date" type="date" defaultValue={milestone?.due_date ?? ""} />
        </Field>
      </div>
      <Field label="Description" name={`desc_${key}`} hint="Optional. Clients can see this.">
        <Textarea id={`desc_${key}`} name="description" rows={2} defaultValue={milestone?.description ?? ""} />
      </Field>
    </>
  );
}
