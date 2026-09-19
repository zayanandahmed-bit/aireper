import { useState } from 'react';

const TILES = [
  { icon: '✉', style: undefined, title: 'Email us', value: 'hello@aireper.example' },
  {
    icon: '☎',
    style: { background: 'linear-gradient(135deg,#ff3d8a,#ffb020)' },
    title: 'Call us',
    value: '+44 0000 000000',
  },
  {
    icon: '⏱',
    style: { background: 'linear-gradient(135deg,#00b8a0,#6c3cff)' },
    title: 'Response time',
    value: 'Within 24 hours, every time',
  },
];

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Get started</p>
        <h1>
          Tell us about <span className="grad">your business</span>
        </h1>
        <p className="hero-sub">
          Book a free 20-minute strategy call: we'll show you exactly where AI can save you
          the most time.
        </p>
      </section>

      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="contact-info">
          {TILES.map((tile) => (
            <div className="info-tile" key={tile.title}>
              <div className="card-icon" style={tile.style}>
                {tile.icon}
              </div>
              <h3>{tile.title}</h3>
              <p>{tile.value}</p>
            </div>
          ))}
        </div>

        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="form-row">
            <input type="text" placeholder="Name" required />
            <input type="email" placeholder="Email" required />
          </div>
          <input type="text" placeholder="Company" />
          <select defaultValue="">
            <option value="" disabled>
              What do you want to automate?
            </option>
            <option>Custom AI Agents</option>
            <option>Workflow Automation</option>
            <option>Voice &amp; Chat Agents</option>
            <option>Internal Ops Copilots</option>
            <option>Not sure yet, help me figure it out</option>
          </select>
          <textarea
            rows="4"
            placeholder="Tell us a bit about your business and what eats up your time..."
          />
          <button type="submit" className="btn btn-primary">
            Send Message
          </button>
          <p className={sent ? 'form-sent show' : 'form-sent'}>
            ✓ Thanks, we'll be in touch within 24 hours.
          </p>
        </form>
      </section>
    </main>
  );
}
