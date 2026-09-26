import { updatePassword } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Choose a password" };

export default function UpdatePasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Choose a password</h1>
      <p className="mt-1.5 text-[0.9375rem] text-graphite">You&apos;ll use it with your email to sign in.</p>
      <ActionForm action={updatePassword} className="mt-8">
        <Field label="New password" name="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
        </Field>
        <Field label="Confirm password" name="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full py-2.5">Save password</SubmitButton>
      </ActionForm>
    </>
  );
}
