import { Fragment } from 'react';

// The CSS scrolls the track by exactly half its width, so the list is rendered
// twice for the loop to be seamless. The spans stay direct children of the
// track: .marquee-track span:nth-child(4n+2) picks out the accent colours, so
// any wrapper element here would break the alternating palette.
export default function Marquee({ items }) {
  return (
    <section className="marquee">
      <div className="marquee-track">
        {[...items, ...items].map((item, i) => (
          <Fragment key={`${item}-${i}`}>
            <span>{item}</span>
            <span>•</span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
