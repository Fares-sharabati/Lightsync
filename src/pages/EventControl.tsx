import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { analyzeAudioFile } from '../lightSync/audioAnalyzer';
import { generateLightTimeline, type LightTimeline } from '../lightSync/timeline';
import { watchShow, updateShow, type Show } from '../firebase/shows';
import { watchParticipants, type ParticipantInfo } from '../firebase/participants';

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://lightsync-two.vercel.app').replace(/\/$/, '');
const SCREEN_COLORS = [
  { name: 'Navy', value: '#071B3A' },
  { name: 'Blue', value: '#0647FF' },
  { name: 'Cyan', value: '#00CFFF' },
  { name: 'Purple', value: '#6D28D9' },
  { name: 'Red', value: '#E11D48' },
  { name: 'Green', value: '#00A86B' },
  { name: 'Yellow', value: '#FFD400' },
  { name: 'White', value: '#FFFFFF' },
];

function getAudioMimeType(file: File) { const n = file.name.toLowerCase(); if (n.endsWith('.mp3') || n.endsWith('.mpeg')) return 'audio/mpeg'; if (n.endsWith('.m4a') || n.endsWith('.mp4')) return 'audio/mp4'; if (n.endsWith('.wav')) return 'audio/wav'; if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'audio/ogg'; if (n.endsWith('.webm')) return 'audio/webm'; if (n.endsWith('.aac')) return 'audio/aac'; if (n.endsWith('.flac')) return 'audio/flac'; return file.type || 'audio/mpeg'; }
function formatTime(seconds: number) { if (!Number.isFinite(seconds) || seconds < 0) return '0:00'; const total = Math.floor(seconds); return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`; }

export default function EventControl() {
  const navigate = useNavigate(); const { eventId } = useParams();
  const [event, setEvent] = useState<Show | null>(null); const [loaded, setLoaded] = useState(false); const [participantCount, setParticipantCount] = useState(0); const [starting, setStarting] = useState(false);
  const [songName, setSongName] = useState(''); const [songFile, setSongFile] = useState<File | null>(null); const [songUrl, setSongUrl] = useState<string | null>(null); const [analyzing, setAnalyzing] = useState(false); const [analysisMessage, setAnalysisMessage] = useState(''); const [generatedTimeline, setGeneratedTimeline] = useState<LightTimeline | null>(null); const [countdown, setCountdown] = useState<number | null>(null); const [songCurrentTime, setSongCurrentTime] = useState(0); const [songDuration, setSongDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null); const startTimerRef = useRef<number | null>(null); const countdownTimerRef = useRef<number | null>(null);

  useEffect(() => { if (!eventId) return; const stopShowWatch = watchShow(eventId, show => { setEvent(show); setLoaded(true); }); const stopParticipantsWatch = watchParticipants(eventId, participants => { setParticipantCount(Object.values(participants).filter((p: ParticipantInfo) => p.connected === true).length); }); return () => { stopShowWatch(); stopParticipantsWatch(); }; }, [eventId]);
  useEffect(() => () => { if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current); if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current); audioRef.current?.pause(); if (songUrl) URL.revokeObjectURL(songUrl); }, [songUrl]);

  function chooseSong(e: ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; audioRef.current?.pause(); if (songUrl) URL.revokeObjectURL(songUrl); const url = URL.createObjectURL(new Blob([file], { type: getAudioMimeType(file) })); const audio = new Audio(url); audio.preload = 'auto'; audio.volume = 1; audio.addEventListener('loadedmetadata', () => setSongDuration(audio.duration)); audio.addEventListener('timeupdate', () => setSongCurrentTime(audio.currentTime)); audio.addEventListener('ended', () => setSongCurrentTime(audio.duration)); audioRef.current = audio; setSongFile(file); setSongName(file.name); setSongUrl(url); setGeneratedTimeline(null); setAnalysisMessage(''); setCountdown(null); setSongCurrentTime(0); setSongDuration(0); }
  async function analyzeSong() { if (!songFile) return setAnalysisMessage('Please select an audio file first.'); setAnalyzing(true); setAnalysisMessage('Analyzing music...'); try { const analysis = await analyzeAudioFile(songFile); setGeneratedTimeline(generateLightTimeline(analysis.beats)); setAnalysisMessage(`Analysis complete — ${analysis.beats.length} beats detected.`); } catch (error) { console.error(error); setGeneratedTimeline(null); setAnalysisMessage('Could not analyze this audio file.'); } finally { setAnalyzing(false); } }
  async function startShow() { const audio = audioRef.current; if (!eventId || !generatedTimeline || !audio) { setAnalysisMessage(!generatedTimeline ? 'Analyze the song before starting the show.' : 'Please select the song again.'); return; } setStarting(true); setAnalysisMessage(''); if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current); if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current); try { audio.pause(); audio.currentTime = 0; audio.volume = 0; await audio.play(); const startTime = Date.now() + 5000; await updateShow(eventId, { status: 'running', showStartTime: startTime, lightTimeline: generatedTimeline }); setSongCurrentTime(0); setCountdown(5); countdownTimerRef.current = window.setInterval(() => setCountdown(current => { if (current === null || current <= 1) { if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; return null; } return current - 1; }), 1000); const delay = Math.max(0, startTime - Date.now()); startTimerRef.current = window.setTimeout(() => { startTimerRef.current = null; audio.currentTime = 0; audio.volume = 1; setSongCurrentTime(0); }, delay); } catch (error) { console.error('Could not start show:', error); audio.pause(); audio.volume = 1; setCountdown(null); setAnalysisMessage(error instanceof Error && error.name === 'NotAllowedError' ? 'Audio was blocked. Press Play once in the browser audio player, then try Start Show again.' : 'Could not start the show. Check the selected audio file and try again.'); } finally { setStarting(false); } }
  async function stopShow() { if (!eventId) return; if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current); if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current); startTimerRef.current = null; countdownTimerRef.current = null; setCountdown(null); if (audioRef.current) { audioRef.current.pause(); audioRef.current.volume = 1; audioRef.current.currentTime = 0; } setSongCurrentTime(0); setAnalysisMessage('Stopping show...'); try { await updateShow(eventId, { status: 'waiting', showStartTime: null }); setAnalysisMessage('Show stopped. Ready for another start.'); } catch (error) { console.error(error); setAnalysisMessage('Could not stop the show. Check the Firebase rules and organizer account.'); } }
  async function changeScreenColor(color: string) { if (!eventId || color === event?.screenLightColor) return; try { await updateShow(eventId, { screenLightColor: color }); } catch (error) { console.error(error); setAnalysisMessage('Could not change the audience screen color.'); } }

  if (!loaded) return <main className="ls-shell"><div className="ls-card ls-event-loading">Loading show...</div></main>;
  if (!event || !eventId) return <main className="ls-shell"><div className="ls-card ls-event-loading"><h2>Show not found</h2><button className="ls-button ls-secondary" onClick={() => navigate('/admin')}>BACK TO DASHBOARD</button></div></main>;
  const running = event.status === 'running'; const joinUrl = `${PUBLIC_APP_URL}/join/${eventId}`; const startDisabled = starting || running || !songFile || !generatedTimeline; const stopDisabled = starting || (!running && countdown === null); const progress = songDuration > 0 ? Math.min(100, Math.max(0, (songCurrentTime / songDuration) * 100)) : 0; const screenColor = event.screenLightColor || '#071B3A';

  return <main className="ls-shell ls-event-shell">
    <header className="ls-header ls-event-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">EVENT CONTROL</p></div><button type="button" className="ls-button ls-secondary" onClick={() => navigate('/admin')}>BACK TO SHOWS</button></header>
    <section className="ls-event-titlebar"><div><p className="ls-eyebrow">LIVE SHOW</p><h1>{event.name}</h1><p className="ls-muted">{event.venue} · {event.date}</p></div><div className={`ls-live-pill ${running ? 'is-running' : ''}`}><span />{running ? 'SHOW RUNNING' : 'WAITING'}</div></section>
    <section className="ls-show-id-card"><div><span className="ls-eyebrow">SHOW ID</span><strong>{eventId}</strong></div><button type="button" className="ls-copy-id" onClick={() => void navigator.clipboard?.writeText(eventId)}>COPY ID</button></section>

    <section className="ls-event-grid">
      <div className="ls-card ls-qr-card">
        <div className="ls-section-title"><div><p className="ls-eyebrow">AUDIENCE ACCESS</p><h2>Scan to Join</h2></div></div>
        <button type="button" onClick={() => window.open(`/audience/${eventId}`, '_blank', 'noopener,noreferrer')} style={{ width: '100%', cursor: 'pointer', border: 0, background: 'transparent', padding: 0 }} aria-label="Open QR audience screen">
          <div className="ls-qr-frame"><div className="ls-qr-corner" /><QRCodeSVG value={joinUrl} size={270} bgColor="#ffffff" fgColor="#050505" level="H" /></div>
        </button>
        <p className="ls-qr-url">{joinUrl}</p><p className="ls-muted ls-qr-help">Click the QR code to open the full-screen audience display.</p>
        <button type="button" className="ls-button ls-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => window.open(`/audience/${eventId}`, '_blank', 'noopener,noreferrer')}>OPEN AUDIENCE SCREEN ↗</button>
      </div>

      <div className="ls-card ls-audience-card"><p className="ls-eyebrow">LIVE AUDIENCE</p><div className="ls-audience-number">{participantCount}</div><div className="ls-audience-label">CONNECTED PHONES</div><div className="ls-audience-indicator"><span /> Live connection count</div></div>

      <div className="ls-card ls-music-card">
        <div className="ls-section-title"><div><p className="ls-eyebrow">MUSIC & TIMELINE</p><h2>Show soundtrack</h2></div></div>
        <label className="ls-upload"><span>{songFile ? 'CHANGE SONG' : 'SELECT SONG'}</span><input type="file" accept="audio/*,.mp3,.mpeg,.m4a,.wav,.ogg,.webm,.aac,.flac" onChange={chooseSong} /></label>
        {songName && <div className="ls-song-name"><span className="ls-song-icon">♪</span><div><strong>{songName}</strong><small>{generatedTimeline ? 'Light timeline ready' : 'Ready to analyze'}</small></div></div>}
        <div className="ls-song-progress" aria-label="Song progress"><div className="ls-progress-track"><div className="ls-progress-fill" style={{ width: `${progress}%` }} /></div><div className="ls-time-row"><span>{formatTime(songCurrentTime)}</span><span>{formatTime(songDuration)}</span></div></div>
        <button type="button" className="ls-button ls-secondary ls-full-button" onClick={analyzeSong} disabled={!songFile || analyzing}>{analyzing ? 'ANALYZING...' : 'ANALYZE SONG'}</button>
        {analysisMessage && <p className={`ls-analysis-message ${generatedTimeline ? 'is-ready' : ''}`}>{analysisMessage}</p>}{generatedTimeline && <div className="ls-ready-badge">✓ LIGHT TIMELINE READY</div>}
      </div>

      <div className="ls-card ls-control-card">
        <div className="ls-section-title"><div><p className="ls-eyebrow">SHOW CONTROL</p><h2>{countdown !== null ? `Starting in ${countdown}` : running ? 'Show is live' : 'Ready when you are'}</h2></div></div>
        <p className="ls-muted">The soundtrack stays on this computer. Phones receive only synchronized light instructions.</p>
        <div className="ls-control-actions"><button type="button" className="ls-button ls-primary ls-control-main" onClick={startShow} disabled={startDisabled}>{starting ? 'STARTING...' : 'START SHOW'}</button><button type="button" className="ls-button ls-stop" onClick={stopShow} disabled={stopDisabled}>STOP SHOW</button></div>
        <p className="ls-stop-note">STOP SHOW stops the music and ends the synchronized light timeline.</p>
      </div>

      <div className="ls-card" style={{ gridColumn: '1 / -1' }}>
        <div className="ls-section-title"><div><p className="ls-eyebrow">AUDIENCE SCREEN</p><h2>Phone screen light color</h2></div><div style={{ width: 42, height: 42, borderRadius: 12, background: screenColor, border: '2px solid rgba(255,255,255,.35)', boxShadow: `0 0 28px ${screenColor}66` }} aria-label={`Current screen color ${screenColor}`} /></div>
        <p className="ls-muted" style={{ marginTop: 8 }}>Choose the color that appears on audience phone screens when the synchronized light is ON. The physical phone flashlight remains white.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          {SCREEN_COLORS.map(color => { const active = screenColor.toLowerCase() === color.value.toLowerCase(); return <button key={color.value} type="button" onClick={() => void changeScreenColor(color.value)} aria-label={`Set screen color to ${color.name}`} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 999, border: active ? '2px solid var(--accent)' : '1px solid var(--line)', background: active ? 'var(--accent-soft)' : 'transparent', color: 'var(--ink)', cursor: 'pointer', fontWeight: 700 }}><span style={{ width: 20, height: 20, borderRadius: '50%', background: color.value, border: color.value === '#FFFFFF' ? '1px solid #777' : 'none', boxShadow: active ? `0 0 16px ${color.value}88` : 'none' }} />{color.name}{active ? ' ✓' : ''}</button>; })}
        </div>
      </div>
    </section>
  </main>;
}
