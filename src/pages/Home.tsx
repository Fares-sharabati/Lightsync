import { useNavigate } from 'react-router-dom';
import ArenaHologram from '../components/ArenaHologram';
import '../styles/theme.css';

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="page home-page">
      <ArenaHologram />
      <div className="home-content">
        <p className="eyebrow">AUDIENCE LIGHTING PLATFORM</p>
        <h1>LIGHTSYNC</h1>
        <p className="tagline">Synchronize the audience.</p>
        <div className="home-actions">
          <button className="button button-primary" onClick={() => navigate('/admin')}>
            Organizer
          </button>
        </div>
      </div>
    </main>
  );
}
