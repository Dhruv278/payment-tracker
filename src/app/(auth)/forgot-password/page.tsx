import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Reset your password</h1>
      <p className="mt-1.5 text-[0.9375rem] text-graphite">We&apos;ll email you a link to choose a new one.</p>
      <ActionForm action={requestPasswordReset} className="mt-8">
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full py-2.5" pendingLabel="Sending…">Email me a reset link</SubmitButton>
      </ActionForm>
      <p className="mt-8 text-sm">
        <Link href="/login" className="text-graphite hover:text-ink">‹ Back to sign in</Link>
      </p>
    </>
  );
}
