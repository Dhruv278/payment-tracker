export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">₹</span>
          <p className="mt-3 text-sm font-medium text-slate-500">Payment Tracker</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
