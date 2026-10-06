import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentTrack } from "@/components/payment-track";
import { NoteList } from "@/components/project-notes";
import { Card, Figure, FigureRow, MilestoneBadge, PageHeader, ProjectBadge, buttonStyles } from "@/components/ui";
import { listProjectNotes, summarizeProject, trackMilestones } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import type { Milestone, PaymentRequest, Project } from "@/lib/types";

type ClientProject = Project & { milestones: Pick<Milestone, "id" | "title">[]; payment_requests: PaymentRequest[] };

export async function generateMetadata({ params }: PageProps<"/portal/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

export default async function ClientProjectPage({ params }: PageProps<"/portal/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, notes] = await Promise.all([
    supabase.from("projects").select("*, milestones(id, title), payment_requests(*)").eq("id", id).maybeSingle<ClientProject>(),
    listProjectNotes(id),
  ]);
  if (!project) notFound();

  const s = summarizeProject(project);
  const money = (n: number) => formatMoney(n, project.currency);
  const titles = new Map(project.milestones.map((m) => [m.id, m.title]));
  const invoices = [...project.payment_requests].sort((a, b) => a.requested_at.localeCompare(b.requested_at));

  return (
    <>
      <PageHeader back={{ href: "/portal", label: "Overview" }} title={project.name} description={<ProjectBadge status={project.status} />} />

      <Card className="mb-6">
        <PaymentTrack milestones={trackMilestones(project)} total={s.total} currency={project.currency} audience="client" />
      </Card>

      <FigureRow className="mb-8 lg:grid-cols-3">
        <Figure label="Project price" value={money(s.total)} />
        <Figure label="Paid" value={money(s.paid)} tone="paid" />
        <Figure label="Remaining" value={money(s.remaining)} />
      </FigureRow>

      {project.description && <p className="mb-8 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed text-graphite">{project.description}</p>}

      <h2 className="mb-3 text-lg font-semibold">Invoices</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-graphite">No invoices yet. You&apos;ll get an email when one is sent.</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-rule bg-paper">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex flex-col gap-3 border-b border-rule-soft px-6 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{titles.get(inv.milestone_id) ?? "Invoice"}</p>
                <p className="text-sm text-graphite">
                  {inv.status === "verified" ? `Paid, confirmed ${formatDate(inv.verified_at)}` : `Sent ${formatDate(inv.requested_at)}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="figures font-semibold">{money(Number(inv.amount))}</span>
                <MilestoneBadge status={inv.status} audience="client" />
                <Link href={`/portal/payments/${inv.id}`} className={inv.status === "requested" ? buttonStyles.primary : buttonStyles.secondary}>
                  {inv.status === "requested" ? (inv.rejection_reason ? "Upload new confirmation" : "Pay now") : "View"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <section id="notes" className="mt-10 scroll-mt-6">
          <h2 className="mb-3 text-lg font-semibold">Notes</h2>
          <NoteList notes={notes} />
        </section>
      )}
    </>
  );
}
