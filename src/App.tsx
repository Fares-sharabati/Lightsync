import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Join from './pages/Join';
import EventControl from './pages/EventControl';
import AudienceScreen from './pages/AudienceScreen';
import SportsInteractions from './pages/SportsInteractions';
import SportsScreen from './pages/SportsScreen';
import SportsFan from './pages/SportsFan';
import { watchPublicShow, watchShow, type ShowKind } from './firebase/shows';

const tabStyle = { padding: '9px 14px', border: '1px solid #383c41', borderRadius: 10, background: 'linear-gradient(180deg,#17191c,#0c0d0f)', color: '#dfe2e5', fontFamily: 'Inter,system-ui,sans-serif', fontWeight: 800, letterSpacing: '.04em', cursor: 'pointer' } as const;

function EventTabs() {
  const location = useLocation(); const navigate = useNavigate(); const match = location.pathname.match(/^\/admin\/(?:event|show)\/([^/]+)/); const eventId = match?.[1]; const [kind, setKind] = useState<ShowKind>('show');
  useEffect(() => { if (!eventId) return; return watchShow(eventId, show => setKind(show?.kind ?? 'show')); }, [eventId]);
  if (!eventId) return null;
  const sportsActive = location.pathname.endsWith('/interactions');
  return <nav style={{ position: 'fixed', top: 18, right: 24, zIndex: 50, display: 'flex', gap: 6, padding: 5, border: '1px solid #292c30', borderRadius: 14, background: 'rgba(13,15,17,.94)', backdropFilter: 'blur(12px)' }} aria-label="Event sections">
    <button style={{ ...tabStyle, borderColor: !sportsActive ? '#d9dde2' : '#383c41' }} onClick={() => navigate(`/admin/event/${eventId}`)}>SHOW</button>
    {kind === 'sports' && <button style={{ ...tabStyle, borderColor: sportsActive ? '#d9dde2' : '#383c41' }} onClick={() => navigate(`/admin/event/${eventId}/interactions`)}>SPORTS</button>}
  </nav>;
}

function FanSportsTab() {
  const location = useLocation(); const navigate = useNavigate(); const match = location.pathname.match(/^\/join\/([^/]+)$/); const eventId = match?.[1]; const [kind, setKind] = useState<ShowKind>('show');
  useEffect(() => { if (!eventId) return; return watchPublicShow(eventId, show => setKind(show?.kind ?? 'show')); }, [eventId]);
  if (!eventId || kind !== 'sports') return null;
  return <button onClick={() => navigate(`/join/${eventId}/interactions`)} style={{ position: 'fixed', top: 18, right: 18, zIndex: 50, ...tabStyle }}>SPORTS</button>;
}

export default function App() {
  return <BrowserRouter><EventTabs /><FanSportsTab /><Routes><Route path="/" element={<Home />} /><Route path="/admin" element={<Admin />} /><Route path="/admin/show/:eventId" element={<EventControl />} /><Route path="/admin/event/:eventId" element={<EventControl />} /><Route path="/admin/event/:eventId/interactions" element={<SportsInteractions />} /><Route path="/audience/:eventId" element={<AudienceScreen />} /><Route path="/sports-screen/:eventId" element={<SportsScreen />} /><Route path="/join" element={<Join />} /><Route path="/join/:eventId" element={<Join />} /><Route path="/join/:eventId/interactions" element={<SportsFan />} /></Routes></BrowserRouter>;
}
