import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Marquee from '../components/Marquee.jsx';
import Timeline from '../components/Timeline.jsx';
import Faq from '../components/Faq.jsx';
import CtaBand from '../components/CtaBand.jsx';
import { ReviewsGrid, ReviewsSummary } from '../components/Reviews.jsx';
import { useHeroParallax } from '../hooks/useSiteEffects.js';

const CAPABILITIES = [
  'REVENUE GENERATION AND GROWTH SYSTEM',
  'LEAD QUALIFICATION',
  'CUSTOMER SUPPORT AGENTS',
  'SALES OUTREACH',
  'WORKFLOW AUTOMATION',
  'DATA PIPELINES',
  'VOICE AGENTS',
];

const INTEGRATIONS = [
  'GMAIL',
  'HUBSPOT',
  'SALESFORCE',
  'WHATSAPP',
  'SLACK',
  'NOTION',
  'STRIPE',
  'CALENDLY',
  'GOOGLE SHEETS',
];

const WHAT_WE_BUILD = [
  {
    icon: '◆',
    title: 'Custom AI Agents',
    body: 'Purpose-built agents that handle sales, support, scheduling, or research, trained on your data, your tone, your rules. They plug into the tools you already use and start working from day one.',
  },
  {
    icon: '▲',
    title: 'Workflow Automation',
    body: 'We connect your CRM, inbox, calendar, and spreadsheets into automations that eliminate repetitive manual work: lead routing, quote generation, data syncing, all hands-free.',
  },
  {
    icon: '●',
    title: 'Voice & Chat Agents',
    body: '24/7 AI receptionists and support bots that answer calls, qualify leads, and book appointments while you sleep, on your website, your phone line, WhatsApp, and SMS.',
  },
  {
    icon: '■',
    title: 'Internal Ops Copilots',
    body: 'Internal tools that summarize, report, and act on your business data automatically: daily reports, inbox triage, and dashboards that update and explain themselves.',
  },
];

const WHY_US = [
  {
    icon: '⚡',
    title: 'Fast delivery',
    body: 'Most agents go live in under 5 working business days. You see working demos as we build, not a big reveal at the end.',
  },
  {
    icon: '🎯',
    title: 'Results-first',
    body: "We measure success in hours saved and revenue generated. If an automation won't pay for itself, we'll tell you upfront.",
  },
  {
    icon: '🔒',
    title: 'Safe & controlled',
    body: 'Every agent ships with guardrails, approvals, and access controls.',
  },
  {
    icon: '🤝',
    title: 'Ongoing support',
    body: "We monitor, maintain, and improve your systems after launch, so you're never left with a black box.",
  },
];

const FAQS = [
  {
    q: 'How long does it take to build an AI agent?',
    a: "Most projects go from first call to deployed agent in under 5 working business days, depending on how many tools we're integrating. You'll see working demos as we build, not just at the end.",
  },
  {
    q: 'Do I need technical knowledge to use it?',
    a: 'No, we build everything, connect it to the tools you already use, and hand it over working. You just watch the results come in.',
  },
  {
    q: 'What tools can you integrate with?',
    a: 'Pretty much anything with an API: Gmail, Outlook, HubSpot, Salesforce, Notion, Slack, WhatsApp, Google Sheets, Stripe, Calendly, and hundreds more.',
  },
  {
    q: 'What does it cost?',
    a: "Every build is custom, so pricing depends on scope. Book a free call and we'll give you a clear quote after the audit. No surprises, no lock-in.",
  },
  {
    q: 'What happens after launch?',
    a: 'We monitor your systems, fix anything that drifts, and keep improving them. Most clients come back to automate two or three more workflows once they see the first one pay off.',
  },
];

export default function Home() {
  const heroRef = useRef(null);
  useHeroParallax(heroRef);

  return (
    <main>
      <section className="hero">
        <div className="hero-content" ref={heroRef}>
          <p className="eyebrow">AI Automation Studio</p>
          <h1>
            We build <span className="grad">custom AI agents</span>
            <br />
            that run your business on autopilot
          </h1>
          <p className="hero-sub">
            From lead follow-up to internal ops, we design, build, and deploy AI automations
            that replace hours of manual work with systems that just run. No templates, no
            hype. Systems built around how your business actually works.
          </p>
          <div className="hero-actions">
            <Link to="/contact" className="btn btn-primary">
              Book a Free Strategy Call
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Explore our services
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <strong>40+</strong>
              <span>Agents deployed</span>
            </div>
            <div>
              <strong>10k+</strong>
              <span>Hours automated / yr</span>
            </div>
            <div>
              <strong>4.9★</strong>
              <span>Google rating</span>
            </div>
            <div>
              <strong>&lt;5 days</strong>
              <span>Idea to launch</span>
            </div>
          </div>
        </div>
        <p className="scroll-hint">scroll · drag to explore</p>
      </section>

      <Marquee items={CAPABILITIES} />

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">What we build</p>
          <h2>AI systems built around your business, not a template</h2>
          <p className="sub">
            Every business loses hours to work a machine should be doing. We find those hours
            and hand them back to you, with systems that work 24/7, never call in sick, and
            get smarter over time.
          </p>
        </div>
        <div className="cards">
          {WHAT_WE_BUILD.map((card) => (
            <div className="card" data-tilt key={card.title}>
              <div className="card-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <Link to="/services" className="card-link">
                Learn more →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <p className="eyebrow">Why us</p>
          <h2>What makes us different</h2>
        </div>
        <div className="cards">
          {WHY_US.map((card) => (
            <div className="card" data-tilt key={card.title}>
              <div className="card-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Marquee items={INTEGRATIONS} />

      <section className="section process">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>From idea to deployed agent in under 5 business days</h2>
          <p className="sub">
            A clear, proven process, so you always know what's happening and what comes next.
          </p>
        </div>
        <Timeline />
      </section>

      <section className="section" id="reviews">
        <div className="section-head">
          <p className="eyebrow">Reviews</p>
          <h2>Businesses love working with us</h2>
          <p className="sub">
            Straight from our Google Business profile: real businesses, real results.
          </p>
        </div>

        <ReviewsSummary>
          <Link to="/reviews" className="btn btn-ghost">
            See all on the Reviews page →
          </Link>
        </ReviewsSummary>

        <ReviewsGrid />
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Questions? Answered.</h2>
        </div>
        <Faq items={FAQS} />
      </section>

      <CtaBand heading="Ready to put your business on autopilot?">
        Book a free 20-minute call. We'll show you exactly where AI can save you the most
        time, and give you a clear plan.
      </CtaBand>
    </main>
  );
}
