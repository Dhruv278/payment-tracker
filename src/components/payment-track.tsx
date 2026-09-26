import { cn } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { MilestoneStatus } from "@/lib/types";

export type TrackMilestone = { id: string; title: string; amount: number; status: MilestoneStatus };

const segmentStyle: Record<MilestoneStatus, string> = {
  verified: "bg-paid",
  proof_submitted: "bg-review [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgba(255,255,255,.28)_5px_10px)]",
  requested: "bg-due",
  pending: "bg-rule",
};

const legendLabel: Record<MilestoneStatus, { developer: string; client: string }> = {
  verified: { developer: "Paid", client: "Paid" },
  proof_submitted: { developer: "Confirmation to verify", client: "Being verified" },
  requested: { developer: "Awaiting payment", client: "Payment due" },
  pending: { developer: "Not invoiced", client: "Upcoming" },
};

/**
 * The project price as a bar: one segment per invoice, sized by amount and
 * coloured by payment status. The part of the price not invoiced yet shows
 * as a dashed remainder.
 */
export function PaymentTrack({
  milestones,
  total,
  currency,
  size = "lg",
  audience = "developer",
}: {
  milestones: TrackMilestone[];
  total: number;
  currency: string;
  size?: "sm" | "lg";
  audience?: "developer" | "client";
}) {
  const allocated = milestones.reduce((a, m) => a + m.amount, 0);
  const scale = Math.max(total, allocated) || 1;
  const unallocated = Math.max(0, total - allocated);
  const money = (n: number) => formatMoney(n, currency);

  const byStatus = (["verified", "proof_submitted", "requested", "pending"] as MilestoneStatus[])
    .map((status) => ({ status, amount: milestones.filter((m) => m.status === status).reduce((a, m) => a + m.amount, 0) }))
    .filter((s) => s.amount > 0);

  const summary = byStatus.map((s) => `${money(s.amount)} ${legendLabel[s.status][audience].toLowerCase()}`).join(", ");

  return (
    <div>
      <div
        role="img"
        aria-label={`${money(total)} project. ${summary || "Nothing invoiced yet"}${unallocated ? `, ${money(unallocated)} not invoiced yet` : ""}.`}
        className={cn("flex w-full gap-[3px] overflow-hidden", size === "lg" ? "h-3.5 rounded-md" : "h-2 rounded-full")}
      >
        {milestones.map((m) => (
          <div
            key={m.id}
            title={`${m.title}: ${money(m.amount)} (${legendLabel[m.status][audience]})`}
            className={cn("track-segment min-w-[4px] first:rounded-l-[inherit] last:rounded-r-[inherit]", segmentStyle[m.status])}
            style={{ flexGrow: m.amount / scale, flexBasis: 0 }}
          />
        ))}
        {unallocated > 0 && (
          <div
            title={`${money(unallocated)} not invoiced yet`}
            className="track-segment rounded-r-[inherit] border border-dashed border-mist/70 first:rounded-l-[inherit]"
            style={{ flexGrow: unallocated / scale, flexBasis: 0 }}
          />
        )}
      </div>

      {size === "lg" && (byStatus.length > 0 || unallocated > 0) && (
        <ul className="figures mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {byStatus.map((s) => (
            <li key={s.status} className="flex items-center gap-2 text-graphite">
              <span aria-hidden className={cn("h-2.5 w-2.5 rounded-sm", segmentStyle[s.status])} />
              <span className="font-medium text-ink">{money(s.amount)}</span> {legendLabel[s.status][audience].toLowerCase()}
            </li>
          ))}
          {unallocated > 0 && (
            <li className="flex items-center gap-2 text-graphite">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-dashed border-mist" />
              <span className="font-medium text-ink">{money(unallocated)}</span> not invoiced yet
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
