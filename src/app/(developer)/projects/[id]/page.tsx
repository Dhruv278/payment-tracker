import Link from "next/link";
import { notFound } from "next/navigation";
import { addMilestone, deleteMilestone, updateMilestone } from "@/actions/projects";
import { requestPayment } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Card, EmptyState, Field, Input, MilestoneBadge, PageHeader, ProgressBar, ProjectBadge, StatCard, Textarea, buttonStyles } from "@/components/ui";
import { summarizeProject } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatDate, formatMoney } from "@/lib/format";
import { milestoneStatus, type Milestone, type PaymentRequest, type Profile, type Project } from "@/lib/types";

type ProjectDetail = Project & {
  client: Pick<Profile, "id" | "full_name" | "email" | "company">;
  milestones: Milestone[];
  payment_requests: PaymentRequest[];
};

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
  const requestFor = (m: Milestone) => project.payment_requests.find((r) => r.milestone_id === m.id);
  const unallocated = s.total - s.milestoneTotal;

  return (
    <>
      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/clients/${project.client.id}`} className="hover:underline">{displayName(project.client)}</Link>
            <ProjectBadge status={project.status} />
            {project.start_date && <span>· {formatDate(project.start_date)} → {formatDate(project.end_date)}</span>}
          </span>
        }
        actions={<ButtonLink variant="secondary" href={`/projects/${project.id}/edit`}>Edit project</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Project price" value={money(s.total)} />
        <StatCard label="Collected" value={<span className="text-emerald-700">{money(s.paid)}</span>} />
        <StatCard label="Awaiting payment" value={money(s.awaiting)} hint="Requested, not yet verified" />
        <StatCard label="Remaining" value={money(s.remaining)} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <ProgressBar value={s.paid} max={s.total} />
        <p className="mt-2 text-xs text-slate-500">
          {money(s.paid)} of {money(s.total)} paid · milestones cover {money(s.milestoneTotal)}
          {unallocated > 0 && ` · ${money(unallocated)} not yet assigned to a milestone`}
          {unallocated < 0 && <span className="text-rose-600"> · milestones exceed the project price by {money(-unallocated)}</span>}
        </p>
      </div>
      {project.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{project.description}</p>}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Milestones</h2>
      {project.milestones.length === 0 ? (
        <EmptyState title="No milestones yet" description="Split the project into milestones, then request payment as each one is done." />
      ) : (
        <div className="space-y-3">
          {project.milestones.map((m, index) => {
            const request = requestFor(m);
            const status = milestoneStatus(request);
            return (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Milestone {index + 1}</p>
                    <p className="font-medium">{m.title}</p>
                    {m.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{m.description}</p>}
                    {m.due_date && <p className="mt-1 text-xs text-slate-500">Due {formatDate(m.due_date)}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{money(Number(m.amount))}</span>
                    <MilestoneBadge status={status} />
                  </div>
                </div>

                {request ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm">
                    <span className="text-slate-500">
                      {request.status === "verified"
                        ? `Paid · verified ${formatDate(request.verified_at)}`
                        : request.status === "proof_submitted"
                          ? `Client submitted proof ${formatDate(request.proof_submitted_at)}`
                          : `Requested ${formatDate(request.requested_at)}${request.rejection_reason ? " · proof was rejected, waiting for resubmission" : ""}`}
                    </span>
                    <Link href={`/payments/${request.id}`} className={buttonStyles.secondary}>
                      {request.status === "proof_submitted" ? "Review & verify" : "View payment"}
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <details className="group w-full">
                      <summary className={`${buttonStyles.primary} cursor-pointer list-none`}>Request payment</summary>
                      <ActionForm action={requestPayment} className="mt-4 max-w-xl">
                        <input type="hidden" name="milestone_id" value={m.id} />
                        <p className="text-sm text-slate-600">
                          Client will be asked to pay <strong>{money(Number(m.amount))}</strong> for this milestone.
                        </p>
                        <Field label="Wise payment link" name={`wise_${m.id}`} hint="Paste the Wise payment request / invoice link.">
                          <Input id={`wise_${m.id}`} name="wise_link" type="url" placeholder="https://wise.com/pay/..." />
                        </Field>
                        <Field label="Invoice (PDF, optional)" name={`invoice_${m.id}`} hint="PDF or image, up to 4 MB.">
                          <Input id={`invoice_${m.id}`} name="invoice" type="file" accept="application/pdf,image/*" />
                        </Field>
                        <Field label="Message to client (optional)" name={`msg_${m.id}`}>
                          <Textarea id={`msg_${m.id}`} name="message" placeholder="Milestone delivered — please find the invoice attached." />
                        </Field>
                        <SubmitButton>Send payment request</SubmitButton>
                      </ActionForm>
                    </details>
                    <details className="w-full">
                      <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">Edit or delete milestone</summary>
                      <ActionForm action={updateMilestone} className="mt-4 max-w-xl">
                        <input type="hidden" name="milestone_id" value={m.id} />
                        <MilestoneFields milestone={m} currency={project.currency} />
                        <SubmitButton variant="secondary">Save milestone</SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteMilestone} className="mt-3">
                        <input type="hidden" name="milestone_id" value={m.id} />
                        <SubmitButton variant="ghost" className="text-rose-600" confirm={`Delete milestone "${m.title}"?`}>Delete milestone</SubmitButton>
                      </ActionForm>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Card title="Add milestone" className="mt-6 max-w-2xl">
        <ActionForm action={addMilestone} resetOnSuccess>
          <input type="hidden" name="project_id" value={project.id} />
          <MilestoneFields currency={project.currency} suggestedAmount={unallocated > 0 ? unallocated : undefined} />
          <SubmitButton>Add milestone</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

function MilestoneFields({ milestone, currency, suggestedAmount }: { milestone?: Milestone; currency: string; suggestedAmount?: number }) {
  const key = milestone?.id ?? "new";
  return (
    <>
      <Field label="Title" name={`title_${key}`}>
        <Input id={`title_${key}`} name="title" defaultValue={milestone?.title} placeholder="Phase 1 — Authentication & dashboard" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Amount (${currency})`} name={`amount_${key}`}>
          <Input id={`amount_${key}`} name="amount" type="number" min="0.01" step="0.01" defaultValue={milestone?.amount ?? suggestedAmount} placeholder="400" required />
        </Field>
        <Field label="Due date (optional)" name={`due_${key}`}>
          <Input id={`due_${key}`} name="due_date" type="date" defaultValue={milestone?.due_date ?? ""} />
        </Field>
      </div>
      <Field label="Description (optional)" name={`desc_${key}`}>
        <Textarea id={`desc_${key}`} name="description" defaultValue={milestone?.description ?? ""} />
      </Field>
    </>
  );
}
