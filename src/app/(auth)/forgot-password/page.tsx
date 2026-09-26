import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a link to set a new password.</p>
      <ActionForm action={requestPasswordReset} className="mt-6">
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-slate-600 hover:text-slate-900">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
