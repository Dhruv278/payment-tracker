import Link from "next/link";
import { cn } from "@/components/ui";

export function FilterTabs({ filters, current, href }: { filters: { value: string; label: string }[]; current: string; href: (v: string) => string }) {
  return (
    <nav aria-label="Filter" className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-rule bg-paper p-1">
      {filters.map((f) => (
        <Link
          key={f.value}
          href={href(f.value)}
          aria-current={current === f.value ? "page" : undefined}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", current === f.value ? "bg-ink text-white" : "text-graphite hover:text-ink")}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}
