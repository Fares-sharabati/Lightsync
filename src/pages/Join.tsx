import { useEffect, useRef, useState } from 'react';
import { onDisconnect, ref, set } from 'firebase/database';
import { useNavigate, useParams } from 'react-router-dom';
import { ensureAnonymousAuth } from '../firebase/auth';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';
import { watchSportsInteractions, submitSportsResponse, type SportsInteraction } from '../firebase/sports';
import { db } from '../firebase/config';
import { recordQrScan } from '../firebase/analytics';
import { getLightStateAtTime, getNextLightEvent, type LightTimeline } from '../lightSync/timeline';

type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean };
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

function detectDevice(): string { const ua = navigator.userAgent; if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone/iPad'; if (/Android/.test(ua)) return 'Android'; if (/Windows Phone/.test(ua)) return 'Windows Phone'; if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'; if (/Windows/.test(ua)) return 'Windows'; if (/Linux/.test(ua)) return 'Linux'; return 'Other'; }
function detectBrowser(): string { const ua = navigator.userAgent; if (/Edg\//.test(ua)) return 'Edge'; if (/OPR\//.test(ua)) return 'Opera'; if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome'; if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'; if (/Firefox\//.test(ua)) return 'Firefox'; return 'Other'; }

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [event, setEvent] = useState<PublicShow | null>(null);
  const [game, setGame] = useState<SportsGame | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<SportsInteraction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [lightState, setLightState] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nextTimerRef = useRef<number | null>(null);
  const currentLightRef = useRef(false);
  const scanRecordedRef = useRef(false);

  useEffect(() => {
    if (!eventId) { setLoaded(true); setError('Invalid show link.'); return; }
    const showId = eventId;
    let cancelled = false;
    let stopShow: (() => void) | undefined;
    let stopGame: (() => void) | undefined;
    let stopInteractions: (() => void) | undefined;
    async function connect() {
      try {
        const user = await ensureAnonymousAuth();
        if (cancelled) return;
        stopShow = watchPublicShow(showId, show => {
          if (cancelled) return;
          setEvent(show); setLoaded(true);
          if (show && !scanRecordedRef.current) { scanRecordedRef.current = true; void recordQrScan(showId, user.uid).catch(console.error); }
          if (!show) setError('Show not found.');
        });
        stopGame = watchSportsGame(showId, setGame);
        // Polls/questions are their own realtime channel. Never depend on show.status.
        stopInteractions = watchSportsInteractions(showId, items => {
          const open = items.find(item => item.status === 'open');
          setActiveInteraction(open ?? null);
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) { setLoaded(true); setError('Could not connect to LightSync. Please refresh.'); }
      }
    }
    void connect();
    return () => { cancelled = true; stopShow?.(); stopGame?.(); stopInteractions?.(); };
  }, [eventId]);

  useEffect(() => { setSelectedOption(''); setAnswer(''); setMessage(''); setSending(false); }, [activeInteraction?.id]);

  function clearNextTimer() { if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
  async function setFlash(enabled: boolean) {
    const track = trackRef.current;
    if (!track || currentLightRef.current === enabled) return;
    try { await track.applyConstraints({ advanced: [{ torch: enabled } as TorchConstraints] }); currentLightRef.current = enabled; setLightState(enabled); }
    catch (err) { console.error(err); setError('Your browser could not control the flashlight.'); }
  }
  function scheduleNextEvent(timeline: LightTimeline, start: number) {
    clearNextTimer();
    const next = getNextLightEvent(timeline, Date.now() - start);
    if (!next) return;
    nextTimerRef.current = window.setTimeout(() => { void setFlash(next.on); scheduleNextEvent(timeline, start); }, Math.max(0, start + next.time - Date.now()));
  }
  function synchronizeShow(start: number, timeline: LightTimeline) { void setFlash(getLightStateAtTime(timeline, Date.now() - start)); scheduleNextEvent(timeline, start); }

  async function joinShow() {
    if (!eventId || !event) return;
    try {
      setError('');
      const user = await ensureAnonymousAuth();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No camera track');
      const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined;
      if (!capabilities?.torch) { stream.getTracks().forEach(t => t.stop()); throw new Error('Torch is not supported'); }
      trackRef.current = track;
      const participantRef = ref(db, `showParticipants/${eventId}/${user.uid}`);
      await set(participantRef, { connected: true, device: detectDevice(), browser: detectBrowser(), joinedAt: Date.now() });
      await onDisconnect(participantRef).update({ connected: false });
      setJoined(true);
      if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message.includes('Torch') ? 'This phone/browser does not allow flashlight control. Try the latest Safari or Chrome.' : 'Please allow camera access so LightSync can control your flashlight.');
    }
  }

  async function submitInteraction() {
    if (!eventId || !activeInteraction || sending) return;
    if (activeInteraction.type === 'poll' && !selectedOption) { setMessage('Choose an answer first.'); return; }
    if (activeInteraction.type === 'question' && !answer.trim()) { setMessage('Enter an answer first.'); return; }
    setSending(true); setMessage('');
    try {
      const uid = (await ensureAnonymousAuth()).uid;
      await submitSportsResponse(eventId, activeInteraction.id, uid, activeInteraction.type === 'poll' ? { optionId: selectedOption } : { answer: answer.trim().slice(0, 200) });
      setMessage('Answer submitted ✓');
    } catch (err) { console.error(err); setMessage('Could not submit your answer. Please try again.'); }
    finally { setSending(false); }
  }

  useEffect(() => {
    if (!joined || !event) return;
    // Only flashlight playback depends on show.status. Interactions stay live at all times.
    if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline);
    else { clearNextTimer(); void setFlash(false); }
  }, [joined, event?.status, event?.showStartTime, event?.lightTimeline]);
  useEffect(() => () => { clearNextTimer(); if (trackRef.current) { void trackRef.current.applyConstraints({ advanced: [{ torch: false } as TorchConstraints] }).catch(() => {}); trackRef.current.stop(); } }, []);

  if (!loaded) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><p>Loading show...</p></div></main>;
  if (!event || !eventId) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><p>{error || 'Show not found.'}</p><button className="button button-secondary" onClick={() => navigate('/')}>Back</button></div></main>;

  const homeColor = game?.homeTeam.primaryColor && /^#[0-9a-fA-F]{6}$/.test(game.homeTeam.primaryColor) ? game.homeTeam.primaryColor : '#2563EB';
  const running = event.status === 'running';
  const uiBackground = `linear-gradient(145deg, ${homeColor} 0%, ${homeColor}CC 38%, #08080c 100%)`;
  const card = { width: '100%', marginTop: 22, padding: 20, borderRadius: 22, background: 'rgba(0,0,0,.30)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(14px)', boxSizing: 'border-box' as const, textAlign: 'left' as const };

  const interactionCard = activeInteraction ? <section style={card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 10px #22c55e' }} /><span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, opacity: .75 }}>{activeInteraction.type === 'poll' ? 'LIVE POLL' : 'LIVE QUESTION'}</span></div>
    <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.25 }}>{activeInteraction.question}</div>
    {activeInteraction.type === 'poll' ? <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>{Object.entries(activeInteraction.options ?? {}).map(([id, label]) => <button key={id} type="button" disabled={sending || message.startsWith('Answer submitted')} onClick={() => { setSelectedOption(id); setMessage(''); }} style={{ width: '100%', minHeight: 52, padding: '12px 15px', borderRadius: 14, border: selectedOption === id ? `3px solid ${homeColor}` : '1px solid rgba(255,255,255,.24)', background: selectedOption === id ? homeColor : 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 800, fontSize: 15, textAlign: 'left' }}><span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{label}</span><span>{selectedOption === id ? '✓' : '○'}</span></span></button>)}</div> : <textarea value={answer} onChange={e => { setAnswer(e.target.value); setMessage(''); }} maxLength={200} placeholder="Type your answer..." rows={4} style={{ width: '100%', marginTop: 18, boxSizing: 'border-box', borderRadius: 14, border: '1px solid rgba(255,255,255,.24)', padding: 14, fontSize: 16, resize: 'vertical', background: 'rgba(255,255,255,.08)', color: '#fff' }} />}
    {!message.startsWith('Answer submitted') && <button type="button" disabled={sending} onClick={() => void submitInteraction()} style={{ width: '100%', marginTop: 14, minHeight: 50, border: 0, borderRadius: 14, background: homeColor, color: '#fff', fontWeight: 900, fontSize: 15, opacity: sending ? .65 : 1 }}>{sending ? 'SUBMITTING...' : activeInteraction.type === 'poll' ? 'SUBMIT VOTE' : 'SUBMIT ANSWER'}</button>}
    {message && <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800, textAlign: 'center', color: message.startsWith('Could not') ? '#fca5a5' : '#fff' }}>{message}</div>}
  </section> : null;

  if (!joined) return <main className="light-page" style={{ background: uiBackground, color: '#fff', minHeight: '100vh' }}><div className="light-content" style={{ maxWidth: 520, width: '100%', boxSizing: 'border-box', padding: '30px 20px' }}>
    <div className="light-logo">LIGHTSYNC</div><div className="light-event-name">{event.name}</div>
    {game && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, opacity: .9 }}>{game.homeTeam.name} <span style={{ opacity: .55, margin: '0 7px' }}>VS</span> {game.awayTeam.name}</div>}
    <div className="light-status" style={{ marginTop: 12 }}>SYSTEM RUNNING</div>
    <p className="light-description" style={{ marginTop: 18 }}>You are connected to the event. Join to enable your flashlight.</p>
    <button style={{ width: '100%', maxWidth: 360, minHeight: 54, border: 0, borderRadius: 16, background: '#fff', color: homeColor, fontWeight: 900, fontSize: 16 }} onClick={() => void joinShow()}>JOIN SHOW</button>
    {error && <p className="light-error">{error}</p>}
    {interactionCard}
  </div></main>;

  return <main className="light-page" style={{ background: lightState ? homeColor : '#08080c', color: lightState ? '#050505' : '#fff', transition: 'background-color .08s linear, color .08s linear' }}><div className="light-content" style={{ maxWidth: 520, width: '100%', boxSizing: 'border-box', padding: '28px 20px' }}>
    <div className="light-logo">LIGHTSYNC</div><div className="light-event-name">{event.name}</div>
    {game && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, opacity: .85 }}>{game.homeTeam.name} <span style={{ opacity: .55, margin: '0 7px' }}>VS</span> {game.awayTeam.name}</div>}
    <div className="light-status" style={{ marginTop: 12 }}>{running ? 'SHOW LIVE' : 'SYSTEM RUNNING'}</div>
    {!running && <><div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 28 }}>FLASHLIGHT SHOW WILL START SOON</div><p className="waiting-description" style={{ marginTop: 8 }}>Stay connected. The organizer can start the light show at any time.</p></>}
    {running && <><div style={{ fontSize: '3.5rem', fontWeight: 900, marginTop: 26 }}>{lightState ? 'ON' : 'OFF'}</div><p className="waiting-description" style={{ marginTop: 4 }}>Your flashlight is synchronized with the show.</p></>}
    {interactionCard}
    {error && <p className="light-error" style={{ marginTop: 16 }}>{error}</p>}
  </div></main>;
}