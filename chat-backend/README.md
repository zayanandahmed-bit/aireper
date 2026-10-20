# DAYSBACK.SI chat backend

One Vercel serverless function, `api/chat.js`, that the website's chat bubble
talks to. It holds the Anthropic API key so the public site never does.

What the assistant knows lives in `api/prompt.js`. Edit that file to change
services, process or wording, then redeploy.

## Go live (once)

1. Anthropic Console (platform.claude.com): create an API key, add credit, and
   **set a monthly spend limit** - that limit is the real cap on what the public
   chat can cost.
2. Deploy this folder to Vercel and add the environment variable
   `ANTHROPIC_API_KEY` (Project > Settings > Environment Variables).
3. Build the website with `VITE_CHAT_URL=https://<your-vercel-project>.vercel.app`
   and deploy it. The bubble appears only once `GET /api/chat` reports ready.

## Limits built in

- Only the website's own origin can call it (`ALLOWED_ORIGINS`).
- Up to 24 messages per conversation, 1,500 characters per visitor message.
- Replies capped at 2,000 tokens, low effort; system prompt is cached.
- About 30 messages per 10 minutes per IP (best effort, per instance).
- Model: `claude-opus-5-5`, with server-side refusal fallback (`fallbacks: "default"`).
