"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { authorizeDeveloper } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeDocuments } from "@/lib/storage";
import { formatMoney } from "@/lib/format";
import type { ActionState, PaymentRequest, Profile, Project } from "@/lib/types";

const UNAUTHORIZED: ActionState = { error: "You are not allowed to do that." };

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date.");

const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a project name.").max(160),
    client_id: z.uuid("Choose a client."),
    description: z.string().trim().max(2000).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency."),
    total_amount: z.coerce.number("Enter the project price.").min(0, "Price cannot be negative."),
    status: z.enum(["active", "on_hold", "completed", "cancelled"]).default("active"),
    start_date: optionalDate,
    end_date: optionalDate,
  })
  .refine((p) => !p.start_date || !p.end_date || p.end_date >= p.start_date, "End date must be after start date.");

async function ownedProject(developerId: string, projectId: string) {
  const { data } = await createAdminClient().from("projects").select("*").eq("id", projectId).single<Project>();
  return data && data.developer_id === developerId ? data : null;
}

async function isOwnApprovedClient(developerId: string, clientId: string) {
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", clientId).single<Profile>();
  return Boolean(data && data.role === "client" && data.status === "approved" && data.developer_id === developerId);
}

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await isOwnApprovedClient(dev.id, parsed.data.client_id))) return { error: "Choose one of your approved clients." };

  const { data, error } = await createAdminClient()
    .from("projects")
    .insert({ ...parsed.data, description: parsed.data.description || null, developer_id: dev.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logActivity({
    project_id: data.id,
    developer_id: dev.id,
    kind: "project_created",
    title: parsed.data.name,
    amount: parsed.data.total_amount,
    currency: parsed.data.currency,
  });

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const project = await ownedProject(dev.id, String(formData.get("project_id")));
  if (!project) return { error: "Project not found." };
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await isOwnApprovedClient(dev.id, parsed.data.client_id))) return { error: "Choose one of your approved clients." };

  const admin = createAdminClient();
  const [{ count: invoices }, { count: notes }] = await Promise.all([
    admin.from("payment_requests").select("id", { count: "exact", head: true }).eq("project_id", project.id),
    admin.from("project_notes").select("id", { count: "exact", head: true }).eq("project_id", project.id),
  ]);
  if (invoices && (parsed.data.currency !== project.currency || parsed.data.client_id !== project.client_id)) {
    return { error: "Currency and client can't change once payments have been requested." };
  }
  // Notes are visible to the project's client, so moving the project would show them to someone else.
  if (notes && parsed.data.client_id !== project.client_id) {
    return { error: "The client can't change once the project has notes. Delete the notes first, or create a new project." };
  }

  const { error } = await admin
    .from("projects")
    .update({ ...parsed.data, description: parsed.data.description || null, updated_at: new Date().toISOString() })
    .eq("id", project.id);
  if (error) return { error: error.message };

  const base = { project_id: project.id, developer_id: dev.id, currency: parsed.data.currency };
  if (parsed.data.status !== project.status) {
    await logActivity({ ...base, kind: "project_status", title: project.status, detail: parsed.data.status });
  }
  if (Number(parsed.data.total_amount) !== Number(project.total_amount)) {
    await logActivity({
      ...base,
      kind: "project_price",
      amount: parsed.data.total_amount,
      detail: `was ${formatMoney(project.total_amount, project.currency)}`,
    });
  }

  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}

export async function deleteProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const project = await ownedProject(dev.id, String(formData.get("project_id")));
  if (!project) return { error: "Project not found." };

  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("payment_requests")
    .select("status, invoice_path, proof_path")
    .eq("project_id", project.id)
    .returns<Pick<PaymentRequest, "status" | "invoice_path" | "proof_path">[]>();
  if (requests?.some((r) => r.status === "verified")) {
    return { error: "This project has verified payments. Mark it as cancelled or completed instead of deleting." };
  }

  const { error } = await admin.from("projects").delete().eq("id", project.id);
  if (error) return { error: error.message };
  await removeDocuments((requests ?? []).flatMap((r) => [r.invoice_path, r.proof_path]));

  revalidatePath("/projects");
  redirect("/projects");
}
