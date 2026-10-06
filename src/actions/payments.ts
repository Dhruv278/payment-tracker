"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
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

/** The invoice email to the client, used when the invoice is sent and for reminders. */
function emailInvoice(
  request: Pick<PaymentRequest, "id" | "amount" | "currency" | "wise_link" | "invoice_path" | "message">,
  ctx: { title: string; projectName: string; clientEmail: string; developer: Pick<Profile, "email" | "full_name"> },
  reminder = false,
) {
  const formatted = formatMoney(request.amount, request.currency);
  const portalPath = `/portal/payments/${request.id}`;
  // Stored as "<timestamp>-<name>"; attach it under its original name.
  const fileName = request.invoice_path?.split("/").pop()?.replace(/^\d+-/, "");
  const intro = reminder
    ? ["This invoice is still waiting for payment. If you've already paid, please upload the payment confirmation so it can be matched."]
    : request.message
      ? [request.message]
      : [];
  sendEmail({
    to: ctx.clientEmail,
    replyTo: ctx.developer.email,
    subject: reminder
      ? `Reminder: ${formatted} due for ${ctx.projectName}`
      : `Invoice from ${ctx.developer.full_name || "your developer"}: ${formatted} for ${ctx.projectName}`,
    heading: reminder ? `Reminder: ${ctx.title} for ${ctx.projectName}` : `${ctx.title} for ${ctx.projectName}`,
    amount: formatted,
    lines: [
      ...intro,
      request.wise_link
        ? "Pay securely with Wise using the button below. Once the payment is complete, upload the Wise payment confirmation PDF so it can be matched to this invoice."
        : "The invoice is attached. Once you've paid, upload the payment confirmation PDF so it can be matched to this invoice.",
    ],
    cta: request.wise_link ? { label: "Pay with Wise", path: request.wise_link } : { label: "Upload payment confirmation", path: portalPath },
    secondaryCta: request.wise_link ? { label: "Upload payment confirmation", path: portalPath } : undefined,
    attachments: request.invoice_path && fileName ? [{ filename: fileName, storagePath: request.invoice_path }] : undefined,
  });
}

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\//i.test(v), "The Wise link must start with https://");

// ---------------------------------------------------------------------------
// Developer: create and send an invoice
// An invoice is stored as a milestone (title/amount) + its payment request.
// ---------------------------------------------------------------------------

const invoiceSchema = z.object({
  project_id: z.uuid(),
  title: z.string().trim().min(2, "Give the invoice a title, e.g. Phase 1.").max(160),
  amount: z.coerce.number("Enter the invoice amount.").positive("Amount must be greater than zero."),
  wise_link: optionalUrl,
  message: z.string().trim().max(2000).optional(),
});

export async function createInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { project_id, title, amount, wise_link, message } = parsed.data;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("*, client:profiles!projects_client_id_fkey(email, full_name, status)")
    .eq("id", project_id)
    .single<Project & { client: Pick<Profile, "email" | "full_name" | "status"> }>();
  if (!project || project.developer_id !== dev.id) return { error: "Project not found." };
  if (project.client.status !== "approved") return { error: "This client's account isn't approved, so they can't open the invoice." };

  const invoiceFile = formData.get("invoice");
  const fileName = invoiceFile instanceof File && invoiceFile.size > 0 ? invoiceFile.name : null;
  if (!wise_link && !fileName) return { error: "Add your Wise payment link or attach the invoice PDF so the client knows how to pay." };
  const upload = await uploadDocument(invoiceFile, `${dev.id}/${project.id}/invoices`);
  if (upload.error) return { error: upload.error };

  const { count } = await admin.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", project.id);
  const { data: milestone, error: milestoneError } = await admin
    .from("milestones")
    .insert({ project_id: project.id, developer_id: dev.id, title, amount, position: count ?? 0 })
    .select("id")
    .single();
  if (milestoneError) {
    await removeDocuments([upload.path]);
    return { error: milestoneError.message };
  }

  const { data: created, error } = await admin
    .from("payment_requests")
    .insert({
      milestone_id: milestone.id,
      project_id: project.id,
      developer_id: dev.id,
      client_id: project.client_id,
      amount,
      currency: project.currency,
      wise_link,
      message: message || null,
      invoice_path: upload.path,
    })
    .select("id")
    .single();
  if (error) {
    await admin.from("milestones").delete().eq("id", milestone.id);
    await removeDocuments([upload.path]);
    return { error: error.message };
  }

  const formatted = formatMoney(amount, project.currency);
  emailInvoice(
    { id: created.id, amount, currency: project.currency, wise_link, invoice_path: upload.path, message: message || null },
    { title, projectName: project.name, clientEmail: project.client.email, developer: dev },
  );
  await logActivity({
    project_id: project.id,
    developer_id: dev.id,
    payment_request_id: created.id,
    kind: "invoice_sent",
    title,
    amount,
    currency: project.currency,
  });

  revalidatePayment({ id: created.id, project_id: project.id });
  return { success: `Invoice for ${formatted} sent to ${project.client.full_name || project.client.email}.` };
}

