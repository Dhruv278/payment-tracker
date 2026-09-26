import Link from "next/link";
import { notFound } from "next/navigation";
import { createInvoice } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PaymentTrack } from "@/components/payment-track";
import { ButtonLink, Card, Field, Figure, FigureRow, Input, MilestoneBadge, PageHeader, ProjectBadge, Textarea } from "@/components/ui";
import { summarizeProject, trackMilestones } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatDate, formatMoney } from "@/lib/format";
import type { Milestone, PaymentRequest, Profile, Project } from "@/lib/types";

type ProjectDetail = Project & {
  client: Pick<Profile, "id" | "full_name" | "email" | "company">;
  milestones: Pick<Milestone, "id" | "title">[];
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
    .select("*, client:profiles!projects_client_id_fkey(id, full_name, email, company), milestones(id, title), payment_requests(*)")
    .eq("id", id)
    .maybeSingle<ProjectDetail>();
  if (!project) notFound();

  const s = summarizeProject(project);
  const money = (n: number) => formatMoney(n, project.currency);
  const titles = new Map(project.milestones.map((m) => [m.id, m.title]));
  const invoices = [...project.payment_requests].sort((a, b) => a.requested_at.localeCompare(b.requested_at));

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
          </span>
        }
        actions={<ButtonLink variant="secondary" href={`/projects/${project.id}/edit`}>Edit project</ButtonLink>}
      />

      <Card className="mb-6">
        <PaymentTrack milestones={trackMilestones(project)} total={s.total} currency={project.currency} />
      </Card>

      <FigureRow className="mb-8">
        <Figure label="Project price" value={money(s.total)} />
        <Figure label="Invoiced" value={money(s.invoiced)} hint={s.awaiting ? `${money(s.awaiting)} not paid yet` : undefined} />
        <Figure label="Paid" value={money(s.paid)} tone="paid" />
        <Figure label="Not invoiced yet" value={money(s.notInvoiced)} />
      </FigureRow>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Invoices</h2>
          {invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-rule bg-paper/60 px-6 py-10 text-center">
              <p className="font-medium">No invoices yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-graphite">
                When a part of the work is done, create an invoice for that amount. {displayName(project.client)} gets it by email with your Wise link.
              </p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-rule bg-paper">
              {invoices.map((inv) => (
                <li key={inv.id} className="border-b border-rule-soft last:border-b-0">
                  <Link href={`/payments/${inv.id}`} className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-desk/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium group-hover:underline">{titles.get(inv.milestone_id) ?? "Invoice"}</p>
                      <p className="text-sm text-graphite">
                        {inv.status === "verified"
                          ? `Sent ${formatDate(inv.requested_at)}, paid ${formatDate(inv.verified_at)}`
                          : inv.status === "proof_submitted"
                            ? `Confirmation uploaded ${formatDate(inv.proof_submitted_at)}. Review it`
                            : `Sent ${formatDate(inv.requested_at)}${inv.rejection_reason ? ", waiting for a new confirmation" : ""}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="figures font-semibold">{money(Number(inv.amount))}</span>
                      <MilestoneBadge status={inv.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {project.description && <p className="mt-6 max-w-prose whitespace-pre-line text-sm leading-relaxed text-graphite">{project.description}</p>}
        </section>

        <aside className="lg:self-start">
          <Card title="New invoice" tone={invoices.length === 0 ? "due" : undefined}>
            <ActionForm action={createInvoice} resetOnSuccess>
              <input type="hidden" name="project_id" value={project.id} />
              <Field label="Title" name="inv_title" hint="What this invoice is for.">
                <Input id="inv_title" name="title" placeholder="Phase 1: authentication and dashboard" required />
              </Field>
              <Field label={`Amount (${project.currency})`} name="inv_amount">
                <Input
                  id="inv_amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="400"
                  required
                />
              </Field>
              <Field label="Wise payment link" name="inv_wise" hint="From your Wise invoice or payment request.">
                <Input id="inv_wise" name="wise_link" type="url" placeholder="https://wise.com/pay/…" />
              </Field>
              <Field label="Invoice PDF" name="inv_file" hint="Optional. Attached to the email.">
                <Input id="inv_file" name="invoice" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
              </Field>
              <Field label="Note to client" name="inv_note" hint="Optional">
                <Textarea id="inv_note" name="message" rows={2} placeholder="Phase 1 is live on staging. Thanks!" />
              </Field>
              <SubmitButton className="w-full" pendingLabel="Sending invoice…">
                Send invoice to {project.client.full_name.split(" ")[0] || "client"}
              </SubmitButton>
            </ActionForm>
          </Card>
          {s.notInvoiced === 0 && s.total > 0 && (
            <p className="mt-3 text-sm text-graphite">The full project price has been invoiced.</p>
          )}
        </aside>
      </div>
    </>
  );
}
