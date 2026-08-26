import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="page home-page">
      <div className="home-content">
        <p className="eyebrow">AUDIENCE LIGHTING PLATFORM</p>

        <h1>LIGHTSYNC</h1>

        <p className="tagline">Synchronize the audience.</p>

        <div className="home-actions">
          <button
            className="button button-primary"
            onClick={() => navigate('/admin')}
          >
            Organizer
          </button>

          <button
            className="button button-secondary"
            onClick={() => navigate('/join')}
          >
            Join an Event
          </button>
        </div>
      </div>
    </main>
  );
}