const REMINDER_GAP_MS = 24 * 60 * 60 * 1000;

/** Emails the invoice again as a reminder. At most one reminder per invoice per 24 hours. */
export async function sendReminder(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const request = await loadRequest(String(formData.get("request_id")));
  if (!request || request.developer_id !== dev.id) return { error: "Invoice not found." };
  if (request.status !== "requested") return { error: "Reminders are only for invoices that are waiting for payment." };

  const { data: last } = await createAdminClient()
    .from("activity")
    .select("created_at")
    .eq("payment_request_id", request.id)
    .eq("kind", "invoice_reminder")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  if (last && Date.now() - new Date(last.created_at).getTime() < REMINDER_GAP_MS) {
    return { error: "A reminder was already sent in the last 24 hours." };
  }

  emailInvoice(request, { title: request.milestone.title, projectName: request.project.name, clientEmail: request.client.email, developer: dev }, true);
  await logActivity({
    project_id: request.project_id,
    developer_id: dev.id,
    payment_request_id: request.id,
    kind: "invoice_reminder",
    title: request.milestone.title,
    amount: request.amount,
    currency: request.currency,
  });

  revalidatePayment(request);
  return { success: `Reminder sent to ${request.client.full_name || request.client.email}.` };
}

export async function cancelInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const request = await loadRequest(String(formData.get("request_id")));
  if (!request || request.developer_id !== dev.id) return { error: "Invoice not found." };
  if (request.status === "verified") return { error: "Paid invoices can't be cancelled." };

  // Deleting the milestone cascades to its payment request.
  const { error } = await createAdminClient().from("milestones").delete().eq("id", request.milestone_id);
  if (error) return { error: error.message };
  await removeDocuments([request.invoice_path, request.proof_path]);

  sendEmail({
    to: request.client.email,
    replyTo: dev.email,
    subject: `Invoice cancelled: ${request.milestone.title} (${request.project.name})`,
    heading: "This invoice has been cancelled",
    lines: [
      `The invoice "${request.milestone.title}" for ${formatMoney(request.amount, request.currency)} on ${request.project.name} was cancelled. No payment is needed for it.`,
      "If you already paid it, just reply to this email.",
    ],
  });
  await logActivity({
    project_id: request.project_id,
    developer_id: dev.id,
    kind: "invoice_cancelled",
    title: request.milestone.title,
    amount: request.amount,
    currency: request.currency,
  });

  revalidatePayment(request);
  redirect(`/projects/${request.project_id}`);
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
  if (!request || request.client_id !== client.id) return { error: "Invoice not found." };
  if (request.status === "verified") return { error: "This payment is already verified." };

  const proofFile = formData.get("proof");
  if (!(proofFile instanceof File) || proofFile.size === 0) return { error: "Attach the payment confirmation PDF (or a screenshot)." };
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
    subject: `Payment confirmation received: ${amount} for ${request.project.name}`,
    heading: `${client.full_name || client.email} uploaded a payment confirmation`,
    lines: [
      `Project: ${request.project.name}`,
      `Invoice: ${request.milestone.title} (${amount})`,
      `Paid on: ${parsed.data.client_paid_on}${parsed.data.client_reference ? `, reference ${parsed.data.client_reference}` : ""}`,
      "Check your Wise account, then verify the payment.",
    ],
    cta: { label: "Verify payment", path: `/payments/${request.id}` },
  });
  await logActivity({
    project_id: request.project_id,
    developer_id: request.developer_id,
    payment_request_id: request.id,
    kind: "proof_submitted",
    title: request.milestone.title,
    amount: request.amount,
    currency: request.currency,
    detail: parsed.data.client_paid_on,
  });

  revalidatePayment(request);
  return { success: "Thanks! Your payment confirmation was sent for verification." };
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
  if (!request || request.developer_id !== dev.id) return { error: "Invoice not found." };
  if (request.status === "verified") return { error: "Already verified." };
  // The developer can also mark an invoice paid before the client uploads anything.
  const withoutProof = request.status === "requested";

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
    .update({
      status: "verified",
      verified_at: now,
      rejection_reason: null,
      updated_at: now,
      ...(withoutProof && !request.client_paid_on ? { client_paid_on: parsed.data.received_on } : {}),
    })
    .eq("id", request.id);
  if (error) return { error: error.message };

  const amount = formatMoney(request.amount, request.currency);
  sendEmail({
    to: request.client.email,
    replyTo: dev.email,
    subject: `Payment received: ${amount} for ${request.project.name}`,
    heading: "Payment confirmed. Thank you!",
    lines: [`Your payment of ${amount} for "${request.milestone.title}" (${request.project.name}) has been received and verified.`],
    cta: { label: "View project", path: `/portal/projects/${request.project_id}` },
  });
  const trail = { project_id: request.project_id, developer_id: dev.id, payment_request_id: request.id, title: request.milestone.title };
  await logActivity({ ...trail, kind: "payment_verified", amount: request.amount, currency: request.currency, detail: withoutProof ? "no_proof" : null });
  // What actually arrived stays private to the developer.
  await logActivity({ ...trail, kind: "earning_recorded", client_visible: false, amount: parsed.data.net_amount, currency: parsed.data.net_currency });

  revalidatePayment(request);
  revalidatePath("/reports");
  return { success: withoutProof ? "Marked as paid." : "Payment verified. The invoice is marked as paid." };
}

