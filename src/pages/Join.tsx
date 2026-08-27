import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

import {
  getLightStateAtTime,
  getNextLightEvent,
  LightTimeline,
} from '../lightSync/timeline';

type EventData = {
  name: string;
  status: string;
  showStartTime?: number | null;
  lightTimeline?: LightTimeline;
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

  const [lightState, setLightState] =
    useState(false);

  const trackRef =
    useRef<MediaStreamTrack | null>(null);

  const participantIdRef =
    useRef<string | null>(null);

  const nextTimerRef =
    useRef<number | null>(null);

  const currentLightRef =
    useRef(false);

  /*
   * Get the event from Firebase.
   */
  useEffect(() => {
    if (!eventId) return;

    const eventRef =
      ref(db, `events/${eventId}`);

    return onValue(
      eventRef,
      snapshot => {
        setEvent(snapshot.val());
      }
    );
  }, [eventId]);

  /*
   * Turn the physical flashlight ON/OFF.
   */
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

      setLightState(enabled);

    } catch (error) {
      console.error(
        'Torch error:',
        error
      );
    }
  }

  /*
   * Cancel the currently scheduled
   * timeline event.
   */
  function clearNextTimer() {
    if (
      nextTimerRef.current !== null
    ) {
      clearTimeout(
        nextTimerRef.current
      );

      nextTimerRef.current = null;
    }
  }

  /*
   * Schedule ONLY the next change.
   *
   * We do NOT create thousands of
   * timers at once.
   */
  function scheduleNextEvent(
    timeline: LightTimeline,
    showStartTime: number
  ) {
    clearNextTimer();

    const now =
      Date.now();

    const position =
      now - showStartTime;

    const nextEvent =
      getNextLightEvent(
        timeline,
        position
      );

    if (!nextEvent) {
      return;
    }

    const delay =
      showStartTime +
      nextEvent.time -
      now;

    nextTimerRef.current =
      window.setTimeout(() => {

        setFlash(
          nextEvent.on
        );

        scheduleNextEvent(
          timeline,
          showStartTime
        );

      }, Math.max(0, delay));
  }

  /*
   * Synchronize the phone with
   * the current position of the show.
   */
  function synchronizeShow(
    showStartTime: number,
    timeline: LightTimeline
  ) {
    const position =
      Date.now() -
      showStartTime;

    /*
     * IMPORTANT:
     *
     * We immediately calculate the
     * state instead of starting from
     * the beginning.
     *
     * This is what makes late joining
     * possible.
     */
    const currentState =
      getLightStateAtTime(
        timeline,
        position
      );

    setFlash(currentState);

    /*
     * Then schedule the NEXT change.
     */
    scheduleNextEvent(
      timeline,
      showStartTime
    );
  }

  /*
   * Join the event.
   */
  async function joinShow() {
    if (!eventId) return;

    try {
      setError('');

      /*
       * Request camera access.
       *
       * The camera track is used because
       * torch control is exposed through
       * MediaStreamTrack.
       */
      const stream =
        await navigator.mediaDevices
          .getUserMedia({
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

      trackRef.current =
        track;

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

      /*
       * If the show is already running
       * when the person joins, synchronize
       * immediately.
       */
      if (
        event?.status === 'running' &&
        event.showStartTime &&
        event.lightTimeline
      ) {
        synchronizeShow(
          event.showStartTime,
          event.lightTimeline
        );
      }

    } catch (err) {
      console.error(err);

      setError(
        'Flashlight permission was denied or unavailable.'
      );
    }
  }

  /*
   * React to Firebase show state changes.
   *
   * If the organizer starts the show,
   * every phone receives the same
   * showStartTime.
   */
  useEffect(() => {
    if (!joined) return;
    if (!event) return;

    if (
      event.status === 'running' &&
      event.showStartTime &&
      event.lightTimeline
    ) {
      synchronizeShow(
        event.showStartTime,
        event.lightTimeline
      );
    }

    if (
      event.status !== 'running'
    ) {
      clearNextTimer();

      setFlash(false);
    }

  }, [
    joined,
    event?.status,
    event?.showStartTime,
    event?.lightTimeline,
  ]);

  /*
   * Cleanup.
   */
  useEffect(() => {
    return () => {
      clearNextTimer();

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

  /*
   * Join screen.
   */
  if (!joined) {
    return (
      <main className="light-page">
        <div className="light-content">

          <div className="light-logo">
            LIGHTSYNC
          </div>

          <div className="light-event-name">
            {event?.name}
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
    event?.status === 'running';

  return (
    <main
      className="light-page"
      style={{
        background: lightState
          ? '#ffffff'
          : '#08080c',
        color: lightState
          ? '#08080c'
          : '#ffffff',
      }}
    >
      <div className="light-content">

        <div className="light-logo">
          LIGHTSYNC
        </div>

        <div className="light-event-name">
          {event?.name}
        </div>

        <div className="light-status">
          CONNECTED
        </div>

        {running ? (
          <>
            <div className="show-live-text">
              SHOW LIVE
            </div>

            <div
              style={{
                fontSize: '4rem',
                marginTop: '30px',
              }}
            >
              {lightState
                ? 'ON'
                : 'OFF'}
            </div>

            <p className="waiting-description">
              Your flashlight is synchronized
              with the show.
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