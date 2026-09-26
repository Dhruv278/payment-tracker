import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/actions/auth";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { brand, initials } from "@/lib/brand";
import { displayName } from "@/lib/format";
import type { Profile } from "@/lib/types";

export function Monogram({ className = "h-9 w-9 text-sm" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-ink font-semibold tracking-wide text-white ${className}`}>
      {initials(brand.name)}
    </span>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button className={className ?? "text-sm font-medium text-graphite hover:text-ink"}>Sign out</button>
    </form>
  );
}

/** Developer workspace: sidebar navigation. */
export function DeveloperShell({ profile, nav, children }: { profile: Profile; nav: NavItem[]; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-rule bg-paper md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <Monogram />
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-semibold leading-tight">{brand.name}</span>
              <span className="block truncate text-xs text-graphite">Billing workspace</span>
            </span>
          </Link>
          <div className="md:hidden">
            <SignOutButton />
          </div>
        </div>
        <NavLinks items={nav} />
        <div className="hidden border-t border-rule-soft px-5 py-4 md:mt-auto md:block">
          <p className="truncate text-sm font-medium">{displayName(profile)}</p>
          <p className="truncate text-xs text-graphite">{profile.email}</p>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="w-full min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Client portal: a single top bar, branded as the developer's business. */
export function ClientShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/portal" className="flex min-w-0 items-center gap-3">
            <Monogram />
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-semibold leading-tight">{brand.name}</span>
              <span className="block truncate text-xs text-graphite">Client portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium">{displayName(profile)}</span>
              {profile.company && <span className="block text-xs text-graphite">{profile.company}</span>}
            </span>
            <SignOutButton className={"rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:border-graphite"} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-mist sm:px-8">
        {brand.name}, {brand.tagline}. Questions about a payment? Reply to any payment email.
      </footer>
    </div>
  );
}
