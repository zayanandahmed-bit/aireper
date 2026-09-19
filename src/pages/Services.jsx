import Faq from '../components/Faq.jsx';
import CtaBand from '../components/CtaBand.jsx';

const SERVICES = [
  {
    icon: '◆',
    iconStyle: undefined,
    title: 'Custom AI Agents',
    body: 'Purpose-built agents trained on your data, tone, and rules, deployed wherever your work happens.',
    points: [
      'Sales agents that qualify and nurture leads automatically',
      'Research agents that gather and summarize market intel',
      'Scheduling agents that manage calendars end-to-end',
    ],
  },
  {
    icon: '▲',
    iconStyle: { background: 'linear-gradient(135deg,#ff3d8a,#ffb020)' },
    title: 'Workflow Automation',
    body: 'We connect your CRM, inbox, calendar, and spreadsheets into automations that eliminate repetitive work.',
    points: [
      'Automatic lead capture, enrichment, and routing',
      'Invoice, quote, and document generation',
      'Cross-tool syncing so data is never entered twice',
    ],
  },
  {
    icon: '●',
    iconStyle: { background: 'linear-gradient(135deg,#00b8a0,#6c3cff)' },
    title: 'Voice & Chat Agents',
    body: '24/7 AI receptionists and support bots that talk to your customers like your best employee would.',
    points: [
      'Phone agents that answer, qualify, and book appointments',
      'Website chatbots trained on your products and FAQs',
      'WhatsApp & SMS follow-up sequences that convert',
    ],
  },
  {
    icon: '■',
    iconStyle: { background: 'linear-gradient(135deg,#ffb020,#ff3d8a)' },
    title: 'Internal Ops Copilots',
    body: 'Internal tools that act on your business data automatically: reporting, summaries, and alerts without lifting a finger.',
    points: [
      'Daily/weekly performance reports generated automatically',
      'Inbox triage and priority alerts for your team',
      'Data dashboards that update and explain themselves',
    ],
  },
];

const FAQS = [
  {
    q: 'How long does it take to build an AI agent?',
    a: "Most projects go from first call to deployed agent in under 5 working business days, depending on how many tools we're integrating.",
  },
  {
    q: 'Do I need technical knowledge to use it?',
    a: 'No, we build everything, connect it to the tools you already use, and hand it over working. You just watch the results.',
  },
  {
    q: 'What tools can you integrate with?',
    a: 'Pretty much anything with an API: Gmail, Outlook, HubSpot, Salesforce, Notion, Slack, WhatsApp, Google Sheets, Stripe, Calendly, and hundreds more.',
  },
  {
    q: 'What does it cost?',
    a: "Every build is custom, so pricing depends on scope. Book a free call and we'll give you a clear quote after the audit. No surprises.",
  },
];

export default function Services() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Our services</p>
        <h1>
          Everything we can <span className="grad">automate for you</span>
        </h1>
        <p className="hero-sub">
          Every system is custom-built around your workflows, your tools, and your customers.
        </p>
      </section>

      <section className="section">
        <div className="detail-rows">
          {SERVICES.map((service) => (
            <div className="detail-row" key={service.title}>
              <div className="card-icon" style={service.iconStyle}>
                {service.icon}
              </div>
              <div>
                <h3>{service.title}</h3>
                <p>{service.body}</p>
                <ul>
                  {service.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Common questions</h2>
        </div>
        <Faq items={FAQS} />
      </section>

      <CtaBand heading="Not sure which service fits?">
        Book a free audit call: we'll map your workflows and tell you exactly what to automate
        first.
      </CtaBand>
    </main>
  );
}
