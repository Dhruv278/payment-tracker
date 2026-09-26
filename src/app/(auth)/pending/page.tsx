import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { homePathFor, requireProfile } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { buttonStyles } from "@/components/ui";

export const metadata = { title: "Waiting for approval" };

export default async function PendingPage() {
  const profile = await requireProfile();
  if (profile.role === "developer" || profile.status === "approved") redirect(homePathFor(profile));

  const rejected = profile.status === "rejected";
  return (
    <>
      <span aria-hidden className={`mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full text-lg ${rejected ? "bg-danger-tint text-danger" : "bg-due-tint text-due"}`}>
        {rejected ? "✕" : "◷"}
      </span>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{rejected ? "Your account wasn't approved" : "Your account is waiting for approval"}</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
        {rejected
          ? `If you're working with ${brand.name} and think this is a mistake, contact them directly.`
          : `Thanks, ${profile.full_name || "there"}. ${brand.name} will review your account shortly, and we'll email ${profile.email} as soon as you can sign in.`}
      </p>
      <form action={signOut} className="mt-8">
        <button className={buttonStyles.secondary}>Sign out</button>
      </form>
    </>
  );
}
