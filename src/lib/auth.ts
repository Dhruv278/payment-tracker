import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/types";

/**
 * Returns the signed-in user's profile, or null. Emails listed in
 * DEVELOPER_EMAILS are promoted to approved developers on first access.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single<Profile>();
  if (!profile) return null;

  const shouldBeDeveloper = env.developerEmails().includes(profile.email.toLowerCase());
  if (shouldBeDeveloper && (profile.role !== "developer" || profile.status !== "approved")) {
    const { data: promoted } = await createAdminClient()
      .from("profiles")
      .update({ role: "developer", status: "approved", approved_at: new Date().toISOString(), developer_id: null })
      .eq("id", profile.id)
      .select("*")
      .single<Profile>();
    return promoted ?? profile;
  }

  return profile;
});

export function homePathFor(profile: Profile): string {
  if (profile.role === "developer") return "/dashboard";
  if (profile.status !== "approved") return "/pending";
  return "/portal";
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireDeveloper(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "developer") redirect(homePathFor(profile));
  return profile;
}

export async function requireClient(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "client") redirect(homePathFor(profile));
  if (profile.status !== "approved") redirect("/pending");
  return profile;
}

/** For server actions: returns the profile, or null when not an approved developer. */
export async function authorizeDeveloper(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile?.role === "developer" && profile.status === "approved" ? profile : null;
}

/** For server actions: returns the profile, or null when not an approved client. */
export async function authorizeClient(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile?.role === "client" && profile.status === "approved" ? profile : null;
}
