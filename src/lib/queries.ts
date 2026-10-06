import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityItem } from "@/components/activity-feed";
import type { TrackMilestone } from "@/components/payment-track";
import type { Milestone, PaymentEarning, PaymentRequest, Profile, Project, ProjectNote } from "@/lib/types";

// All queries run with the signed-in user's session, so RLS scopes the rows.

// Each invoice is stored as a milestone (its title) plus a payment request
// (amount, Wise link, status). Milestones without a request are ignored.

type InvoiceParts = {
  milestones: Pick<Milestone, "id" | "title">[];
  payment_requests: Pick<PaymentRequest, "id" | "status" | "amount" | "milestone_id" | "requested_at">[];
};

export type ProjectWithRelations = Project & { client: Pick<Profile, "id" | "full_name" | "email" | "company"> } & InvoiceParts;

export type ProjectSummary = {
  total: number;
  invoiced: number;
  paid: number;
  awaiting: number; // invoiced, not yet verified
  notInvoiced: number;
  remaining: number; // price minus paid
};

export function summarizeProject(p: Pick<Project, "total_amount"> & Pick<InvoiceParts, "payment_requests">): ProjectSummary {
  const total = Number(p.total_amount);
  const sum = (rows: typeof p.payment_requests) => rows.reduce((a, r) => a + Number(r.amount), 0);
  const invoiced = sum(p.payment_requests);
  const paid = sum(p.payment_requests.filter((r) => r.status === "verified"));
  return {
    total,
    invoiced,
    paid,
    awaiting: invoiced - paid,
    notInvoiced: Math.max(0, total - invoiced),
    remaining: Math.max(0, total - paid),
  };
}

/** Invoices in the order they were sent, for the payment track. */
export function trackMilestones(p: InvoiceParts): TrackMilestone[] {
  const titles = new Map(p.milestones.map((m) => [m.id, m.title]));
  return [...p.payment_requests]
    .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
    .map((r) => ({ id: r.id, title: titles.get(r.milestone_id) ?? "Invoice", amount: Number(r.amount), status: r.status }));
}

const PROJECT_WITH_RELATIONS =
  "*, client:profiles!projects_client_id_fkey(id, full_name, email, company), milestones(id, title), payment_requests(id, status, amount, milestone_id, requested_at)";

export async function listProjects(filter: { clientId?: string; status?: string } = {}) {
  const supabase = await createClient();
  let query = supabase.from("projects").select(PROJECT_WITH_RELATIONS).order("created_at", { ascending: false });
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.status) query = query.eq("status", filter.status);
  const { data } = await query.returns<ProjectWithRelations[]>();
  return data ?? [];
}

export type PaymentRow = PaymentRequest & {
  milestone: Pick<Milestone, "id" | "title">;
  project: Pick<Project, "id" | "name">;
  client: Pick<Profile, "id" | "full_name" | "email" | "company">;
};

const PAYMENT_WITH_RELATIONS =
  "*, milestone:milestones(id, title), project:projects(id, name), client:profiles!payment_requests_client_id_fkey(id, full_name, email, company)";

export async function listPayments(filter: { status?: string; clientId?: string; projectId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("payment_requests").select(PAYMENT_WITH_RELATIONS).order("updated_at", { ascending: false });
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.projectId) query = query.eq("project_id", filter.projectId);
  if (filter.limit) query = query.limit(filter.limit);
  const { data } = await query.returns<PaymentRow[]>();
  return data ?? [];
}

export async function getPayment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_requests").select(PAYMENT_WITH_RELATIONS).eq("id", id).maybeSingle<PaymentRow>();
  return data;
}

export type VerifiedPaymentRow = PaymentRow & { earning: PaymentEarning };

/**
 * Verified payments joined with the developer's private earnings (developer only).
 * Date filters apply to the date the money was received.
 */
export async function listVerifiedPayments(filter: { from?: string; to?: string; clientId?: string; projectId?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("payment_requests")
    .select(`${PAYMENT_WITH_RELATIONS}, earning:payment_earnings!inner(*)`)
    .eq("status", "verified")
    .order("verified_at", { ascending: false });
  if (filter.from) query = query.gte("earning.received_on", filter.from);
  if (filter.to) query = query.lte("earning.received_on", filter.to);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.projectId) query = query.eq("project_id", filter.projectId);
  const { data } = await query.returns<VerifiedPaymentRow[]>();
  return data ?? [];
}

/** Notes on a project, newest first. RLS limits them to the project's developer and client. */
export async function listProjectNotes(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .returns<ProjectNote[]>();
  return data ?? [];
}

/**
 * History events, newest first. RLS returns everything to the developer and
 * only client-visible events on their own projects to a client.
 */
export async function listActivity(filter: { projectId?: string; paymentRequestId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("activity")
    .select("*, project:projects(name)")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.projectId) query = query.eq("project_id", filter.projectId);
  if (filter.paymentRequestId) query = query.eq("payment_request_id", filter.paymentRequestId);
  const { data } = await query.returns<ActivityItem[]>();
  return data ?? [];
}

export async function listClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();
  return data ?? [];
}
