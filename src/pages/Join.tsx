import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { auth, db } from '../firebase/config';

import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';

import {
  onDisconnect,
  onValue,
  ref,
  set,
} from 'firebase/database';

import {
  getLightStateAtTime,
  getNextLightEvent,
  type LightTimeline,
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

  const [event, setEvent] = useState<EventData | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [lightState, setLightState] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const trackRef =
    useRef<MediaStreamTrack | null>(null);

  const participantPathRef =
    useRef<string | null>(null);

  const nextTimerRef =
    useRef<number | null>(null);

  const currentLightRef =
    useRef(false);

  /*
   * Load the event from Firebase.
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
   * Make sure the participant has
   * a Firebase Anonymous Auth identity.
   *
   * The Firebase UID becomes the participant ID.
   */
  useEffect(() => {
    let cancelled = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user: User | null) => {
          try {
            if (user) {
              if (!cancelled) {
                setAuthReady(true);
              }

              return;
            }

            await signInAnonymously(auth);

            if (!cancelled) {
              setAuthReady(true);
            }
          } catch (err) {
            console.error(
              'Anonymous authentication failed:',
              err
            );

            if (!cancelled) {
              setError(
                'Unable to connect to LightSync. Please try again.'
              );
            }
          }
        }
      );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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
      window.clearTimeout(
        nextTimerRef.current
      );

      nextTimerRef.current = null;
    }
  }

  /*
   * Schedule ONLY the next timeline event.
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

    const currentState =
      getLightStateAtTime(
        timeline,
        position
      );

    setFlash(currentState);

    scheduleNextEvent(
      timeline,
      showStartTime
    );
  }

  /*
   * Register the authenticated participant.
   *
   * Firebase Anonymous Auth gives us the UID.
   * Firebase onDisconnect() marks the participant
   * inactive if the connection disappears.
   */
  async function registerParticipant(
    user: User
  ) {
    if (!eventId) {
      throw new Error(
        'Missing event ID.'
      );
    }

    const participantPath =
      `events/${eventId}/participants/${user.uid}`;

    const participantRef =
      ref(db, participantPath);

    /*
     * Store the path so cleanup can use
     * the same participant identity.
     */
    participantPathRef.current =
      participantPath;

    /*
     * If Firebase detects that this client
     * disconnects, automatically mark it inactive.
     */
    await onDisconnect(
      participantRef
    ).set({
      active: false,
      leftAt: Date.now(),
    });

    /*
     * Mark the participant as active.
     */
    await set(
      participantRef,
      {
        joinedAt: Date.now(),
        active: true,
      }
    );
  }

  /*
   * Join the event.
   */
  async function joinShow() {
    if (!eventId) return;

    if (!authReady) {
      setError(
        'Connecting to LightSync. Please try again.'
      );

      return;
    }

    const user =
      auth.currentUser;

    if (!user) {
      setError(
        'Unable to establish a participant connection.'
      );

      return;
    }

    try {
      setError('');

      /*
       * Request camera access.
       *
       * The camera track is currently used
       * for physical torch control.
       */
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

      if (!track) {
        stream.getTracks().forEach(
          mediaTrack => mediaTrack.stop()
        );

        setError(
          'Unable to access the phone camera.'
        );

        return;
      }

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

      /*
       * Register using the Firebase
       * Anonymous Authentication UID.
       */
      await registerParticipant(
        user
      );

      setJoined(true);

      /*
       * If the show is already running
       * when the participant joins,
       * synchronize immediately.
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
      console.error(
        'Join error:',
        err
      );

      /*
       * Stop any camera tracks that may
       * have been opened before the error.
       */
      if (trackRef.current) {
        trackRef.current.stop();
        trackRef.current = null;
      }

      setError(
        'Flashlight permission was denied or unavailable.'
      );
    }
  }

  /*
   * React to Firebase show state changes.
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
        trackRef.current = null;
      }

      /*
       * Explicitly mark the participant inactive
       * when the React page is closed/unmounted.
       *
       * onDisconnect() remains the important
       * backup for unexpected disconnections.
       */
      if (
        participantPathRef.current
      ) {
        set(
          ref(
            db,
            participantPathRef.current
          ),
          {
            active: false,
            leftAt: Date.now(),
          }
        ).catch(() => {});
      }
    };
  }, []);

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
            disabled={!authReady}
          >
            {authReady
              ? 'JOIN SHOW'
              : 'CONNECTING...'}
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
