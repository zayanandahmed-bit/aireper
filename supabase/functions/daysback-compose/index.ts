// Supabase Edge Function behind the standalone DaysBack mail tool.
//
//   POST { pass, action: "list" }                                  -> { enquiries: [...] }
//   POST { pass, action: "send", to, subject, message, from }      -> { ok: true }
//
// Lets the team email anyone (not just website leads) in the branded DaysBack
// template, sent from a chosen team mailbox with the team on BCC.
//
// Secrets: COMPOSE_PASS (the tool's passcode), SMTP_PASS (contact@),
// SMTP_PASS_MAZHER / SMTP_PASS_ZAYAN for other mailboxes, optional NOTIFY_TO, MAILBOXES.
import nodemailer from "npm:nodemailer@6.9.16";
import { brandedMessage, SITE, sign } from "../_shared/mail.ts";
import { type FolderState, readAddresses } from "../_shared/imap.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://hq.daysback.si,https://daysback.si,https://www.daysback.si,http://daysback.si,http://www.daysback.si,https://zayanandahmed-bit.github.io,http://localhost:5183").split(",").map((s) => s.trim());
const NOTIFY_TO = (Deno.env.get("NOTIFY_TO") ?? "contact@daysback.si,mazher@daysback.si")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "contact@daysback.si";
// Mailboxes the team can send from. contact@ uses SMTP_PASS; any other uses
// SMTP_PASS_<NAME>, e.g. SMTP_PASS_MAZHER for mazher@daysback.si.
const MAILBOXES = (Deno.env.get("MAILBOXES") ?? "contact@daysback.si,mazher@daysback.si,zayan@daysback.si")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const passFor = (box: string) =>
  box === SMTP_USER ? Deno.env.get("SMTP_PASS") : Deno.env.get("SMTP_PASS_" + box.split("@")[0].replace(/[^a-z0-9]/g, "_").toUpperCase());
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

// Reads every message in a mailbox's Inbox and Sent folders (only mail that is
// new since the last scan) and returns the outside addresses seen in From/To/Cc.
const IMAP_HOST = Deno.env.get("IMAP_HOST") ?? "imap.hostinger.com";
const OWN = /@daysback\.si$/i;
const JUNK = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?@|bounce)/i;

