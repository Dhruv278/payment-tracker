import type { ReactNode } from "react";
import { signOut } from "@/actions/auth";
import { NavLinks, type NavItem } from "@/components/nav-links";
import type { Profile } from "@/lib/types";

export function AppShell({ profile, nav, children }: { profile: Profile; nav: NavItem[]; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">₹</span>
          <span className="text-sm font-semibold">Payment Tracker</span>
        </div>
        <NavLinks items={nav} />
        <div className="hidden border-t border-slate-100 px-5 py-4 md:mt-auto md:block">
          <p className="truncate text-sm font-medium">{profile.full_name || profile.email}</p>
          <p className="truncate text-xs text-slate-500">{profile.email}</p>
          <form action={signOut} className="mt-3">
            <button className="text-xs font-medium text-slate-500 hover:text-slate-900">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
