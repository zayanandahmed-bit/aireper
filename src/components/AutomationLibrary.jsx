import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Automations most small businesses recognise straight away. "Why it's hard"
// is the honest reason people don't build these themselves: it's never one
// tool, it's several talking to each other plus the awkward edge cases.
const AUTOMATIONS = [
  {
    id: 'missed', cat: 'Customers', icon: '📞', title: 'Missed call → booked appointment',
    steps: ['A call goes unanswered', 'Customer gets a text within 10 seconds', 'AI chats and finds a slot', 'Booked into your calendar'],
    saves: 'Recovers enquiries that would have rung a competitor',
    hard: 'Phone system, SMS, an AI that understands replies, and live calendar availability all have to line up.',
  },
  {
    id: 'lead', cat: 'Sales', icon: '⚡', title: 'Instant lead follow-up',
    steps: ['Form, ad or email enquiry arrives', 'AI asks qualifying questions', 'Scores and adds them to your CRM', 'Hot leads alert you on WhatsApp'],
    saves: 'Replies in under a minute instead of hours',
    hard: 'Every lead source sends data differently, and the AI has to know your services and when to hand over.',
  },
  {
    id: 'invoice', cat: 'Money', icon: '💷', title: 'Invoice chasing on autopilot',
    steps: ['Invoice goes overdue', 'Polite reminder with a payment link', 'Firmer follow-ups on a schedule', 'Marked paid when the money lands'],
    saves: 'Gets you paid faster without awkward chasing',
    hard: 'Needs your accounting software, payments and messaging connected, and must stop the instant they pay.',
  },
  {
    id: 'reviews', cat: 'Customers', icon: '⭐', title: 'Review engine',
    steps: ['Job marked complete', 'Customer asked how it went', 'Every customer gets your review link', 'Any unhappy reply flagged to you'],
    saves: 'More Google reviews, and problems caught early',
    hard: 'Timing, wording and Google’s review rules all matter, and it has to work from your job system.',
  },
  {
    id: 'quote', cat: 'Sales', icon: '📝', title: 'Quotes in minutes',
    steps: ['Enquiry comes in with details or photos', 'AI drafts a quote from your price list', 'You approve with one tap', 'Sent, then followed up if unanswered'],
    saves: 'Quotes out the same day, not next week',
    hard: 'The AI has to learn your pricing rules and exceptions, and stay inside them.',
  },
  {
    id: 'noshow', cat: 'Customers', icon: '📅', title: 'No-show killer',
    steps: ['Reminder the day before', 'Customer confirms or reschedules by reply', 'Freed slots offered to a waitlist', 'Diary stays full'],
    saves: 'Fewer empty slots, less time on the phone',
    hard: 'Two-way messaging tied to live bookings, with a waitlist that fills gaps automatically.',
  },
  {
    id: 'brief', cat: 'Admin', icon: '📊', title: 'Morning business briefing',
    steps: ['Pulls sales, bookings and cash overnight', 'AI spots what changed and why', 'Flags anything that needs you', 'Summary on WhatsApp at 8am'],
    saves: 'No more logging into five dashboards',
    hard: 'Data from several systems, cleaned and combined, then explained in plain English.',
  },
  {
    id: 'inbox', cat: 'Admin', icon: '📥', title: 'Inbox that sorts itself',
    steps: ['Every email read as it arrives', 'Sorted: urgent, sales, admin, junk', 'Routine replies drafted for you', 'Only what matters reaches you'],
    saves: 'Hours a week back from email',
    hard: 'It has to understand context, not just keywords, and never send something you didn’t approve.',
  },
  {
    id: 'onboard', cat: 'Admin', icon: '🤝', title: 'New customer onboarding',
    steps: ['Deal marked won', 'Contract and invoice sent automatically', 'Welcome pack and forms delivered', 'Kick-off booked, team notified'],
    saves: 'A professional start without the copy-paste',
    hard: 'Touches your CRM, e-signature, invoicing and calendar in the right order, every time.',
  },
];

const CATS = ['All', 'Sales', 'Customers', 'Money', 'Admin'];

export default function AutomationLibrary() {
  const [cat, setCat] = useState('All');
  const [openId, setOpenId] = useState(AUTOMATIONS[0].id);
  const [step, setStep] = useState(0);
  const detailRef = useRef(null);

  // On a phone the detail card sits above the list, so bring it into view
  // when someone taps an automation further down.
  const pick = (id) => {
    setOpenId(id);
    if (window.innerWidth < 900 && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const list = AUTOMATIONS.filter((a) => cat === 'All' || a.cat === cat);
  const open = AUTOMATIONS.find((a) => a.id === openId) || list[0];

  // Walk through the selected flow one step at a time, then loop.
  useEffect(() => {
    setStep(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStep(3); return undefined; }
    const id = setInterval(() => setStep((s) => (s + 1) % 5), 1100);
    return () => clearInterval(id);
  }, [openId]);

  return (
    <section className="section" id="automations">
      <div className="section-head">
        <p className="eyebrow">Automations we build</p>
        <h2>Ideas you'll recognise from your own business</h2>
        <p className="sub">Simple to describe, fiddly to build. That's where we come in. Tap one to see how it works.</p>
      </div>

      <div className="lib-filters" role="tablist" aria-label="Filter automations">
        {CATS.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={c === cat}
            className={c === cat ? 'demo-tab active' : 'demo-tab'}
            onClick={() => {
              setCat(c);
              const first = AUTOMATIONS.find((a) => c === 'All' || a.cat === c);
              if (first) setOpenId(first.id);
            }}>
            {c}
          </button>
        ))}
      </div>

      <div className="lib">
        <div className="lib-list">
          {list.map((a) => (
            <button key={a.id} type="button" className={'lib-item' + (a.id === open.id ? ' active' : '')}
              onClick={() => pick(a.id)} aria-pressed={a.id === open.id}>
              <span className="lib-icon">{a.icon}</span>
              <span className="lib-title">{a.title}</span>
              <span className="lib-cat">{a.cat}</span>
            </button>
          ))}
        </div>

        <div className="lib-detail" key={open.id} ref={detailRef}>
          <div className="lib-detail-head">
            <span className="lib-icon big">{open.icon}</span>
            <h3>{open.title}</h3>
          </div>
          <ol className="flow">
            {open.steps.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
                <span className="flow-dot">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="lib-facts">
            <div><span>What you get</span>{open.saves}</div>
            <div><span>Why it's hard to DIY</span>{open.hard}</div>
          </div>
          <Link to="/contact" className="btn btn-primary">Build this for my business</Link>
        </div>
      </div>
    </section>
  );
}
