"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeClient, authorizeDeveloper } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeDocuments, uploadDocument } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/format";
import type { ActionState, Milestone, PaymentRequest, Profile, Project } from "@/lib/types";

const UNAUTHORIZED: ActionState = { error: "You are not allowed to do that." };

type RequestWithContext = PaymentRequest & {
  milestone: Pick<Milestone, "title">;
  project: Pick<Project, "name">;
  client: Pick<Profile, "email" | "full_name">;
  developer: Pick<Profile, "email" | "full_name">;
};

async function loadRequest(id: string) {
  const { data } = await createAdminClient()
    .from("payment_requests")
    .select(
      "*, milestone:milestones(title), project:projects(name), client:profiles!payment_requests_client_id_fkey(email, full_name), developer:profiles!payment_requests_developer_id_fkey(email, full_name)",
    )
    .eq("id", id)
    .single<RequestWithContext>();
  return data;
}

function revalidatePayment(request: Pick<PaymentRequest, "id" | "project_id">) {
  revalidatePath(`/projects/${request.project_id}`);
  revalidatePath(`/payments/${request.id}`);
  revalidatePath(`/portal/payments/${request.id}`);
  revalidatePath(`/portal/projects/${request.project_id}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\//i.test(v), "The Wise link must start with https://");

// ---------------------------------------------------------------------------
// Developer: request payment for a milestone
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  milestone_id: z.uuid(),
  wise_link: optionalUrl,
  message: z.string().trim().max(2000).optional(),
});

export async function requestPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: milestone } = await admin
    .from("milestones")
    .select("*, project:projects(*, client:profiles!projects_client_id_fkey(email, full_name))")
    .eq("id", parsed.data.milestone_id)
    .single<Milestone & { project: Project & { client: Pick<Profile, "email" | "full_name"> } }>();
  if (!milestone || milestone.developer_id !== dev.id) return { error: "Milestone not found." };

  const invoiceFile = formData.get("invoice");
  if (!parsed.data.wise_link && !(invoiceFile instanceof File && invoiceFile.size > 0)) {
    return { error: "Add a Wise payment link or attach an invoice so the client knows how to pay." };
  }
  const upload = await uploadDocument(invoiceFile, `${dev.id}/${milestone.project_id}/invoices`);
  if (upload.error) return { error: upload.error };

  const { data: created, error } = await admin
    .from("payment_requests")
    .insert({
      milestone_id: milestone.id,
      project_id: milestone.project_id,
      developer_id: dev.id,
      client_id: milestone.project.client_id,
      amount: milestone.amount,
      currency: milestone.project.currency,
      wise_link: parsed.data.wise_link,
      message: parsed.data.message || null,
      invoice_path: upload.path,
    })
    .select("id")
    .single();
  if (error) {
    await removeDocuments([upload.path]);
    return { error: error.code === "23505" ? "A payment was already requested for this milestone." : error.message };
  }

  const amount = formatMoney(milestone.amount, milestone.project.currency);
  sendEmail({
    to: milestone.project.client.email,
    replyTo: dev.email,
    subject: `Payment request: ${amount} for ${milestone.project.name}`,
    heading: `Payment requested — ${amount}`,
    lines: [
      `Project: ${milestone.project.name}`,
      `Milestone: ${milestone.title}`,
      ...(parsed.data.message ? [parsed.data.message] : []),
      "After paying, open the request and upload your payment receipt.",
    ],
    cta: { label: "View payment request", path: `/portal/payments/${created.id}` },
  });

  revalidatePayment({ id: created.id, project_id: milestone.project_id });
  return { success: `Payment of ${amount} requested. The client has been emailed.` };
}

export async function cancelPaymentRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const request = await loadRequest(String(formData.get("request_id")));
  if (!request || request.developer_id !== dev.id) return { error: "Payment request not found." };
  if (request.status === "verified") return { error: "Verified payments can't be cancelled." };

  const { error } = await createAdminClient().from("payment_requests").delete().eq("id", request.id);
  if (error) return { error: error.message };
  await removeDocuments([request.invoice_path, request.proof_path]);

  revalidatePayment(request);
  return { success: "Payment request cancelled. The milestone is back to not requested." };
}

// ---------------------------------------------------------------------------
// Client: submit proof of payment
// ---------------------------------------------------------------------------

const proofSchema = z.object({
  request_id: z.uuid(),
  client_paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you paid."),
  client_reference: z.string().trim().max(200).optional(),
  client_note: z.string().trim().max(2000).optional(),
});

export async function submitProof(_: ActionState, formData: FormData): Promise<ActionState> {
  const client = await authorizeClient();
  if (!client) return UNAUTHORIZED;
  const parsed = proofSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const request = await loadRequest(parsed.data.request_id);
  if (!request || request.client_id !== client.id) return { error: "Payment request not found." };
  if (request.status === "verified") return { error: "This payment is already verified." };

  const proofFile = formData.get("proof");
  if (!(proofFile instanceof File) || proofFile.size === 0) return { error: "Attach your payment receipt (PDF or image)." };
  const upload = await uploadDocument(proofFile, `${request.developer_id}/${request.project_id}/proofs`);
  if (upload.error) return { error: upload.error };

  const { error } = await createAdminClient()
    .from("payment_requests")
    .update({
      status: "proof_submitted",
      client_paid_on: parsed.data.client_paid_on,
      client_reference: parsed.data.client_reference || null,
      client_note: parsed.data.client_note || null,
      proof_path: upload.path,
      proof_submitted_at: new Date().toISOString(),
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (error) {
    await removeDocuments([upload.path]);
    return { error: error.message };
  }
  await removeDocuments([request.proof_path]);

  const amount = formatMoney(request.amount, request.currency);
  sendEmail({
    to: request.developer.email,
    subject: `Payment proof submitted: ${amount} — ${request.project.name}`,
    heading: `${client.full_name || client.email} submitted payment proof`,
    lines: [
      `Project: ${request.project.name}`,
      `Milestone: ${request.milestone.title} (${amount})`,
      `Paid on: ${parsed.data.client_paid_on}${parsed.data.client_reference ? ` · Ref: ${parsed.data.client_reference}` : ""}`,
      "Check your Wise account and verify the payment.",
    ],
    cta: { label: "Verify payment", path: `/payments/${request.id}` },
  });

  revalidatePayment(request);
  return { success: "Thanks! Your payment proof was submitted for verification." };
}

// ---------------------------------------------------------------------------
// Developer: verify or reject proof
// ---------------------------------------------------------------------------

const earningSchema = z.object({
  request_id: z.uuid(),
  net_amount: z.coerce.number("Enter what you received.").min(0, "Amount cannot be negative."),
  net_currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency."),
  received_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you received it."),
  note: z.string().trim().max(1000).optional(),
});

export async function verifyPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = earningSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const request = await loadRequest(parsed.data.request_id);
  if (!request || request.developer_id !== dev.id) return { error: "Payment request not found." };
  if (request.status === "verified") return { error: "Already verified." };

  const admin = createAdminClient();
  const { error: earningError } = await admin.from("payment_earnings").upsert({
    payment_request_id: request.id,
    developer_id: dev.id,
    net_amount: parsed.data.net_amount,
    net_currency: parsed.data.net_currency,
    received_on: parsed.data.received_on,
    note: parsed.data.note || null,
  });
  if (earningError) return { error: earningError.message };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("payment_requests")
    .update({ status: "verified", verified_at: now, rejection_reason: null, updated_at: now })
    .eq("id", request.id);
  if (error) return { error: error.message };

  const amount = formatMoney(request.amount, request.currency);
  sendEmail({
    to: request.client.email,
    replyTo: dev.email,
    subject: `Payment received: ${amount} — ${request.project.name}`,
    heading: "Payment confirmed — thank you!",
    lines: [`Your payment of ${amount} for "${request.milestone.title}" (${request.project.name}) has been verified.`],
    cta: { label: "View project", path: `/portal/projects/${request.project_id}` },
  });

  revalidatePayment(request);
  revalidatePath("/reports");
  return { success: "Payment verified and milestone marked as paid." };
}

export async function rejectProof(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Tell the client why the proof was rejected." };

  const request = await loadRequest(String(formData.get("request_id")));
  if (!request || request.developer_id !== dev.id) return { error: "Payment request not found." };
  if (request.status !== "proof_submitted") return { error: "There is no submitted proof to reject." };

  const { error } = await createAdminClient()
    .from("payment_requests")
    .update({ status: "requested", rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", request.id);
  if (error) return { error: error.message };

  sendEmail({
    to: request.client.email,
    replyTo: dev.email,
    subject: `Action needed: payment proof for ${request.project.name}`,
    heading: "Your payment proof needs another look",
    lines: [`Milestone: ${request.milestone.title} (${formatMoney(request.amount, request.currency)})`, `Reason: ${reason}`, "Please upload an updated receipt."],
    cta: { label: "Update payment proof", path: `/portal/payments/${request.id}` },
  });

  revalidatePayment(request);
  return { success: "Proof rejected. The client has been asked to resubmit." };
}

/** Edit the private net-received record of a verified payment. */
export async function updateEarning(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = earningSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const request = await loadRequest(parsed.data.request_id);
  if (!request || request.developer_id !== dev.id || request.status !== "verified") return { error: "Payment not found." };

  const { error } = await createAdminClient()
    .from("payment_earnings")
    .update({
      net_amount: parsed.data.net_amount,
      net_currency: parsed.data.net_currency,
      received_on: parsed.data.received_on,
      note: parsed.data.note || null,
    })
    .eq("payment_request_id", request.id);
  if (error) return { error: error.message };

  revalidatePayment(request);
  revalidatePath("/reports");
  return { success: "Earnings record updated." };
}
