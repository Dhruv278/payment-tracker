import { ClientShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireClient();
  return <ClientShell profile={profile}>{children}</ClientShell>;
}
