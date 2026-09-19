import CtaBand from '../components/CtaBand.jsx';
import { ReviewsGrid, ReviewsSummary } from '../components/Reviews.jsx';

export default function Reviews() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Client reviews</p>
        <h1>
          What businesses say <span className="grad">about us</span>
        </h1>
        <p className="hero-sub">Straight from our Google Business profile.</p>
      </section>

      <section className="section" style={{ paddingTop: '2rem' }}>
        <ReviewsSummary />
        <ReviewsGrid />
      </section>

      <CtaBand heading="Want results like these?">
        Book a free 20-minute call and we'll show you what's possible for your business.
      </CtaBand>
    </main>
  );
}
