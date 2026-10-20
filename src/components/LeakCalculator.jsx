import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Share of repetitive admin we assume can be handed to automation, and the
// share of missed enquiries that would have turned into a sale. Both are shown
// to the visitor under the result, so the number never pretends to be exact.
const AUTOMATABLE = 0.6;
const CLOSE_RATE = 0.25;
const WORK_DAY_HOURS = 8;

const FIELDS = [
  { key: 'hours', label: 'Hours a week your team spends on repetitive admin', min: 1, max: 80, step: 1, unit: 'hrs' },
  { key: 'rate', label: 'What an hour of that time costs you', min: 10, max: 60, step: 1, unit: '£', prefix: true },
  { key: 'missed', label: 'Enquiries a week you miss or answer too late', min: 0, max: 50, step: 1, unit: '' },
  { key: 'value', label: 'What a new customer is worth to you', min: 20, max: 2000, step: 10, unit: '£', prefix: true },
];

const gbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');

// Eases the displayed number towards the real one, so moving a slider reads
// as the total reacting rather than flickering.
function useEased(target) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 500);
      const v = begin + (target - begin) * (1 - Math.pow(1 - t, 3));
      from.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

export default function LeakCalculator() {
  const [v, setV] = useState({ hours: 15, rate: 15, missed: 5, value: 150 });

  const yearlyAdminCost = v.hours * v.rate * 52 * AUTOMATABLE;
  const yearlyLostSales = v.missed * 52 * CLOSE_RATE * v.value;
  const leak = yearlyAdminCost + yearlyLostSales;
  const daysBack = (v.hours * AUTOMATABLE * 52) / WORK_DAY_HOURS;

  const leakShown = useEased(leak);
  const daysShown = useEased(daysBack);

  return (
    <section className="section" id="calculator">
      <div className="section-head">
        <p className="eyebrow">Find your leak</p>
        <h2>How much is your business losing every year?</h2>
        <p className="sub">Move the sliders. It takes ten seconds and the number is usually bigger than people expect.</p>
      </div>

      <div className="leak">
        <div className="leak-inputs">
          {FIELDS.map((f) => (
            <label className="leak-field" key={f.key}>
              <span className="leak-label">
                {f.label}
                <strong>
                  {f.prefix ? f.unit : ''}
                  {v[f.key].toLocaleString('en-GB')}
                  {!f.prefix && f.unit ? ' ' + f.unit : ''}
                </strong>
              </span>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={v[f.key]}
                style={{ '--fill': ((v[f.key] - f.min) / (f.max - f.min)) * 100 + '%' }}
                onChange={(e) => setV({ ...v, [f.key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>

        <div className="leak-result" aria-live="polite">
          <p className="leak-kicker">Leaking every year</p>
          <p className="leak-big">{gbp(leakShown)}</p>
          <div className="leak-split">
            <div><span>{gbp(yearlyAdminCost)}</span>on admin a machine could do</div>
            <div><span>{gbp(yearlyLostSales)}</span>in sales from missed enquiries</div>
          </div>
          <p className="leak-days">
            That's <strong>{Math.round(daysShown).toLocaleString('en-GB')} working days</strong> a year you could get back.
          </p>
          <Link to="/contact" className="btn btn-primary">Let's Map Your Opportunities</Link>
          <p className="leak-note">
            Estimate only. Assumes about {Math.round(AUTOMATABLE * 100)}% of repetitive admin can be automated and
            that 1 in {Math.round(1 / CLOSE_RATE)} missed enquiries would have bought.
          </p>
        </div>
      </div>
    </section>
  );
}
