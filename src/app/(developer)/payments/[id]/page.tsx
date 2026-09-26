import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelPaymentRequest, rejectProof, updateEarning, verifyPayment } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, DetailList, Field, Input, MilestoneBadge, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { getPayment } from "@/lib/queries";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES, displayName, formatDate, formatMoney, today } from "@/lib/format";
import type { PaymentEarning } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/payments/[id]">) {
  const { id } = await params;
  const payment = await getPayment(id);
  return { title: payment ? payment.milestone.title : "Payment" };
}

const linkClass = "text-[#27468a] underline underline-offset-4";

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
        back={{ href: `/projects/${payment.project.id}`, label: payment.project.name }}
        title={`${payment.milestone.title}`}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="figures font-semibold text-ink">{amount}</span>
            <span>
              from{" "}
              <Link href={`/clients/${payment.client.id}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                {displayName(payment.client)}
              </Link>
            </span>
            <MilestoneBadge status={payment.status} />
          </span>
        }
      />

      {payment.status === "proof_submitted" && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card tone="paid" title="Confirm you received it">
            <p className="mb-5 text-sm text-graphite">
              Check the transfer in Wise, then record what actually reached you after fees. Any currency works. Only you can see this.
            </p>
            <EarningForm action={verifyPayment} requestId={payment.id} submitLabel="Mark as paid" variant="paid" />
          </Card>
          <Card title="Receipt doesn't match?">
            <ActionForm action={rejectProof}>
              <input type="hidden" name="request_id" value={payment.id} />
              <Field label="Tell the client what's wrong" name="reason" hint="Included in the email to the client.">
                <Textarea id="reason" name="reason" rows={3} placeholder="I can't find this transfer in Wise yet. Could you send the transfer confirmation?" required />
              </Field>
              <SubmitButton variant="secondary" pendingLabel="Sending…">Ask for a new receipt</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}

      {payment.status === "verified" && earning && (
        <Card tone="paid" title="What you received" className="mb-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="figures text-3xl font-semibold tracking-[-0.02em] text-paid">{formatMoney(earning.net_amount, earning.net_currency)}</p>
              <p className="mt-1 text-sm text-graphite">received {formatDate(earning.received_on)}, private to you</p>
            </div>
            <div className="sm:col-span-2">
              <DetailList
                items={[
                  ["Client paid", amount],
                  ["Confirmed", formatDate(payment.verified_at)],
                  ...(earning.note ? ([["Note", earning.note]] as [string, string][]) : []),
                ]}
              />
            </div>
          </div>
          <details className="mt-5 border-t border-rule-soft pt-4">
            <summary className="cursor-pointer list-none text-sm text-graphite hover:text-ink">Correct this record</summary>
            <div className="mt-4 max-w-lg">
              <EarningForm action={updateEarning} requestId={payment.id} earning={earning} submitLabel="Save changes" />
            </div>
          </details>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Your request">
          <DetailList
            items={[
              ["Amount", amount],
              ["Sent", formatDate(payment.requested_at)],
              ["Wise link", payment.wise_link ? <a href={payment.wise_link} target="_blank" rel="noreferrer" className={`${linkClass} break-all`}>{payment.wise_link.replace(/^https?:\/\//, "")}</a> : "—"],
              ["Invoice", invoiceUrl ? <a href={invoiceUrl} target="_blank" rel="noreferrer" className={linkClass}>Download</a> : "—"],
            ]}
          />
          {payment.message && <p className="mt-5 whitespace-pre-line border-l-2 border-rule pl-4 text-sm leading-relaxed text-graphite">{payment.message}</p>}
          {payment.status !== "verified" && (
            <ActionForm action={cancelPaymentRequest} className="mt-5 border-t border-rule-soft pt-4">
              <input type="hidden" name="request_id" value={payment.id} />
              <SubmitButton variant="ghost" className="!px-0 !text-danger hover:!bg-transparent" confirm="Cancel this payment request? The milestone goes back to not requested.">
                Cancel request
              </SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card title="Client's receipt">
          {payment.status === "requested" && payment.rejection_reason && (
            <div className="mb-4">
              <Notice tone="due">You asked for a new receipt: {payment.rejection_reason}</Notice>
            </div>
          )}
          {payment.proof_submitted_at ? (
            <>
              <DetailList
                items={[
                  ["Paid on", formatDate(payment.client_paid_on)],
                  ["Sent", formatDate(payment.proof_submitted_at)],
                  ["Transfer reference", payment.client_reference || "—"],
                  ["Receipt", proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className={linkClass}>Open receipt</a> : "—"],
                ]}
              />
              {payment.client_note && <p className="mt-5 whitespace-pre-line border-l-2 border-rule pl-4 text-sm leading-relaxed text-graphite">{payment.client_note}</p>}
            </>
          ) : (
            <p className="text-sm text-graphite">No receipt yet. You&apos;ll get an email when {displayName(payment.client)} sends one.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function EarningForm({
  action,
  requestId,
  earning,
  submitLabel,
  variant = "primary",
}: {
  action: typeof verifyPayment;
  requestId: string;
  earning?: PaymentEarning;
  submitLabel: string;
  variant?: "primary" | "paid";
}) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Amount received" name={`net_amount_${requestId}`}>
          <Input id={`net_amount_${requestId}`} name="net_amount" type="number" min="0" step="0.01" defaultValue={earning?.net_amount} placeholder="36000" required />
        </Field>
        <Field label="Currency" name={`net_currency_${requestId}`}>
          <Select id={`net_currency_${requestId}`} name="net_currency" defaultValue={earning?.net_currency ?? "INR"}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Received on" name={`received_on_${requestId}`}>
          <Input id={`received_on_${requestId}`} name="received_on" type="date" defaultValue={earning?.received_on ?? today()} required />
        </Field>
        <Field label="Note" name={`note_${requestId}`} hint="Optional">
          <Input id={`note_${requestId}`} name="note" defaultValue={earning?.note ?? ""} placeholder="After Wise fees" />
        </Field>
      </div>
      <SubmitButton variant={variant} pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
