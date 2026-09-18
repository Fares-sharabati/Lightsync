import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsInteractions, watchSportsResult, watchSportsScreen, type SportsInteraction, type SportsResult, type SportsScreenState } from '../firebase/sports';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';
import '../styles/theme.css';
import { useTranslate } from '../i18n/LanguageContext';

export default function SportsScreen() {
  const { eventId } = useParams();
  const showId = eventId;
  const t = useTranslate();
  const [show, setShow] = useState<PublicShow | null>(null);
  const [game, setGame] = useState<SportsGame | null>(null);
  const [screen, setScreen] = useState<SportsScreenState | null>(null);
  const [interactions, setInteractions] = useState<SportsInteraction[]>([]);
  const [result, setResult] = useState<SportsResult | null>(null);

  useEffect(() => { if (!showId) return; return watchPublicShow(showId, setShow); }, [showId]);
  useEffect(() => { if (!showId) return; return watchSportsGame(showId, setGame); }, [showId]);
  useEffect(() => { if (!showId) return; return watchSportsScreen(showId, setScreen); }, [showId]);
  useEffect(() => { if (!showId) return; return watchSportsInteractions(showId, setInteractions); }, [showId]);

  const activeInteractionId = screen?.activeInteractionId ?? null;
  const interaction = (activeInteractionId ? interactions.find(item => item.id === activeInteractionId) : null) ?? interactions.find(item => item.status === 'open') ?? null;
  const resultInteractionId = interaction?.id ?? null;

  useEffect(() => {
    if (!showId || !resultInteractionId) { setResult(null); return; }
    return watchSportsResult(showId, resultInteractionId, setResult);
  }, [showId, resultInteractionId]);

  const options = Object.entries(interaction?.options ?? {});
  const total = result?.total ?? 0;
  // Live sports screens are monochrome by default. Team colors are the only
  // intentional accents and are supplied by the configured game data.
  const homeColor = show?.screenLightColor || game?.homeTeam.primaryColor || '#FFFFFF';
  const awayColor = game?.awayTeam.primaryColor || homeColor;
  const screenStyle = { '--ls-screen-accent': homeColor, '--ls-screen-accent-2': awayColor } as CSSProperties;
  const displayMode = interaction ? (screen?.displayMode === 'question' || interaction.type === 'question' ? 'question' : 'results') : 'idle';

  return <main className="audience-screen ls-audience-show-screen" style={screenStyle}>
    <div className="audience-vignette" /><div className="ls-audience-color-wash" />
    <section className="audience-content ls-audience-show-content ls-sports-show-content">
      <header className="ls-audience-show-header"><div className="audience-brand">FANCOURT360</div><div className="ls-audience-live"><span /> {show?.name ?? t({ tr: 'CANLI SPOR', en: 'LIVE SPORTS' })}</div></header>
      <div className="ls-sports-title-block"><p className="audience-eyebrow">{game?.sport?.toUpperCase() || t({ tr: 'CANLI SPOR', en: 'LIVE SPORTS' })}</p>{game && <div className="ls-audience-teams"><span style={{ '--team-color': game.homeTeam.primaryColor || homeColor } as CSSProperties}>{game.homeTeam.name}</span><b>VS</b><span style={{ '--team-color': game.awayTeam.primaryColor || awayColor } as CSSProperties}>{game.awayTeam.name}</span></div>}</div>
      {displayMode === 'idle' ? <div className="ls-sports-state-card"><div className="ls-sports-state-number">01</div><p className="audience-eyebrow">{t({ tr: 'HAZIR OLUN', en: 'GET READY' })}</p><h1>{t({ tr: 'BİRAZDAN BAŞLIYOR', en: 'GET READY' })}</h1><p className="audience-instruction">{t({ tr: 'Bir sonraki etkileşim burada görünecek.', en: 'The next audience interaction will appear here.' })}</p></div> : <div className="ls-sports-interaction-card"><div className="ls-sports-state-number">02</div><p className="audience-eyebrow">{displayMode === 'question' ? t({ tr: 'SORU', en: 'QUESTION' }) : t({ tr: 'SONUÇLAR', en: 'RESULTS' })}</p><h1>{interaction?.question}</h1>{displayMode === 'question' ? <div className="ls-sports-answer-prompt">{t({ tr: 'TELEFONUNUZDAN CEVAPLAYIN', en: 'ANSWER ON YOUR PHONE' })}</div> : <div className="ls-sports-results">{options.map(([id, label]) => { const count = result?.counts?.[id] ?? 0; const pct = total ? Math.round(count / total * 100) : 0; return <div key={id} className="ls-sports-result-row"><div><span>{label}</span><b>{pct}%</b></div><div className="ls-sports-result-track"><i style={{ width: `${pct}%`, background: homeColor }} /></div></div>})}<div className="ls-sports-total">{t({ tr: `${total} YANIT`, en: `${total} RESPONSES` })}</div></div>}</div>}
      <footer className="ls-audience-footer"><span>{t({ tr: 'TELEFONUNUZDAN KATILIN', en: 'JOIN FROM YOUR PHONE' })}</span><span className="ls-audience-footer-line" /><span>FANCOURT360</span></footer>
    </section>
  </main>;
}