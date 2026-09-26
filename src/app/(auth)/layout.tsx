import { Monogram } from "@/components/app-shell";
import { brand } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <Monogram className="h-10 w-10 bg-white text-sm !text-ink" />
          <div>
            <p className="font-semibold leading-tight">{brand.name}</p>
            <p className="text-sm text-white/60">{brand.tagline}</p>
          </div>
        </div>

        <div className="mt-auto max-w-md">
          <p className="text-[2rem] font-semibold leading-[1.2] tracking-[-0.01em]">
            Every milestone, invoice and payment in one place.
          </p>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/70">
            See what&apos;s been delivered, what&apos;s due and what&apos;s been paid, and send your payment receipts without digging through email.
          </p>
          <TrackIllustration />
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Monogram />
            <div>
              <p className="font-semibold leading-tight">{brand.name}</p>
              <p className="text-sm text-graphite">{brand.tagline}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Decorative echo of the in-app payment track. */
function TrackIllustration() {
  const segments = [
    { w: 25, c: "bg-[#3fae78]" },
    { w: 25, c: "bg-[#3fae78]" },
    { w: 30, c: "bg-[#e0a43c]" },
    { w: 20, c: "bg-white/20" },
  ];
  return (
    <div aria-hidden className="mt-10 rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-white/70">Project progress</span>
        <span className="figures font-semibold">$800 of $1,600 paid</span>
      </div>
      <div className="mt-3 flex h-3 gap-[3px] overflow-hidden rounded-md">
        {segments.map((s, i) => (
          <div key={i} className={s.c} style={{ flexGrow: s.w, flexBasis: 0 }} />
        ))}
      </div>
    </div>
  );
}
