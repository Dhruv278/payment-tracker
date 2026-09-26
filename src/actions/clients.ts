"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeDeveloper } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
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

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, company: company ?? "" },
    redirectTo: `${env.siteUrl()}/auth/confirm?next=/update-password`,
  });
  if (error) {
    return { error: error.message.includes("already") ? "A user with this email already exists." : error.message };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ status: "approved", developer_id: dev.id, approved_at: new Date().toISOString(), full_name, company: company || null })
    .eq("id", data.user.id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/clients");
  return { success: `Invitation sent to ${email}.` };
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
