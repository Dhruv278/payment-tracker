import { createProject } from "@/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { listClients } from "@/lib/queries";

export const metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { client } = await searchParams;
  const clients = (await listClients()).filter((c) => c.status === "approved");

  return (
    <>
      <PageHeader title="New project" description="Set the client and total price. You'll add milestones next." />
      {clients.length === 0 ? (
        <EmptyState title="You need an approved client first" action={<ButtonLink href="/clients">Go to clients</ButtonLink>} />
      ) : (
        <Card className="max-w-2xl">
          <ProjectForm action={createProject} clients={clients} defaultClientId={typeof client === "string" ? client : undefined} />
        </Card>
      )}
    </>
  );
}
