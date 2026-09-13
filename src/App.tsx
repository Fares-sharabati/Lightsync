import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const Mission = lazy(() => import('./pages/Mission'));
const Projects = lazy(() => import('./pages/Projects'));
const Contact = lazy(() => import('./pages/Contact'));
const Admin = lazy(() => import('./pages/Admin'));
const Join = lazy(() => import('./pages/Join'));
const EventControl = lazy(() => import('./pages/EventControl'));
const AudienceScreen = lazy(() => import('./pages/AudienceScreen'));
const SportsScreen = lazy(() => import('./pages/SportsScreen'));

function RouteFallback() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0c', color: '#8b8b8b', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, letterSpacing: '.14em', fontWeight: 800 }}>LOADING...</div>;
}

function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    if (!location.hash) {
      window.scrollTo(0, 0);
      return;
    }

    const scrollToTarget = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);

      if (target) {
        target.scrollIntoView({ behavior: attempts === 0 ? 'auto' : 'smooth', block: 'start' });
        if (timer) clearInterval(timer);
        return;
      }

      attempts += 1;
      if (attempts >= 20 && timer) clearInterval(timer);
    };

    scrollToTarget();
    timer = setInterval(scrollToTarget, 50);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [location.pathname, location.hash]);

  return null;
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0a0a0c', color: '#f4f5fa', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}><div><h1 style={{ margin: '0 0 10px', fontSize: 28 }}>Something went wrong</h1><p style={{ margin: '0 0 20px', color: '#8b8b8b' }}>Please refresh the page and try again.</p><button onClick={this.handleRefresh} style={{ border: 0, borderRadius: 10, padding: '12px 20px', background: '#f4f5fa', color: '#0a0a0c', fontWeight: 800, cursor: 'pointer' }}>Refresh</button></div></div>;
    }

    return this.props.children;
  }
}

export default function App() {
  return <BrowserRouter><ScrollToHash /><RouteErrorBoundary><Suspense fallback={<RouteFallback />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/mission" element={<Mission />} />
    <Route path="/projects" element={<Projects />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/admin" element={<Admin />} />
    <Route path="/admin/show/:eventId" element={<EventControl />} />
    <Route path="/admin/event/:eventId" element={<EventControl />} />
    <Route path="/audience/:eventId" element={<AudienceScreen />} />
    <Route path="/sports-screen/:eventId" element={<SportsScreen />} />
    <Route path="/join" element={<Join />} />
    <Route path="/join/:eventId" element={<Join />} />
  </Routes></Suspense></RouteErrorBoundary></BrowserRouter>;
}
