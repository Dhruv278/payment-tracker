import Link from "next/link";
import { signUp } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Client accounts are reviewed before access is granted.</p>
      <ActionForm action={signUp} className="mt-6">
        <Field label="Full name" name="full_name">
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Company (optional)" name="company">
          <Input id="company" name="company" autoComplete="organization" />
        </Field>
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" name="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full">Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
