import Link from "next/link";
import { signIn } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back.</p>
      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          That link is invalid or has expired. Please try again.
        </p>
      )}
      <ActionForm action={signIn} className="mt-6">
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" name="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-900">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        New client?{" "}
        <Link href="/signup" className="font-medium text-slate-900 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
