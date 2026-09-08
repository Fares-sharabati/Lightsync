import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ensureAnonymousAuth } from '../firebase/auth';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsGame, getSportsLightColor, type SportsGame } from '../firebase/sportsGame';
import { watchSportsInteractions, submitSportsResponse, type SportsInteraction } from '../firebase/sports';
import { registerParticipant } from '../firebase/participants';
import { getLightStateAtTime, getNextLightEvent, type LightTimeline } from '../lightSync/timeline';

type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean };
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

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
  const [submittedInteractionId, setSubmittedInteractionId] = useState<string | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nextTimerRef = useRef<number | null>(null);
  const currentLightRef = useRef(false);

  useEffect(() => {
    if (!eventId) { setLoaded(true); setError('Invalid show link.'); return; }
    const showId = eventId;
    let cancelled = false;
    let stopShow: (() => void) | undefined;
    let stopGame: (() => void) | undefined;
    let stopInteractions: (() => void) | undefined;
    async function connect() {
      try {
        await ensureAnonymousAuth();
        if (cancelled) return;
        stopShow = watchPublicShow(showId, show => {
          if (cancelled) return;
          setEvent(show); setLoaded(true);
          if (!show) setError('Show not found.');
        });
        stopGame = watchSportsGame(showId, setGame);
        stopInteractions = watchSportsInteractions(showId, items => setActiveInteraction(items.find(item => item.status === 'open') ?? null));
      } catch (err) {
        console.error(err);
        if (!cancelled) { setLoaded(true); setError('Could not connect to LightSync. Please refresh.'); }
      }
    }
    void connect();
    return () => { cancelled = true; stopShow?.(); stopGame?.(); stopInteractions?.(); };
  }, [eventId]);

  useEffect(() => {
    setSelectedOption(''); setAnswer(''); setMessage(''); setSending(false); setSubmittedInteractionId(null);
  }, [activeInteraction?.id]);

  function clearNextTimer() {
    if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current);
    nextTimerRef.current = null;
  }
  async function setFlash(enabled: boolean) {
    const track = trackRef.current;
    if (!track || currentLightRef.current === enabled) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled } as TorchConstraints] });
      currentLightRef.current = enabled; setLightState(enabled);
    } catch (err) { console.error(err); setError('Your browser could not control the flashlight.'); }
  }
  function scheduleNextEvent(timeline: LightTimeline, start: number, offsetMs: number) {
    clearNextTimer();
    const now = Date.now();
    if (now < start) {
      nextTimerRef.current = window.setTimeout(() => synchronizeShow(start, timeline, offsetMs / 1000), Math.max(0, start - now));
      return;
    }
    const position = now - start + offsetMs;
    const next = getNextLightEvent(timeline, position);
    if (!next) return;
    const eventAt = start + next.time - offsetMs;
    nextTimerRef.current = window.setTimeout(() => {
      const currentPosition = Date.now() - start + offsetMs;
      void setFlash(getLightStateAtTime(timeline, currentPosition));
      scheduleNextEvent(timeline, start, offsetMs);
    }, Math.max(0, eventAt - now));
  }
  function synchronizeShow(start: number, timeline: LightTimeline, offsetSeconds = 0) {
    const offsetMs = Math.max(0, offsetSeconds) * 1000;
    const now = Date.now();
    const position = now >= start ? now - start + offsetMs : -1;
    void setFlash(position >= 0 ? getLightStateAtTime(timeline, position) : false);
    scheduleNextEvent(timeline, start, offsetSeconds);
  }

  async function joinShow() {
    if (!eventId || !event) return;
    setError('');
    // Real camera-torch control is a bonus, not a requirement: the full-screen
    // background color (see `pageBackground` below) is the actual flashlight
    // effect and works on every device with zero permissions. iOS Safari in
    // particular has never supported the web torch API at all, so treating
    // torch as mandatory here would lock out every iPhone in the audience.
    let torchNote = '';
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined;
        if (track && capabilities?.torch) {
          trackRef.current = track;
        } else {
          stream.getTracks().forEach(t => t.stop());
          torchNote = 'Your phone will use its screen as the light - camera flash control is not supported on this device/browser.';
        }
      } catch (mediaErr) {
        console.error(mediaErr);
        torchNote = 'Your phone will use its screen as the light - camera access was unavailable.';
      }
    } else {
      torchNote = 'Your phone will use its screen as the light on this browser.';
    }
    try {
      const user = await ensureAnonymousAuth();
      await registerParticipant(eventId, user.uid);
      setJoined(true);
      if (torchNote) setError(torchNote);
      if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline, event.showStartOffset ?? 0);
    } catch (err) {
      console.error(err);
      setError('Could not join the show. Please check your connection and try again.');
    }
  }

  async function submitInteraction() {
    if (!eventId || !activeInteraction || sending) return;
    if (activeInteraction.type === 'poll' && !selectedOption) { setMessage('Choose an answer first.'); return; }
    if (activeInteraction.type === 'question' && !answer.trim()) { setMessage('Enter an answer first.'); return; }
    const interactionId = activeInteraction.id;
    setSending(true); setMessage('');
    try {
      const uid = (await ensureAnonymousAuth()).uid;
      await submitSportsResponse(eventId, interactionId, uid, activeInteraction.type === 'poll' ? { optionId: selectedOption } : { answer: answer.trim().slice(0, 200) });
      setSubmittedInteractionId(interactionId); setMessage('Response submitted!'); setSelectedOption(''); setAnswer('');
    } catch (err) { console.error(err); setMessage('Could not submit your answer. Please try again.'); }
    finally { setSending(false); }
  }

  useEffect(() => {
    if (!joined || !event) return;
    if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline, event.showStartOffset ?? 0);
    else { clearNextTimer(); void setFlash(false); }
  }, [joined, event?.status, event?.showStartTime, event?.showStartOffset, event?.lightTimeline]);

  // Mobile browsers can suspend timers while the tab is backgrounded or the screen wakes.
  // Recalculate from the Firebase anchor when the page becomes visible again instead of
  // trusting stale timers. This is intentionally additive and does not change the normal
  // synchronized path while the page remains active.
  useEffect(() => {
    if (!joined) return;
    const resync = () => {
      if (document.visibilityState !== 'visible' || !event) return;
      if (event.status === 'running' && event.showStartTime && event.lightTimeline) {
        synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline, event.showStartOffset ?? 0);
      } else {
        clearNextTimer();
        void setFlash(false);
      }
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('pageshow', resync);
    window.addEventListener('focus', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('pageshow', resync);
      window.removeEventListener('focus', resync);
    };
  }, [joined, event?.status, event?.showStartTime, event?.showStartOffset, event?.lightTimeline]);

  useEffect(() => () => {
    clearNextTimer();
    if (trackRef.current) {
      void trackRef.current.applyConstraints({ advanced: [{ torch: false } as TorchConstraints] }).catch(() => {});
      trackRef.current.stop();
    }
  }, []);

  if (!loaded) return <main className="light-page light-page-loading"><div className="light-shell"><div className="light-brand">LIGHTSYNC</div><div className="light-loading">Connecting to show...</div></div></main>;
  if (!event || !eventId) return <main className="light-page light-page-loading"><div className="light-shell"><div className="light-brand">LIGHTSYNC</div><div className="light-loading">{error || 'Show not found.'}</div><button className="light-primary-button" onClick={() => navigate('/')}>BACK</button></div></main>;

  const uiColor = event.phoneUiColor && /^#[0-9a-fA-F]{6}$/.test(event.phoneUiColor) ? event.phoneUiColor : getSportsLightColor(game);
  const flashColor = event.screenLightColor && /^#[0-9a-fA-F]{6}$/.test(event.screenLightColor) ? event.screenLightColor : uiColor;
  const running = event.status === 'running';
  const interactionVisible = !!activeInteraction && submittedInteractionId !== activeInteraction.id;
  const pageBackground = lightState ? flashColor : `radial-gradient(circle at 50% 0%, ${uiColor}55 0%, transparent 42%), linear-gradient(160deg, #101218 0%, #08090d 58%, #050507 100%)`;

  const interactionCard = interactionVisible ? <section className="light-interaction" aria-live="polite">
    <div className="interaction-header"><span className="interaction-live-dot" /><span>{activeInteraction.type === 'poll' ? 'LIVE POLL' : 'LIVE QUESTION'}</span></div>
    <div className="interaction-question">{activeInteraction.question}</div>
    {activeInteraction.type === 'poll' ? <div className="interaction-options">
      {Object.entries(activeInteraction.options ?? {}).map(([id, label]) => <button key={id} type="button" className={`interaction-option ${selectedOption === id ? 'is-selected' : ''}`} disabled={sending} onClick={() => { setSelectedOption(id); setMessage(''); }} style={selectedOption === id ? ({ '--choice-color': uiColor } as CSSProperties) : undefined}><span>{label}</span><span className="choice-mark">{selectedOption === id ? 'v' : ''}</span></button>)}
    </div> : <textarea className="interaction-answer" value={answer} onChange={e => { setAnswer(e.target.value); setMessage(''); }} maxLength={200} placeholder="Type your answer..." rows={3} />}
    <button type="button" className="interaction-submit" disabled={sending} onClick={() => void submitInteraction()} style={{ background: uiColor }}>{sending ? 'SUBMITTING...' : activeInteraction.type === 'poll' ? 'SUBMIT VOTE' : 'SUBMIT ANSWER'}</button>
    {message && <div className={`interaction-message ${message.startsWith('Could not') ? 'is-error' : ''}`}>{message}</div>}
  </section> : null;

  if (!joined) return <main className="light-page" style={{ background: pageBackground }}><div className="light-shell light-shell-join">
    <header className="light-header"><div className="light-brand">LIGHTSYNC</div><div className="light-status"><span /> SYSTEM READY</div></header>
    <section className="light-main join-main"><div className="light-kicker">YOU'RE CONNECTED</div><h1 className="light-title">{event.name}</h1>{game && <div className="light-matchup"><strong>{game.homeTeam.name}</strong><span>VS</span><strong>{game.awayTeam.name}</strong></div>}<p className="light-copy">Join the show to enable your phone's flashlight and take part in live audience interactions.</p><button className="light-primary-button" onClick={() => void joinShow()}>JOIN SHOW</button><div className="light-note">Camera permission is used only to control your phone flashlight.</div></section>
    {interactionCard}{error && <p className="light-error">{error}</p>}
  </div></main>;

  return <main className={`light-page ${lightState ? 'is-flashing' : ''}`} style={{ background: pageBackground, color: lightState ? '#050505' : '#fff' }}>
    <div className="light-shell">
      <header className="light-header"><div className="light-brand">LIGHTSYNC</div><div className="light-status" style={lightState ? { background: 'rgba(0,0,0,.16)' } : undefined}><span /> {running ? 'SHOW LIVE' : 'SYSTEM READY'}</div></header>
      <section className="light-main"><div className="light-kicker">{running ? 'SYNCED WITH THE ARENA' : 'STAY CONNECTED'}</div><h1 className="light-title">{event.name}</h1>{game && <div className="light-matchup"><strong>{game.homeTeam.name}</strong><span>VS</span><strong>{game.awayTeam.name}</strong></div>}
        {running ? <><div className="light-state" aria-label={lightState ? 'Flashlight on' : 'Flashlight off'}>{lightState ? 'ON' : 'OFF'}</div><p className="light-copy">Your flashlight is synchronized with the show.</p></> : <><div className="light-waiting">FLASHLIGHT SHOW WILL START SOON</div><p className="light-copy">Stay connected. The organizer can start the light show at any time.</p></>}
      </section>
      {interactionCard}{error && <p className="light-error">{error}</p>}
    </div>
  </main>;
}
