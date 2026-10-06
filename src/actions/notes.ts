"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeDeveloper } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState, Project, ProjectNote } from "@/lib/types";

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
  const { data: project } = await admin.from("projects").select("id, developer_id").eq("id", projectId).maybeSingle<Pick<Project, "id" | "developer_id">>();
  if (!project || project.developer_id !== dev.id) return { error: "Project not found." };

  const { error } = await admin.from("project_notes").insert({ ...parsed.data, project_id: project.id, developer_id: dev.id });
  if (error) return { error: error.message };

  revalidateNotes(project.id);
  return { success: "Note added. Your client can see it on their project page." };
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
