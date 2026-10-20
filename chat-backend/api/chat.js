// POST /api/chat  { messages: [{ role: "user" | "assistant", content: string }] }
//   -> streams the assistant's reply as plain text
// GET  /api/chat  -> { ready: boolean }  (the website shows the chat bubble only when ready)
//
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY environment
// variable on Vercel. The website is public, so this function is also the only
// thing between the internet and the bill: it limits who can call it, how much
// they can send, and how much each reply can cost.
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.js";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://zayanandahmed-bit.github.io,http://localhost:5180").split(",").map((s) => s.trim());

const MAX_MESSAGES = 24;        // turns kept per conversation (oldest dropped by the widget)
const MAX_CHARS = 1500;         // per visitor message
// A cost cap, not a quality setting: replies are told to be a few sentences,
// so this only ever bites if something goes wrong.
const MAX_TOKENS = 2000;

// Best-effort per-IP limit. Serverless instances don't share memory, so this
// slows down a single abuser on one instance rather than being a hard quota;
// the spend limit you set in the Anthropic Console is the real backstop.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 30;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const out = [];
  for (const [i, m] of messages.entries()) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const text = m.content.trim();
    if (!text || (m.role === "user" && text.length > MAX_CHARS) || text.length > 6000) return null;
    if (i === 0 && m.role !== "user") return null;
    out.push({ role: m.role, content: text });
  }
  return out[out.length - 1].role === "user" ? out : null;
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ready: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: "Origin not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "Chat isn't set up yet" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "You've sent a lot of messages. Please try again in a few minutes." });

  const messages = validMessages(req.body && req.body.messages);
  if (!messages) return res.status(400).json({ error: "Bad request" });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: MAX_TOKENS,
      // Chat replies are short and simple; low effort keeps them fast and cheap.
      output_config: { effort: "low" },
      // The system prompt never changes between requests, so it's cached and
      // each conversation after the first reads it at a fraction of the price.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
      // If the model declines a message, the API retries it on Anthropic's
      // recommended fallback model instead of returning nothing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    let wrote = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(event.delta.text);
        wrote = true;
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal" || !wrote) {
      res.write((wrote ? "\n\n" : "") +
        "Sorry, I can't help with that one. For anything about your business, book a free 20-minute strategy call on our Contact page.");
    }
    return res.end();
  } catch (err) {
    const msg = err instanceof Anthropic.RateLimitError
      ? "We're getting a lot of questions right now. Please try again in a minute."
      : "Sorry, something went wrong on our side. Please try again, or book a call on our Contact page.";
    console.error("chat error", err && err.status, err && err.message);
    if (!res.headersSent) return res.status(502).json({ error: msg });
    res.write("\n\n" + msg);
    return res.end();
  }
}
