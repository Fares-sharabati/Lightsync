import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const Admin = lazy(() => import('./pages/Admin'));
const Join = lazy(() => import('./pages/Join'));
const EventControl = lazy(() => import('./pages/EventControl'));
const AudienceScreen = lazy(() => import('./pages/AudienceScreen'));
const SportsScreen = lazy(() => import('./pages/SportsScreen'));

function RouteFallback() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0c', color: '#8b8b8b', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, letterSpacing: '.14em', fontWeight: 800 }}>LOADING...</div>;
}

export default function App() {
  return <BrowserRouter><Suspense fallback={<RouteFallback />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/admin" element={<Admin />} />
    <Route path="/admin/show/:eventId" element={<EventControl />} />
    <Route path="/admin/event/:eventId" element={<EventControl />} />
    <Route path="/audience/:eventId" element={<AudienceScreen />} />
    <Route path="/sports-screen/:eventId" element={<SportsScreen />} />
    <Route path="/join" element={<Join />} />
    <Route path="/join/:eventId" element={<Join />} />
  </Routes></Suspense></BrowserRouter>;
}
