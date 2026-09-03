import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsInteractions, watchSportsResult, watchSportsScreen, type SportsInteraction, type SportsResult, type SportsScreenState } from '../firebase/sports';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';

export default function SportsScreen() {
  const { eventId } = useParams();
  const showId = eventId;
  const [show, setShow] = useState<PublicShow | null>(null);
  const [game, setGame] = useState<SportsGame | null>(null);
  const [screen, setScreen] = useState<SportsScreenState | null>(null);
  const [interaction, setInteraction] = useState<SportsInteraction | null>(null);
  const [result, setResult] = useState<SportsResult | null>(null);

  useEffect(() => { if (!showId) return; return watchPublicShow(showId, setShow); }, [showId]);
  useEffect(() => { if (!showId) return; return watchSportsGame(showId, setGame); }, [showId]);
  useEffect(() => { if (!showId) return; return watchSportsScreen(showId, setScreen); }, [showId]);
  useEffect(() => { if (!showId) return; return watchSportsInteractions(showId, items => { const interactionId = screen?.activeInteractionId; setInteraction(interactionId ? items.find(item => item.id === interactionId) ?? null : null); }); }, [showId, screen?.activeInteractionId]);
  useEffect(() => { const interactionId = screen?.activeInteractionId; if (!showId || !interactionId) { setResult(null); return; } return watchSportsResult(showId, interactionId, setResult); }, [showId, screen?.activeInteractionId]);

  const options = Object.entries(interaction?.options ?? {});
  const total = result?.total ?? 0;
  const homeColor = game?.homeTeam.primaryColor || '#FFFFFF';

  return <main className="audience-screen" style={{ background: '#050607' }}>
    <section className="audience-content" style={{ width: 'min(94vw, 1400px)', height: '92dvh' }}>
      <div className="audience-brand">LIGHTSYNC</div>
      <p className="audience-eyebrow">{show?.name ?? 'LIVE SPORTS'}</p>
      {game && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'clamp(14px, 3vw, 36px)', margin: '10px 0 24px', fontWeight: 900 }}><div style={{ borderBottom: `4px solid ${game.homeTeam.primaryColor || '#FFFFFF'}`, paddingBottom: 5 }}>{game.homeTeam.name}</div><span style={{ opacity: .5 }}>VS</span><div style={{ borderBottom: `4px solid ${game.awayTeam.primaryColor || '#FFFFFF'}`, paddingBottom: 5 }}>{game.awayTeam.name}</div></div>}
      {!interaction || screen?.displayMode === 'idle' ? <><h1>GET READY</h1><p className="audience-instruction">The next audience interaction will appear here.</p></> : <><h1 style={{ whiteSpace: 'normal', fontSize: 'clamp(30px, 6vmin, 78px)' }}>{interaction.question}</h1>{screen?.displayMode === 'question' ? <div style={{ marginTop: 28, fontSize: 'clamp(24px, 4vmin, 54px)', fontWeight: 800 }}>ANSWER ON YOUR PHONE</div> : <div style={{ width: 'min(88vw, 1000px)', marginTop: 24 }}>{options.map(([id, label]) => { const count = result?.counts?.[id] ?? 0; const pct = total ? Math.round(count / total * 100) : 0; return <div key={id} style={{ margin: '18px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, fontSize: 'clamp(18px, 3vmin, 38px)', fontWeight: 800 }}><span>{label}</span><span>{pct}%</span></div><div style={{ height: 'clamp(12px, 2vmin, 22px)', background: '#25282d', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}><div style={{ height: '100%', width: `${pct}%`, background: homeColor, transition: 'width .4s ease' }} /></div></div>})}<div style={{ marginTop: 26, color: '#9a9da2', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.12em' }}>{total} RESPONSES</div></div>}</>}
    </section>
  </main>;
}
