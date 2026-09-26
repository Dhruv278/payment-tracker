import { AppShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireClient();
  const supabase = await createClient();
  const { count } = await supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "requested");

  return (
    <AppShell profile={profile} nav={[{ href: "/portal", label: "Overview", badge: count ?? 0 }]}>
      {children}
    </AppShell>
  );
}
