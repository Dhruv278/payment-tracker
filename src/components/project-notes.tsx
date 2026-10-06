import { createNote, deleteNote, updateNote } from "@/actions/notes";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { ProjectNote } from "@/lib/types";

function NoteFields({ note, idPrefix }: { note?: ProjectNote; idPrefix: string }) {
  return (
    <>
      <Field label="Title" name={`${idPrefix}-title`} hint="Optional">
        <Input id={`${idPrefix}-title`} name="title" defaultValue={note?.title ?? ""} maxLength={160} placeholder="Weekly call" />
      </Field>
      <Field label="Note" name={`${idPrefix}-body`}>
        <Textarea
          id={`${idPrefix}-body`}
          name="body"
          rows={note ? 8 : 6}
          defaultValue={note?.body}
          maxLength={20000}
          placeholder="What we discussed, what was decided, next steps…"
          required
        />
      </Field>
    </>
  );
}

/** Composer for the developer's project page. */
export function NewNoteCard({ projectId, clientName }: { projectId: string; clientName: string }) {
  return (
    <Card title="Add a note" className="mb-4">
      <p className="-mt-1 mb-4 text-sm text-graphite">Meeting notes, progress updates, decisions. {clientName} can read every note on this project.</p>
      <ActionForm action={createNote} resetOnSuccess>
        <input type="hidden" name="project_id" value={projectId} />
        <NoteFields idPrefix="new-note" />
        <SubmitButton pendingLabel="Adding note…">Add note</SubmitButton>
      </ActionForm>
    </Card>
  );
}

/** Notes, newest first. `editable` adds edit/delete controls for the developer. */
export function NoteList({ notes, editable = false }: { notes: ProjectNote[]; editable?: boolean }) {
  return (
    <ol className="overflow-hidden rounded-xl border border-rule bg-paper">
      {notes.map((note) => (
        <li key={note.id} className="border-b border-rule-soft px-6 py-5 last:border-b-0">
          <p className="text-sm text-graphite">
            <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
            {note.updated_at.slice(0, 16) !== note.created_at.slice(0, 16) && <span className="text-mist"> · edited</span>}
          </p>
          {note.title && <h3 className="mt-1 break-words font-semibold text-ink">{note.title}</h3>}
          <p className="mt-2 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-ink-soft">{note.body}</p>
          {editable && (
            // Keyed on updated_at so a saved edit collapses the panel and the fields pick up the new text.
            <details key={note.updated_at} className="mt-3">
              <summary className="cursor-pointer list-none text-sm text-graphite hover:text-ink">Edit</summary>
              <div className="mt-4 max-w-2xl">
                <ActionForm action={updateNote}>
                  <input type="hidden" name="note_id" value={note.id} />
                  <NoteFields note={note} idPrefix={`note-${note.id}`} />
                  <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
                </ActionForm>
                <ActionForm action={deleteNote} className="mt-4 border-t border-rule-soft pt-3">
                  <input type="hidden" name="note_id" value={note.id} />
                  <SubmitButton
                    variant="ghost"
                    className="!px-0 !text-danger hover:!bg-transparent"
                    confirm="Delete this note? Your client will no longer see it."
                    pendingLabel="Deleting…"
                  >
                    Delete note
                  </SubmitButton>
                </ActionForm>
              </div>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
