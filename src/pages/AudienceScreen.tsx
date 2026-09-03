import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';
import { watchSportsInteractions, watchSportsResult, watchSportsScreen, type SportsInteraction, type SportsResult, type SportsScreenState } from '../firebase/sports';
import ArenaHologram from '../components/ArenaHologram';
import '../styles/theme.css';

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://lightsync-two.vercel.app').replace(/\/$/, '');

export default function AudienceScreen() {
  const { eventId } = useParams();
  const [show, setShow] = useState<PublicShow | null>(null);
  const [game, setGame] = useState<SportsGame | null>(null);
  const [screen, setScreen] = useState<SportsScreenState | null>(null);
  const [interactions, setInteractions] = useState<SportsInteraction[]>([]);
  const [result, setResult] = useState<SportsResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const stopShow = watchPublicShow(eventId, value => { setShow(value); setLoaded(true); });
    const stopGame = watchSportsGame(eventId, setGame);
    const stopScreen = watchSportsScreen(eventId, setScreen);
    const stopInteractions = watchSportsInteractions(eventId, setInteractions);
    return () => { stopShow(); stopGame(); stopScreen(); stopInteractions(); };
  }, [eventId]);

  const activeInteraction = useMemo(() => {
    if (!screen?.activeInteractionId || screen.displayMode === 'idle') return null;
    return interactions.find(item => item.id === screen.activeInteractionId && item.status === 'open') ?? null;
  }, [screen, interactions]);

  useEffect(() => {
    if (!eventId || !activeInteraction) { setResult(null); return; }
    return watchSportsResult(eventId, activeInteraction.id, setResult);
  }, [eventId, activeInteraction?.id]);

  if (!loaded) return <main className="audience-screen"><div className="audience-loading">LIGHTSYNC<br/><span>Loading...</span></div></main>;
  if (!show || !eventId) return <main className="audience-screen"><div className="audience-loading">SHOW NOT FOUND</div></main>;

  const joinUrl = `${PUBLIC_APP_URL}/join/${eventId}`;
  const isInteraction = Boolean(activeInteraction);
  const isPoll = activeInteraction?.type === 'poll';
  const counts = result?.counts ?? {};
  const total = result?.total ?? 0;

  return (
    <main className="audience-screen">
      <ArenaHologram />
      <div className="audience-vignette" />
      <section className="audience-content">
        <div className="audience-brand">LIGHTSYNC</div>
        <p className="audience-eyebrow">{isInteraction ? (isPoll ? 'LIVE AUDIENCE POLL' : 'LIVE AUDIENCE QUESTION') : 'AUDIENCE LIGHT SHOW'}</p>

        {isInteraction ? (
          <div style={{ width: 'min(1100px, 94vw)', margin: '28px auto 0', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 5rem)', lineHeight: 1.08, margin: '0 auto 36px', maxWidth: 1000 }}>{activeInteraction!.question}</h1>
            {isPoll ? (
              <div style={{ display: 'grid', gap: 20, maxWidth: 950, margin: '0 auto' }}>
                {Object.entries(activeInteraction!.options ?? {}).map(([id, label]) => {
                  const count = counts[id] ?? 0;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={id} style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20, marginBottom: 8, fontSize: 'clamp(1rem, 2vw, 1.45rem)', fontWeight: 900 }}>
                        <span>{label}</span><span>{pct}% <small style={{ opacity: .65 }}>({count})</small></span>
                      </div>
                      <div style={{ height: 24, borderRadius: 999, background: 'rgba(255,255,255,.16)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'currentColor', transition: 'width .35s ease' }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800, opacity: .7 }}>{total} {total === 1 ? 'RESPONSE' : 'RESPONSES'}</div>
              </div>
            ) : (
              <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px 35px', borderRadius: 24, background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.2)', backdropFilter: 'blur(12px)' }}>
                <div style={{ fontSize: 'clamp(1.3rem, 3vw, 2.2rem)', fontWeight: 900, marginBottom: 14 }}>AUDIENCE RESPONSES</div>
                <div style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', fontWeight: 950, lineHeight: 1 }}>{total}</div>
                <div style={{ marginTop: 10, opacity: .7, fontWeight: 800 }}>{total === 1 ? 'RESPONSE' : 'RESPONSES'}</div>
                {result?.answers && Object.values(result.answers).length > 0 && <div style={{ marginTop: 24, display: 'grid', gap: 10, textAlign: 'left', maxHeight: 300, overflow: 'auto' }}>{Object.values(result.answers).slice(-8).map((answer, index) => <div key={`${answer}-${index}`} style={{ padding: '12px 15px', borderRadius: 12, background: 'rgba(255,255,255,.08)', fontWeight: 700 }}>{answer}</div>)}</div>}
              </div>
            )}
            <div style={{ marginTop: 34, fontSize: 16, fontWeight: 800, opacity: .65 }}>SCAN THE QR CODE ON THE JOIN SCREEN TO PARTICIPATE</div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>
    </main>
  );
}
