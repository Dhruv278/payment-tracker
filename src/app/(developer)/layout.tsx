import { DeveloperShell } from "@/components/app-shell";
import { requireDeveloper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireDeveloper();
  const supabase = await createClient();

  const [{ count: pendingClients }, { count: proofsToVerify }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client").eq("status", "pending"),
    supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "proof_submitted"),
  ]);

  return (
    <DeveloperShell
      profile={profile}
      nav={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/clients", label: "Clients", badge: pendingClients ?? 0 },
        { href: "/projects", label: "Projects" },
        { href: "/payments", label: "Invoices", badge: proofsToVerify ?? 0 },
        { href: "/reports", label: "Reports" },
      ]}
    >
      {children}
    </DeveloperShell>
  );
}
