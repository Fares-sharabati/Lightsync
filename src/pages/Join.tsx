import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { onDisconnect, ref, set } from 'firebase/database';
import { ensureAnonymousAuth } from '../firebase/auth';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { db } from '../firebase/config';
import { getLightStateAtTime, getNextLightEvent, type LightTimeline } from '../lightSync/timeline';

type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean };

function detectDevice() {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Other';
}
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/FxiOS|Firefox\//.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [event, setEvent] = useState<PublicShow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [lightState, setLightState] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nextTimerRef = useRef<number | null>(null);
  const currentLightRef = useRef(false);

  useEffect(() => {
    if (!eventId) return;
    return watchPublicShow(eventId, show => { setEvent(show); setLoaded(true); });
  }, [eventId]);

  async function setFlash(enabled: boolean) {
    const track = trackRef.current;
    if (!track || currentLightRef.current === enabled) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled } as TorchConstraints] });
      currentLightRef.current = enabled;
      setLightState(enabled);
    } catch (err) {
      console.error('Torch control failed:', err);
      setError('Your browser connected, but it could not control the flashlight.');
    }
  }

  function clearNextTimer() {
    if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current);
    nextTimerRef.current = null;
  }

  function scheduleNextEvent(timeline: LightTimeline, showStartTime: number) {
    clearNextTimer();
    const position = Date.now() - showStartTime;
    const next = getNextLightEvent(timeline, position);
    if (!next) return;
    const delay = Math.max(0, showStartTime + next.time - Date.now());
    nextTimerRef.current = window.setTimeout(() => {
      void setFlash(next.on);
      scheduleNextEvent(timeline, showStartTime);
    }, delay);
  }

  function synchronizeShow(showStartTime: number, timeline: LightTimeline) {
    const position = Date.now() - showStartTime;
    void setFlash(getLightStateAtTime(timeline, position));
    scheduleNextEvent(timeline, showStartTime);
  }

  async function joinShow() {
    if (!eventId || !event) return;
    try {
      setError('');
      const user = await ensureAnonymousAuth();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No camera track');
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      if (!capabilities?.torch) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('Torch is not supported by this browser/device');
      }
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

  useEffect(() => {
    if (!joined || !event) return;
    if (event.status === 'running' && event.showStartTime && event.lightTimeline) synchronizeShow(event.showStartTime, event.lightTimeline as LightTimeline);
    else { clearNextTimer(); void setFlash(false); }
  }, [joined, event?.status, event?.showStartTime, event?.lightTimeline]);

  useEffect(() => () => {
    clearNextTimer();
    if (trackRef.current) {
      void trackRef.current.applyConstraints({ advanced: [{ torch: false } as TorchConstraints] }).catch(() => {});
      trackRef.current.stop();
    }
  }, []);

  if (!loaded) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><p>Loading show...</p></div></main>;
  if (!event || !eventId) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><p>Show not found.</p><button className="button button-secondary" onClick={() => navigate('/')}>Back</button></div></main>;
  if (!joined) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><div className="light-event-name">{event.name}</div><p className="light-description">Join the audience light show.</p><button className="light-join-button" onClick={() => void joinShow()}>JOIN SHOW</button>{error && <p className="light-error">{error}</p>}</div></main>;
  const running = event.status === 'running';
  return <main className="light-page" style={{ background: lightState ? '#fff' : '#08080c', color: lightState ? '#08080c' : '#fff' }}><div className="light-content"><div className="light-logo">LIGHTSYNC</div><div className="light-event-name">{event.name}</div><div className="light-status">CONNECTED</div>{running ? <><div className="show-live-text">SHOW LIVE</div><div style={{ fontSize: '4rem', marginTop: 30 }}>{lightState ? 'ON' : 'OFF'}</div><p className="waiting-description">Your flashlight is synchronized with the show.</p></> : <><div className="connected-icon">✓</div><div className="waiting-message">READY</div><p className="waiting-description">Waiting for the organizer.</p></>}</div></main>;
}
