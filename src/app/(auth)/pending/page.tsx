import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { homePathFor, requireProfile } from "@/lib/auth";
import { buttonStyles } from "@/components/ui";

export const metadata = { title: "Awaiting approval" };

export default async function PendingPage() {
  const profile = await requireProfile();
  if (profile.role === "developer" || profile.status === "approved") redirect(homePathFor(profile));

  const rejected = profile.status === "rejected";
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold">{rejected ? "Access not granted" : "Awaiting approval"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {rejected
          ? "Your account request was not approved. If you think this is a mistake, please contact your developer directly."
          : `Thanks for signing up, ${profile.full_name || profile.email}. Your account is being reviewed — you'll get an email as soon as it's approved.`}
      </p>
      <form action={signOut} className="mt-6">
        <button className={buttonStyles.secondary}>Sign out</button>
      </form>
    </div>
  );
}
