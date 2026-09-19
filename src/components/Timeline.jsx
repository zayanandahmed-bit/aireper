import { useEffect, useRef } from 'react';
import { rafThrottle } from '../hooks/useSiteEffects.js';

const STEPS = [
  {
    num: '01',
    title: 'Audit',
    desc: 'We map your current workflows in a free strategy call and find where AI removes the most manual hours, then give you a clear plan and quote.',
  },
  {
    num: '02',
    title: 'Design',
    desc: 'We architect the agent: logic, integrations, guardrails, and fallbacks, before writing a line of code, so there are no surprises later.',
  },
  {
    num: '03',
    title: 'Build',
    desc: 'Your automation gets built and tested against real scenarios, then connected to your live tools and data with weekly demo check-ins.',
  },
  {
    num: '04',
    title: 'Deploy & Scale',
    desc: "We launch, monitor performance, and iterate, so your systems keep getting sharper, and we're on hand whenever you want to automate more.",
  },
];

// Separate from the generic reveal system: a timeline step needs its own
// "in-view" state (dot lights up, desc/title slide in from opposite sides)
// rather than a single opacity/transform pair, and the connecting line fills in
// as you scroll past it.
export default function Timeline() {
  const timelineRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const timeline = timelineRef.current;
    const progress = progressRef.current;
    if (!timeline || !progress) return undefined;

    // threshold: 0.4 would mean "40% of the step's own area is on screen":
    // for a step this tall that happens while it's still well below centre, so
    // the words would arrive before you'd actually scrolled to them. Shrinking
    // the observer's root to a thin band around the vertical middle of the
    // screen means it only fires once the step is genuinely there to be read.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
    );
    timeline.querySelectorAll('.timeline-step').forEach((step) => observer.observe(step));

    const update = () => {
      const rect = timeline.getBoundingClientRect();
      const viewportMid = window.innerHeight * 0.55;
      const pct = (viewportMid - rect.top) / rect.height;
      progress.style.height = `${Math.max(0, Math.min(1, pct)) * 100}%`;
    };
    const onScroll = rafThrottle(update);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className="timeline" ref={timelineRef}>
      <div className="timeline-track">
        <div className="timeline-progress" ref={progressRef} />
      </div>

      {STEPS.map((step) => (
        <div className="timeline-step" key={step.num}>
          <div className="timeline-desc">
            <p>{step.desc}</p>
          </div>
          <div className="timeline-dot">
            <span>{step.num}</span>
          </div>
          <div className="timeline-title">
            <h3>{step.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
