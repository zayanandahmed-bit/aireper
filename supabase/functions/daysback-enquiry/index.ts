// Supabase Edge Function behind the website's contact form.
//
//   POST { name, email, company?, interest?, page?, website? }  ->  { ok: true }
//
// 1. Saves the message in the private daysback_enquiries table (RLS on, no
//    policies, so only this function's service key can write it).
// 2. Emails it to the team through the contact@daysback.si mailbox (Hostinger
//    SMTP), with Reply-To set to the sender so you can answer straight back.
//
// 3. Sends the visitor a branded "we've got your message" confirmation.
//
// The message is always saved first; if the email can't be sent (password not
// set yet, mail server down) the visitor still gets a success and nothing is
// lost: the row just has emailed = false.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   SMTP_PASS   password for the contact@daysback.si mailbox   (required for email)
//   SMTP_USER   defaults to contact@daysback.si
//   SMTP_HOST   defaults to smtp.hostinger.com (port 465, SSL)
//   NOTIFY_TO   comma-separated recipients, defaults to contact@ and mazher@
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import nodemailer from "npm:nodemailer@6.9.16";
import { esc, SITE, sign } from "../_shared/mail.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://daysback.si,https://www.daysback.si,https://zayanandahmed-bit.github.io,http://localhost:5182").split(",").map((s) => s.trim());
const NOTIFY_TO = (Deno.env.get("NOTIFY_TO") ?? "contact@daysback.si,mazher@daysback.si")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "contact@daysback.si";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com";

// Best-effort per-IP limit against someone hammering the form.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 5;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";


