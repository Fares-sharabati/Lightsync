import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;

    return onValue(ref(db, `events/${eventId}`), snapshot => {
      setEvent(snapshot.val());
    });
  }, [eventId]);

  async function joinShow() {
    if (!eventId) return;

    try {
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
    } catch (err) {
      console.error(err);
      setError('Could not join.');
    }
  }

  async function testTorch() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      const track = stream.getVideoTracks()[0];

      const capabilities =
        track.getCapabilities?.();

      if (!capabilities?.torch) {
        setError(
          'Torch control is not supported by this browser.'
        );
        track.stop();
        return;
      }

      setTorchSupported(true);

      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });

      setTorchOn(!torchOn);

      if (torchOn) {
        track.stop();
      }
    } catch (err) {
      console.error(err);
      setError(
        'Camera/flashlight permission was denied or unavailable.'
      );
    }
  }

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
          <div className="light-logo">LIGHTSYNC</div>

          <div className="light-event-name">
            {event.name}
          </div>

          <p className="light-description">
            Join the audience light show.
          </p>

          <button
            className="light-join-button"
            onClick={joinShow}
          >
            JOIN SHOW
          </button>

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

        <h2>Flashlight Test</h2>

        <button
          className="light-join-button"
          onClick={testTorch}
        >
          {torchOn ? 'TURN FLASH OFF' : 'TURN FLASH ON'}
        </button>

        <p className="waiting-description">
          {torchSupported
            ? 'Torch control is supported.'
            : 'Press the button to test your phone.'}
        </p>

        {error && (
          <p className="light-error">
            {error}
          </p>
        )}

      </div>
    </main>
  );
}
