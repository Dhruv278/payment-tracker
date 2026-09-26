"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeDeveloper } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import type { ActionState, Profile } from "@/lib/types";

const UNAUTHORIZED: ActionState = { error: "You are not allowed to do that." };

/** Loads a client the developer may manage: their own, or an unassigned sign-up. */
async function loadManageableClient(developerId: string, clientId: string) {
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", clientId).single<Profile>();
  if (!data || data.role !== "client") return null;
  if (data.developer_id && data.developer_id !== developerId) return null;
  return data;
}

export async function approveClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const client = await loadManageableClient(dev.id, String(formData.get("client_id")));
  if (!client) return { error: "Client not found." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ status: "approved", developer_id: dev.id, approved_at: new Date().toISOString() })
    .eq("id", client.id);
  if (error) return { error: error.message };

  sendEmail({
    to: client.email,
    replyTo: dev.email,
    subject: "Your account has been approved",
    heading: `Welcome, ${client.full_name || "there"}!`,
    lines: [`${dev.full_name || "Your developer"} approved your account.`, "You can now sign in to view your projects and payment requests."],
    cta: { label: "Open client portal", path: "/portal" },
  });

  revalidatePath("/clients");
  return { success: `${client.full_name || client.email} approved.` };
}

export async function rejectClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const client = await loadManageableClient(dev.id, String(formData.get("client_id")));
  if (!client) return { error: "Client not found." };

  const { count } = await createAdminClient()
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id);
  if (count) return { error: "This client has projects. Remove or reassign them first." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ status: "rejected", developer_id: dev.id, approved_at: null })
    .eq("id", client.id);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  return { success: `${client.full_name || client.email} rejected.` };
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email.").transform((e) => e.toLowerCase()),
  full_name: z.string().trim().min(2, "Enter the client's name."),
  company: z.string().trim().max(120).optional(),
});

/** Creates a pre-approved client account and emails them a link to set a password. */
export async function inviteClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, full_name, company } = parsed.data;

  // generateLink creates the user without sending Supabase's own email. We send
  // a branded invite whose link carries a token_hash our /auth/confirm route can
  // verify server-side (Supabase's default invite link puts the session in the
  // URL fragment, which never reaches the server).
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name, company: company ?? "" } },
  });
  if (error) {
    return { error: /already|registered|exists/i.test(error.message) ? "A user with this email already exists." : error.message };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ status: "approved", developer_id: dev.id, approved_at: new Date().toISOString(), full_name, company: company || null })
    .eq("id", data.user.id);
  if (updateError) return { error: updateError.message };

  sendEmail({
    to: email,
    replyTo: dev.email,
    subject: `${dev.full_name || "Your developer"} invited you to the client portal`,
    heading: `Hi ${full_name.split(" ")[0]}, your client portal is ready`,
    lines: [
      `${dev.full_name || "Your developer"} set up an account for you to follow your projects, see payment requests and send payment receipts.`,
      "Choose a password to get started. For security the link works once. If it has expired, ask for a new one.",
    ],
    cta: { label: "Choose your password", path: `/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite` },
  });

  revalidatePath("/clients");
  return { success: `Invitation sent to ${email}.` };
}

/** Emails an approved client a one-time link to (re)set their password — for expired invites or forgotten passwords. */
export async function sendAccessLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const client = await loadManageableClient(dev.id, String(formData.get("client_id")));
  if (!client || client.status !== "approved") return { error: "Client not found." };

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email: client.email });
  if (error) return { error: error.message };

  sendEmail({
    to: client.email,
    replyTo: dev.email,
    subject: "Your sign-in link for the client portal",
    heading: `Hi ${client.full_name.split(" ")[0] || "there"}, here's your sign-in link`,
    lines: ["Use the button below to choose a password and sign in to your client portal. The link works once."],
    cta: { label: "Choose your password", path: `/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery` },
  });

  return { success: `Sign-in link sent to ${client.email}.` };
}

const updateSchema = z.object({
  client_id: z.uuid(),
  full_name: z.string().trim().min(2, "Enter the client's name."),
  company: z.string().trim().max(120).optional(),
});

export async function updateClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = await loadManageableClient(dev.id, parsed.data.client_id);
  if (!client) return { error: "Client not found." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ full_name: parsed.data.full_name, company: parsed.data.company || null })
    .eq("id", client.id);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${client.id}`);
  return { success: "Client updated." };
}
