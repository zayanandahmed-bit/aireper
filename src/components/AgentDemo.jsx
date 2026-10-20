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

// How far you scroll for each new message. Big enough that a trackpad flick
// doesn't skip several at once, small enough that a phone swipe moves it on.
const stepPx = () => Math.max(120, Math.round(window.innerHeight * 0.15));

// The demo pins to the screen while you scroll through it: each bit of scroll
// reveals the next message, so nobody passes it without seeing the agent work.
// The wrapper is made tall enough for every message to get its own step; the
// phone inside it is position: sticky.
export default function AgentDemo() {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(1);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(220);
  const trackRef = useRef(null);
  const listRef = useRef(null);

  const chat = SCENARIOS[active].chat;
  const still = reducedMotion();

  useEffect(() => {
    if (still) { setShown(chat.length); setTyping(false); return undefined; }
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = trackRef.current;
      if (!el) return;
      const s = stepPx();
      setStep(s);
      const rect = el.getBoundingClientRect();
      // How far past the pin point the visitor has scrolled, in messages.
      const pinTop = parseFloat(getComputedStyle(el.firstElementChild).top) || 0;
      const progress = Math.max(0, (pinTop - rect.top) / s);
      const n = Math.min(chat.length, 1 + Math.floor(progress));
      setShown(n);
      // Part-way to the next agent reply, show it typing.
      setTyping(n < chat.length && chat[n].from === 'bot' && progress - Math.floor(progress) > 0.3);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [chat, still]);

  // Keep the newest message in view inside the phone, without moving the page.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [shown, typing]);

  const done = shown >= chat.length;

  return (
    <section className="section demo-section" id="demo">
      <div className="section-head">
        <p className="eyebrow">See it work</p>
        <h2>Your customers message. The agent handles it.</h2>
        <p className="sub">Pick a business, then keep scrolling to watch the conversation play out.</p>
      </div>

      <div
        className="demo-track"
        ref={trackRef}
        style={still ? undefined : { height: `calc(100vh - 90px + ${(chat.length - 1) * step}px)` }}
      >
        <div className="demo demo-pin">
          <div className="demo-tabs" role="tablist" aria-label="Example businesses">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={i === active ? 'demo-tab active' : 'demo-tab'}
                onClick={() => setActive(i)}
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
                <div key={active + '-' + i} className={'bubble bubble-' + m.from}>{m.text}</div>
              ))}
              {typing && (
                <div className="bubble bubble-bot bubble-typing" aria-label="typing">
                  <span /><span /><span />
                </div>
              )}
            </div>
            <div className="phone-foot">
              <span className="demo-label">Example conversation</span>
              <span className="demo-progress">
                {done ? 'Done ✓' : <>Scroll <span className="demo-arrow">↓</span> {shown}/{chat.length}</>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
