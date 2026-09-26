import Link from "next/link";
import { approveClient, inviteClient, rejectClient } from "@/actions/clients";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, Input, PageHeader, Table, Td } from "@/components/ui";
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
      <PageHeader title="Clients" description="Approve new sign-ups, invite clients, and see what each client has paid." />

      {pending.length > 0 && (
        <Card tone="due" title={`Waiting for approval (${pending.length})`} className="mb-8">
          <ul className="-my-1 divide-y divide-rule-soft">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {displayName(c)}
                    {c.company && <span className="font-normal text-graphite">, {c.company}</span>}
                  </p>
                  <p className="text-sm text-graphite">
                    {c.email}, signed up {formatDate(c.created_at)}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <ActionForm action={approveClient} className="space-y-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <SubmitButton variant="paid" pendingLabel="Approving…">Approve</SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectClient} className="space-y-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <SubmitButton variant="secondary" pendingLabel="Rejecting…" confirm={`Reject ${displayName(c)}? They won't be able to access the portal.`}>
                      Reject
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Your clients" className="lg:self-start">
          {approved.length === 0 ? (
            <EmptyState title="No clients yet" description="Invite a client, or approve someone who signed up." />
          ) : (
            <Table head={["Client", "Projects", "Collected", "Still to collect"]} align={["left", "right", "right", "right"]}>
              {approved.map((c) => {
                const own = projects.filter((p) => p.client_id === c.id && p.status !== "cancelled");
                const rows = own.map((p) => ({ currency: p.currency, s: summarizeProject(p) }));
                return (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">{displayName(c)}</Link>
                      <p className="text-xs text-graphite">{c.company || c.email}</p>
                    </Td>
                    <Td align="right">{own.length}</Td>
                    <Td align="right" className="text-paid">{formatTotals(sumByCurrency(rows, (r) => r.s.paid, (r) => r.currency))}</Td>
                    <Td align="right">{formatTotals(sumByCurrency(rows, (r) => r.s.remaining, (r) => r.currency))}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>

        <Card title="Invite a client" className="lg:self-start">
          <p className="mb-5 text-sm text-graphite">They&apos;ll get an email to choose a password. No approval step needed.</p>
          <ActionForm action={inviteClient} resetOnSuccess>
            <Field label="Name" name="invite_name">
              <Input id="invite_name" name="full_name" required />
            </Field>
            <Field label="Company" name="invite_company" hint="Optional">
              <Input id="invite_company" name="company" />
            </Field>
            <Field label="Email" name="invite_email">
              <Input id="invite_email" name="email" type="email" required />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Sending invite…">Send invite</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {rejected.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer list-none text-sm text-graphite hover:text-ink">Rejected sign-ups ({rejected.length})</summary>
          <Card className="mt-3">
            <ul className="-my-1 divide-y divide-rule-soft">
              {rejected.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="text-sm">
                    {displayName(c)} <span className="text-graphite">({c.email})</span>
                  </p>
                  <ActionForm action={approveClient} className="space-y-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <SubmitButton variant="ghost" pendingLabel="Approving…">Approve instead</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
    </>
  );
}
