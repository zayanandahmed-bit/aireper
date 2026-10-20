import { useEffect, useRef, useState } from 'react';

// Scripted conversations showing what an agent does. They are illustrations,
// labelled as such on screen, not transcripts of real customers.
const SCENARIOS = [
  {
    id: 'clinic',
    tab: 'Dental clinic',
    name: 'Bright Smile Dental',
    chat: [
      { from: 'them', text: 'Hi, do you have anything for a check-up this week? 9:47pm' },
      { from: 'bot', text: "Hi! Yes, we have Thursday at 10:30am or Friday at 2:15pm. Which suits you better?" },
      { from: 'them', text: 'Friday please' },
      { from: 'bot', text: "Done. You're booked for Friday 2:15pm with Dr Patel. Can I take your full name?" },
      { from: 'them', text: 'Sarah Jones' },
      { from: 'bot', text: "Thanks Sarah, confirmed ✅ I'll text you a reminder the day before." },
      { from: 'note', text: 'Booked into the calendar at 9:48pm, while the clinic was closed.' },
    ],
  },
  {
    id: 'trades',
    tab: 'Plumber',
    name: 'Rapid Plumbing Co.',
    chat: [
      { from: 'them', text: 'Boiler stopped working, no hot water. How much for someone to look?' },
      { from: 'bot', text: 'Sorry to hear that! A call-out is £75 and covers the first hour. What postcode are you in?' },
      { from: 'them', text: 'M14 5RT' },
      { from: 'bot', text: "We cover M14. Earliest slot is tomorrow 8–10am. Shall I lock it in?" },
      { from: 'them', text: 'Yes' },
      { from: 'bot', text: "Booked ✅ Your engineer is Dave. He'll call 30 minutes before arriving." },
      { from: 'note', text: 'Quote given, area checked and job booked with no one picking up the phone.' },
    ],
  },
  {
    id: 'salon',
    tab: 'Salon',
    name: 'Luxe Hair Studio',
    chat: [
      { from: 'them', text: 'Can I move my Saturday appointment?' },
      { from: 'bot', text: 'Of course! I can see your cut and colour at 11am on Saturday. Would Sunday 1pm or next Saturday 11am work?' },
      { from: 'them', text: 'Sunday 1pm' },
      { from: 'bot', text: "All moved ✅ Sunday 1pm with Chloe. Your Saturday slot is now free for someone else." },
      { from: 'note', text: 'Rescheduled and the old slot released back for booking automatically.' },
    ],
  },
];

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function AgentDemo() {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [started, setStarted] = useState(false);
  const [run, setRun] = useState(0);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  const chat = SCENARIOS[active].chat;

  // Only start playing once the demo is actually on screen.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); io.disconnect(); } },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Play the conversation one message at a time, with a typing pause before
  // each reply that roughly matches how long it is.
  useEffect(() => {
    if (!started) return undefined;
    if (reducedMotion()) { setShown(chat.length); return undefined; }
    setShown(0);
    setTyping(false);
    const timers = [];
    let t = 500;
    chat.forEach((m, i) => {
      if (m.from === 'bot') {
        timers.push(setTimeout(() => setTyping(true), t));
        t += 700 + Math.min(1400, m.text.length * 18);
      } else {
        t += m.from === 'note' ? 500 : 900;
      }
      timers.push(setTimeout(() => { setTyping(false); setShown(i + 1); }, t));
    });
    return () => timers.forEach(clearTimeout);
  }, [started, active, run, chat]);

  // Keep the newest message in view inside the phone, without moving the page.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [shown, typing]);

  const done = shown >= chat.length;

  return (
    <section className="section" id="demo">
      <div className="section-head">
        <p className="eyebrow">See it work</p>
        <h2>Your customers message. The agent handles it.</h2>
        <p className="sub">Pick a business and watch what happens, any hour of the day.</p>
      </div>

      <div className="demo" ref={boxRef}>
        <div className="demo-tabs" role="tablist" aria-label="Example businesses">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={i === active ? 'demo-tab active' : 'demo-tab'}
              onClick={() => { setActive(i); setStarted(true); setRun((r) => r + 1); }}
            >
              {s.tab}
            </button>
          ))}
        </div>

        <div className="phone">
          <div className="phone-top">
            <span className="phone-avatar">{SCENARIOS[active].name[0]}</span>
            <div>
              <div className="phone-name">{SCENARIOS[active].name}</div>
              <div className="phone-status">{typing ? 'typing…' : 'AI assistant · online 24/7'}</div>
            </div>
          </div>
          <div className="phone-chat" ref={listRef}>
            {chat.slice(0, shown).map((m, i) => (
              <div key={active + '-' + run + '-' + i} className={'bubble bubble-' + m.from}>{m.text}</div>
            ))}
            {typing && (
              <div className="bubble bubble-bot bubble-typing" aria-label="typing">
                <span /><span /><span />
              </div>
            )}
          </div>
          <div className="phone-foot">
            <span className="demo-label">Example conversation</span>
            <button type="button" className="demo-replay" disabled={!done} onClick={() => setRun((r) => r + 1)}>
              ↻ Replay
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
