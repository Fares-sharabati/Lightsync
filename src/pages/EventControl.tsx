import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { analyzeAudioFile } from '../lightSync/audioAnalyzer';
import { generateLightTimeline, type LightTimeline } from '../lightSync/timeline';
import { watchShow, updateShow, type Show } from '../firebase/shows';
import { watchParticipants, type ParticipantInfo } from '../firebase/participants';

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://lightsync-two.vercel.app').replace(/\/$/, '');

function getAudioMimeType(file: File) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.mp3') || n.endsWith('.mpeg')) return 'audio/mpeg';
  if (n.endsWith('.m4a') || n.endsWith('.mp4')) return 'audio/mp4';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'audio/ogg';
  if (n.endsWith('.webm')) return 'audio/webm';
  if (n.endsWith('.aac')) return 'audio/aac';
  if (n.endsWith('.flac')) return 'audio/flac';
  return file.type || 'audio/mpeg';
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function EventControl() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [event, setEvent] = useState<Show | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [songName, setSongName] = useState('');
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [generatedTimeline, setGeneratedTimeline] = useState<LightTimeline | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [songCurrentTime, setSongCurrentTime] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const stopShowWatch = watchShow(eventId, show => { setEvent(show); setLoaded(true); });
    const stopParticipantsWatch = watchParticipants(eventId, participants => {
      const active = Object.values(participants).filter((p: ParticipantInfo) => p.connected === true);
      setParticipantCount(active.length);
    });
    return () => { stopShowWatch(); stopParticipantsWatch(); };
  }, [eventId]);

  useEffect(() => () => {
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    audioRef.current?.pause();
    if (songUrl) URL.revokeObjectURL(songUrl);
  }, [songUrl]);

  function chooseSong(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    audioRef.current?.pause();
    if (songUrl) URL.revokeObjectURL(songUrl);
    const url = URL.createObjectURL(new Blob([file], { type: getAudioMimeType(file) }));
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 1;
    audio.addEventListener('loadedmetadata', () => setSongDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setSongCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setSongCurrentTime(audio.duration));
    audioRef.current = audio;
    setSongFile(file); setSongName(file.name); setSongUrl(url); setGeneratedTimeline(null); setAnalysisMessage(''); setCountdown(null); setSongCurrentTime(0); setSongDuration(0);
  }

  async function analyzeSong() {
    if (!songFile) return setAnalysisMessage('Please select an audio file first.');
    setAnalyzing(true); setAnalysisMessage('Analyzing music...');
    try { const analysis = await analyzeAudioFile(songFile); const timeline = generateLightTimeline(analysis.beats); setGeneratedTimeline(timeline); setAnalysisMessage(`Analysis complete — ${analysis.beats.length} beats detected.`); }
    catch (error) { console.error(error); setGeneratedTimeline(null); setAnalysisMessage('Could not analyze this audio file.'); }
    finally { setAnalyzing(false); }
  }

  async function startShow() {
    if (!eventId || !generatedTimeline || !audioRef.current) { setAnalysisMessage(!generatedTimeline ? 'Analyze the song before starting the show.' : 'Please select the song again.'); return; }
    setStarting(true);
    setAnalysisMessage('');
    try {
      const startTime = Date.now() + 5000;
      audioRef.current.currentTime = 0;
      setSongCurrentTime(0);
      await updateShow(eventId, { status: 'running', showStartTime: startTime, lightTimeline: generatedTimeline });
      setCountdown(5);
      countdownTimerRef.current = window.setInterval(() => setCountdown(current => { if (current === null || current <= 1) { if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; return null; } return current - 1; }), 1000);
      startTimerRef.current = window.setTimeout(async () => { startTimerRef.current = null; try { await audioRef.current?.play(); } catch (error) { console.error(error); setAnalysisMessage('The browser blocked music playback. Click Start Show again.'); } }, Math.max(0, startTime - Date.now()));
    } catch (error) { console.error(error); setCountdown(null); setAnalysisMessage('Could not start the show. Check the Firebase rules and organizer account.'); }
    finally { setStarting(false); }
  }

  async function stopShow() {
    if (!eventId) return;
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    startTimerRef.current = null; countdownTimerRef.current = null; setCountdown(null);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setSongCurrentTime(0);
    setAnalysisMessage('Stopping show...');
    try {
      await updateShow(eventId, { status: 'waiting', showStartTime: null });
      setAnalysisMessage('Show stopped. Ready for another start.');
    } catch (error) {
      console.error(error);
      setAnalysisMessage('Could not stop the show. Check the Firebase rules and organizer account.');
    }
  }

  if (!loaded) return <main className="page"><div className="card" style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>Loading show...</div></main>;
  if (!event || !eventId) return <main className="page"><div className="card" style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}><h2>Show not found</h2><button className="button button-secondary" onClick={() => navigate('/admin')}>Back to Dashboard</button></div></main>;

  const running = event.status === 'running';
  const joinUrl = `${PUBLIC_APP_URL}/join/${eventId}`;
  const startDisabled = starting || running || !songFile || !generatedTimeline;
  const stopDisabled = starting || (!running && countdown === null);

  return (
    <main className="page">
      <header className="page-header"><div><p className="eyebrow">LIGHTSYNC EVENT</p><h1>{event.name}</h1><p className="event-id">Show ID: {eventId}</p><p className="muted">{event.venue} · {event.date}</p></div><button type="button" className="button button-secondary" onClick={() => navigate('/admin')}>Back</button></header>
      <section className="event-control-grid">
        <div className="card qr-card"><p className="eyebrow">JOIN THE SHOW</p><h2>Scan to Join</h2><div className="qr-wrapper"><QRCodeSVG value={joinUrl} size={280} bgColor="#fff" fgColor="#000" level="H" /></div><p className="qr-instruction">Scan this QR code with your phone.</p></div>
        <div className="card control-card"><p className="eyebrow">AUDIENCE</p><div className="connected-number">{participantCount}</div><p className="connected-label">Connected Phones</p><hr /><p className="eyebrow">MUSIC</p><input type="file" accept="audio/*,.mp3,.mpeg,.m4a,.wav,.ogg,.webm,.aac,.flac" onChange={chooseSong} />{songName && <p className="song-selected">✓ {songName}</p>}{songUrl && <audio controls preload="metadata" src={songUrl} style={{ width: '100%', marginTop: 12 }} />}<div className="song-progress" aria-label="Song progress" style={{ marginTop: 10 }}><div style={{ height: 4, background: '#222', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${songDuration > 0 ? Math.min(100, (songCurrentTime / songDuration) * 100) : 0}%`, background: 'var(--accent, #fff)', transition: 'width .15s linear' }} /></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#888' }}><span>{formatTime(songCurrentTime)}</span><span>{formatTime(songDuration)}</span></div></div><button type="button" className="button button-secondary" onClick={analyzeSong} disabled={!songFile || analyzing}>{analyzing ? 'Analyzing...' : 'Analyze Song'}</button>{analysisMessage && <p className="muted">{analysisMessage}</p>}{generatedTimeline && <p className="song-selected">✓ Light timeline ready</p>}<hr /><p className="eyebrow">SHOW CONTROL</p><p className="muted">Music plays locally on the organizer's computer. Phones receive only synchronized light instructions.</p>{countdown !== null && <div className="event-status-large">STARTING IN {countdown}</div>}<div className="control-actions"><button type="button" className="button button-primary control-button" onClick={startShow} disabled={startDisabled}>{starting ? 'Starting...' : 'Start Show'}</button><button type="button" className="button button-secondary control-button" onClick={stopShow} disabled={stopDisabled}>Stop Show</button></div><div className="event-status-large"><span className="status-dot" />{running ? 'SHOW RUNNING' : 'WAITING'}</div></div>
      </section>
    </main>
  );
}
