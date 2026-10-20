import { useEffect, useRef, useState } from 'react';

// Scripted example calls, labelled on screen as examples. With sound on, the
// browser's built-in speech voices read the lines, so what you hear depends on
// the visitor's device; with sound off the transcript plays on its own timing.
const CALLS = [
  {
    id: 'physio',
    tab: 'After-hours booking',
    business: 'Riverside Physio',
    lines: [
      { who: 'ai', text: 'Good evening, Riverside Physio. How can I help?' },
      { who: 'caller', text: "Hi, I've hurt my back. Can I get in tomorrow?" },
      { who: 'ai', text: "I'm sorry to hear that. I have nine forty or two fifteen tomorrow with Emma. Which is better?" },
      { who: 'caller', text: 'Nine forty please.' },
      { who: 'ai', text: "Lovely, you're booked for nine forty tomorrow. I'll text you the address and a reminder." },
    ],
    after: ['Booked into the calendar', 'Confirmation text sent', 'Call notes saved to the patient record'],
  },
  {
    id: 'lead',
    tab: 'Qualifying a lead',
    business: 'Northside Kitchens',
    lines: [
      { who: 'ai', text: 'Thanks for calling Northside Kitchens. Are you looking for a new kitchen or a repair?' },
      { who: 'caller', text: "A new kitchen. We're renovating in the spring." },
      { who: 'ai', text: 'Great. Roughly what budget do you have in mind, and what postcode is the property?' },
      { who: 'caller', text: 'Around fifteen thousand, and it is L18.' },
      { who: 'ai', text: "Perfect, that's in our area. I've booked a free design visit for Saturday at ten. Our designer Tom will see you then." },
    ],
    after: ['Lead scored as hot', 'Design visit booked', 'Sales team alerted on WhatsApp'],
  },
];

const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function pickVoices() {
  const all = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
  const en = all.filter((v) => /^en/i.test(v.lang));
  const gb = en.filter((v) => /GB/i.test(v.lang));
  const pool = gb.length >= 2 ? gb : en.length >= 2 ? en : all;
  return { ai: pool[0] || null, caller: pool[1] || pool[0] || null };
}

export default function VoiceDemo() {
  const [active, setActive] = useState(0);
  const [line, setLine] = useState(-1);       // index of the line being spoken; -1 = not started
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [secs, setSecs] = useState(0);
  const token = useRef(0);                     // bumps on every start/stop so stale callbacks do nothing
  const listRef = useRef(null);

  const call = CALLS[active];
  const finished = !playing && line >= call.lines.length;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = () => {
    token.current += 1;
    if (canSpeak) window.speechSynthesis.cancel();
    setPlaying(false);
  };

  useEffect(() => () => stop(), []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Call timer while a call is running.
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [line]);

  const start = () => {
    stop();
    const my = ++token.current;
    setSecs(0);
    setLine(-1);
    setPlaying(true);
    const voices = canSpeak ? pickVoices() : {};

    const say = (i) => {
      if (token.current !== my) return;
      if (i >= call.lines.length) { setLine(i); setPlaying(false); return; }
      setLine(i);
      const l = call.lines[i];
      let moved = false;
      const next = () => {
        if (moved) return;
        moved = true;
        setTimeout(() => say(i + 1), 450);
      };
      if (sound && canSpeak) {
        const u = new SpeechSynthesisUtterance(l.text);
        u.voice = voices[l.who] || null;
        u.rate = 1.02;
        u.pitch = l.who === 'ai' ? 1.05 : 0.9;
        u.onend = next;
        u.onerror = next;
        window.speechSynthesis.speak(u);
        // Some devices have speech but no voice installed and never fire
        // onend. Don't let the demo hang there: move on after a generous wait.
        setTimeout(next, 2500 + l.text.length * 110);
      } else {
        setTimeout(next, 900 + l.text.length * 45);
      }
    };
    setTimeout(() => say(0), 700);   // a beat of "ringing" before the pickup
  };

  const choose = (i) => { stop(); setActive(i); setLine(-1); setSecs(0); };

  return (
    <section className="section" id="voice">
      <div className="section-head">
        <p className="eyebrow">Voice agents</p>
        <h2>It answers the phone too</h2>
        <p className="sub">Every call picked up, day or night, in a natural voice. Press play and listen.</p>
      </div>

      <div className="voice">
        <div className="demo-tabs" role="tablist" aria-label="Example calls">
          {CALLS.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={i === active}
              className={i === active ? 'demo-tab active' : 'demo-tab'} onClick={() => choose(i)}>
              {c.tab}
            </button>
          ))}
        </div>

        <div className={'call' + (playing ? ' is-live' : '')}>
          <div className="call-head">
            <div className="call-avatar"><span>☎</span></div>
            <div className="call-meta">
              <div className="call-biz">{call.business}</div>
              <div className="call-state">
                {playing ? (line < 0 ? 'Ringing…' : 'On call · ' + fmt(secs)) : finished ? 'Call ended · ' + fmt(secs) : 'Example call'}
              </div>
            </div>
            <div className={'wave' + (playing && line >= 0 ? ' on' : '')} aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => <i key={i} style={{ animationDelay: (i % 7) * 0.09 + 's' }} />)}
            </div>
          </div>

          <div className="call-lines" ref={listRef}>
            {line < 0 && <p className="call-empty">Press play to hear the agent take the call.</p>}
            {call.lines.slice(0, Math.max(0, Math.min(line + 1, call.lines.length))).map((l, i) => (
              <div key={call.id + i} className={'call-line ' + l.who + (i === line && playing ? ' speaking' : '')}>
                <span className="call-who">{l.who === 'ai' ? 'AI receptionist' : 'Caller'}</span>
                <p>{l.text}</p>
              </div>
            ))}
            {finished && (
              <div className="call-after">
                <span className="call-who">What happened next, automatically</span>
                <ul>{call.after.map((a) => <li key={a}>✓ {a}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="call-controls">
            {playing
              ? <button type="button" className="btn btn-ghost" onClick={stop}>■ Stop</button>
              : <button type="button" className="btn btn-primary" onClick={start}>{finished ? '↻ Play again' : '▶ Play call'}</button>}
            {canSpeak && (
              <label className="call-sound">
                <input type="checkbox" checked={sound} disabled={playing} onChange={(e) => setSound(e.target.checked)} />
                Sound
              </label>
            )}
          </div>
        </div>
        <p className="voice-note">Example call. On the real thing, the voice is tuned to your business and sounds far more natural than your browser's built-in one.</p>
      </div>
    </section>
  );
}
