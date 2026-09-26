import Link from "next/link";
import { notFound } from "next/navigation";
import { sendAccessLink, updateClient } from "@/actions/clients";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PaymentTrack } from "@/components/payment-track";
import { AccountBadge, ButtonLink, Card, EmptyState, Field, Figure, FigureRow, Input, PageHeader, ProjectBadge, Table, Td, MoneyLines } from "@/components/ui";
import { listProjects, listVerifiedPayments, summarizeProject, trackMilestones } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatDate, formatMoney, sumByCurrency } from "@/lib/format";
import type { Profile } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle();
  return { title: data ? displayName(data) : "Client" };
}

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "client").maybeSingle<Profile>();
  if (!client) notFound();

  const [projects, payments] = await Promise.all([listProjects({ clientId: id }), listVerifiedPayments({ clientId: id })]);
  const rows = projects.filter((p) => p.status !== "cancelled").map((p) => ({ currency: p.currency, s: summarizeProject(p) }));

  return (
    <>
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        title={displayName(client)}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span>{client.company ? `${client.company}, ${client.email}` : client.email}</span>
            <AccountBadge status={client.status} />
          </span>
        }
        actions={client.status === "approved" && <ButtonLink href={`/projects/new?client=${client.id}`}>New project</ButtonLink>}
      />

      <FigureRow className="mb-8">
        <Figure label="Contracted" value={<MoneyLines totals={sumByCurrency(rows, (r) => r.s.total, (r) => r.currency)} />} />
        <Figure label="Collected" value={<MoneyLines totals={sumByCurrency(rows, (r) => r.s.paid, (r) => r.currency)} />} tone="paid" />
        <Figure label="Still to collect" value={<MoneyLines totals={sumByCurrency(rows, (r) => r.s.remaining, (r) => r.currency)} />} />
        <Figure label="You received" value={<MoneyLines totals={sumByCurrency(payments, (p) => p.earning.net_amount, (p) => p.earning.net_currency)} />} hint="Private to you" />
      </FigureRow>

      <h2 className="mb-3 text-lg font-semibold">Projects</h2>
      {projects.length === 0 ? (
        <EmptyState title="No projects for this client yet" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-rule bg-paper">
          {projects.map((p) => {
            const s = summarizeProject(p);
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="block border-b border-rule-soft px-6 py-4 transition-colors last:border-b-0 hover:bg-desk/40">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold">{p.name}</p>
                    <ProjectBadge status={p.status} />
                  </div>
                  <p className="figures text-sm text-graphite">
                    <span className="font-semibold text-paid">{formatMoney(s.paid, p.currency)}</span> of {formatMoney(s.total, p.currency)}
                  </p>
                </div>
                <div className="mt-3">
                  <PaymentTrack milestones={trackMilestones(p)} total={s.total} currency={p.currency} size="sm" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Card title="Payments received" className="mt-8">
        {payments.length === 0 ? (
          <p className="text-sm text-graphite">No verified payments from this client yet.</p>
        ) : (
          <Table head={["Received", "Invoice", "Client paid", "You received"]} align={["left", "left", "right", "right"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="text-graphite">{formatDate(p.earning.received_on)}</Td>
                <Td>
                  <Link href={`/payments/${p.id}`} className="font-medium hover:underline">{p.milestone.title}</Link>
                  <p className="text-xs text-graphite">{p.project.name}</p>
                </Td>
                <Td align="right">{formatMoney(p.amount, p.currency)}</Td>
                <Td align="right" className="font-semibold text-paid">{formatMoney(p.earning.net_amount, p.earning.net_currency)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Client details" className="mt-8 max-w-xl">
        <ActionForm action={updateClient}>
          <input type="hidden" name="client_id" value={client.id} />
          <Field label="Name" name="full_name">
            <Input id="full_name" name="full_name" defaultValue={client.full_name} required />
          </Field>
          <Field label="Company" name="company" hint="Optional">
            <Input id="company" name="company" defaultValue={client.company ?? ""} />
          </Field>
          <SubmitButton variant="secondary">Save details</SubmitButton>
        </ActionForm>
        {client.status === "approved" && (
          <ActionForm action={sendAccessLink} className="mt-6 border-t border-rule-soft pt-5">
            <input type="hidden" name="client_id" value={client.id} />
            <p className="text-sm text-graphite">Invite link expired, or they forgot their password? Email them a new one-time sign-in link.</p>
            <SubmitButton variant="secondary" pendingLabel="Sending…">Send a new sign-in link</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
