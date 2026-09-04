import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';
import ArenaHologram from '../components/ArenaHologram';
import '../styles/theme.css';
import { PUBLIC_APP_URL } from '../constants';

export default function AudienceScreen() {
  const { eventId } = useParams();
  const [show, setShow] = useState<PublicShow | null>(null);
  const [game, setGame] = useState<SportsGame | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const stopShow = watchPublicShow(eventId, value => { setShow(value); setLoaded(true); });
    const stopGame = watchSportsGame(eventId, setGame);
    return () => { stopShow(); stopGame(); };
  }, [eventId]);

  if (!loaded) return <main className="audience-screen"><div className="audience-loading">LIGHTSYNC<br/><span>Loading...</span></div></main>;
  if (!show || !eventId) return <main className="audience-screen"><div className="audience-loading">SHOW NOT FOUND</div></main>;

  const joinUrl = `${PUBLIC_APP_URL}/join/${eventId}`;

  return (
    <main className="audience-screen">
      <ArenaHologram />
      <div className="audience-vignette" />
      <section className="audience-content">
        <div className="audience-brand">LIGHTSYNC</div>
        <p className="audience-eyebrow">AUDIENCE LIGHT SHOW</p>
        <h1>{show.name}</h1>
        {game && <div style={{ margin: '12px auto 20px', fontSize: 22, fontWeight: 900 }}>{game.homeTeam.name} <span style={{ opacity: .5, margin: '0 12px' }}>VS</span> {game.awayTeam.name}</div>}
        <div className="audience-qr-frame">
          <div className="audience-qr-inner">
            <QRCodeSVG value={joinUrl} size={600} bgColor="#ffffff" fgColor="#050505" level="H" includeMargin />
          </div>
        </div>
        <h2>SCAN TO JOIN</h2>
        <p className="audience-instruction">Point your phone camera at the QR code and join the crowd light show.</p>
        <div className="audience-url">{joinUrl.replace(/^https?:\/\//, '')}</div>
      </section>
    </main>
  );
}
