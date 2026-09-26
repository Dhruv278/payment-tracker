"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import type { ActionState } from "@/lib/types";

const credentials = z.object({
  email: z.email("Enter a valid email.").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/** Only allow same-site relative redirects. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Please confirm your email first — check your inbox." };
    return { error: "Invalid email or password." };
  }
  redirect(safeNext(formData.get("next")));
}

const signUpSchema = credentials.extend({
  full_name: z.string().trim().min(2, "Enter your name."),
  company: z.string().trim().max(120).optional(),
});

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, full_name, company } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, company: company ?? "" },
      emailRedirectTo: `${env.siteUrl()}/auth/confirm?next=/`,
    },
  });
  if (error) return { error: error.message };
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) return { error: "An account with this email already exists." };

  const isDeveloper = env.developerEmails().includes(email);
  if (!isDeveloper) {
    sendEmail({
      to: env.developerEmails(),
      subject: `New client sign-up: ${full_name}`,
      heading: "A new client signed up",
      lines: [`${full_name}${company ? ` (${company})` : ""} — ${email}`, "Review and approve them to give access to the client portal."],
      cta: { label: "Review clients", path: "/clients" },
    });
  }

  if (data.session) redirect("/");
  return { success: "Account created. Check your email to confirm your address, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data.toLowerCase(), {
    redirectTo: `${env.siteUrl()}/auth/confirm?next=/update-password`,
  });
  // Same response whether or not the account exists.
  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) return { error: "Password must be at least 8 characters." };
  if (formData.get("password") !== formData.get("confirm")) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: error.message };
  redirect("/");
}
