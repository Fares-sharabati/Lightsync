import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

type EventData = {
  name: string;
  status: string;
  showStartTime?: number | null;
  flashPattern?: number[];
};

export default function Join() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] =
    useState<EventData | null>(null);

  const [joined, setJoined] =
    useState(false);

  const [error, setError] =
    useState('');

  const trackRef =
    useRef<MediaStreamTrack | null>(null);

  const timersRef =
    useRef<number[]>([]);

  const participantIdRef =
    useRef<string | null>(null);

  const currentLightRef =
    useRef(false);

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
      setError('');

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
        });

      const track =
        stream.getVideoTracks()[0];

      const capabilities =
        track.getCapabilities?.() as any;

      if (!capabilities?.torch) {
        track.stop();

        setError(
          'This phone/browser does not support flashlight control.'
        );

        return;
      }

      trackRef.current = track;

      const participantId =
        crypto.randomUUID();

      participantIdRef.current =
        participantId;

      await set(
        ref(
          db,
          `events/${eventId}/participants/${participantId}`
        ),
        {
          joinedAt: Date.now(),
          active: true,
        }
      );

      setJoined(true);

    } catch (err) {
      console.error(err);

      setError(
        'Camera/flashlight permission was denied or unavailable.'
      );
    }
  }

  async function setFlash(
    enabled: boolean
  ) {
    const track =
      trackRef.current;

    if (!track) return;

    if (
      currentLightRef.current === enabled
    ) {
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [
          {
            torch: enabled,
          } as any,
        ],
      });

      currentLightRef.current =
        enabled;

    } catch (error) {
      console.error(
        'Torch error:',
        error
      );
    }
  }

  function clearTimers() {
    timersRef.current.forEach(
      timer => clearTimeout(timer)
    );

    timersRef.current = [];
  }

  function stopLightShow() {
    clearTimers();

    setFlash(false);
  }

  function startLightShow(
    startTime: number,
    pattern: number[]
  ) {
    clearTimers();

    if (!pattern?.length) {
      return;
    }

    const now = Date.now();

    const elapsed =
      now - startTime;

    for (
      let i = 0;
      i < pattern.length;
      i++
    ) {
      const beatTime =
        pattern[i];

      /*
       * The pattern stores milliseconds
       * from the beginning of the song.
       *
       * Each detected beat toggles
       * the flashlight.
       */
      if (beatTime <= elapsed) {
        continue;
      }

      const delay =
        startTime +
        beatTime -
        now;

      const timer =
        window.setTimeout(() => {
          setFlash(
            !currentLightRef.current
          );
        }, delay);

      timersRef.current.push(timer);
    }
  }

  useEffect(() => {
    if (!event) return;

    if (
      event.status === 'running' &&
      event.showStartTime &&
      event.flashPattern &&
      joined
    ) {
      startLightShow(
        event.showStartTime,
        event.flashPattern
      );
    }

    if (
      event.status !== 'running'
    ) {
      stopLightShow();
    }

  }, [
    event?.status,
    event?.showStartTime,
    event?.flashPattern,
    joined,
  ]);

  useEffect(() => {
    return () => {
      clearTimers();

      if (trackRef.current) {
        trackRef.current
          .applyConstraints({
            advanced: [
              {
                torch: false,
              } as any,
            ],
          })
          .catch(() => {});

        trackRef.current.stop();
      }

      if (
        eventId &&
        participantIdRef.current
      ) {
        set(
          ref(
            db,
            `events/${eventId}/participants/${participantIdRef.current}`
          ),
          {
            active: false,
            leftAt: Date.now(),
          }
        ).catch(() => {});
      }
    };
  }, [eventId]);

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
              Your flashlight is synchronized
              with the music.
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

        {error && (
          <p className="light-error">
            {error}
          </p>
        )}

      </div>
    </main>
  );
}