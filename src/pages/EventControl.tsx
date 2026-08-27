import { useEffect, useRef, useState } from 'react';
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


  const [songUrl, setSongUrl] =
    useState<string | null>(null);


  const [analyzing, setAnalyzing] =
    useState(false);


  const [analysisMessage, setAnalysisMessage] =
    useState('');


  const [generatedTimeline, setGeneratedTimeline] =
    useState<LightTimeline | null>(null);


  /*
   * Local audio element.
   *
   * The music stays on the organizer's computer.
   * It is never uploaded to Firebase.
   */
  const audioRef =
    useRef<HTMLAudioElement | null>(null);


  /*
   * Timer used to start the local music.
   */
  const startTimerRef =
    useRef<number | null>(null);


  /*
   * Listen to the event.
   */
  useEffect(() => {

    if (!eventId) return;


    const eventRef =
      ref(
        db,
        `events/${eventId}`
      );


    const unsubscribeEvent =
      onValue(
        eventRef,
        (snapshot) => {
          setEvent(
            snapshot.val()
          );
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
   * Clean up audio and timer when
   * leaving the page.
   */
  useEffect(() => {

    return () => {

      if (startTimerRef.current !== null) {

        window.clearTimeout(
          startTimerRef.current
        );

        startTimerRef.current = null;
      }


      if (audioRef.current) {

        audioRef.current.pause();

        audioRef.current.currentTime = 0;

        audioRef.current.src = '';
      }


      if (songUrl) {

        URL.revokeObjectURL(
          songUrl
        );
      }

    };

  }, [songUrl]);


  /*
   * Choose a local music file.
   */
  function chooseSong(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      e.target.files?.[0];


    if (!file) return;


    /*
     * Stop previous song.
     */
    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime = 0;

      audioRef.current.src = '';

      audioRef.current = null;
    }


    /*
     * Cancel any scheduled start.
     */
    if (startTimerRef.current !== null) {

      window.clearTimeout(
        startTimerRef.current
      );

      startTimerRef.current = null;
    }


    /*
     * Remove previous local URL.
     */
    if (songUrl) {

      URL.revokeObjectURL(
        songUrl
      );
    }


    /*
     * Create a local browser URL.
     *
     * This does NOT upload the song.
     */
    const localUrl =
      URL.createObjectURL(
        file
      );


    const audio =
      new Audio(localUrl);


    audio.preload = 'auto';


    audioRef.current =
      audio;


    setSongFile(file);

    setSongName(file.name);

    setSongUrl(localUrl);


    /*
     * Selecting another song invalidates
     * the previous timeline.
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
      generatedTimeline.length === 0 ||
      !audioRef.current
    ) {
      return;
    }


    setStarting(true);


    try {

      /*
       * The important part:
       *
       * We call play() immediately as part
       * of the user's button click.
       *
       * This satisfies browser autoplay rules.
       */
      const audio =
        audioRef.current;


      audio.currentTime = 0;


      /*
       * Start the audio immediately.
       *
       * We will pause it almost immediately
       * and then start it at the synchronized
       * start time.
       */
      try {

        await audio.play();

      } catch (error) {

        console.error(
          'Browser rejected audio playback:',
          error
        );

        setAnalysisMessage(
          'The browser blocked music playback. Click the page once and press Start Show again.'
        );

        setStarting(false);

        return;
      }


      /*
       * Pause immediately after unlocking
       * audio playback.
       */
      audio.pause();

      audio.currentTime = 0;


      /*
       * Schedule the actual synchronized
       * start 5 seconds in the future.
       */
      const startTime =
        Date.now() + 5000;


      /*
       * Send ONLY the timing and light
       * timeline to Firebase.
       *
       * The song itself remains local.
       */
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


      /*
       * Calculate how long we need to wait.
       */
      const delay =
        Math.max(
          0,
          startTime - Date.now()
        );


      /*
       * Schedule local music playback.
       */
      startTimerRef.current =
        window.setTimeout(
          async () => {

            startTimerRef.current =
              null;


            try {

              if (!audioRef.current) {
                return;
              }


              audioRef.current.currentTime =
                0;


              await audioRef.current.play();


              console.log(
                'Local music started at scheduled time.'
              );


            } catch (error) {

              console.error(
                'Scheduled music playback failed:',
                error
              );

            }

          },
          delay
        );


      /*
       * Firebase accepted the show.
       */
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


    /*
     * Cancel scheduled music start.
     */
    if (startTimerRef.current !== null) {

      window.clearTimeout(
        startTimerRef.current
      );

      startTimerRef.current = null;
    }


    /*
     * Stop local music.
     */
    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime = 0;
    }


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
   * Wait for event data.
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


          {/* SHOW CONTROL */}

          <p className="eyebrow">
            SHOW CONTROL
          </p>


          <p className="muted">
            Music plays locally on the
            organizer's computer. Phones
            receive only the light timeline.
          </p>


          <div className="control-actions">


            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={
                starting ||
                running ||
                !generatedTimeline ||
                !songFile
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
