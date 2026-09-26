import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { after } from "next/server";
import { env } from "@/lib/env";
import { brand } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

let transporter: Transporter | null = null;

/**
 * Gmail (app password) in production. Setting SMTP_HOST instead points at any
 * SMTP server — locally, Supabase's Mailpit inbox on port 54325.
 */
function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? process.env.GMAIL_USER ?? "no-reply@localhost";
}

type Button = { label: string; /** App path ("/portal/...") or absolute URL. */ path: string };

type Email = {
  to: string | string[];
  subject: string;
  heading: string;
  /** Large figure shown under the heading, e.g. an invoice amount. */
  amount?: string;
  lines: string[];
  cta?: Button;
  secondaryCta?: Button;
  /** Files from the private storage bucket to attach. */
  attachments?: { filename: string; storagePath: string }[];
  /** Where replies go — the developer's address for client-facing emails. */
  replyTo?: string;
};

const href = (path: string) => (/^https?:\/\//i.test(path) ? path : `${env.siteUrl()}${path}`);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function render({ heading, amount, lines, cta, secondaryCta }: Email) {
  const primary = cta
    ? `<a href="${escapeHtml(href(cta.path))}" style="display:inline-block;background:#14213d;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:0 8px 8px 0">${escapeHtml(cta.label)}</a>`
    : "";
  const secondary = secondaryCta
    ? `<a href="${escapeHtml(href(secondaryCta.path))}" style="display:inline-block;background:#ffffff;color:#14213d;border:1px solid #d9dee7;padding:11px 21px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:0 8px 8px 0">${escapeHtml(secondaryCta.label)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#eef1f5;font-family:'IBM Plex Sans',-apple-system,'Segoe UI',Roboto,sans-serif;color:#14213d">
<div style="max-width:560px;margin:32px auto;padding:0 16px">
<p style="margin:0 0 16px;font-size:15px;font-weight:600">${escapeHtml(brand.name)}</p>
<div style="background:#ffffff;border:1px solid #d9dee7;border-radius:12px;padding:32px">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 16px">${escapeHtml(heading)}</h1>
${amount ? `<p style="font-size:32px;font-weight:600;margin:0 0 16px;letter-spacing:-0.02em">${escapeHtml(amount)}</p>` : ""}
${lines.map((l) => `<p style="font-size:15px;line-height:1.6;margin:0 0 10px;color:#2b3a5c">${escapeHtml(l)}</p>`).join("")}
${primary || secondary ? `<p style="margin:24px 0 0">${primary}${secondary}</p>` : ""}
</div>
<p style="font-size:12px;line-height:1.5;color:#646e80;margin:16px 0 0">${escapeHtml(brand.name)}, ${escapeHtml(brand.tagline)}. You can reply to this email.</p>
</div></body></html>`;
}

async function loadAttachments(files: Email["attachments"]) {
  if (!files?.length) return undefined;
  const storage = createAdminClient().storage.from("documents");
  const loaded = await Promise.all(
    files.map(async (f) => {
      const { data } = await storage.download(f.storagePath);
      return data ? { filename: f.filename, content: Buffer.from(await data.arrayBuffer()) } : null;
    }),
  );
  return loaded.filter((a) => a !== null);
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
      console.warn(`[email] No SMTP configured — skipped "${email.subject}"`);
      return;
    }
    try {
      const buttons = [email.cta, email.secondaryCta].filter((b): b is Button => Boolean(b));
      await t.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME ?? brand.name}" <${fromAddress()}>`,
        to: recipients.join(", "),
        replyTo: email.replyTo,
        subject: email.subject,
        text: [email.heading, email.amount ?? "", "", ...email.lines, "", ...buttons.map((b) => `${b.label}: ${href(b.path)}`)].join("\n"),
        html: render(email),
        attachments: await loadAttachments(email.attachments),
      });
    } catch (error) {
      console.error(`[email] Failed to send "${email.subject}"`, error);
    }
  });
}
