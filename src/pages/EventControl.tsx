import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

type EventData = {
  name: string;
  createdAt: number;
  status: string;
  connectedUsers?: number;
};

type Participant = {
  joinedAt: number;
  active: boolean;
};

export default function EventControl() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<EventData | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const eventRef = ref(db, `events/${eventId}`);

    const unsubscribeEvent = onValue(eventRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        setEvent(data);
      } else {
        setEvent(null);
      }

      setLoading(false);
    });

    const participantsRef = ref(db, `events/${eventId}/participants`);

    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Participant> | null;

      if (!data) {
        setParticipantCount(0);
        return;
      }

      const activeParticipants = Object.values(data).filter(
        (participant) => participant.active === true
      );

      setParticipantCount(activeParticipants.length);
    });

    return () => {
      unsubscribeEvent();
      unsubscribeParticipants();
    };
  }, [eventId]);

  async function startShow() {
    if (!eventId || starting) return;

    setStarting(true);

    try {
      await set(ref(db, `events/${eventId}/status`), 'running');
    } catch (error) {
      console.error('Could not start show:', error);
    } finally {
      setStarting(false);
    }
  }

  async function stopShow() {
    if (!eventId) return;

    try {
      await set(ref(db, `events/${eventId}/status`), 'waiting');
    } catch (error) {
      console.error('Could not stop show:', error);
    }
  }

  if (loading) {
    return (
      <main className="page loading-page">
        <p>Loading event...</p>
      </main>
    );
  }

  if (!event || !eventId) {
    return (
      <main className="page">
        <section className="card">
          <h2>Event not found</h2>

          <p>This event does not exist or may have been deleted.</p>

          <button
            className="button button-secondary"
            onClick={() => navigate('/admin')}
          >
            Back to Events
          </button>
        </section>
      </main>
    );
  }

  const joinUrl = `${window.location.origin}/join/${eventId}`;

  const isRunning = event.status === 'running';

  return (
    <main className="page event-control-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">LIGHTSYNC EVENT</p>
          <h1>{event.name}</h1>
        </div>

        <button
          className="button button-secondary"
          onClick={() => navigate('/admin')}
        >
          Back to Events
        </button>
      </header>

      <section className="event-control-grid">
        <div className="card qr-card">
          <p className="eyebrow">JOIN THE SHOW</p>

          <h2>Scan to Join</h2>

          <div className="qr-wrapper">
            <QRCodeSVG
              value={joinUrl}
              size={280}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
            />
          </div>

          <p className="qr-instruction">Scan this QR code with your phone.</p>

          <p className="join-url">{joinUrl}</p>
        </div>

        <div className="card control-card">
          <p className="eyebrow">AUDIENCE</p>

          <div className="connected-number">{participantCount}</div>

          <p className="connected-label">
            {participantCount === 1 ? 'Connected Phone' : 'Connected Phones'}
          </p>

          <div className="event-status-large">
            <span className="status-dot" />

            {isRunning ? 'SHOW RUNNING' : 'WAITING'}
          </div>

          <div className="control-actions">
            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={starting || isRunning}
            >
              {starting ? 'Starting...' : 'Start Show'}
            </button>

            <button
              className="button button-secondary control-button"
              onClick={stopShow}
              disabled={!isRunning}
            >
              Stop Show
            </button>
          </div>

          <p className="coming-soon">
            Light synchronization will be connected next.
          </p>
        </div>
      </section>
    </main>
  );
}
