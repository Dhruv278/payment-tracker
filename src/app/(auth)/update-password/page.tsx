import { updatePassword } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Set password" };

export default function UpdatePasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <ActionForm action={updatePassword} className="mt-6">
        <Field label="New password" name="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password" name="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full">Save password</SubmitButton>
      </ActionForm>
    </>
  );
}
