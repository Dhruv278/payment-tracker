import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { after } from "next/server";
import { env } from "@/lib/env";

let transporter: Transporter | null = null;

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transporter;
}

type Email = {
  to: string | string[];
  subject: string;
  heading: string;
  lines: string[];
  cta?: { label: string; path: string };
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function render({ heading, lines, cta }: Email) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${env.siteUrl()}${cta.path}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
${lines.map((l) => `<p style="font-size:15px;line-height:1.6;margin:0 0 10px">${escapeHtml(l)}</p>`).join("")}
${button}
<p style="font-size:12px;color:#64748b;margin-top:32px">Sent by Payment Tracker</p>
</div></body></html>`;
}

/**
 * Sends an email after the response is returned, so a slow or failing SMTP
 * server never blocks or breaks the user's action.
 */
export function sendEmail(email: Email) {
  const recipients = [email.to].flat().filter(Boolean);
  if (recipients.length === 0) return;

  after(async () => {
    const t = getTransporter();
    if (!t) {
      console.warn(`[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipped "${email.subject}"`);
      return;
    }
    try {
      await t.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME ?? "Payment Tracker"}" <${process.env.GMAIL_USER}>`,
        to: recipients.join(", "),
        subject: email.subject,
        text: [email.heading, "", ...email.lines, email.cta ? `\n${email.cta.label}: ${env.siteUrl()}${email.cta.path}` : ""].join("\n"),
        html: render(email),
      });
    } catch (error) {
      console.error(`[email] Failed to send "${email.subject}"`, error);
    }
  });
}
