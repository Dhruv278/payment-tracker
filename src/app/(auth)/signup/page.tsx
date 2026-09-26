import Link from "next/link";
import { signUp } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Create your client account</h1>
      <p className="mt-1.5 text-[0.9375rem] text-graphite">New accounts are approved by hand. You&apos;ll get an email once yours is ready.</p>
      <ActionForm action={signUp} className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name">
            <Input id="full_name" name="full_name" autoComplete="name" required autoFocus />
          </Field>
          <Field label="Company" name="company" hint="Optional">
            <Input id="company" name="company" autoComplete="organization" />
          </Field>
        </div>
        <Field label="Work email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" name="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full py-2.5" pendingLabel="Creating account…">Create account</SubmitButton>
      </ActionForm>
      <p className="mt-8 text-sm text-graphite">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          Sign in
        </Link>
      </p>
    </>
  );
}
