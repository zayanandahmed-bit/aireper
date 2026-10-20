import { Fragment, useEffect, useRef, useState } from 'react';

// A real AI assistant visitors can talk to, laid out like the chat demo above
// it so it reads as "now try it yourself". The backend is a Supabase Edge
// Function (supabase/functions/daysback-chat) that holds the AI key; its full
// URL is set at build time as VITE_CHAT_URL. Until that backend
// reports it's ready, the phone shows a clear "opening soon" state with a way
// to book a call, never a chat that fails when you type into it.
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

export default function LiveChat() {
  const [ready, setReady] = useState(null);   // null = checking, false = not connected
  const [messages, setMessages] = useState(load);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!CHAT_URL) { setReady(false); return; }
    fetch(CHAT_URL).then((r) => r.json()).then((d) => setReady(!!d.ready)).catch(() => setReady(false));
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-MAX_KEEP))); } catch { /* private mode */ }
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => abortRef.current && abortRef.current.abort(), []);

  const send = async (text) => {
    const content = (text ?? draft).trim().slice(0, 1500);
    if (!content || busy || !ready) return;
    setDraft('');
    setError('');
    const history = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    // The greeting is ours, not the model's, so it isn't sent; the backend
    // needs the conversation to start with the visitor.
    const toSend = history.filter((m) => m.content).slice(-MAX_KEEP);
    while (toSend.length && toSend[0].role !== 'user') toSend.shift();

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(CHAT_URL, {
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

  const fresh = messages.length === 1;
  const live = ready === true;

  return (
    <section className="section" id="talk">
      <div className="section-head">
        <p className="eyebrow">Try it yourself</p>
        <h2>Now talk to ours</h2>
        <p className="sub">This one is real. Tell it about your business and it'll show you what we could automate for you.</p>
      </div>

      <div className="demo">
        <div className="phone phone-live">
          <div className="phone-top">
            <span className="phone-avatar">D</span>
            <div className="phone-top-text">
              <div className="phone-name">DaysBack Assistant</div>
              <div className="phone-status">
                {busy ? 'typing…' : live ? <><span className="live-dot" />online now</> : ready === null ? 'connecting…' : 'opening soon'}
              </div>
            </div>
            {live && !fresh && (
              <button type="button" className="phone-reset" onClick={reset} title="Start over" aria-label="Start a new conversation">↺</button>
            )}
          </div>

          <div className="phone-chat" ref={listRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={'bubble ' + (m.role === 'user' ? 'bubble-them live-user' : 'bubble-bot live-bot')}>
                {m.content ? <Rich text={m.content} /> : <span className="chatw-dots"><i /><i /><i /></span>}
              </div>
            ))}
            {live && fresh && (
              <div className="live-chips">
                {SUGGESTIONS.map((sug) => (
                  <button key={sug} type="button" onClick={() => send(sug)}>{sug}</button>
                ))}
              </div>
            )}
            {ready === false && (
              <div className="bubble bubble-note">
                Our live assistant is opening soon. In the meantime, <a href="/aireper/contact">book a free 20-minute call</a> and we'll answer everything.
              </div>
            )}
            {error && <div className="bubble bubble-note live-error">{error}</div>}
          </div>

          <form className="live-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              rows={1}
              value={draft}
              maxLength={1500}
              disabled={!live}
              placeholder={live ? 'Message…' : 'Opening soon'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button type="submit" disabled={!live || busy || !draft.trim()} aria-label="Send">➤</button>
          </form>
        </div>
        <p className="voice-note">AI can make mistakes. For anything important, book a call.</p>
      </div>
    </section>
  );
}
