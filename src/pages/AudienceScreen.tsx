import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';
import ArenaHologram from '../components/ArenaHologram';
import '../styles/theme.css';
import { PUBLIC_APP_URL } from '../constants';
import { useTranslate } from '../i18n/LanguageContext';

export default function AudienceScreen() {
  const { eventId } = useParams();
  const t = useTranslate();
  const [show, setShow] = useState<PublicShow | null>(null);
  const [game, setGame] = useState<SportsGame | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const stopShow = watchPublicShow(eventId, value => { setShow(value); setLoaded(true); });
    const stopGame = watchSportsGame(eventId, setGame);
    return () => { stopShow(); stopGame(); };
  }, [eventId]);

  if (!loaded) return <main className="audience-screen"><div className="audience-loading">LIGHTSYNC<br/><span>{t({ tr: 'Yükleniyor...', en: 'Loading...' })}</span></div></main>;
  if (!show || !eventId) return <main className="audience-screen"><div className="audience-loading">{t({ tr: 'ETKİNLİK BULUNAMADI', en: 'SHOW NOT FOUND' })}</div></main>;

  const joinUrl = `${PUBLIC_APP_URL}/join/${eventId}`;
  const homeColor = game?.homeTeam.primaryColor || '#ff3030';
  const awayColor = game?.awayTeam.primaryColor || homeColor;
  const screenStyle = { '--ls-screen-accent': homeColor, '--ls-screen-accent-2': awayColor } as CSSProperties;

  return (
    <main className="audience-screen ls-audience-show-screen" style={screenStyle}>
      <ArenaHologram />
      <div className="audience-vignette" />
      <div className="ls-audience-color-wash" />
      <section className="audience-content ls-audience-show-content">
        <header className="ls-audience-show-header">
          <div className="audience-brand">LIGHTSYNC</div>
          <div className="ls-audience-live"><span /> LIVE EVENT</div>
        </header>
        <div className="ls-audience-event-meta">
          <p className="audience-eyebrow">{t({ tr: 'IŞIK GÖSTERİSİ', en: 'AUDIENCE LIGHT SHOW' })}</p>
          <h1>{show.name}</h1>
          {game && <div className="ls-audience-teams"><span style={{ '--team-color': game.homeTeam.primaryColor || homeColor } as CSSProperties}>{game.homeTeam.name}</span><b>VS</b><span style={{ '--team-color': game.awayTeam.primaryColor || awayColor } as CSSProperties}>{game.awayTeam.name}</span></div>}
        </div>
        <div className="ls-audience-qr-layout">
          <div className="audience-qr-frame ls-audience-qr-frame">
            <div className="audience-qr-inner"><QRCodeSVG value={joinUrl} size={800} bgColor="#ffffff" fgColor="#050505" level="H" includeMargin /></div>
          </div>
          <div className="ls-audience-join-copy">
            <div className="ls-audience-number">01</div>
            <p className="audience-eyebrow">{t({ tr: 'TELEFONUNUZU HAZIRLAYIN', en: 'GET YOUR PHONE READY' })}</p>
            <h2>{t({ tr: 'TARAMAK İÇİN KAMERAYI AÇIN', en: 'SCAN TO JOIN THE CROWD' })}</h2>
            <p className="audience-instruction">{t({ tr: 'QR kodunu tarayın. Telefonunuz ışık gösterisinin bir parçası olacak.', en: 'Scan the QR code. Your phone will become part of the live light show.' })}</p>
            <div className="ls-audience-join-badge"><span>●</span> {t({ tr: 'KATILIM ÜCRETSİZ', en: 'JOIN FOR FREE' })}</div>
          </div>
        </div>
        <footer className="ls-audience-footer"><span>{t({ tr: 'Telefonunuzun kamerasını QR koduna tutun', en: 'Point your phone camera at the QR code' })}</span><span className="ls-audience-footer-line" /><span>LIGHTSYNC</span></footer>
      </section>
    </main>
  );
}
