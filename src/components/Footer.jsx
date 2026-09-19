import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <Link to="/" className="logo">
            <span>AI</span>REPER
          </Link>
          <p className="footer-blurb">
            Custom AI agents &amp; automations for growing businesses. Built around your
            workflows, deployed in under 5 business days.
          </p>
        </div>
        <div>
          <h4>Pages</h4>
          <Link to="/">Home</Link>
          <Link to="/services">Services</Link>
          <Link to="/reviews">Reviews</Link>
          <Link to="/about">About</Link>
        </div>
        <div>
          <h4>Services</h4>
          <Link to="/services">Custom AI Agents</Link>
          <Link to="/services">Workflow Automation</Link>
          <Link to="/services">Voice &amp; Chat Agents</Link>
          <Link to="/services">Ops Copilots</Link>
        </div>
        <div>
          <h4>Get in touch</h4>
          <Link to="/contact">Book a Call</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </div>
      <div className="footer-bottom">
        © 2026 AIREPER. Custom AI agents &amp; automations for growing businesses.
      </div>
    </footer>
  );
}
