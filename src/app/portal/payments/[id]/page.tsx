import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { submitProof } from "@/actions/payments";
import { ActivityFeed } from "@/components/activity-feed";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, DetailList, Field, Input, MilestoneBadge, Notice, PageHeader, Textarea, buttonStyles, cn } from "@/components/ui";
import { getPayment, listActivity } from "@/lib/queries";
import { signedUrl } from "@/lib/storage";
import { formatDate, formatMoney, today } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/portal/payments/[id]">) {
  const { id } = await params;
  const payment = await getPayment(id);
  return { title: payment ? payment.milestone.title : "Invoice" };
}

export default async function ClientPaymentPage({ params }: PageProps<"/portal/payments/[id]">) {
  const { id } = await params;
  // RLS limits this to the signed-in client's own invoices.
  const payment = await getPayment(id);
  if (!payment) notFound();

  const [invoiceUrl, proofUrl, history] = await Promise.all([
    signedUrl(payment.invoice_path),
    signedUrl(payment.proof_path),
    listActivity({ paymentRequestId: id }),
  ]);
  const amount = formatMoney(payment.amount, payment.currency);
  const step = payment.status === "requested" ? 1 : payment.status === "proof_submitted" ? 3 : 4;

  return (
    <>
      <PageHeader
        back={{ href: `/portal/projects/${payment.project.id}`, label: payment.project.name }}
        title={payment.milestone.title}
        description={<MilestoneBadge status={payment.status} audience="client" />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {payment.status === "requested" && payment.rejection_reason && (
            <Notice tone="due">
              <p className="font-medium">Please upload a new payment confirmation</p>
              <p className="mt-1">{payment.rejection_reason}</p>
            </Notice>
          )}

          <Step n={1} title="Pay the invoice" state={step > 1 ? "done" : "current"}>
            <p className="text-[0.9375rem] text-graphite">
              {payment.status === "requested" ? (
                <>
                  Pay <span className="figures font-semibold text-ink">{amount}</span> using the {payment.wise_link && payment.invoice_path ? "link or invoice" : payment.wise_link ? "link" : "invoice"} below.
                </>
              ) : (
                <>
                  You paid <span className="figures font-semibold text-ink">{amount}</span>
                  {payment.client_paid_on ? ` on ${formatDate(payment.client_paid_on)}` : ""}.
                </>
              )}
            </p>
            {payment.message && (
              <blockquote className="mt-4 border-l-2 border-rule pl-4 text-[0.9375rem] italic leading-relaxed text-graphite whitespace-pre-line">
                {payment.message}
              </blockquote>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {payment.wise_link && payment.status === "requested" && (
                <a href={payment.wise_link} target="_blank" rel="noreferrer" className={buttonStyles.primary}>
                  Pay with Wise
                </a>
              )}
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>
                  Download invoice
                </a>
              )}
            </div>
          </Step>

          <Step n={2} title="Upload the payment confirmation" state={step === 1 ? "current" : step > 2 ? "done" : "upcoming"}>
            {payment.status === "verified" ? (
              <DetailList
                items={[
                  ["Paid on", formatDate(payment.client_paid_on)],
                  ["Transfer reference", payment.client_reference || "—"],
                  ["Confirmation", proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className="text-[#27468a] underline underline-offset-4">Download</a> : "—"],
                ]}
              />
            ) : payment.status === "proof_submitted" ? (
              <>
                <DetailList
                  items={[
                    ["Paid on", formatDate(payment.client_paid_on)],
                    ["Transfer reference", payment.client_reference || "—"],
                    ["Confirmation", proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className="text-[#27468a] underline underline-offset-4">View</a> : "—"],
                    ["Sent", formatDate(payment.proof_submitted_at)],
                  ]}
                />
                <details className="mt-5">
                  <summary className="cursor-pointer list-none text-sm font-medium text-graphite hover:text-ink">Uploaded the wrong file? Send a different one</summary>
                  <div className="mt-4">
                    <ProofForm payment={payment} submitLabel="Send new confirmation" />
                  </div>
                </details>
              </>
            ) : (
              <ProofForm payment={payment} submitLabel="Send confirmation" />
            )}
          </Step>

          <Step n={3} title="Payment confirmed" state={step === 4 ? "done" : step === 3 ? "current" : "upcoming"}>
            <p className="text-[0.9375rem] text-graphite">
              {payment.status === "verified"
                ? `Confirmed on ${formatDate(payment.verified_at)}. Thank you!`
                : payment.status === "proof_submitted"
                  ? "Your payment confirmation is being checked. You'll get an email once the payment is confirmed."
                  : "Once your payment confirmation is checked, this invoice is marked as paid and you'll get an email."}
            </p>
          </Step>
        </div>

        <aside className="order-first lg:sticky lg:top-8 lg:order-none lg:self-start">
          <Card>
            <p className="text-sm text-graphite">Amount</p>
            <p className="figures mt-1 text-3xl font-semibold tracking-[-0.02em]">{amount}</p>
            <dl className="figures mt-5 space-y-3 border-t border-rule-soft pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-graphite">Project</dt>
                <dd className="text-right font-medium">{payment.project.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-graphite">Invoice sent</dt>
                <dd className="font-medium">{formatDate(payment.requested_at)}</dd>
              </div>
              {payment.verified_at && (
                <div className="flex justify-between gap-4">
                  <dt className="text-graphite">Confirmed</dt>
                  <dd className="font-medium text-paid">{formatDate(payment.verified_at)}</dd>
                </div>
              )}
            </dl>
          </Card>
          {history.length > 0 && (
            <Card title="History" className="mt-4">
              <ActivityFeed items={history} audience="client" />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function ProofForm({ payment, submitLabel }: { payment: NonNullable<Awaited<ReturnType<typeof getPayment>>>; submitLabel: string }) {
  return (
    <ActionForm action={submitProof}>
      <input type="hidden" name="request_id" value={payment.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date you paid" name="client_paid_on">
          <Input id="client_paid_on" name="client_paid_on" type="date" max={today()} defaultValue={payment.client_paid_on ?? today()} required />
        </Field>
        <Field label="Transfer reference" name="client_reference" hint="Optional, e.g. the Wise transfer number">
          <Input id="client_reference" name="client_reference" defaultValue={payment.client_reference ?? ""} />
        </Field>
      </div>
      <Field label="Wise payment confirmation" name="proof" hint="The PDF Wise gives you once the transfer is complete (or a screenshot), up to 4 MB">
        <Input id="proof" name="proof" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required />
      </Field>
      <Field label="Note" name="client_note" hint="Optional">
        <Textarea id="client_note" name="client_note" defaultValue={payment.client_note ?? ""} rows={2} />
      </Field>
      <SubmitButton pendingLabel="Sending…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "current" | "upcoming"; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-paper px-6 py-5", state === "current" ? "border-ink/40" : "border-rule", state === "upcoming" && "opacity-60")}>
      <h2 className="flex items-center gap-3 text-base font-semibold">
        <span
          aria-hidden
          className={cn(
            "figures inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
            state === "done" ? "bg-paid text-white" : state === "current" ? "bg-ink text-white" : "border border-rule text-graphite",
          )}
        >
          {state === "done" ? "✓" : n}
        </span>
        {title}
        {state === "done" && <span className="sr-only">(done)</span>}
      </h2>
      {state !== "upcoming" || n === 3 ? <div className="mt-4 pl-10">{children}</div> : null}
    </section>
  );
}
