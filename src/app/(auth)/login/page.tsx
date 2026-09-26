import Link from "next/link";
import { signIn } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Notice } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Sign in</h1>
      <p className="mt-1.5 text-[0.9375rem] text-graphite">Use the email you signed up or were invited with.</p>
      {error && (
        <div className="mt-6">
          <Notice tone="danger">That link is invalid or has expired. Sign in, or request a new link.</Notice>
        </div>
      )}
      <ActionForm action={signIn} className="mt-8">
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-sm text-graphite hover:text-ink">Forgot password?</Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <SubmitButton className="w-full py-2.5" pendingLabel="Signing in…">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-8 text-sm text-graphite">
        New client?{" "}
        <Link href="/signup" className="font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          Create an account
        </Link>
      </p>
    </>
  );
}
