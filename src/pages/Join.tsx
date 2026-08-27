import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

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

type EventData = {
  name?: string;
  status?: string;
};

export default function Join() {
  const { eventId } = useParams();

  const [event, setEvent] =
    useState<EventData | null>(null);

  const [authReady, setAuthReady] =
    useState(false);

  const [joined, setJoined] =
    useState(false);

  const [error, setError] =
    useState('');

  const [lightOn, setLightOn] =
    useState(false);

  const trackRef =
    useRef<MediaStreamTrack | null>(null);

  const participantRef =
    useRef<ReturnType<typeof ref> | null>(null);

  /*
   * Load the event.
   */
  useEffect(() => {
    if (!eventId) return;

    const eventRef =
      ref(db, `events/${eventId}`);

    const unsubscribe =
      onValue(eventRef, snapshot => {
        if (snapshot.exists()) {
          setEvent(snapshot.val());
        } else {
          setEvent(null);
        }
      });

    return unsubscribe;
  }, [eventId]);

  /*
   * Firebase Anonymous Authentication.
   *
   * The Firebase UID will become the participant ID.
   */
  useEffect(() => {
    let cancelled = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async user => {
          if (cancelled) return;

          try {
            if (user) {
              setAuthReady(true);
              return;
            }

            await signInAnonymously(auth);

            if (!cancelled) {
              setAuthReady(true);
            }
          } catch (err) {
            console.error(
              'Anonymous authentication error:',
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
   * Turn the phone flashlight on/off.
   */
  async function setTorch(
    enabled: boolean
  ) {
    const track =
      trackRef.current;

    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [
          {
            torch: enabled,
          } as any,
        ],
      });

      setLightOn(enabled);
    } catch (err) {
      console.error(
        'Unable to control flashlight:',
        err
      );
    }
  }

  /*
   * Register participant with Firebase.
   */
  async function registerParticipant(
    user: User
  ) {
    if (!eventId) {
      throw new Error(
        'Missing event ID.'
      );
    }

    /*
     * IMPORTANT:
     * Firebase UID is now the participant ID.
     */
    const participantRefPath =
      `events/${eventId}/participants/${user.uid}`;

    const participant =
      ref(db, participantRefPath);

    participantRef.current =
      participant;

    /*
     * Ask Firebase to automatically
     * mark this participant offline
     * when the connection is lost.
     */
    await onDisconnect(
      participant
    ).set({
      active: false,
      leftAt: Date.now(),
    });

    /*
     * Mark participant as connected.
     */
    await set(
      participant,
      {
        active: true,
        joinedAt: Date.now(),
      }
    );

    console.log(
      'LightSync participant registered:',
      user.uid
    );
  }

  /*
   * Join the show.
   */
  async function joinShow() {
    if (!eventId) {
      setError(
        'Invalid event.'
      );

      return;
    }

    if (!authReady) {
      setError(
        'Connecting to LightSync. Please wait.'
      );

      return;
    }

    const user =
      auth.currentUser;

    if (!user) {
      setError(
        'Unable to connect to LightSync. Please try again.'
      );

      return;
    }

    try {
      setError('');

      /*
       * Request camera access.
       * The camera track is required for
       * physical flashlight control.
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
        stream
          .getTracks()
          .forEach(mediaTrack =>
            mediaTrack.stop()
          );

        setError(
          'Unable to access the phone camera.'
        );

        return;
      }

      /*
       * Check whether the device supports
       * browser flashlight/torch control.
       */
      const capabilities =
        track.getCapabilities?.() as any;

      if (!capabilities?.torch) {
        stream
          .getTracks()
          .forEach(mediaTrack =>
            mediaTrack.stop()
          );

        setError(
          'This phone/browser does not support flashlight control.'
        );

        return;
      }

      trackRef.current =
        track;

      /*
       * Register ONLY after camera
       * permission and torch capability
       * have succeeded.
       */
      await registerParticipant(user);

      setJoined(true);
    } catch (err) {
      console.error(
        'Unable to join LightSync:',
        err
      );

      if (trackRef.current) {
        trackRef.current.stop();
        trackRef.current = null;
      }

      setError(
        'Unable to join the light show. Please try again.'
      );
    }
  }

  /*
   * Cleanup when the participant leaves
   * the page normally.
   *
   * onDisconnect() remains responsible
   * for unexpected connection loss.
   */
  useEffect(() => {
    return () => {
      /*
       * Turn flashlight off.
       */
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
       * Explicitly mark inactive on normal
       * page cleanup.
       */
      if (participantRef.current) {
        set(
          participantRef.current,
          {
            active: false,
            leftAt: Date.now(),
          }
        ).catch(() => {});
      }
    };
  }, []);

  /*
   * Event doesn't exist.
   */
  if (!event && eventId) {
    return (
      <main className="light-page">
        <div className="light-content">
          <div className="light-logo">
            LIGHTSYNC
          </div>

          <h1>
            Event not found
          </h1>

          <p>
            This LightSync event does not exist
            or is no longer available.
          </p>
        </div>
      </main>
    );
  }

  /*
   * Before joining.
   */
  if (!joined) {
    return (
      <main className="light-page">
        <div className="light-content">

          <div className="light-logo">
            LIGHTSYNC
          </div>

          <div className="light-event-name">
            {event?.name || 'LightSync Event'}
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

        </div>
      </main>
    );
  }

  /*
   * Participant is connected.
   */
  return (
    <main
      className="light-page"
      style={{
        background: lightOn
          ? '#ffffff'
          : '#08080c',
        color: lightOn
          ? '#08080c'
          : '#ffffff',
      }}
    >
      <div className="light-content">

        <div className="light-logo">
          LIGHTSYNC
        </div>

        <div className="light-event-name">
          {event?.name || 'LightSync Event'}
        </div>

        <div className="light-status">
          CONNECTED
        </div>

        <div className="connected-icon">
          ✓
        </div>

        <div className="waiting-message">
          READY
        </div>

        <p className="waiting-description">
          Waiting for the organizer to start
          the light show.
        </p>

      </div>
    </main>
  );
}
