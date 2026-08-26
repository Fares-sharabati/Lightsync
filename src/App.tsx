import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Admin from './pages/Admin';
import Join from './pages/Join';
import EventControl from './pages/EventControl';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/admin" element={<Admin />} />

        <Route path="/admin/event/:eventId" element={<EventControl />} />

        <Route path="/join" element={<Join />} />
        <Route path="/join/:eventId" element={<Join />} />
      </Routes>
    </BrowserRouter>
  );
}
