import Link from "next/link";
import { notFound } from "next/navigation";
import { submitProof } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, DetailList, Field, Input, MilestoneBadge, PageHeader, Textarea, buttonStyles } from "@/components/ui";
import { getPayment } from "@/lib/queries";
import { signedUrl } from "@/lib/storage";
import { formatDate, formatMoney, today } from "@/lib/format";

export const metadata = { title: "Payment" };

export default async function ClientPaymentPage({ params }: PageProps<"/portal/payments/[id]">) {
  const { id } = await params;
  // RLS limits this to the signed-in client's own payment requests.
  const payment = await getPayment(id);
  if (!payment) notFound();

  const [invoiceUrl, proofUrl] = await Promise.all([signedUrl(payment.invoice_path), signedUrl(payment.proof_path)]);
  const amount = formatMoney(payment.amount, payment.currency);

  return (
    <>
      <PageHeader
        title={`${amount} — ${payment.milestone.title}`}
        description={
          <span className="flex items-center gap-2">
            <Link href={`/portal/projects/${payment.project.id}`} className="hover:underline">{payment.project.name}</Link>
            <MilestoneBadge status={payment.status} />
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="How to pay">
          <p className="text-3xl font-semibold">{amount}</p>
          <p className="mt-1 text-sm text-slate-500">Requested {formatDate(payment.requested_at)}</p>
          {payment.message && <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{payment.message}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {payment.wise_link && (
              <a href={payment.wise_link} target="_blank" rel="noreferrer" className={buttonStyles.primary}>Pay with Wise ↗</a>
            )}
            {invoiceUrl && (
              <a href={invoiceUrl} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>Download invoice</a>
            )}
          </div>
        </Card>

        {payment.status === "verified" ? (
          <Card title="Payment confirmed" className="border-emerald-200">
            <p className="text-sm text-slate-600">Thank you! This payment was verified on {formatDate(payment.verified_at)}.</p>
            <div className="mt-4">
              <DetailList
                items={[
                  ["Paid on", formatDate(payment.client_paid_on)],
                  ["Reference", payment.client_reference || "—"],
                  ["Your receipt", proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">Download</a> : "—"],
                ]}
              />
            </div>
          </Card>
        ) : (
          <Card title={payment.status === "proof_submitted" ? "Proof submitted — awaiting verification" : "Already paid? Upload your proof"}>
            {payment.rejection_reason && payment.status === "requested" && (
              <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your previous proof was not accepted: {payment.rejection_reason}</p>
            )}
            {payment.status === "proof_submitted" && (
              <p className="mb-4 text-sm text-slate-600">
                Submitted {formatDate(payment.proof_submitted_at)}.{" "}
                {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">View receipt</a>}
                {" "}You can replace it below if needed.
              </p>
            )}
            <ActionForm action={submitProof}>
              <input type="hidden" name="request_id" value={payment.id} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Date paid" name="client_paid_on">
                  <Input id="client_paid_on" name="client_paid_on" type="date" max={today()} defaultValue={payment.client_paid_on ?? today()} required />
                </Field>
                <Field label="Transfer reference (optional)" name="client_reference">
                  <Input id="client_reference" name="client_reference" defaultValue={payment.client_reference ?? ""} placeholder="Wise transfer #" />
                </Field>
              </div>
              <Field label="Payment receipt" name="proof" hint="PDF or image, up to 4 MB.">
                <Input id="proof" name="proof" type="file" accept="application/pdf,image/*" required />
              </Field>
              <Field label="Note (optional)" name="client_note">
                <Textarea id="client_note" name="client_note" defaultValue={payment.client_note ?? ""} />
              </Field>
              <SubmitButton>{payment.status === "proof_submitted" ? "Replace proof" : "Submit proof"}</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
