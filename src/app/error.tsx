"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Something went wrong</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
          The page couldn&apos;t be loaded. Try again, and if it keeps happening, reply to any payment email to let us know.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <button onClick={reset} className={buttonStyles.primary}>Try again</button>
          <Link href="/" className={buttonStyles.secondary}>Go home</Link>
        </div>
      </div>
    </main>
  );
}
