import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TrackMilestone } from "@/components/payment-track";
import { milestoneStatus, type Milestone, type PaymentEarning, type PaymentRequest, type Profile, type Project } from "@/lib/types";

// All queries run with the signed-in user's session, so RLS scopes the rows.

export type ProjectWithRelations = Project & {
  client: Pick<Profile, "id" | "full_name" | "email" | "company">;
  milestones: Pick<Milestone, "id" | "title" | "amount" | "position">[];
  payment_requests: Pick<PaymentRequest, "id" | "status" | "amount" | "milestone_id">[];
};

export type ProjectSummary = {
  total: number;
  paid: number;
  awaiting: number; // requested or proof submitted, not yet verified
  remaining: number;
  milestoneCount: number;
  milestoneTotal: number;
};

export function summarizeProject(p: Pick<ProjectWithRelations, "total_amount" | "milestones" | "payment_requests">): ProjectSummary {
  const total = Number(p.total_amount);
  const paid = p.payment_requests.filter((r) => r.status === "verified").reduce((a, r) => a + Number(r.amount), 0);
  const awaiting = p.payment_requests.filter((r) => r.status !== "verified").reduce((a, r) => a + Number(r.amount), 0);
  return {
    total,
    paid,
    awaiting,
    remaining: Math.max(0, total - paid),
    milestoneCount: p.milestones.length,
    milestoneTotal: p.milestones.reduce((a, m) => a + Number(m.amount), 0),
  };
}

/** Milestones in order with their derived payment status, for the payment track. */
export function trackMilestones(p: {
  milestones: Pick<Milestone, "id" | "title" | "amount" | "position">[];
  payment_requests: Pick<PaymentRequest, "status" | "milestone_id">[];
}): TrackMilestone[] {
  return [...p.milestones]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      title: m.title,
      amount: Number(m.amount),
      status: milestoneStatus(p.payment_requests.find((r) => r.milestone_id === m.id)),
    }));
}

const PROJECT_WITH_RELATIONS =
  "*, client:profiles!projects_client_id_fkey(id, full_name, email, company), milestones(id, title, amount, position), payment_requests(id, status, amount, milestone_id)";

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
