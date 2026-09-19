import { Link } from 'react-router-dom';

export default function CtaBand({ heading, children }) {
  return (
    <section className="section">
      <div className="cta-band">
        <h2>{heading}</h2>
        <p>{children}</p>
        <Link to="/contact" className="btn btn-primary btn-lg">
          Book a Free Strategy Call
        </Link>
      </div>
    </section>
  );
}
