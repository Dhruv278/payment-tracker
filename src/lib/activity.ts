import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Activity } from "@/lib/types";

type NewActivity = Pick<Activity, "project_id" | "developer_id" | "kind"> &
  Partial<Pick<Activity, "payment_request_id" | "note_id" | "client_visible" | "title" | "amount" | "currency" | "detail">>;

/**
 * Records an event in the project's history. Best effort: a failure is logged
 * and never breaks the action that triggered it.
 */
export async function logActivity(event: NewActivity) {
  const { error } = await createAdminClient().from("activity").insert(event);
  if (error) console.error(`[activity] Failed to log ${event.kind}`, error.message);
}
