import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { db } from '../firebase/config';
import {
  onValue,
  ref,
  update,
} from 'firebase/database';

import {
  analyzeAudioFile,
} from '../lightSync/audioAnalyzer';

import {
  generateLightTimeline,
  type LightTimeline,
} from '../lightSync/timeline';


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


  const [songName, setSongName] =
    useState('');


  const [songFile, setSongFile] =
    useState<File | null>(null);


  const [analyzing, setAnalyzing] =
    useState(false);


  const [analysisMessage, setAnalysisMessage] =
    useState('');


  const [generatedTimeline, setGeneratedTimeline] =
    useState<LightTimeline | null>(null);


  /*
   * Listen to the event.
   */
  useEffect(() => {
    if (!eventId) return;


    const eventRef =
      ref(db, `events/${eventId}`);


    const unsubscribeEvent =
      onValue(
        eventRef,
        (snapshot) => {
          setEvent(snapshot.val());
        }
      );


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
          const data =
            snapshot.val();


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
   * Choose a local music file.
   *
   * The file stays on the organizer's computer.
   * It is NOT uploaded to Firebase.
   */
  function chooseSong(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];


    if (!file) return;


    setSongFile(file);
    setSongName(file.name);


    /*
     * Selecting a new song invalidates
     * the previous analysis.
     */
    setGeneratedTimeline(null);
    setAnalysisMessage('');
  }


  /*
   * Analyze the selected song locally.
   */
  async function analyzeSong() {
    if (!songFile) return;


    setAnalyzing(true);

    setAnalysisMessage(
      'Analyzing music...'
    );


    try {
      const analysis =
        await analyzeAudioFile(
          songFile
        );


      const timeline =
        generateLightTimeline(
          analysis.beats
        );


      setGeneratedTimeline(
        timeline
      );


      setAnalysisMessage(
        `Analysis complete — ${analysis.beats.length} beats detected.`
      );


      console.log(
        'Audio analysis:',
        analysis
      );


      console.log(
        'Generated light timeline:',
        timeline
      );


    } catch (error) {
      console.error(
        'Audio analysis failed:',
        error
      );


      setAnalysisMessage(
        'Could not analyze this audio file.'
      );


      setGeneratedTimeline(null);


    } finally {
      setAnalyzing(false);
    }
  }


  /*
   * Start the synchronized show.
   */
  async function startShow() {
    if (
      !eventId ||
      !event ||
      !generatedTimeline ||
      generatedTimeline.length === 0
    ) {
      return;
    }


    setStarting(true);


    try {
      /*
       * Give all phones 5 seconds to receive
       * the Firebase update.
       */
      const startTime =
        Date.now() + 5000;


      await update(
        ref(
          db,
          `events/${eventId}`
        ),
        {
          status: 'running',

          showStartTime:
            startTime,

          lightTimeline:
            generatedTimeline,
        }
      );


      console.log(
        'Show scheduled for:',
        new Date(startTime)
      );


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
        ref(
          db,
          `events/${eventId}`
        ),
        {
          status: 'waiting',

          showStartTime:
            null,
        }
      );


    } catch (error) {
      console.error(
        'Could not stop show:',
        error
      );
    }
  }


  /*
   * Wait for Firebase event data.
   */
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


          <h1>
            {event.name}
          </h1>


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


        {/* =========================
            QR CODE
        ========================== */}

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


        {/* =========================
            CONTROL PANEL
        ========================== */}

        <div className="card control-card">


          {/* AUDIENCE */}

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


          {/* MUSIC */}

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


          <button
            className="button button-secondary"
            onClick={analyzeSong}
            disabled={
              !songFile ||
              analyzing
            }
          >
            {analyzing
              ? 'Analyzing...'
              : 'Analyze Song'}
          </button>


          {analysisMessage && (
            <p className="muted">
              {analysisMessage}
            </p>
          )}


          {generatedTimeline && (
            <p className="song-selected">
              ✓ Light timeline ready
            </p>
          )}


          <hr />


          {/* SHOW CONTROLS */}

          <p className="eyebrow">
            SHOW CONTROL
          </p>


          <div className="control-actions">


            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={
                starting ||
                running ||
                !generatedTimeline
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
