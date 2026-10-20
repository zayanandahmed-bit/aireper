import { useEffect, useState } from 'react';

const WORD = 'DAYSBACK'.split('');

// How long the letters, bar and hold take before the curtain lifts, and how
// long the lift itself runs before the overlay is removed.
const HOLD_MS = 1450;
const LIFT_MS = 1200;
// Upper bound on waiting for the 3D background. Normally it's ready in a few
// hundred ms; this only matters on a slow device or a stalled download.
const MAX_WAIT_MS = 1200;

// Opening sequence shown once per page load: the wordmark builds letter by
// letter, a gradient bar sweeps under it, then the whole panel lifts away to
// reveal the page. When it lifts it puts .intro-done on <html>, which is what
// releases the staggered hero entrance in styles.css, so the hero animates in
// *as* the curtain clears rather than behind it where nobody sees it.
//
// It starts in a 'wait' phase with the animations paused until the 3D
// background has drawn its first frame: that first frame freezes the main
// thread briefly, and doing it before anything moves is what keeps the
// animation itself stutter-free.
//
// It lives in App, not Home, so moving between pages never replays it.
export default function Intro() {
  const [phase, setPhase] = useState('wait'); // wait -> in -> out -> gone

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      root.classList.add('intro-done');
      setPhase('gone');
      return undefined;
    }

    root.classList.add('intro-running');
    const timers = [];
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      // one more frame so the browser paints the static screen before the
      // animations are unpaused, rather than starting them mid-hitch
      requestAnimationFrame(() => {
        setPhase('in');
        timers.push(
          setTimeout(() => {
            setPhase('out');
            root.classList.add('intro-done');
          }, HOLD_MS),
          setTimeout(() => {
            setPhase('gone');
            root.classList.remove('intro-running');
          }, HOLD_MS + LIFT_MS)
        );
      });
    };

    if (window.__bgReady) start();
    window.addEventListener('bg-ready', start);
    timers.push(setTimeout(start, MAX_WAIT_MS));

    return () => {
      window.removeEventListener('bg-ready', start);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className={`intro intro-${phase}`} aria-hidden="true">
      <div className="intro-mark">
        {WORD.map((ch, i) => (
          <span key={i} className="intro-letter" style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
            {ch}
          </span>
        ))}
        <span className="intro-ai">.SI</span>
      </div>
      <div className="intro-bar" />
    </div>
  );
}
