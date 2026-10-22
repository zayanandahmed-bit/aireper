// Records one page view from daysback.si. Cookie-free and no IP stored; see
// supabase/sql/daysback_pageviews.sql.
//
//   POST { path, referrer }  ->  204
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://daysback.si,https://www.daysback.si,http://localhost:5182").split(",").map((s) => s.trim());
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp/i;

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";

async function hash(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
  if (ALLOWED_ORIGINS.includes(origin)) { cors["Access-Control-Allow-Origin"] = origin; cors["Vary"] = "Origin"; }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST" || !ALLOWED_ORIGINS.includes(origin)) return new Response(null, { status: 403, headers: cors });

  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return new Response(null, { status: 204, headers: cors });

  const body = await req.json().catch(() => ({}));
  const path = clean(body.path, 200).split("?")[0].replace(/(.)\/$/, "$1") || "/";
  let referrer = "";
  try {
    const r = new URL(clean(body.referrer, 500));
    if (!/(^|\.)daysback\.si$/.test(r.hostname)) referrer = r.hostname.replace(/^www\./, "");
  } catch { /* none or invalid */ }
  const device = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const visitor_hash = await hash(`${Deno.env.get("REPLY_SECRET") ?? ""}|${ip}|${ua}|${day}`);

  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  await fetch(Deno.env.get("SUPABASE_URL")! + "/rest/v1/daysback_pageviews", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify([{ path, referrer, device, visitor_hash }]),
  }).catch(() => {});
  return new Response(null, { status: 204, headers: cors });
});
