import Link from "next/link";
import type { ReactNode } from "react";
import { LocalDateTime } from "@/components/local-time";
import { Badge, cn, projectBadge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { Activity, ProjectStatus } from "@/lib/types";

export type ActivityItem = Activity & { project?: { name: string } | null };

type Audience = "developer" | "client";
type Tone = "neutral" | "due" | "review" | "paid" | "danger";

const dot: Record<Tone, string> = {
  neutral: "bg-mist",
  due: "bg-due",
  review: "bg-review",
  paid: "bg-paid",
  danger: "bg-danger",
};

function describe(a: ActivityItem, audience: Audience, clientName: string): { text: ReactNode; tone: Tone } {
  const money = a.amount !== null && a.currency ? formatMoney(a.amount, a.currency) : "";
  const invoice = <span className="font-medium text-ink">{a.title ?? "Invoice"}</span>;
  const status = (s: string | null) => (s && s in projectBadge ? projectBadge[s as ProjectStatus][1] : s);
  const mine = audience === "developer";

  switch (a.kind) {
    case "project_created":
      return { text: <>Project started{money && <>, price {money}</>}</>, tone: "neutral" };
    case "project_status":
      return { text: <>Status changed from {status(a.title)} to <span className="font-medium text-ink">{status(a.detail)}</span></>, tone: "neutral" };
    case "project_price":
      return { text: <>Project price changed to <span className="font-medium text-ink">{money}</span>{a.detail && <> ({a.detail})</>}</>, tone: "neutral" };
    case "invoice_sent":
      return { text: <>Invoice sent: {invoice}, {money}</>, tone: "due" };
    case "invoice_reminder":
      return { text: <>Payment reminder sent for {invoice}</>, tone: "due" };
    case "invoice_cancelled":
      return { text: <>Invoice cancelled: {invoice}, {money}</>, tone: "neutral" };
    case "proof_submitted":
      return {
        text: <>{mine ? clientName : "You"} uploaded a payment confirmation for {invoice}{a.detail && <> (paid {formatDate(a.detail)})</>}</>,
        tone: "review",
      };
    case "proof_rejected":
      return {
        text: <>{mine ? "You asked for" : "Asked for"} a new payment confirmation for {invoice}{a.detail && <>: “{a.detail}”</>}</>,
        tone: "danger",
      };
    case "payment_verified":
      return { text: <>Payment confirmed: {invoice}, {money}</>, tone: "paid" };
    case "earning_recorded":
      return { text: <>You received <span className="font-medium text-ink">{money}</span> for {invoice}</>, tone: "paid" };
    case "earning_updated":
      return { text: <>Received amount for {invoice} corrected to <span className="font-medium text-ink">{money}</span></>, tone: "paid" };
    case "note_added":
      return { text: <>Note added{a.title && <>: <span className="font-medium text-ink">{a.title}</span></>}</>, tone: "neutral" };
  }
}

function href(a: ActivityItem, audience: Audience): string | null {
  if (a.kind === "note_added") return audience === "developer" ? `/projects/${a.project_id}#notes` : `/portal/projects/${a.project_id}#notes`;
  if (a.payment_request_id) return audience === "developer" ? `/payments/${a.payment_request_id}` : `/portal/payments/${a.payment_request_id}`;
  return null;
}

/**
 * The money trail: events newest first. Rows the client can't see
 * (client_visible = false) are filtered out by RLS before they get here and
 * marked "Private" for the developer.
 */
export function ActivityFeed({
  items,
  audience,
  clientName = "The client",
  showProject = false,
  links = true,
  empty = "Nothing has happened yet.",
}: {
  items: ActivityItem[];
  audience: Audience;
  clientName?: string;
  showProject?: boolean;
  /** Off on an invoice's own page, where every event would link back to it. */
  links?: boolean;
  empty?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-graphite">{empty}</p>;
  return (
    <ol className="space-y-0">
      {items.map((a) => {
        const { text, tone } = describe(a, audience, clientName);
        const link = links ? href(a, audience) : null;
        return (
          <li
            key={a.id}
            className="relative pb-4 pl-6 last:pb-0 before:absolute before:left-[4px] before:top-3 before:bottom-0 before:w-px before:bg-rule-soft last:before:hidden"
          >
            <span aria-hidden className={cn("absolute left-0 top-1.5 size-[9px] rounded-full", dot[tone])} />
            <p className="text-sm leading-snug text-graphite">{link ? <Link href={link} className="hover:underline">{text}</Link> : text}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mist">
              <LocalDateTime value={a.created_at} />
              {showProject && a.project && <span>· {a.project.name}</span>}
              {!a.client_visible && audience === "developer" && <Badge>Private</Badge>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
