import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

type EventData = {
  name: string;
  createdAt: number;
  status: string;
};

export default function EventControl() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<EventData | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [songName, setSongName] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [starting, setStarting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const eventRef = ref(db, `events/${eventId}`);

    const unsubscribeEvent = onValue(eventRef, (snapshot) => {
      setEvent(snapshot.val());
    });

    const participantsRef = ref(
      db,
      `events/${eventId}/participants`
    );

    const unsubscribeParticipants = onValue(
      participantsRef,
      (snapshot) => {
        const data = snapshot.val();

        if (!data) {
          setParticipantCount(0);
          return;
        }

        const active = Object.values(data).filter(
          (participant: any) =>
            participant.active === true
        );

        setParticipantCount(active.length);
      }
    );

    return () => {
      unsubscribeEvent();
      unsubscribeParticipants();
    };
  }, [eventId]);

  function chooseSong(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const url = URL.createObjectURL(file);

    setSongUrl(url);
    setSongName(file.name);

    const audio = new Audio(url);

    audio.preload = 'auto';

    audioRef.current = audio;
  }

  async function startShow() {
    if (!eventId || !audioRef.current || !songUrl) {
      return;
    }

    setStarting(true);

    try {
      /*
       * Give every phone a common future start time.
       * 3 seconds gives Firebase enough time to deliver it.
       */
      const startTime = Date.now() + 3000;

      await set(
        ref(db, `events/${eventId}`),
        {
          ...event,
          status: 'running',
          showStartTime: startTime,
        }
      );

      /*
       * Start the organizer's music.
       */
      audioRef.current.currentTime = 0;

      await new Promise<void>((resolve) => {
        const delay = Math.max(
          0,
          startTime - Date.now()
        );

        setTimeout(resolve, delay);
      });

      await audioRef.current.play();

    } catch (error) {
      console.error(
        'Could not start show:',
        error
      );
    } finally {
      setStarting(false);
    }
  }

  async function stopShow() {
    if (!eventId) return;

    audioRef.current?.pause();

    await set(
      ref(db, `events/${eventId}`),
      {
        ...event,
        status: 'waiting',
        showStartTime: null,
      }
    );
  }

  if (!event || !eventId) {
    return (
      <main className="page">
        Loading...
      </main>
    );
  }

  const joinUrl =
    `${window.location.origin}/join/${eventId}`;

  const running =
    event.status === 'running';

  return (
    <main className="page">

      <header className="page-header">
        <div>
          <p className="eyebrow">
            LIGHTSYNC EVENT
          </p>

          <h1>{event.name}</h1>
        </div>

        <button
          className="button button-secondary"
          onClick={() => navigate('/admin')}
        >
          Back
        </button>
      </header>

      <section className="event-control-grid">

        <div className="card qr-card">

          <p className="eyebrow">
            JOIN THE SHOW
          </p>

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

          <p className="qr-instruction">
            Fans scan this QR code with their phones.
          </p>

        </div>

        <div className="card control-card">

          <p className="eyebrow">
            AUDIENCE
          </p>

          <div className="connected-number">
            {participantCount}
          </div>

          <p className="connected-label">
            Connected Phones
          </p>

          <hr />

          <p className="eyebrow">
            MUSIC
          </p>

          <input
            type="file"
            accept="audio/*"
            onChange={chooseSong}
          />

          {songName && (
            <p className="song-selected">
              ✓ {songName}
            </p>
          )}

          <div className="control-actions">

            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={
                starting ||
                running ||
                !songUrl
              }
            >
              {starting
                ? 'Starting...'
                : 'Start Show'}
            </button>

            <button
              className="button button-secondary control-button"
              onClick={stopShow}
              disabled={!running}
            >
              Stop Show
            </button>

          </div>

          <div className="event-status-large">
            <span className="status-dot" />

            {running
              ? 'SHOW RUNNING'
              : 'WAITING'}
          </div>

        </div>

      </section>

    </main>
  );
}
