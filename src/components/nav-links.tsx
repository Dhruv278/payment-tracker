"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string; badge?: number };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[0.9375rem] transition-colors",
              active ? "bg-desk font-semibold text-ink" : "text-graphite hover:bg-desk/60 hover:text-ink",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-ink md:block" />}
            {item.label}
            {item.badge ? (
              <span className="figures min-w-5 rounded-full bg-due-tint px-1.5 text-center text-xs font-semibold text-[#8a5a12]">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
