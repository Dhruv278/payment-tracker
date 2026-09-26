import Link from "next/link";
import { approveClient, inviteClient, rejectClient } from "@/actions/clients";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AccountBadge, Card, EmptyState, Field, Input, PageHeader, Table, Td } from "@/components/ui";
import { listClients, listProjects, summarizeProject } from "@/lib/queries";
import { displayName, formatDate, formatTotals, sumByCurrency } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const [clients, projects] = await Promise.all([listClients(), listProjects()]);
  const pending = clients.filter((c) => c.status === "pending");
  const approved = clients.filter((c) => c.status === "approved");
  const rejected = clients.filter((c) => c.status === "rejected");

  return (
    <>
      <PageHeader title="Clients" description="Approve sign-ups, invite clients and see what each one has paid." />

      {pending.length > 0 && (
        <Card title={`Waiting for approval (${pending.length})`} className="mb-6 border-amber-200">
          <ul className="divide-y divide-slate-100">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{displayName(c)}{c.company && <span className="text-slate-500"> · {c.company}</span>}</p>
                  <p className="text-xs text-slate-500">{c.email} · signed up {formatDate(c.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <ActionForm action={approveClient} className="space-y-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <SubmitButton>Approve</SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectClient} className="space-y-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <SubmitButton variant="secondary" confirm={`Reject ${displayName(c)}?`}>Reject</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={`Your clients (${approved.length})`} className="lg:col-span-2">
          {approved.length === 0 ? (
            <EmptyState title="No approved clients yet" description="Invite a client or approve a sign-up to get started." />
          ) : (
            <Table head={["Client", "Projects", "Collected", "Outstanding"]}>
              {approved.map((c) => {
                const own = projects.filter((p) => p.client_id === c.id && p.status !== "cancelled");
                const rows = own.map((p) => ({ currency: p.currency, s: summarizeProject(p) }));
                return (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:underline">{displayName(c)}</Link>
                      <p className="text-xs text-slate-500">{c.company || c.email}</p>
                    </Td>
                    <Td>{own.length}</Td>
                    <Td className="text-emerald-700">{formatTotals(sumByCurrency(rows, (r) => r.s.paid, (r) => r.currency))}</Td>
                    <Td>{formatTotals(sumByCurrency(rows, (r) => r.s.remaining, (r) => r.currency))}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>

        <Card title="Invite a client">
          <p className="mb-4 text-sm text-slate-500">Creates an approved account and emails them a link to set their password.</p>
          <ActionForm action={inviteClient} resetOnSuccess>
            <Field label="Name" name="invite_name">
              <Input id="invite_name" name="full_name" required />
            </Field>
            <Field label="Company (optional)" name="invite_company">
              <Input id="invite_company" name="company" />
            </Field>
            <Field label="Email" name="invite_email">
              <Input id="invite_email" name="email" type="email" required />
            </Field>
            <SubmitButton className="w-full">Send invite</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {rejected.length > 0 && (
        <Card title="Rejected" className="mt-6">
          <ul className="divide-y divide-slate-100">
            {rejected.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm">{displayName(c)} <span className="text-slate-500">· {c.email}</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <AccountBadge status="rejected" />
                  <ActionForm action={approveClient} className="space-y-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <SubmitButton variant="ghost">Approve instead</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
