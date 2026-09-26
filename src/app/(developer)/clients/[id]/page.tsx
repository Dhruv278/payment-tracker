import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "@/actions/clients";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AccountBadge, ButtonLink, Card, EmptyState, Field, Input, PageHeader, ProjectBadge, ProgressBar, StatCard, Table, Td } from "@/components/ui";
import { listProjects, listVerifiedPayments, summarizeProject } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatDate, formatMoney, formatTotals, sumByCurrency } from "@/lib/format";
import type { Profile } from "@/lib/types";

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
        title={displayName(client)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {client.company && <span>{client.company} ·</span>}
            <span>{client.email}</span>
            <AccountBadge status={client.status} />
          </span>
        }
        actions={client.status === "approved" && <ButtonLink href={`/projects/new?client=${client.id}`}>New project</ButtonLink>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Contracted" value={formatTotals(sumByCurrency(rows, (r) => r.s.total, (r) => r.currency))} />
        <StatCard label="Collected" value={formatTotals(sumByCurrency(rows, (r) => r.s.paid, (r) => r.currency))} />
        <StatCard
          label="Net earned (private)"
          value={formatTotals(sumByCurrency(payments, (p) => p.earning.net_amount, (p) => p.earning.net_currency))}
        />
      </div>

      <Card title="Projects" className="mt-6">
        {projects.length === 0 ? (
          <EmptyState title="No projects for this client yet" />
        ) : (
          <Table head={["Project", "Status", "Price", "Progress"]}>
            {projects.map((p) => {
              const s = summarizeProject(p);
              return (
                <tr key={p.id}>
                  <Td><Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:underline">{p.name}</Link></Td>
                  <Td><ProjectBadge status={p.status} /></Td>
                  <Td>{formatMoney(s.total, p.currency)}</Td>
                  <Td className="min-w-48"><ProgressBar value={s.paid} max={s.total} /></Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title="Payment history" className="mt-6">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No verified payments yet.</p>
        ) : (
          <Table head={["Received", "Project", "Milestone", "Billed", "Net to you"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.earning.received_on)}</Td>
                <Td>{p.project.name}</Td>
                <Td><Link href={`/payments/${p.id}`} className="hover:underline">{p.milestone.title}</Link></Td>
                <Td>{formatMoney(p.amount, p.currency)}</Td>
                <Td className="font-medium text-emerald-700">{formatMoney(p.earning.net_amount, p.earning.net_currency)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Client details" className="mt-6 max-w-xl">
        <ActionForm action={updateClient}>
          <input type="hidden" name="client_id" value={client.id} />
          <Field label="Name" name="full_name">
            <Input id="full_name" name="full_name" defaultValue={client.full_name} required />
          </Field>
          <Field label="Company" name="company">
            <Input id="company" name="company" defaultValue={client.company ?? ""} />
          </Field>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
