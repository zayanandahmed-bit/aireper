import { useEffect, useState } from 'react';

const WORD = 'DAYSBACK'.split('');

// Opening sequence shown once per page load: the wordmark builds letter by
// letter, a gradient bar sweeps under it, then the whole panel lifts away to
// reveal the page. When it lifts it puts .intro-done on <html>, which is what
// releases the staggered hero entrance in styles.css — so the hero animates
// in *as* the curtain clears rather than behind it where nobody sees it.
//
// It lives in App, not Home, so moving between pages never replays it.
export default function Intro() {
  const [phase, setPhase] = useState('in'); // in -> out -> gone

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      root.classList.add('intro-done');
      setPhase('gone');
      return undefined;
    }

    root.classList.add('intro-running');
    const lift = setTimeout(() => {
      setPhase('out');
      root.classList.add('intro-done');
    }, 1500);
    const remove = setTimeout(() => {
      setPhase('gone');
      root.classList.remove('intro-running');
    }, 2300);

    return () => {
      clearTimeout(lift);
      clearTimeout(remove);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className={`intro intro-${phase}`} aria-hidden="true">
      <div className="intro-mark">
        {WORD.map((ch, i) => (
          <span key={i} className="intro-letter" style={{ animationDelay: `${0.05 + i * 0.055}s` }}>
            {ch}
          </span>
        ))}
        <span className="intro-ai">.AI</span>
      </div>
      <div className="intro-bar" />
    </div>
  );
}
