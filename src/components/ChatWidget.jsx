import { Fragment, useEffect, useRef, useState } from 'react';

// The chat backend (chat-backend/ on Vercel) holds the AI key. Its URL is set
// at build time; without it, or until the backend reports it's ready, the
// bubble simply doesn't appear, so the site never shows a broken chat.
const CHAT_URL = (import.meta.env.VITE_CHAT_URL || '').replace(/\/+$/, '');
const STORE_KEY = 'daysback.chat.v1';
const MAX_KEEP = 24;   // matches the backend's limit; oldest turns are dropped

const GREETING = {
  role: 'assistant',
  content: "Hi! I'm the DaysBack assistant. Tell me a bit about your business and I'll show you where AI could save you time and money.",
};
const SUGGESTIONS = [
  'What could you automate for a dental clinic?',
  'How does the process work?',
  'How much does it cost?',
  'Can it answer my phone calls?',
];

function load() {
  try {
    // Drop an empty reply left behind if the page closed mid-answer.
    const saved = (JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null') || []).filter((m) => m && m.content);
    return saved.length ? saved : [GREETING];
  } catch {
    return [GREETING];
  }
}

// Plain text with line breaks and clickable links. No HTML from the model is
// ever injected into the page.
function Rich({ text }) {
  return text.split('\n').map((line, i, all) => (
    <Fragment key={i}>
      {line.split(/(https?:\/\/[^\s)]+)/g).map((part, j) =>
        /^https?:\/\//.test(part)
          ? <a key={j} href={part} target={part.includes('zayanandahmed-bit.github.io') ? undefined : '_blank'} rel="noopener noreferrer">{part.includes('/contact') ? 'Book a call' : part}</a>
          : <Fragment key={j}>{part.replace(/\*\*/g, '')}</Fragment>
      )}
      {i < all.length - 1 && <br />}
    </Fragment>
  ));
}

export default function ChatWidget() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(load);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!CHAT_URL) return;
    fetch(CHAT_URL + '/api/chat').then((r) => r.json()).then((d) => setReady(!!d.ready)).catch(() => {});
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-MAX_KEEP))); } catch { /* private mode */ }
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current && inputRef.current.focus(), 250); }, [open]);
  useEffect(() => () => abortRef.current && abortRef.current.abort(), []);

  const send = async (text) => {
    const content = (text ?? draft).trim().slice(0, 1500);
    if (!content || busy) return;
    setDraft('');
    setError('');
    const history = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    // The greeting is ours, not the model's, so it isn't sent; the backend
    // needs the conversation to start with the visitor.
    const toSend = history.filter((m) => m !== GREETING && m.content).slice(-MAX_KEEP);
    while (toSend.length && toSend[0].role !== 'user') toSend.shift();

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(CHAT_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: toSend }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Something went wrong. Please try again.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let reply = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += dec.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: reply }]);
      }
      if (!reply.trim()) throw new Error('No reply came back. Please try again.');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(history);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([GREETING]);
    setError('');
    setBusy(false);
  };

  if (!ready) return null;

  const fresh = messages.length === 1;

  return (
    <div className={'chatw' + (open ? ' open' : '')}>
      <div className="chatw-panel" role="dialog" aria-label="Chat with the DaysBack assistant" aria-hidden={!open}>
        <div className="chatw-head">
          <span className="chatw-avatar">D</span>
          <div className="chatw-title">
            <strong>Ask DaysBack</strong>
            <span>AI assistant · replies instantly</span>
          </div>
          <button type="button" className="chatw-icon" onClick={reset} title="Start over" aria-label="Start a new conversation">↺</button>
          <button type="button" className="chatw-icon" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
        </div>

        <div className="chatw-list" ref={listRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={'chatw-msg ' + m.role}>
              {m.content ? <Rich text={m.content} /> : <span className="chatw-dots"><i /><i /><i /></span>}
            </div>
          ))}
          {fresh && (
            <div className="chatw-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}
          {error && <div className="chatw-error">{error}</div>}
        </div>

        <form className="chatw-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={1500}
            placeholder="Ask about your business…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send">➤</button>
        </form>
        <p className="chatw-foot">AI can make mistakes. For anything important, book a call.</p>
      </div>

      <button type="button" className="chatw-launch" onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Chat with us'} aria-expanded={open}>
        {open ? '✕' : <><span className="chatw-launch-icon">💬</span><span className="chatw-launch-text">Ask us anything</span></>}
      </button>
    </div>
  );
}
