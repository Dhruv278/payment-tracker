import Link from "next/link";
import { buttonStyles } from "@/components/ui";

/** Shared "nothing here" panel for 404s — also shown when a record belongs to someone else. */
export function NotFoundPanel({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="figures text-sm font-medium text-graphite">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em]">This page isn&apos;t available</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
        The link may be out of date, or the item was removed. If you followed a link from an email, check you&apos;re signed in with the right account.
      </p>
      <Link href={homeHref} className={`${buttonStyles.primary} mt-8`}>
        {homeLabel}
      </Link>
    </div>
  );
}
