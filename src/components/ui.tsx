import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { AccountStatus, MilestoneStatus, ProjectStatus } from "@/lib/types";
import { formatMoney, type CurrencyTotal } from "@/lib/format";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-ink text-white hover:bg-ink-soft`,
  secondary: `${buttonBase} border border-rule bg-paper text-ink hover:border-graphite`,
  danger: `${buttonBase} bg-danger text-white hover:bg-[#912018]`,
  paid: `${buttonBase} bg-paid text-white hover:bg-[#186440]`,
  ghost: "inline-flex items-center justify-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-graphite transition-colors hover:bg-rule-soft hover:text-ink",
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cn(buttonStyles[variant], className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
          <span aria-hidden>‹</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
          {description && <div className="mt-1.5 text-[0.9375rem] text-graphite">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  tone,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "due" | "review" | "paid";
}) {
  const toneBar = { due: "before:bg-due", review: "before:bg-review", paid: "before:bg-paid" };
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-rule bg-paper",
        tone && `before:absolute before:inset-y-0 before:left-0 before:w-1 ${toneBar[tone]}`,
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

/** Per-currency totals, one currency per line (currencies are never added together). */
export function MoneyLines({ totals, emptyCurrency = "USD" }: { totals: CurrencyTotal[]; emptyCurrency?: string }) {
  if (totals.length === 0) return <span>{formatMoney(0, emptyCurrency)}</span>;
  return (
    <span className="flex flex-col">
      {totals.map((t) => (
        <span key={t.currency}>{formatMoney(t.amount, t.currency)}</span>
      ))}
    </span>
  );
}

/** A figure with a label beneath — used in summary rows. */
export function Figure({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "paid" | "due" }) {
  return (
    <div className="min-w-0">
      <div className={cn("figures text-xl font-semibold leading-snug tracking-[-0.01em]", tone === "paid" ? "text-paid" : tone === "due" ? "text-due" : "text-ink")}>
        {value}
      </div>
      <p className="mt-0.5 text-sm text-graphite">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-mist">{hint}</p>}
    </div>
  );
}

export function FigureRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-rule bg-paper px-6 py-5 lg:grid-cols-4 lg:divide-x lg:divide-rule-soft [&>*]:lg:pl-6 [&>*:first-child]:lg:pl-0", className)}>
      {children}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </label>
  );
}

const fieldStyles =
  "block w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-mist transition-colors hover:border-mist focus:border-ink focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-ink/10 file:mr-3 file:rounded-md file:border-0 file:bg-rule-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-ink";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(fieldStyles, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cn(fieldStyles, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cn(fieldStyles, "pr-8", props.className)} />;
}

export function Field({ label, name, hint, children }: { label: string; name?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-graphite">{hint}</p>}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-rule-soft text-graphite",
  due: "bg-due-tint text-[#8a5a12]",
  review: "bg-review-tint text-review",
  paid: "bg-paid-tint text-paid",
  info: "bg-[#e7eefb] text-[#27468a]",
  danger: "bg-danger-tint text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone])}>
      {children}
    </span>
  );
}

export const milestoneMeta: Record<MilestoneStatus, { tone: keyof typeof badgeTones; label: string; clientLabel: string }> = {
  pending: { tone: "neutral", label: "Not invoiced", clientLabel: "Upcoming" },
  requested: { tone: "due", label: "Sent", clientLabel: "Payment due" },
  proof_submitted: { tone: "review", label: "Confirmation received", clientLabel: "Being verified" },
  verified: { tone: "paid", label: "Paid", clientLabel: "Paid" },
};

export function MilestoneBadge({ status, audience = "developer" }: { status: MilestoneStatus; audience?: "developer" | "client" }) {
  const meta = milestoneMeta[status];
  return <Badge tone={meta.tone}>{audience === "client" ? meta.clientLabel : meta.label}</Badge>;
}

export const projectBadge: Record<ProjectStatus, [keyof typeof badgeTones, string]> = {
  active: ["info", "Active"],
  on_hold: ["due", "On hold"],
  completed: ["paid", "Completed"],
  cancelled: ["neutral", "Cancelled"],
};

export function ProjectBadge({ status }: { status: ProjectStatus }) {
  const [tone, label] = projectBadge[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const accountBadge: Record<AccountStatus, [keyof typeof badgeTones, string]> = {
  pending: ["due", "Waiting for approval"],
  approved: ["paid", "Approved"],
  rejected: ["danger", "Rejected"],
};

export function AccountBadge({ status }: { status: AccountStatus }) {
  const [tone, label] = accountBadge[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-rule bg-paper/60 px-6 py-12 text-center">
      <p className="text-base font-medium text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-graphite">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Table({ head, children, align }: { head: ReactNode[]; children: ReactNode; align?: ("left" | "right")[] }) {
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="figures min-w-full text-sm">
        <thead>
          <tr className="border-b border-rule">
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "whitespace-nowrap px-6 pb-2.5 text-xs font-medium text-graphite first:pl-6 [&:not(:first-child)]:pl-3",
                  align?.[i] === "right" ? "text-right" : "text-left",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule-soft">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, align }: { children: ReactNode; className?: string; align?: "right" }) {
  return (
    <td className={cn("whitespace-nowrap px-6 py-3 text-ink first:pl-6 [&:not(:first-child)]:pl-3", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}

export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-sm text-graphite">{k}</dt>
          <dd className="figures mt-0.5 break-words text-[0.9375rem] font-medium text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "due", children }: { tone?: "due" | "review" | "paid" | "danger"; children: ReactNode }) {
  const tones = {
    due: "border-due/30 bg-due-tint text-[#6f480e]",
    review: "border-review/30 bg-review-tint text-[#4a3589]",
    paid: "border-paid/30 bg-paid-tint text-[#155c39]",
    danger: "border-danger/30 bg-danger-tint text-danger",
  };
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}
