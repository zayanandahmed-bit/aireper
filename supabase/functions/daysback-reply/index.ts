// Supabase Edge Function behind the team's reply page (/reply on the site).
//
//   GET  ?id=&t=                      -> { name, email, company, interest }
//   POST { id, t, message, from? }    -> sends a branded reply to the visitor
//
// The link (with a signed token t) is in the "New enquiry" email, so only the
// team can use it. The reply goes out from contact@daysback.si, Reply-To the
// same mailbox, with the rest of the team on BCC so everyone sees what was sent.
import nodemailer from "npm:nodemailer@6.9.16";
import { esc, shell, sign } from "../_shared/mail.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://zayanandahmed-bit.github.io,http://localhost:5182").split(",").map((s) => s.trim());
const NOTIFY_TO = (Deno.env.get("NOTIFY_TO") ?? "contact@daysback.si,mazher@daysback.si")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "contact@daysback.si";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com";

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  if (!ALLOWED_ORIGINS.includes(origin)) return json(403, { error: "Origin not allowed" });

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };

  let id = "", t = "", body: Record<string, unknown> = {};
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    id = q.get("id") ?? ""; t = q.get("t") ?? "";
  } else if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
    id = clean(body.id, 60); t = clean(body.t, 80);
  } else return json(405, { error: "Method not allowed" });

  if (!/^[0-9a-f-]{36}$/.test(id) || t !== (await sign(id))) return json(403, { error: "This link isn't valid." });

  const res = await fetch(sbUrl + "/rest/v1/daysback_enquiries?id=eq." + id + "&select=name,email,company,interest", { headers });
  const [row] = res.ok ? await res.json() : [];
  if (!row) return json(404, { error: "Enquiry not found." });

  if (req.method === "GET") return json(200, row);

  const message = clean(body.message, 5000);
  const from = clean(body.from, 60) || "The DaysBack team";
  if (message.length < 2) return json(400, { error: "Write your reply first." });

  const pass = Deno.env.get("SMTP_PASS");
  if (!pass) return json(500, { error: "Email isn't set up." });

  const paras = message.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 14px;font:15px/1.65 Arial,sans-serif;color:#17123a">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = shell(`
<tr><td style="padding:12px 36px 0">${paras}</td></tr>
<tr><td style="padding:8px 36px 30px;font:15px/1.6 Arial,sans-serif;color:#17123a">Best regards,<br><strong>${esc(from)}</strong><br><span style="color:#5f5b7e">DaysBack</span></td></tr>`);

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST, port: 465, secure: true, auth: { user: SMTP_USER, pass },
    });
    await transport.sendMail({
      from: `"${from.replace(/"/g, "")} | DaysBack" <${SMTP_USER}>`,
      to: row.email,
      bcc: NOTIFY_TO.join(", "),
      replyTo: SMTP_USER,
      subject: "Re: Your enquiry | DaysBack",
      text: message + `\n\nBest regards,\n${from}\nDaysBack | contact@daysback.si`,
      html,
    });
  } catch (err) {
    console.error("reply failed", (err as Error)?.message);
    return json(502, { error: "Couldn't send. Try again or reply from your mailbox." });
  }
  return json(200, { ok: true });
});
