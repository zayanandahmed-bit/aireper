// Records one page view from daysback.si. Cookie-free and no IP stored; see
// supabase/sql/daysback_pageviews.sql.
//
//   POST { kind: "view"|"leave", path, referrer, tz, campaign, seconds }  ->  204
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://daysback.si,https://www.daysback.si,http://localhost:5182").split(",").map((s) => s.trim());
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 120;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}
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

  // Best-effort per-IP limit so a script can't flood the stats table.
  const ipKey = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ipKey)) return new Response(null, { status: 204, headers: cors });

  // sendBeacon posts text/plain, so read the text and parse it ourselves.
  const raw = await req.text().catch(() => "");
  if (raw.length > 2000) return new Response(null, { status: 204, headers: cors });
  const body = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
  const path = clean(body.path, 200).split("?")[0].replace(/(.)\/$/, "$1") || "/";
  if (!path.startsWith("/")) return new Response(null, { status: 204, headers: cors });
  let referrer = "";
  try {
    const r = new URL(clean(body.referrer, 500));
    if (!/(^|\.)daysback\.si$/.test(r.hostname)) referrer = r.hostname.replace(/^www\./, "");
  } catch { /* none or invalid */ }
  const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const kind = body.kind === "leave" ? "leave" : "view";
  const seconds = kind === "leave" ? Math.max(0, Math.min(7200, Math.round(Number(body.seconds) || 0))) : null;
  const tz = clean(body.tz, 60).replace(/[^A-Za-z0-9_\/+-]/g, "");
  const campaign = clean(body.campaign, 80);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const visitor_hash = await hash(`${Deno.env.get("REPLY_SECRET") ?? ""}|${ip}|${ua}|${day}`);

  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  await fetch(Deno.env.get("SUPABASE_URL")! + "/rest/v1/daysback_pageviews", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify([{ kind, path, referrer: kind === "view" ? referrer : "", device, browser, os, tz, campaign, seconds, visitor_hash }]),
  }).catch(() => {});
  return new Response(null, { status: 204, headers: cors });
});
