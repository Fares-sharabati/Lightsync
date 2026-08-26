import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const trackRef = useRef<MediaStreamTrack | null>(null);
  const patternTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!eventId) return;

    return onValue(
      ref(db, `events/${eventId}`),
      snapshot => {
        setEvent(snapshot.val());
      }
    );
  }, [eventId]);

  async function joinShow() {
    if (!eventId) return;

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
        });

      const track = stream.getVideoTracks()[0];

      const capabilities =
        track.getCapabilities() as any;

      if (!capabilities.torch) {
        track.stop();

        setError(
          'Flashlight control is not supported.'
        );

        return;
      }

      trackRef.current = track;

      await set(
        ref(
          db,
          `events/${eventId}/participants/${crypto.randomUUID()}`
        ),
        {
          joinedAt: Date.now(),
          active: true,
        }
      );

      setJoined(true);

    } catch (error) {
      console.error(error);

      setError(
        'Camera permission is required.'
      );
    }
  }

  async function setTorch(on: boolean) {
    const track = trackRef.current;

    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [
          {
            torch: on,
          } as any,
        ],
      });
    } catch (error) {
      console.error(
        'Torch error:',
        error
      );
    }
  }

  function stopPattern() {
    if (patternTimerRef.current !== null) {
      window.clearInterval(
        patternTimerRef.current
      );

      patternTimerRef.current = null;
    }

    setTorch(false);
  }

  function startPattern() {
    stopPattern();

    let lightOn = false;

    patternTimerRef.current =
      window.setInterval(() => {
        lightOn = !lightOn;

        setTorch(lightOn);
      }, 500);
  }

  useEffect(() => {
    if (!joined || !event) return;

    if (event.status === 'running') {
      startPattern();
    } else {
      stopPattern();
    }
  }, [event?.status, joined]);

  useEffect(() => {
    return () => {
      stopPattern();

      if (trackRef.current) {
        trackRef.current.stop();
        trackRef.current = null;
      }
    };
  }, []);

  if (!event) {
    return (
      <main className="light-page">
        <div className="light-content">
          Loading...
        </div>
      </main>
    );
  }

  if (!joined) {
    return (
      <main className="light-page">
        <div className="light-content">

          <div className="light-logo">
            LIGHTSYNC
          </div>

          <div className="light-event-name">
            {event.name}
          </div>

          <p className="light-description">
            Join the audience light show.
            <br />
            Allow camera access.
          </p>

          <button
            className="light-join-button"
            onClick={joinShow}
          >
            JOIN SHOW
          </button>

          {error && (
            <p className="light-error">
              {error}
            </p>
          )}

          <button
            className="button button-secondary"
            onClick={() => navigate('/')}
          >
            Back
          </button>

        </div>
      </main>
    );
  }

  const running =
    event.status === 'running';

  return (
    <main className="light-page">
      <div className="light-content">

        <div className="light-logo">
          LIGHTSYNC
        </div>

        <div className="light-event-name">
          {event.name}
        </div>

        <div className="light-status">
          CONNECTED
        </div>

        {running ? (
          <>
            <div className="show-live-text">
              SHOW LIVE
            </div>

            <div className="show-light">
              🔦
            </div>

            <p className="waiting-description">
              Flash pattern active.
            </p>
          </>
        ) : (
          <>
            <div className="connected-icon">
              ✓
            </div>

            <div className="waiting-message">
              READY
            </div>

            <p className="waiting-description">
              Waiting for the organizer.
            </p>
          </>
        )}

      </div>
    </main>
  );
}