async function harvest(box: string, pass: string, sbUrl: string, headers: Record<string, string>) {
  const r = await fetch(sbUrl + "/rest/v1/daysback_mail_sync?select=folder,uidvalidity,last_uid&box=eq." + encodeURIComponent(box), { headers });
  const state: Record<string, FolderState> = {};
  for (const row of r.ok ? await r.json() : []) state[row.folder] = { uidvalidity: Number(row.uidvalidity), last_uid: Number(row.last_uid) };
  const out = await readAddresses(IMAP_HOST, box, pass, state, 45_000);
  const found = new Map<string, string>();
  for (const { email, name } of out.addresses) {
    if (OWN.test(email) || JUNK.test(email)) continue;
    if (!found.has(email) || (!found.get(email) && name)) found.set(email, name);
  }
  return { found, state: out.state, done: out.done };
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
    return json(200, {
      enquiries: r.ok ? await r.json() : [], contacts: c.ok ? await c.json() : [],
      mailboxes: MAILBOXES.map((m) => ({ email: m, ready: !!passFor(m) })),
    });
  }

  // Pull contacts from every connected mailbox (run each time the tool opens).
  // The first run reads all mail; later runs only read what is new. If a
  // mailbox is too big to finish in one call, done=false and the page calls again.
  if (body.action === "sync") {
    const results = await Promise.all(MAILBOXES.map(async (box) => {
      const pass = passFor(box);
      if (!pass) return { box, ok: false, count: 0, done: true, error: "not connected" };
      try {
        const { found, state, done } = await harvest(box, pass, sbUrl, headers);
        const all = [...found].map(([email, name]) => ({ email, name, source: "mailbox" }));
        const named = all.filter((c) => c.name), unnamed = all.filter((c) => !c.name);
        const up = (table: string, rows: unknown[], how: string, key: string) => rows.length ? fetch(sbUrl + `/rest/v1/${table}?on_conflict=${key}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=" + how },
          body: JSON.stringify(rows),
        }) : null;
        await up("daysback_contacts", unnamed, "ignore-duplicates", "email");
        await up("daysback_contacts", named, "merge-duplicates", "email");
        // Save the position only after the contacts are stored.
        await up("daysback_mail_sync", Object.entries(state).map(([folder, st]) => ({ box, folder, ...st, updated_at: new Date().toISOString() })), "merge-duplicates", "box,folder");
        return { box, ok: true, count: all.length, done };
      } catch (err) {
        console.error("sync failed", box, (err as Error)?.message);
        return { box, ok: false, count: 0, done: true, error: "couldn't read mailbox" };
      }
    }));
    return json(200, { results });
  }

  // HQ home: shared settings (the link tiles), same for everyone on the team.
  if (body.action === "hq_get") {
    const r = await fetch(sbUrl + "/rest/v1/daysback_hq?key=eq.tiles&select=value", { headers });
    const [row] = r.ok ? await r.json() : [];
    return json(200, { tiles: row?.value ?? null });
  }
  if (body.action === "hq_set") {
    const tiles = Array.isArray(body.tiles) ? body.tiles.slice(0, 200).map((t: Record<string, unknown>) => ({
      name: clean(t.name, 60), url: clean(t.url, 500), group: clean(t.group, 40), note: clean(t.note, 80),
    })).filter((t) => t.name && /^https?:\/\//.test(t.url)) : [];
    const r = await fetch(sbUrl + "/rest/v1/daysback_hq?on_conflict=key", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ key: "tiles", value: tiles, updated_at: new Date().toISOString() }]),
    });
    return json(r.ok ? 200 : 502, r.ok ? { ok: true } : { error: "Couldn't save." });
  }

  // Case studies (client or internal version), kept private in daysback_hq.
  if (body.action === "case_studies") {
    const k = body.version === "internal" ? "cs_internal" : "cs_client";
    const r = await fetch(sbUrl + `/rest/v1/daysback_hq?key=in.(${k},cs_updated)&select=key,value`, { headers });
    const rows = r.ok ? await r.json() : [];
    const html = rows.find((x: { key: string }) => x.key === k)?.value;
    if (!html) return json(404, { error: "Case studies haven't been published to HQ yet." });
    return json(200, { html, updated: rows.find((x: { key: string }) => x.key === "cs_updated")?.value ?? null });
  }

  // Latest website enquiries, each with its signed reply link.
  if (body.action === "recent") {
    const r = await fetch(sbUrl + "/rest/v1/daysback_enquiries?select=id,created_at,name,email,company,interest&order=created_at.desc&limit=8", { headers });
    const rows = r.ok ? await r.json() : [];
    for (const row of rows) row.reply = `${SITE}/reply?id=${row.id}&t=${await sign(row.id)}`;
    return json(200, { enquiries: rows });
  }

  // Visitor stats for the Stats tab.
  if (body.action === "stats") {
    const days = Math.min(365, Math.max(1, Number(body.days) || 30));
    const r = await fetch(sbUrl + "/rest/v1/rpc/daysback_stats", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ days }),
    });
    return json(r.ok ? 200 : 502, r.ok ? await r.json() : { error: "Couldn't load stats." });
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

  const box = MAILBOXES.includes(clean(body.box, 160).toLowerCase()) ? clean(body.box, 160).toLowerCase() : SMTP_USER;
  const pass = passFor(box);
  if (!pass) return json(400, { error: `${box} isn't connected yet. Add its mailbox password in Supabase secrets.` });

  const { html, text } = brandedMessage(message, from, box);
  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST, port: 465, secure: true, auth: { user: box, pass },
    });
    await transport.sendMail({
      from: `"${from.replace(/"/g, "")} | DaysBack" <${box}>`,
      to,
      // Copy to the team, plus the sending mailbox so it lands in its inbox too
      // (SMTP sends don't appear in Hostinger's Sent folder).
      bcc: [...new Set([...NOTIFY_TO.map((a) => a.toLowerCase()), box])].filter((a) => a !== to.toLowerCase()).join(", "),
      replyTo: box,
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
