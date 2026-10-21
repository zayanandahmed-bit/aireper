// Supabase Edge Function behind the standalone DaysBack mail tool.
//
//   POST { pass, action: "list" }                                  -> { enquiries: [...] }
//   POST { pass, action: "send", to, subject, message, from }      -> { ok: true }
//
// Lets the team email anyone (not just website leads) in the branded DaysBack
// template, sent from contact@daysback.si with the team on BCC.
//
// Secrets: COMPOSE_PASS (the tool's passcode), SMTP_PASS, optional NOTIFY_TO.
import nodemailer from "npm:nodemailer@6.9.16";
import { brandedMessage } from "../_shared/mail.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://zayanandahmed-bit.github.io,http://localhost:5183").split(",").map((s) => s.trim());
const NOTIFY_TO = (Deno.env.get("NOTIFY_TO") ?? "contact@daysback.si,mazher@daysback.si")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "contact@daysback.si";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com";

// Best-effort brute-force guard: 8 wrong passcodes per IP per 10 minutes.
const fails = new Map<string, number[]>();
const WINDOW = 10 * 60 * 1000;
const recentFails = (ip: string) => (fails.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW);

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "";

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
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
  if (recentFails(ip).length >= 8) return json(429, { error: "Too many attempts. Try again in a few minutes." });

  const body = await req.json().catch(() => ({}));
  const expected = Deno.env.get("COMPOSE_PASS") ?? "";
  if (!expected || !same(clean(body.pass, 200), expected)) {
    fails.set(ip, [...recentFails(ip), Date.now()]);
    return json(401, { error: "Wrong passcode." });
  }

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { apikey: key, Authorization: "Bearer " + key };

  if (body.action === "list") {
    const r = await fetch(
      sbUrl + "/rest/v1/daysback_enquiries?select=name,email,company,interest,created_at&order=created_at.desc&limit=30",
      { headers },
    );
    const c = await fetch(sbUrl + "/rest/v1/daysback_contacts?select=email,name&order=name.asc&limit=5000", { headers });
    return json(200, { enquiries: r.ok ? await r.json() : [], contacts: c.ok ? await c.json() : [] });
  }

  // Bulk add addresses (exported from a mailbox's contacts). Existing ones are kept.
  if (body.action === "import") {
    const rows = (Array.isArray(body.contacts) ? body.contacts : []).slice(0, 5000).map((c: Record<string, unknown>) => ({
      email: clean(c.email, 160).toLowerCase(), name: clean(c.name, 100), source: "import",
    })).filter((c) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(c.email));
    if (!rows.length) return json(400, { error: "No email addresses found in that file." });
    const r = await fetch(sbUrl + "/rest/v1/daysback_contacts?on_conflict=email", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) { console.error("import failed", r.status, await r.text()); return json(502, { error: "Couldn't import." }); }
    return json(200, { ok: true, count: rows.length });
  }

  if (body.action !== "send") return json(400, { error: "Bad request" });
  const to = clean(body.to, 160);
  const subject = clean(body.subject, 150).replace(/\n/g, " ");
  const message = clean(body.message, 8000);
  const SENDERS = ["Mazher", "Zayan"];
  const from = SENDERS.includes(clean(body.from, 60)) ? clean(body.from, 60) : "The DaysBack team";
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(to)) return json(400, { error: "Add a valid email to send to." });
  if (!subject) return json(400, { error: "Add a subject." });
  if (message.length < 2) return json(400, { error: "Write your message first." });

  const pass = Deno.env.get("SMTP_PASS");
  if (!pass) return json(500, { error: "Email isn't set up." });

  const { html, text } = brandedMessage(message, from);
  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST, port: 465, secure: true, auth: { user: SMTP_USER, pass },
    });
    await transport.sendMail({
      from: `"${from.replace(/"/g, "")} | DaysBack" <${SMTP_USER}>`,
      to,
      bcc: NOTIFY_TO.filter((a) => a.toLowerCase() !== to.toLowerCase()).join(", "),
      replyTo: SMTP_USER,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("send failed", (err as Error)?.message);
    return json(502, { error: "Couldn't send. Check the address and try again." });
  }
  // Remember who we've written to, so they show up in the address book.
  await fetch(sbUrl + "/rest/v1/daysback_contacts?on_conflict=email", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify([{ email: to.toLowerCase(), name: "", source: "sent" }]),
  }).catch(() => {});
  return json(200, { ok: true });
});
