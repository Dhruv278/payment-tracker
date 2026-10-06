"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { authorizeDeveloper } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState, Profile, Project, ProjectNote } from "@/lib/types";

const UNAUTHORIZED: ActionState = { error: "You are not allowed to do that." };

const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .max(160, "Keep the title under 160 characters.")
    .optional()
    .transform((v) => v || null),
  body: z.string().trim().min(1, "Write the note first.").max(20000, "Notes can be up to 20,000 characters."),
});

function revalidateNotes(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
}

async function ownedNote(developerId: string, noteId: string) {
  if (!z.uuid().safeParse(noteId).success) return null;
  const { data } = await createAdminClient().from("project_notes").select("*").eq("id", noteId).maybeSingle<ProjectNote>();
  return data && data.developer_id === developerId ? data : null;
}

export async function createNote(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const projectId = String(formData.get("project_id"));
  if (!z.uuid().safeParse(projectId).success) return { error: "Project not found." };
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, name, developer_id, client:profiles!projects_client_id_fkey(email, full_name)")
    .eq("id", projectId)
    .maybeSingle<Pick<Project, "id" | "name" | "developer_id"> & { client: Pick<Profile, "email" | "full_name"> }>();
  if (!project || project.developer_id !== dev.id) return { error: "Project not found." };

  const { data: note, error } = await admin
    .from("project_notes")
    .insert({ ...parsed.data, project_id: project.id, developer_id: dev.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({ project_id: project.id, developer_id: dev.id, note_id: note.id, kind: "note_added", title: parsed.data.title });

  const emailed = formData.get("email_client") === "on";
  if (emailed) {
    sendEmail({
      to: project.client.email,
      replyTo: dev.email,
      subject: `${parsed.data.title ?? "Project update"}: ${project.name}`,
      heading: parsed.data.title ?? `Update on ${project.name}`,
      lines: [...parsed.data.body.split(/\n+/).filter((line) => line.trim()), `Project: ${project.name}`],
      cta: { label: "Open project", path: `/portal/projects/${project.id}#notes` },
    });
  }

  revalidateNotes(project.id);
  const clientName = project.client.full_name || project.client.email;
  return { success: emailed ? `Note added and emailed to ${clientName}.` : `Note added. ${clientName} can see it on their project page.` };
}

export async function updateNote(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const note = await ownedNote(dev.id, String(formData.get("note_id")));
  if (!note) return { error: "Note not found." };
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await createAdminClient()
    .from("project_notes")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", note.id);
  if (error) return { error: error.message };

  revalidateNotes(note.project_id);
  return { success: "Note updated." };
}

export async function deleteNote(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await authorizeDeveloper();
  if (!dev) return UNAUTHORIZED;
  const note = await ownedNote(dev.id, String(formData.get("note_id")));
  if (!note) return { error: "Note not found." };

  const { error } = await createAdminClient().from("project_notes").delete().eq("id", note.id);
  if (error) return { error: error.message };

  revalidateNotes(note.project_id);
  return { success: "Note deleted." };
}
