import { useEffect, useLayoutEffect } from 'react';

// ---------- shared: batch a high-frequency handler to one call per frame ----------
// mousemove/scroll can fire far more than 60 times a second. Writing to
// style/layout straight from the raw event forces the browser to redo work
// faster than it can actually paint, which is what reads as "not smooth" even
// though each individual change is small. Collapsing to one call per animation
// frame fixes that without changing what anything looks like.
export function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs;
  const wrapped = (...args) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...lastArgs);
    });
  };
  return wrapped;
}

const REVEAL_SELECTOR =
  '.card, .step, .section-head, .review-card, .detail-row, .info-tile, .faq-item';
const TILT_SELECTOR = '[data-tilt], .review-card, .detail-row, .info-tile';

const HIDDEN_TRANSFORM = 'perspective(900px) rotateX(-8deg) translateY(28px)';
const REVEAL_TRANSITION =
  'opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1)';

function reveal(el) {
  el.style.opacity = 1;
  el.style.transform = 'perspective(900px) rotateX(0) translateY(0)';
  // The 0.8s entrance transition would otherwise sit on the element forever as
  // an inline style, making every hover after it feel sluggish (it fights the
  // much snappier hover transition). Once the entrance finishes, hand control
  // back to that.
  el.addEventListener('transitionend', function clearInline(ev) {
    if (ev.propertyName !== 'transform') return;
    el.style.transition = '';
    el.removeEventListener('transitionend', clearInline);
  });
}

// ---------- scroll-reveal for sections ----------
// Entrance has real depth (rotateX + translateY, not just a fade) so content
// settles into place instead of just appearing. Runs in a layout effect so the
// elements are already hidden before the browser's first paint of the page.
export function useScrollReveal(pathname) {
  useLayoutEffect(() => {
    const els = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
    els.forEach((el) => {
      el.style.opacity = 0;
      el.style.transform = HIDDEN_TRANSFORM;
      el.style.transition = REVEAL_TRANSITION;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px 80px 0px' }
    );
    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pathname]);
}

// ---------- 3D tilt + lift on cards ----------
// translateZ alone barely reads as movement on a flat page: scaling the card up
// a touch and pairing it with the CSS hover glow is what actually makes
// hovering feel like something happened.
export function useCardTilt(pathname) {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll(TILT_SELECTOR));
    const teardowns = cards.map((card) => {
      card.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.2,1)';

      const onEnter = () => {
        card.style.transition = 'transform 0.15s ease-out';
      };
      const onMove = rafThrottle((e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotY = (x / rect.width - 0.5) * 10;
        const rotX = (y / rect.height - 0.5) * -10;
        card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-8px) scale(1.03)`;
      });
      const onLeave = () => {
        card.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.2,1)';
        card.style.transform =
          'perspective(700px) rotateX(0) rotateY(0) translateY(0) scale(1)';
      };

      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);

      return () => {
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
      };
    });

    return () => teardowns.forEach((off) => off());
  }, [pathname]);
}

// ---------- hero parallax depth ----------
// The WebGL network already tilts with the mouse; without this the hero text
// doesn't move at all, which makes it feel pasted on top of a 3D scene rather
// than part of it. A few degrees of counter-tilt sells the depth.
export function useHeroParallax(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    el.style.transition = 'transform 0.3s ease-out';
    el.style.transformStyle = 'preserve-3d';

    const onMove = rafThrottle((e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      el.style.transform = `perspective(1200px) rotateY(${nx * 4}deg) rotateX(${ny * -4}deg) translateZ(0)`;
    });

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [ref]);
}
