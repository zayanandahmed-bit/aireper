// Supabase Edge Function behind the website's "Now talk to ours" chat.
//
//   GET  /functions/v1/daysback-chat  -> { ready: boolean }
//   POST /functions/v1/daysback-chat  { messages: [{ role, content }] } -> streamed plain-text reply
//
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret
// (Supabase > Edge Functions > Secrets). The website is public, so this
// function is also the only thing between the internet and the bill: it limits
// who can call it, how much they can send, and how much each reply can cost.
// What the assistant knows is in prompt.ts.
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { SYSTEM_PROMPT } from "./prompt.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://daysback.si,https://www.daysback.si,https://zayanandahmed-bit.github.io,http://localhost:5180").split(",").map((s) => s.trim());

const MAX_MESSAGES = 24;   // turns per conversation (the site drops older ones)
const MAX_CHARS = 1500;    // per visitor message
// A cost cap, not a quality setting: replies are told to be a few sentences.
const MAX_TOKENS = 2000;

// Best-effort per-IP limit. Edge instances don't share memory, so this slows a
// single abuser rather than being a hard quota; the monthly spend limit in the
// Anthropic Console is the real backstop.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 30;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}

function validMessages(messages: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const out: Anthropic.MessageParam[] = [];
  for (const [i, m] of messages.entries()) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const text = m.content.trim();
    if (!text || (m.role === "user" && text.length > MAX_CHARS) || text.length > 6000) return null;
    if (i === 0 && m.role !== "user") return null;
    out.push({ role: m.role, content: text });
  }
  return out[out.length - 1].role === "user" ? out : null;
}

const FALLBACK_REPLY =
  "Sorry, I can't help with that one. For anything about your business, book a free 27-minute strategy call on our Contact page.";

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
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (req.method === "GET") return json(200, { ready: !!apiKey });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  if (!ALLOWED_ORIGINS.includes(origin)) return json(403, { error: "Origin not allowed" });
  if (!apiKey) return json(503, { error: "Chat isn't set up yet" });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json(429, { error: "You've sent a lot of messages. Please try again in a few minutes." });

  const body = await req.json().catch(() => null);
  const messages = validMessages(body?.messages);
  if (!messages) return json(400, { error: "Bad request" });

  const client = new Anthropic({ apiKey });
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (s: string) => controller.enqueue(enc.encode(s));
      let wrote = false;
      try {
        const reply = client.beta.messages.stream({
          model: "claude-opus-5-5",
          max_tokens: MAX_TOKENS,
          // Chat replies are short and simple; low effort keeps them fast and cheap.
          output_config: { effort: "low" },
          // Never changes between requests, so it's cached and later
          // conversations read it at a fraction of the price.
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
          // If the model declines a message, the API retries it on Anthropic's
          // recommended fallback model instead of returning nothing.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        for await (const event of reply) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            write(event.delta.text);
            wrote = true;
          }
        }
        const final = await reply.finalMessage();
        if (final.stop_reason === "refusal" || !wrote) write((wrote ? "\n\n" : "") + FALLBACK_REPLY);
      } catch (err) {
        console.error("chat error", (err as { status?: number })?.status, (err as Error)?.message);
        write((wrote ? "\n\n" : "") + (err instanceof Anthropic.RateLimitError
          ? "We're getting a lot of questions right now. Please try again in a minute."
          : "Sorry, something went wrong on our side. Please try again, or book a call on our Contact page."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
});
