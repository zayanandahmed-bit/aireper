// Supabase Edge Function behind the website's contact form.
//
//   POST { name, email, company?, interest?, page?, website? }  ->  { ok: true }
//
// 1. Saves the message in the private daysback_enquiries table (RLS on, no
//    policies, so only this function's service key can write it).
// 2. Emails it to the team through the contact@daysback.si mailbox (Hostinger
//    SMTP), with Reply-To set to the sender so you can answer straight back.
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

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://zayanandahmed-bit.github.io,http://localhost:5182").split(",").map((s) => s.trim());
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
      });
      await fetch(url + "/rest/v1/daysback_enquiries?id=eq." + row.id, {
        method: "PATCH", headers, body: JSON.stringify({ emailed: true }),
      });
    } catch (err) {
      console.error("email failed", (err as Error)?.message);
    }
  }

  return json(200, { ok: true });
});
