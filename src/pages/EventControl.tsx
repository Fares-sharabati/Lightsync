import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { db } from '../firebase/config';
import { onValue, ref, update } from 'firebase/database';

import { TEST_TIMELINE } from '../lightSync/timeline';

type EventData = {
  name: string;
  createdAt: number;
  status: string;
  showStartTime?: number | null;
};

export default function EventControl() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] =
    useState<EventData | null>(null);

  const [participantCount, setParticipantCount] =
    useState(0);

  const [starting, setStarting] =
    useState(false);

  /*
   * Listen to the event.
   */
  useEffect(() => {
    if (!eventId) return;

    const eventRef =
      ref(db, `events/${eventId}`);

    const unsubscribeEvent =
      onValue(eventRef, (snapshot) => {
        setEvent(snapshot.val());
      });

    /*
     * Listen to connected participants.
     */
    const participantsRef =
      ref(
        db,
        `events/${eventId}/participants`
      );

    const unsubscribeParticipants =
      onValue(
        participantsRef,
        (snapshot) => {
          const data = snapshot.val();

          if (!data) {
            setParticipantCount(0);
            return;
          }

          const active =
            Object.values(data).filter(
              (participant: any) =>
                participant.active === true
            );

          setParticipantCount(
            active.length
          );
        }
      );

    return () => {
      unsubscribeEvent();
      unsubscribeParticipants();
    };
  }, [eventId]);

  /*
   * Start the synchronized test show.
   */
  async function startShow() {
    if (!eventId || !event) return;
  
    setStarting(true);
  
    try {
      const startTime = Date.now() + 5000;
  
      await update(
        ref(db, `events/${eventId}`),
        {
          status: 'running',
          showStartTime: startTime,
          lightTimeline: TEST_TIMELINE,
        }
      );
  
      console.log(
        'Show scheduled for:',
        new Date(startTime)
      );
  
      // Firebase has accepted the show.
      // Allow the button to return to its normal state.
      setStarting(false);
  
    } catch (error) {
      console.error(
        'Could not start show:',
        error
      );
  
      setStarting(false);
    }
  }
  

  /*
   * Stop the show.
   */
  async function stopShow() {
    if (!eventId) return;

    try {
      await update(
        ref(db, `events/${eventId}`),
        {
          status: 'waiting',
          showStartTime: null,
        }
      );
    } catch (error) {
      console.error(
        'Could not stop show:',
        error
      );
    }
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

          <p className="event-id">
            Event ID: {eventId}
          </p>
        </div>

        <button
          className="button button-secondary"
          onClick={() => navigate('/admin')}
        >
          Back
        </button>

      </header>


      <section className="event-control-grid">

        {/* QR CODE */}

        <div className="card qr-card">

          <p className="eyebrow">
            JOIN THE SHOW
          </p>

          <h2>
            Scan to Join
          </h2>

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
            Scan this QR code with your phone.
          </p>

        </div>


        {/* CONTROL PANEL */}

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
            TEST SHOW
          </p>

          <p className="muted">
            This is a temporary synchronization
            test. No music is being used yet.
          </p>


          <div className="timeline-preview">

            <div>
              0.0s — OFF
            </div>

            <div>
              1.0s — ON
            </div>

            <div>
              2.0s — OFF
            </div>

            <div>
              2.5s — ON
            </div>

            <div>
              5.0s — OFF
            </div>

            <div>
              5.5s — ON
            </div>

            <div>
              8.0s — OFF
            </div>

            <div>
              9.0s — ON
            </div>

            <div>
              12.0s — OFF
            </div>

          </div>


          <div className="control-actions">

            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={
                starting || running
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