import { REVIEWS } from '../data/reviews.js';

export function GoogleWordmark() {
  return (
    <span className="g-logo">
      <span className="g1">G</span>
      <span className="g2">o</span>
      <span className="g3">o</span>
      <span className="g4">g</span>
      <span className="g1">l</span>
      <span className="g2">e</span>
    </span>
  );
}

export function ReviewsSummary({ children }) {
  return (
    <div className="reviews-summary">
      <div className="g-badge">
        <GoogleWordmark />
        <span className="rating-num">4.9</span>
        <span className="stars">★★★★★</span>
        <span className="rating-count">38 reviews</span>
      </div>
      {children}
    </div>
  );
}

export function ReviewsGrid() {
  return (
    <div className="reviews-grid">
      {REVIEWS.map((review) => (
        <div className="review-card" key={review.name}>
          <div className="review-head">
            <div className="avatar" style={{ background: review.color }}>
              {review.initials}
            </div>
            <div className="review-meta">
              <div className="review-name">{review.name}</div>
              <div className="review-date">{review.date}</div>
            </div>
            <span className="review-g g-logo">
              <span className="g1">G</span>
            </span>
          </div>
          <span className="stars">{review.stars}</span>
          <p className="review-text">{review.text}</p>
        </div>
      ))}
    </div>
  );
}
