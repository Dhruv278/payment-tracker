import { notFound } from "next/navigation";
import { deleteProject, updateProject } from "@/actions/projects";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ProjectForm } from "@/components/project-form";
import { Card, PageHeader } from "@/components/ui";
import { listClients } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle<Project>();
  if (!project) notFound();
  const clients = (await listClients()).filter((c) => c.status === "approved");

  return (
    <>
      <PageHeader back={{ href: `/projects/${project.id}`, label: project.name }} title="Edit project" />
      <Card className="max-w-2xl">
        <ProjectForm action={updateProject} clients={clients} project={project} />
      </Card>
      <Card title="Delete project" className="mt-6 max-w-2xl">
        <p className="mb-4 text-sm text-graphite">
          Deleting removes the project, its milestones and any unverified payment requests. Projects with verified payments can&apos;t be deleted. Mark them as completed or cancelled instead.
        </p>
        <ActionForm action={deleteProject}>
          <input type="hidden" name="project_id" value={project.id} />
          <SubmitButton variant="danger" confirm={`Delete "${project.name}" permanently?`}>Delete project</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
