import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/about', label: 'About' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="logo" onClick={close}>
          <span>AI</span>REPER
        </Link>
        {/* The open/closed look lives entirely in CSS (.nav-links /
            .nav-links.open) so it can transition smoothly. */}
        <nav className={open ? 'nav-links open' : 'nav-links'}>
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={close}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/contact" className="nav-cta" onClick={close}>
            Book a Call
          </NavLink>
        </nav>
        <button
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