// Branded confirmation sent to the visitor. Table layout + inline styles so it
// renders the same in Gmail, Outlook and Apple Mail.
function confirmation(name: string) {
  const first = esc(name.split(" ")[0] || "there");
  const subject = "We've got your message | DaysBack";
  const text = [
    `Hi ${name.split(" ")[0] || "there"},`,
    "",
    "Thanks for reaching out to DaysBack. We've received your message and one of the team will reply personally within 1 hour.",
    "",
    "What happens next:",
    "1. We read what you need and look at where your business is losing time and money.",
    "2. We reply with a time for your free 27-minute strategy call.",
    "3. On the call we map your opportunities. No pressure, no lock-in.",
    "",
    "Just reply to this email if you want to add anything.",
    "",
    "The DaysBack team",
    "contact@daysback.si",
  ].join("\n");
  const step = (n: string, t: string) =>
    `<tr><td style="padding:6px 0;vertical-align:top;width:34px"><div style="width:26px;height:26px;border-radius:13px;background:#6c3cff;color:#fff;font:700 13px/26px Arial,sans-serif;text-align:center">${n}</div></td><td style="padding:6px 0;font:15px/1.5 Arial,sans-serif;color:#17123a">${t}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ff;padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:linear-gradient(90deg,#6c3cff,#e0307e 55%,#ff6a1a);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:32px 36px 8px;font:800 22px Arial,sans-serif;color:#17123a;letter-spacing:.5px">DaysBack</td></tr>
<tr><td style="padding:8px 36px 0;font:700 24px/1.3 Arial,sans-serif;color:#17123a">Thanks ${first}, we've got your message.</td></tr>
<tr><td style="padding:12px 36px 0;font:15px/1.6 Arial,sans-serif;color:#5f5b7e">One of the team will reply to you personally <strong style="color:#17123a">within 1 hour</strong>.</td></tr>
<tr><td style="padding:24px 36px 0;font:700 13px Arial,sans-serif;color:#6c3cff;letter-spacing:1px">WHAT HAPPENS NEXT</td></tr>
<tr><td style="padding:8px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${step("1", "We read what you need and look at where your business is losing time and money.")}
${step("2", "We reply with a time for your free <strong>27-minute strategy call</strong>.")}
${step("3", "On the call we map your opportunities. No pressure, no lock-in.")}
</table></td></tr>
<tr><td style="padding:20px 36px 0;font:15px/1.6 Arial,sans-serif;color:#5f5b7e">Want to add anything? Just reply to this email.</td></tr>
<tr><td style="padding:28px 36px 32px;font:15px/1.6 Arial,sans-serif;color:#17123a">Speak soon,<br><strong>The DaysBack team</strong></td></tr>
<tr><td style="padding:18px 36px;background:#f4f2ff;font:12px/1.6 Arial,sans-serif;color:#5f5b7e">DaysBack builds custom AI that finds where your business leaks money and gets your days back.<br><a href="mailto:contact@daysback.si" style="color:#6c3cff;text-decoration:none">contact@daysback.si</a> &nbsp;|&nbsp; <a href="https://daysback.si" style="color:#6c3cff;text-decoration:none">daysback.si</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

// One-click reply: opens the site's reply page, where the team writes a
// message that goes out in the branded template.
async function replyLink(id: string) {
  return `${SITE}/reply?id=${id}&t=${await sign(id)}`;
}

function teamHtml(d: Record<string, string>, reply: string) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;width:90px;font:700 12px Arial,sans-serif;color:#6c3cff;letter-spacing:.5px;text-transform:uppercase">${k}</td><td style="padding:6px 0;font:15px Arial,sans-serif;color:#17123a">${esc(v || "-")}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f2ff;padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:linear-gradient(90deg,#6c3cff,#e0307e 55%,#ff6a1a);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 4px;font:700 20px Arial,sans-serif;color:#17123a">New enquiry</td></tr>
<tr><td style="padding:4px 32px 0;font:14px Arial,sans-serif;color:#5f5b7e">Promised reply time: within 1 hour.</td></tr>
<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Name", d.name)}${row("Email", d.email)}${row("Company", d.company)}${row("Wants", d.interest)}${row("Page", d.page)}
</table></td></tr>
<tr><td style="padding:24px 32px 32px"><a href="${reply}" style="display:inline-block;background:#6c3cff;color:#fff;text-decoration:none;font:700 15px Arial,sans-serif;padding:13px 22px;border-radius:10px">Reply to this enquiry</a>
<div style="padding-top:10px;font:12px Arial,sans-serif;color:#5f5b7e">Opens a page where you write the reply. It is sent to ${esc(d.email)} in the DaysBack template.</div></td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "no-store",
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    cors["Access-Control-Allow-Origin"] = origin;
    cors["Vary"] = "Origin";
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!ALLOWED_ORIGINS.includes(origin)) return json(403, { error: "Origin not allowed" });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json(429, { error: "Too many messages. Please email contact@daysback.si instead." });

  const body = await req.json().catch(() => null);
  if (!body) return json(400, { error: "Bad request" });

  // A hidden field real people never see. Bots fill it in; pretend it worked.
  if (clean(body.website, 200)) return json(200, { ok: true });

  const name = clean(body.name, 100);
  const email = clean(body.email, 160);
  const company = clean(body.company, 120);
  const interest = clean(body.interest, 80);
  const page = clean(body.page, 120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json(400, { error: "Please add your name and a valid email." });
  }

  // 1. Save it.
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  const saved = await fetch(url + "/rest/v1/daysback_enquiries", {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([{ name, email, company, interest, page }]),
  });
  if (!saved.ok) {
    console.error("save failed", saved.status, await saved.text());
    return json(502, { error: "Couldn't send right now. Please email contact@daysback.si." });
  }
  const [row] = await saved.json();

  // 2. Email the team. Never let a mail problem lose the enquiry.
  const pass = Deno.env.get("SMTP_PASS");
  if (pass && NOTIFY_TO.length) {
    try {
      const transport = nodemailer.createTransport({
        host: SMTP_HOST, port: 465, secure: true, auth: { user: SMTP_USER, pass },
      });
      const lines = [
        `Name:      ${name}`,
        `Email:     ${email}`,
        `Company:   ${company || "-"}`,
        `Wants:     ${interest || "-"}`,
        `Page:      ${page || "-"}`,
        `Received:  ${new Date().toUTCString()}`,
        "",
        "Reply to this email to answer them directly. (Promised reply time: within 1 hour.)",
      ];
      await transport.sendMail({
        from: `"DaysBack website" <${SMTP_USER}>`,
        to: NOTIFY_TO.join(", "),
        replyTo: `"${name.replace(/"/g, "")}" <${email}>`,
        subject: `New enquiry: ${name}${company ? " (" + company + ")" : ""}`,
        text: lines.join("\n"),
        html: teamHtml({ name, email, company, interest, page }, await replyLink(row.id)),
      });
      await fetch(url + "/rest/v1/daysback_enquiries?id=eq." + row.id, {
        method: "PATCH", headers, body: JSON.stringify({ emailed: true }),
      });
      // 3. Confirmation to the visitor. Failure here must not matter.
      try {
        const c = confirmation(name);
        await transport.sendMail({
          from: `"DaysBack" <${SMTP_USER}>`,
          to: email,
          replyTo: SMTP_USER,
          subject: c.subject,
          text: c.text,
          html: c.html,
        });
      } catch (err) {
        console.error("confirmation failed", (err as Error)?.message);
      }
    } catch (err) {
      console.error("email failed", (err as Error)?.message);
    }
  }

  return json(200, { ok: true });
});
