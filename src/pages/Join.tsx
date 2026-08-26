import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

type EventData = {
  name: string;
  createdAt: number;
  status: string;
};

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<EventData | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [torchReady, setTorchReady] = useState(false);

  const trackRef = useRef<MediaStreamTrack | null>(null);
  const torchStateRef = useRef(false);

  useEffect(() => {
    if (!eventId) return;

    const eventRef = ref(db, `events/${eventId}`);

    return onValue(eventRef, (snapshot) => {
      setEvent(snapshot.val());
    });
  }, [eventId]);

  async function joinShow() {
    if (!eventId) return;

    try {
      setError('');

      // Ask for camera permission.
      // We need this before the organizer can control the torch.
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
        });

      const track = stream.getVideoTracks()[0];

      const capabilities = track.getCapabilities() as any;

      if (!capabilities.torch) {
        track.stop();

        setError(
          'This phone/browser does not support flashlight control.'
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

      setTorchReady(true);
      setJoined(true);

    } catch (err) {
      console.error(err);

      setError(
        'Camera permission is required to control the flashlight.'
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

      torchStateRef.current = on;
    } catch (err) {
      console.error('Torch error:', err);
    }
  }

  // Watch the organizer's show status.
  useEffect(() => {
    if (!joined || !event) return;

    if (event.status === 'running') {
      setTorch(true);
    } else {
      setTorch(false);
    }
  }, [event?.status, joined]);

  // Turn flashlight off when leaving the page.
  useEffect(() => {
    return () => {
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
            Allow camera access so LightSync can control your flashlight.
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

  const showRunning = event.status === 'running';

  return (
    <main
      className={
        showRunning
          ? 'light-page show-running'
          : 'light-page waiting'
      }
    >
      <div className="light-content">

        <div className="light-logo">
          LIGHTSYNC
        </div>

        <div className="light-event-name">
          {event.name}
        </div>

        <div className="light-status">
          {torchReady ? 'CONNECTED' : 'CONNECTING'}
        </div>

        {showRunning ? (
          <>
            <div className="show-live-indicator">
              ●
            </div>

            <div className="show-live-text">
              SHOW LIVE
            </div>

            <div className="show-light">
              🔦
            </div>

            <p className="waiting-description">
              Your flashlight is being controlled by LightSync.
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
              Keep your phone open.
              <br />
              The organizer will start the show.
            </p>
          </>
        )}

      </div>
    </main>
  );
}