export async function rejectProof(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Tell the client what is wrong with the confirmation." };

  const request = await loadRequest(String(formData.get("request_id")));
  if (!request || request.developer_id !== dev.id) return { error: "Invoice not found." };
  if (request.status !== "proof_submitted") return { error: "There is no payment confirmation to review." };

  const { error } = await createAdminClient()
    .from("payment_requests")
    .update({ status: "requested", rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", request.id);
  if (error) return { error: error.message };

  sendEmail({
    to: request.client.email,
    replyTo: dev.email,
    subject: `Action needed: payment confirmation for ${request.project.name}`,
    heading: "Please upload a new payment confirmation",
    lines: [`Invoice: ${request.milestone.title} (${formatMoney(request.amount, request.currency)})`, reason],
    cta: { label: "Upload new confirmation", path: `/portal/payments/${request.id}` },
  });
  await logActivity({
    project_id: request.project_id,
    developer_id: dev.id,
    payment_request_id: request.id,
    kind: "proof_rejected",
    title: request.milestone.title,
    amount: request.amount,
    currency: request.currency,
    detail: reason,
  });

  revalidatePayment(request);
  return { success: "The client has been asked for a new confirmation." };
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
  await logActivity({
    project_id: request.project_id,
    developer_id: dev.id,
    payment_request_id: request.id,
    kind: "earning_updated",
    client_visible: false,
    title: request.milestone.title,
    amount: parsed.data.net_amount,
    currency: parsed.data.net_currency,
  });

  revalidatePayment(request);
  revalidatePath("/reports");
  return { success: "Earnings record updated." };
}
