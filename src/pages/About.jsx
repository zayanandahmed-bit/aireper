import CtaBand from '../components/CtaBand.jsx';

const VALUES = [
  {
    icon: '⚡',
    title: 'Results over hype',
    body: "We measure success in hours saved and leads won, not buzzwords. If an automation won't pay for itself, we'll tell you.",
  },
  {
    icon: '🔒',
    title: 'Your data, protected',
    body: 'Every agent is built with guardrails, access controls, and privacy in mind. Your business data stays yours.',
  },
  {
    icon: '🤝',
    title: 'Partners, not vendors',
    body: 'We stay after launch: monitoring, iterating, and improving your systems as your business grows.',
  },
  {
    icon: '🚀',
    title: 'Ship fast, ship right',
    body: 'Weeks, not months. We deliver working automations quickly, then sharpen them with real-world feedback.',
  },
];

export default function About() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">About us</p>
        <h1>
          We make AI <span className="grad">actually useful</span> for business
        </h1>
        <p className="hero-sub">
          No hype, no jargon: just automations that save real hours and win real customers.
        </p>
      </section>

      <section className="section">
        <div className="about-grid">
          <div>
            <p className="eyebrow">Our story</p>
            <h2>Built by automators, for businesses that want their time back</h2>
            <p>
              AIREPER started with a simple observation: most businesses lose hours every day
              to work a machine should be doing, chasing leads, answering the same questions,
              copying data between tools.
            </p>
            <p>
              We build AI agents that take that work off your plate. Not off-the-shelf
              chatbots, but custom systems designed around how your business actually runs:
              your tools, your customers, your voice.
            </p>
            <p>
              Every project starts with a workflow audit and ends with a system that's live,
              monitored, and improving over time.
            </p>
          </div>
          <div className="about-visual">🤖✨</div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">What we stand for</p>
          <h2>Our values</h2>
        </div>
        <div className="values">
          {VALUES.map((value) => (
            <div className="card" data-tilt key={value.title}>
              <div className="card-icon">{value.icon}</div>
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBand heading="Let's build something together">
        Tell us about your business and we'll show you what AI can take off your plate.
      </CtaBand>
    </main>
  );
}
