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


  const [musicReady, setMusicReady] =
    useState(false);


  const [countdown, setCountdown] =
    useState<number | null>(null);


  const audioRef =
    useRef<HTMLAudioElement | null>(null);


  const countdownTimerRef =
    useRef<number | null>(null);


  const startTimerRef =
    useRef<number | null>(null);


  /*
   * Listen to event.
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
     * Listen to participants.
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
   * Cleanup.
   */
  useEffect(() => {

    return () => {

      if (
        startTimerRef.current !== null
      ) {

        window.clearTimeout(
          startTimerRef.current
        );

      }


      if (
        countdownTimerRef.current !== null
      ) {

        window.clearInterval(
          countdownTimerRef.current
        );

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
   * Select a local song.
   */
  function chooseSong(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      e.target.files?.[0];


    if (!file) return;


    /*
     * Stop old audio.
     */
    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime = 0;

      audioRef.current.src = '';

      audioRef.current = null;

    }


    /*
     * Cancel old timers.
     */
    if (
      startTimerRef.current !== null
    ) {

      window.clearTimeout(
        startTimerRef.current
      );

      startTimerRef.current = null;

    }


    if (
      countdownTimerRef.current !== null
    ) {

      window.clearInterval(
        countdownTimerRef.current
      );

      countdownTimerRef.current = null;

    }


    /*
     * Remove old local URL.
     */
    if (songUrl) {

      URL.revokeObjectURL(
        songUrl
      );

    }


    /*
     * Create local browser URL.
     *
     * The file remains on this computer.
     */
    const localUrl =
      URL.createObjectURL(
        file
      );


    const audio =
      new Audio(localUrl);


    audio.preload = 'auto';

    audio.volume = 1;


    audioRef.current =
      audio;


    setSongFile(file);

    setSongName(file.name);

    setSongUrl(localUrl);


    /*
     * New song requires new analysis.
     */
    setGeneratedTimeline(null);

    setAnalysisMessage('');

    setMusicReady(false);

    setCountdown(null);

  }


  /*
   * Analyze the song locally.
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
   * Prepare the music.
   *
   * This MUST be triggered directly by the
   * organizer clicking the button.
   *
   * This is what gives the browser permission
   * to play audio later.
   */
  async function prepareMusic() {

    if (!audioRef.current) return;


    const audio =
      audioRef.current;


    try {

      /*
       * Start playback as part of the
       * user's button click.
       */
      await audio.play();


      /*
       * Immediately pause it.
       *
       * The important part is that the browser
       * has now received a legitimate user gesture
       * allowing this media element to play.
       */
      audio.pause();

      audio.currentTime = 0;


      setMusicReady(true);

      setAnalysisMessage(
        '✓ Music ready. You can start the show.'
      );


      console.log(
        'Music playback unlocked.'
      );


    } catch (error) {

      console.error(
        'Could not prepare music:',
        error
      );


      setMusicReady(false);


      setAnalysisMessage(
        'The browser still blocked music. Try clicking Prepare Music again.'
      );

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
      !audioRef.current ||
      !musicReady
    ) {

      return;

    }


    setStarting(true);


    try {

      /*
       * Five seconds gives the phones time
       * to receive the timeline.
       */
      const startTime =
        Date.now() + 5000;


      /*
       * Reset local music.
       */
      audioRef.current.currentTime = 0;


      /*
       * Send timeline + start time.
       *
       * The actual music file stays local.
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
       * Start visible countdown.
       */
      setCountdown(5);


      countdownTimerRef.current =
        window.setInterval(() => {

          setCountdown(
            (current) => {

              if (
                current === null ||
                current <= 1
              ) {

                if (
                  countdownTimerRef.current !== null
                ) {

                  window.clearInterval(
                    countdownTimerRef.current
                  );

                  countdownTimerRef.current =
                    null;

                }


                return null;

              }


              return current - 1;

            }
          );

        }, 1000);


      /*
       * Schedule laptop music.
       */
      const delay =
        Math.max(
          0,
          startTime - Date.now()
        );


      startTimerRef.current =
        window.setTimeout(
          async () => {

            startTimerRef.current =
              null;


            if (!audioRef.current) {
              return;
            }


            try {

              audioRef.current.currentTime =
                0;


              await audioRef.current.play();


              console.log(
                '🎵 Local music started.'
              );


            } catch (error) {

              console.error(
                'Music playback failed:',
                error
              );

            }

          },
          delay
        );


      setStarting(false);


    } catch (error) {

      console.error(
        'Could not start show:',
        error
      );


      setStarting(false);

      setCountdown(null);

    }

  }


  /*
   * Stop show.
   */
  async function stopShow() {

    if (!eventId) return;


    /*
     * Cancel scheduled music.
     */
    if (
      startTimerRef.current !== null
    ) {

      window.clearTimeout(
        startTimerRef.current
      );

      startTimerRef.current = null;

    }


    /*
     * Cancel countdown.
     */
    if (
      countdownTimerRef.current !== null
    ) {

      window.clearInterval(
        countdownTimerRef.current
      );

      countdownTimerRef.current = null;

    }


    setCountdown(null);


    /*
     * Stop laptop music.
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
   * Wait for Firebase event.
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


          {/* PREPARE MUSIC */}

          {songFile && (
            <button
              className="button button-secondary"
              onClick={prepareMusic}
              disabled={
                !generatedTimeline ||
                musicReady ||
                running
              }
            >
              {musicReady
                ? '✓ Music Ready'
                : 'Prepare Music'}
            </button>
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


          {countdown !== null && (
            <div className="event-status-large">
              STARTING IN {countdown}
            </div>
          )}


          <div className="control-actions">

            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={
                starting ||
                running ||
                !generatedTimeline ||
                !songFile ||
                !musicReady
              }
            >
              {starting
                ? 'Starting...'
                : 'Start Show'}
            </button>


            <button
              className="button button-secondary control-button"
              onClick={stopShow}
              disabled={
                !running &&
                countdown === null
              }
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
