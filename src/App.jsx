import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Services from './pages/Services.jsx';
import Reviews from './pages/Reviews.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import { useCardTilt, useScrollReveal } from './hooks/useSiteEffects.js';

// Three.js is by far the heaviest thing on the page and it only draws
// decoration. Splitting it out means the text, buttons and layout paint
// immediately and the network animation fades in a moment later, instead of
// everyone waiting on a 600kB download before seeing anything.
const Background = lazy(() => import('./components/Background.jsx'));

const TITLES = {
  '/': 'AIREPER | Custom AI Agents & Automations',
  '/services': 'Services | AIREPER',
  '/reviews': 'Reviews | AIREPER',
  '/about': 'About | AIREPER',
  '/contact': 'Contact | AIREPER',
};

export default function App() {
  const { pathname } = useLocation();

  useScrollReveal(pathname);
  useCardTilt(pathname);

  useEffect(() => {
    document.title = TITLES[pathname] ?? TITLES['/'];
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Suspense fallback={null}>
        <Background />
      </Suspense>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* The site used to be plain .html files, so links already out in the
            world (the WhatsApp share, anything indexed) point at those paths.
            Redirect rather than break them. */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/services.html" element={<Navigate to="/services" replace />} />
        <Route path="/reviews.html" element={<Navigate to="/reviews" replace />} />
        <Route path="/about.html" element={<Navigate to="/about" replace />} />
        <Route path="/contact.html" element={<Navigate to="/contact" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
