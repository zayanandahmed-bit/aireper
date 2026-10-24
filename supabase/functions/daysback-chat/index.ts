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
  "https://daysback.si,https://www.daysback.si,http://daysback.si,http://www.daysback.si,https://zayanandahmed-bit.github.io,http://localhost:5180").split(",").map((s) => s.trim());

const MAX_MESSAGES = 24;   // turns per conversation (the site drops older ones)
const MAX_CHARS = 1500;    // per visitor message
// A cost cap: replies are told to stay under ~50 words, this is the hard ceiling.
const MAX_TOKENS = 300;
// Hard cap on visitor messages per day (UK date) across the whole site,
// shared by every edge instance via the database. Owner's limit: 200/day.
const DAILY_CAP = Number(Deno.env.get("CHAT_DAILY_CAP") ?? 200);
const CAP_REPLY =
  "Our assistant has had a busy day and is resting until tomorrow. Book a free 27-minute strategy call on our Contact page (https://daysback.si/contact) or email contact@daysback.si and a real person will reply within 1 hour.";

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

  const body = await req.json().catch(() => null);
  const messages = validMessages(body?.messages);
  if (!messages) return json(400, { error: "Bad request" });

  // Count this message against today's site-wide cap before spending anything.
  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const taken = await fetch(sbUrl + "/rest/v1/rpc/daysback_chat_take", {
    method: "POST",
    headers: { apikey: sbKey, Authorization: "Bearer " + sbKey, "Content-Type": "application/json" },
    body: JSON.stringify({ cap: DAILY_CAP }),
  }).then((r) => (r.ok ? r.json() : 0)).catch(() => 0);
  if (Number(taken) > DAILY_CAP) {
    return new Response(CAP_REPLY, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
  }

  const client = new Anthropic({ apiKey });
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (s: string) => controller.enqueue(enc.encode(s));
      let wrote = false;
      try {
        const reply = client.messages.stream({
          // Haiku: fast and the cheapest current model, plenty for answering
          // questions about our services and booking calls.
          model: "claude-haiku-5-5",
          max_tokens: MAX_TOKENS,
          // Chat replies are short and simple; low effort keeps them fast and cheap.
          output_config: { effort: "low" },
          // Never changes between requests, so it's cached and later
          // conversations read it at a fraction of the price.
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
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
