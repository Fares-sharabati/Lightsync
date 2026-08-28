import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import ArenaHologram from '../components/ArenaHologram';
import '../styles/theme.css';

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://lightsync-two.vercel.app').replace(/\/$/, '');

export default function AudienceScreen() {
  const { eventId } = useParams();
  const [show, setShow] = useState<PublicShow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    return watchPublicShow(eventId, value => {
      setShow(value);
      setLoaded(true);
    });
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
        <div className="audience-qr-frame">
          <div className="audience-qr-inner">
            <QRCodeSVG value={joinUrl} size={min(520, Math.min(window.innerWidth * 0.55, window.innerHeight * 0.55))} bgColor="#ffffff" fgColor="#050505" level="H" includeMargin />
          </div>
        </div>
        <h2>SCAN TO JOIN</h2>
        <p className="audience-instruction">Point your phone camera at the QR code and join the crowd light show.</p>
        <div className="audience-url">{joinUrl.replace(/^https?:\/\//, '')}</div>
      </section>
    </main>
  );
}

function min(a: number, b: number) { return Math.max(180, Math.floor(Math.min(a, b))); }
