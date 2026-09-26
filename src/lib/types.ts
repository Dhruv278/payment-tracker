export type Role = "developer" | "client";
export type AccountStatus = "pending" | "approved" | "rejected";
export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
export type PaymentStatus = "requested" | "proof_submitted" | "verified";
export type MilestoneStatus = "pending" | PaymentStatus;

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  company: string | null;
  role: Role;
  status: AccountStatus;
  developer_id: string | null;
  approved_at: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  developer_id: string;
  client_id: string;
  name: string;
  description: string | null;
  currency: string;
  total_amount: number;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  developer_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  position: number;
  created_at: string;
};

export type PaymentRequest = {
  id: string;
  milestone_id: string;
  project_id: string;
  developer_id: string;
  client_id: string;
  amount: number;
  currency: string;
  wise_link: string | null;
  invoice_path: string | null;
  message: string | null;
  status: PaymentStatus;
  requested_at: string;
  client_paid_on: string | null;
  client_reference: string | null;
  client_note: string | null;
  proof_path: string | null;
  proof_submitted_at: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  updated_at: string;
};

export type PaymentEarning = {
  payment_request_id: string;
  developer_id: string;
  net_amount: number;
  net_currency: string;
  received_on: string;
  note: string | null;
  created_at: string;
};

/** Shape returned by server actions used with useActionState. */
export type ActionState = { error?: string; success?: string } | undefined;

export function milestoneStatus(request: Pick<PaymentRequest, "status"> | null | undefined): MilestoneStatus {
  return request ? request.status : "pending";
}
