import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { CURRENCIES, displayName } from "@/lib/format";
import type { ActionState, Profile, Project } from "@/lib/types";

export function ProjectForm({
  action,
  clients,
  project,
  defaultClientId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  clients: Profile[];
  project?: Project;
  defaultClientId?: string;
}) {
  return (
    <ActionForm action={action}>
      {project && <input type="hidden" name="project_id" value={project.id} />}
      <Field label="Project name" name="name">
        <Input id="name" name="name" defaultValue={project?.name} placeholder="License Management System" required />
      </Field>
      <Field label="Client" name="client_id">
        <Select id="client_id" name="client_id" defaultValue={project?.client_id ?? defaultClientId ?? ""} required>
          <option value="" disabled>Choose a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {displayName(c)}{c.company ? ` — ${c.company}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Project price" name="total_amount" hint="What the client pays in total.">
            <Input id="total_amount" name="total_amount" type="number" min="0" step="0.01" defaultValue={project?.total_amount} placeholder="1600" required />
          </Field>
        </div>
        <Field label="Currency" name="currency">
          <Select id="currency" name="currency" defaultValue={project?.currency ?? "USD"}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Status" name="status">
          <Select id="status" name="status" defaultValue={project?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
        <Field label="Start date" name="start_date">
          <Input id="start_date" name="start_date" type="date" defaultValue={project?.start_date ?? ""} />
        </Field>
        <Field label="End date" name="end_date">
          <Input id="end_date" name="end_date" type="date" defaultValue={project?.end_date ?? ""} />
        </Field>
      </div>
      <Field label="Description (optional)" name="description">
        <Textarea id="description" name="description" defaultValue={project?.description ?? ""} />
      </Field>
      <SubmitButton>{project ? "Save changes" : "Create project"}</SubmitButton>
    </ActionForm>
  );
}
