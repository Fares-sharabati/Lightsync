import { useEffect, useRef, useState } from 'react';
import { onDisconnect, ref, set } from 'firebase/database';
import { useNavigate, useParams } from 'react-router-dom';
import { ensureAnonymousAuth } from '../firebase/auth';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsGame, getSportsLightColor, type SportsGame } from '../firebase/sportsGame';
import { watchSportsInteractions, submitSportsResponse, type SportsInteraction } from '../firebase/sports';
import { db } from '../firebase/config';
import { recordQrScan } from '../firebase/analytics';
import { getLightStateAtTime, getNextLightEvent, type LightTimeline } from '../lightSync/timeline';

type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean };
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
const DEFAULT_SCREEN_LIGHT_COLOR = '#071B3A';

function detectDevice(): string { const ua = navigator.userAgent; if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone/iPad'; if (/Android/.test(ua)) return 'Android'; if (/Windows Phone/.test(ua)) return 'Windows Phone'; if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'; if (/Windows/.test(ua)) return 'Windows'; if (/Linux/.test(ua)) return 'Linux'; return 'Other'; }
function detectBrowser(): string { const ua = navigator.userAgent; if (/Edg\//.test(ua)) return 'Edge'; if (/OPR\//.test(ua)) return 'Opera'; if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome'; if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'; if (/Firefox\//.test(ua)) return 'Firefox'; return 'Other'; }

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [event, setEvent] = useState<PublicShow | null>(null);
  const [sportsGame, setSportsGame] = useState<SportsGame | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<SportsInteraction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [lightState, setLightState] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const [answer, setAnswer] = useState('');
  const [interactionMessage, setInteractionMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nextTimerRef = useRef<number | null>(null);
  const currentLightRef = useRef(false);
  const scanRecordedRef = useRef(false);

  useEffect(() => {
    if (!eventId) { setLoaded(true); setError('Invalid show link. Please scan the QR code again.'); return; }
    const showId = eventId;
    let unsubscribe: (() => void) | null = null;
    let unsubscribeGame: (() => void) | null = null;
    let unsubscribeInteractions: (() => void) | null = null;
    let cancelled = false;
    let loadingTimeout: number | null = null;
    async function connectToShow() {
      try {
        const user = await ensureAnonymousAuth();
        if (cancelled) return;
        unsubscribe = watchPublicShow(showId, show => {
          if (cancelled) return;
          setEvent(show); setLoaded(true);
          if (show && !scanRecordedRef.current) { scanRecordedRef.current = true; void recordQrScan(showId, user.uid).catch(err => console.error('Could not record QR scan:', err)); }
          if (!show) setError('Show not found. Please scan the QR code again.');
          if (loadingTimeout !== null) window.clearTimeout(loadingTimeout);
        });
        unsubscribeGame = watchSportsGame(showId, setSportsGame);
        unsubscribeInteractions = watchSportsInteractions(showId, items => setActiveInteraction(items.find(item => item.status === 'open') ?? null));
      } catch (err) {
        console.error('Could not initialize fan session:', err);
        if (!cancelled) { setLoaded(true); setError('Could not connect to LightSync. Please refresh and scan the QR code again.'); }
      }
    }
    loadingTimeout = window.setTimeout(() => { if (!cancelled) setLoaded(current => { if (!current) setError('The show is taking too long to load. Please scan the QR code again.'); return true; }); }, 10000);
    void connectToShow();
    return () => { cancelled = true; unsubscribe?.(); unsubscribeGame?.(); unsubscribeInteractions?.(); if (loadingTimeout !== null) window.clearTimeout(loadingTimeout); };
  }, [eventId]);

  useEffect(() => { setSelectedOption(''); setAnswer(''); setInteractionMessage(''); setSendingResponse(false); }, [activeInteraction?.id]);

  async function setFlash(enabled: boolean) {
    const track = trackRef.current; if (!track || currentLightRef.current === enabled) return;
    try { await track.applyConstraints({ advanced: [{ torch: enabled } as TorchConstraints] }); currentLightRef.current = enabled; setLightState(enabled); }
    catch (err) { console.error('Torch control failed:', err); setError('Your browser connected, but it could not control the flashlight.'); }
  }
  function clearNextTimer() { if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
  function scheduleNextEvent(timeline: LightTimeline, showStartTime: number) { clearNextTimer(); const position = Date.now() - showStartTime; const next = getNextLightEvent(timeline, position); if (!next) return; const delay = Math.max(0, showStartTime + next.time - Date.now()); nextTimerRef.current = window.setTimeout(() => { void setFlash(next.on); scheduleNextEvent(timeline, showStartTime); }, delay); }
  function synchronizeShow(showStartTime: number, timeline: LightTimeline) { const position = Date.now() - showStartTime; void setFlash(getLightStateAtTime(timeline, position)); scheduleNextEvent(timeline, showStartTime); }

  async function joinShow() {
    if (!eventId || !event) return;
    const showId = eventId;
    try {
      setError(''); const user = await ensureAnonymousAuth();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const track = stream.getVideoTracks()[0]; if (!track) { stream.getTracks().forEach(t => t.stop()); throw new Error('No camera track'); }
      const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined;
      if (!capabilities?.torch) { stream.getTracks().forEach(t => t.stop()); throw new Error('Torch is not supported by this browser/device'); }
      trackRef.current = track;
      const participantRef = ref(db, `showParticipants/${showId}/${user.uid}`);
      await set(participantRef, { connected: true, device: detectDevice(), browser: detectBrowser(), joinedAt: Date.now() });
      await onDisconnect(participantRef).update({ connected: false });
      setJoined(true);
      if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline);
    } catch (err) { console.error(err); setError(err instanceof Error && err.message.includes('Torch') ? 'This phone/browser does not allow flashlight control. Try the latest Safari or Chrome.' : 'Please allow camera access so LightSync can control your flashlight.'); }
  }

  async function submitInteraction() {
    if (!eventId || !activeInteraction || sendingResponse) return;
    const uid = (await ensureAnonymousAuth()).uid;
    if (activeInteraction.type === 'poll' && !selectedOption) { setInteractionMessage('Choose an answer first.'); return; }
    if (activeInteraction.type === 'question' && !answer.trim()) { setInteractionMessage('Enter an answer first.'); return; }
    setInteractionMessage(''); setSendingResponse(true);
    try {
      await submitSportsResponse(eventId, activeInteraction.id, uid, activeInteraction.type === 'poll' ? { optionId: selectedOption } : { answer: answer.trim().slice(0, 200) });
      setInteractionMessage('Answer submitted ✓');
    } catch (err) { console.error(err); setInteractionMessage('Could not submit your answer. Please try again.'); }
    finally { setSendingResponse(false); }
  }

  useEffect(() => { if (!joined || !event) return; if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline); else { clearNextTimer(); void setFlash(false); } }, [joined, event?.status, event?.showStartTime, event?.lightTimeline]);
  useEffect(() => () => { clearNextTimer(); if (trackRef.current) { void trackRef.current.applyConstraints({ advanced: [{ torch: false } as TorchConstraints] }).catch(() => {}); trackRef.current.stop(); } }, []);

  if (!loaded) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><p>Loading show...</p></div></main>;
  if (!event || !eventId) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><p>{error || 'Show not found.'}</p><button className="button button-secondary" onClick={() => navigate('/')}>Back</button></div></main>;
  if (!joined) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><div className="light-event-name">{event.name}</div><p className="light-description">Join the audience light show.</p><button className="light-join-button" onClick={() => void joinShow()}>JOIN SHOW</button>{error && <p className="light-error">{error}</p>}</div></main>;

  const running = event.status === 'running';
  const teamColor = getSportsLightColor(sportsGame);
  const screenColor = /^#[0-9a-fA-F]{6}$/.test(event.screenLightColor || '') ? event.screenLightColor! : (/^#[0-9a-fA-F]{6}$/.test(teamColor) && sportsGame ? teamColor : DEFAULT_SCREEN_LIGHT_COLOR);
  const activeBackground = lightState ? screenColor : '#08080c';
  const activeText = lightState ? '#050505' : '#fff';
  const interactionCardBackground = lightState ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.08)';
  const interactionCardText = lightState ? '#050505' : '#fff';

  return <main className="light-page" style={{ background: activeBackground, color: activeText, transition: 'background-color .08s linear, color .08s linear' }}>
    <div className="light-content" style={{ maxWidth: 520, width: '100%', boxSizing: 'border-box', padding: '28px 20px' }}>
      <div className="light-logo">LIGHTSYNC</div>
      <div className="light-event-name">{event.name}</div>
      {sportsGame && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, opacity: .85 }}>{sportsGame.homeTeam.name} <span style={{ opacity: .55, margin: '0 7px' }}>VS</span> {sportsGame.awayTeam.name}</div>}
      <div className="light-status" style={{ marginTop: 12 }}>{running ? 'SHOW LIVE' : event.status === 'finished' ? 'SHOW FINISHED' : 'CONNECTED'}</div>

      {running ? <>
        <div style={{ fontSize: '3.5rem', fontWeight: 900, marginTop: 26 }}>{lightState ? 'ON' : 'OFF'}</div>
        <p className="waiting-description" style={{ marginTop: 4 }}>Your flashlight is synchronized with the show.</p>
      </> : <>
        <div className="waiting-message" style={{ marginTop: 28 }}>{event.status === 'finished' ? 'SHOW FINISHED' : 'READY'}</div>
        <p className="waiting-description">{event.status === 'finished' ? 'This LightSync show has finished.' : 'Stay here. The organizer will start the show.'}</p>
      </>}

      {activeInteraction && event.status !== 'finished' && <section style={{ width: '100%', marginTop: 26, padding: 22, borderRadius: 22, background: interactionCardBackground, color: interactionCardText, backdropFilter: 'blur(12px)', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,.16)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /><span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, opacity: .65 }}>{activeInteraction.type === 'poll' ? 'LIVE POLL' : 'LIVE QUESTION'}</span></div>
        <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.25 }}>{activeInteraction.question}</div>

        {activeInteraction.type === 'poll' ? <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {Object.entries(activeInteraction.options ?? {}).map(([id, label]) => <button key={id} type="button" disabled={sendingResponse || interactionMessage.startsWith('Answer submitted')} onClick={() => { setSelectedOption(id); setInteractionMessage(''); }} style={{ width: '100%', minHeight: 50, padding: '12px 15px', borderRadius: 14, border: selectedOption === id ? '3px solid currentColor' : '1px solid rgba(127,127,127,.35)', background: selectedOption === id ? 'rgba(127,127,127,.2)' : 'rgba(127,127,127,.06)', color: 'inherit', fontWeight: 800, fontSize: 15, textAlign: 'left', cursor: sendingResponse ? 'default' : 'pointer' }}><span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{label}</span><span>{selectedOption === id ? '✓' : '○'}</span></span></button>)}
        </div> : <textarea value={answer} onChange={e => { setAnswer(e.target.value); setInteractionMessage(''); }} maxLength={200} placeholder="Type your answer..." rows={4} style={{ width: '100%', marginTop: 18, boxSizing: 'border-box', borderRadius: 14, border: '1px solid rgba(127,127,127,.35)', padding: 14, fontSize: 16, resize: 'vertical', background: 'rgba(127,127,127,.06)', color: 'inherit' }} />}

        {!interactionMessage.startsWith('Answer submitted') && <button type="button" className="light-join-button" style={{ width: '100%', marginTop: 14 }} disabled={sendingResponse} onClick={() => void submitInteraction()}>{sendingResponse ? 'SUBMITTING...' : activeInteraction.type === 'poll' ? 'SUBMIT VOTE' : 'SUBMIT ANSWER'}</button>}
        {interactionMessage && <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800, textAlign: 'center', color: interactionMessage.startsWith('Could not') || interactionMessage.startsWith('Choose') || interactionMessage.startsWith('Enter') ? '#ef4444' : 'inherit' }}>{interactionMessage}</div>}
      </section>}

      {error && <p className="light-error" style={{ marginTop: 16 }}>{error}</p>}
    </div>
  </main>;
}
