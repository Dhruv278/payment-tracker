import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelPaymentRequest, rejectProof, updateEarning, verifyPayment } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, DetailList, Field, Input, MilestoneBadge, PageHeader, Select, Textarea } from "@/components/ui";
import { getPayment } from "@/lib/queries";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES, displayName, formatDate, formatMoney, today } from "@/lib/format";
import type { PaymentEarning } from "@/lib/types";

export const metadata = { title: "Payment" };

export default async function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) notFound();

  const supabase = await createClient();
  const [{ data: earning }, invoiceUrl, proofUrl] = await Promise.all([
    supabase.from("payment_earnings").select("*").eq("payment_request_id", id).maybeSingle<PaymentEarning>(),
    signedUrl(payment.invoice_path),
    signedUrl(payment.proof_path),
  ]);
  const amount = formatMoney(payment.amount, payment.currency);

  return (
    <>
      <PageHeader
        title={`${amount} — ${payment.milestone.title}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/projects/${payment.project.id}`} className="hover:underline">{payment.project.name}</Link>
            <span>·</span>
            <Link href={`/clients/${payment.client.id}`} className="hover:underline">{displayName(payment.client)}</Link>
            <MilestoneBadge status={payment.status} />
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Payment request">
          <DetailList
            items={[
              ["Amount", amount],
              ["Requested", formatDate(payment.requested_at)],
              ["Wise link", payment.wise_link ? <a href={payment.wise_link} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline">{payment.wise_link}</a> : "—"],
              ["Invoice", invoiceUrl ? <a href={invoiceUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">Download</a> : "—"],
            ]}
          />
          {payment.message && <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{payment.message}</p>}
          {payment.status !== "verified" && (
            <ActionForm action={cancelPaymentRequest} className="mt-5">
              <input type="hidden" name="request_id" value={payment.id} />
              <SubmitButton variant="ghost" className="text-rose-600" confirm="Cancel this payment request? The milestone goes back to not requested.">
                Cancel request
              </SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card title="Client's proof of payment">
          {payment.proof_submitted_at ? (
            <>
              <DetailList
                items={[
                  ["Paid on", formatDate(payment.client_paid_on)],
                  ["Submitted", formatDate(payment.proof_submitted_at)],
                  ["Wise / transaction ref", payment.client_reference || "—"],
                  ["Receipt", proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">Download</a> : "—"],
                ]}
              />
              {payment.client_note && <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{payment.client_note}</p>}
            </>
          ) : (
            <p className="text-sm text-slate-500">The client hasn&apos;t submitted proof yet.</p>
          )}
          {payment.rejection_reason && payment.status === "requested" && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Previous proof rejected: {payment.rejection_reason}</p>
          )}
        </Card>
      </div>

      {payment.status === "proof_submitted" && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Verify & record what you received" className="border-emerald-200">
            <p className="mb-4 text-sm text-slate-500">
              Only you can see this. Record the amount you actually kept after fees and expenses, in any currency.
            </p>
            <EarningFields action={verifyPayment} requestId={payment.id} submitLabel="Mark as paid" />
          </Card>
          <Card title="Reject proof">
            <ActionForm action={rejectProof}>
              <input type="hidden" name="request_id" value={payment.id} />
              <Field label="Reason (sent to the client)" name="reason">
                <Textarea id="reason" name="reason" placeholder="I couldn't find this transfer in Wise — could you share the transfer receipt?" required />
              </Field>
              <SubmitButton variant="secondary">Reject and ask to resubmit</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}

      {payment.status === "verified" && earning && (
        <Card title="Your earnings (private)" className="mt-6 max-w-2xl border-emerald-200">
          <DetailList
            items={[
              ["Billed to client", amount],
              ["Net received", <span key="n" className="font-semibold text-emerald-700">{formatMoney(earning.net_amount, earning.net_currency)}</span>],
              ["Received on", formatDate(earning.received_on)],
              ["Verified", formatDate(payment.verified_at)],
            ]}
          />
          {earning.note && <p className="mt-4 text-sm text-slate-600">{earning.note}</p>}
          <details className="mt-5">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">Edit earnings record</summary>
            <div className="mt-4">
              <EarningFields action={updateEarning} requestId={payment.id} earning={earning} submitLabel="Save" />
            </div>
          </details>
        </Card>
      )}
    </>
  );
}

function EarningFields({
  action,
  requestId,
  earning,
  submitLabel,
}: {
  action: typeof verifyPayment;
  requestId: string;
  earning?: PaymentEarning;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Net amount received" name="net_amount">
            <Input id="net_amount" name="net_amount" type="number" min="0" step="0.01" defaultValue={earning?.net_amount} placeholder="36000" required />
          </Field>
        </div>
        <Field label="Currency" name="net_currency">
          <Select id="net_currency" name="net_currency" defaultValue={earning?.net_currency ?? "INR"}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Received on" name="received_on">
        <Input id="received_on" name="received_on" type="date" defaultValue={earning?.received_on ?? today()} required />
      </Field>
      <Field label="Private note (optional)" name="note">
        <Input id="note" name="note" defaultValue={earning?.note ?? ""} placeholder="Wise fee + conversion" />
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
