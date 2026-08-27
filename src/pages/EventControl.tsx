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


function getAudioMimeType(file: File): string {

  const name =
    file.name.toLowerCase();

  if (
    name.endsWith('.mp3') ||
    name.endsWith('.mpeg')
  ) {
    return 'audio/mpeg';
  }

  if (
    name.endsWith('.m4a') ||
    name.endsWith('.mp4')
  ) {
    return 'audio/mp4';
  }

  if (name.endsWith('.wav')) {
    return 'audio/wav';
  }

  if (
    name.endsWith('.ogg') ||
    name.endsWith('.oga')
  ) {
    return 'audio/ogg';
  }

  if (name.endsWith('.webm')) {
    return 'audio/webm';
  }

  if (name.endsWith('.aac')) {
    return 'audio/aac';
  }

  if (name.endsWith('.flac')) {
    return 'audio/flac';
  }

  return file.type || 'audio/mpeg';
}


export default function EventControl() {

  const navigate = useNavigate();

  const { eventId } =
    useParams();


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


  const [countdown, setCountdown] =
    useState<number | null>(null);


  const audioRef =
    useRef<HTMLAudioElement | null>(null);


  const countdownTimerRef =
    useRef<number | null>(null);


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
   * Cleanup timers/audio.
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

      }

    };

  }, []);


  /*
   * Select song.
   */
  function chooseSong(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      e.target.files?.[0];


    if (!file) return;


    /*
     * Stop previous audio.
     */
    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime = 0;

      audioRef.current.removeAttribute(
        'src'
      );

      audioRef.current.load();

      audioRef.current = null;

    }


    /*
     * Revoke previous URL.
     */
    if (songUrl) {

      URL.revokeObjectURL(
        songUrl
      );

    }


    const mimeType =
      getAudioMimeType(file);


    console.log(
      'Selected audio:',
      {
        name: file.name,
        originalType: file.type,
        detectedType: mimeType,
        size: file.size,
      }
    );


    /*
     * Create a browser-friendly Blob.
     */
    const audioBlob =
      new Blob(
        [file],
        {
          type: mimeType,
        }
      );


    const localUrl =
      URL.createObjectURL(
        audioBlob
      );


    /*
     * Create the actual audio player.
     */
    const audio =
      new Audio();


    audio.preload =
      'auto';

    audio.volume =
      1;

    audio.src =
      localUrl;


    audio.load();


    audio.addEventListener(
      'error',
      () => {

        console.error(
          'Audio element error:',
          audio.error
        );

      }
    );


    audioRef.current =
      audio;


    setSongFile(
      file
    );


    setSongName(
      file.name
    );


    setSongUrl(
      localUrl
    );


    /*
     * New song means new analysis.
     */
    setGeneratedTimeline(
      null
    );


    setAnalysisMessage(
      ''
    );


    setCountdown(
      null
    );

  }


  /*
   * Analyze the selected song.
   */
  async function analyzeSong() {

    if (!songFile) {

      setAnalysisMessage(
        'Please select an audio file first.'
      );

      return;

    }


    setAnalyzing(
      true
    );


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
        'Detected beats:',
        analysis.beats
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


      setGeneratedTimeline(
        null
      );


      setAnalysisMessage(
        'Could not analyze this audio file.'
      );

    } finally {

      setAnalyzing(
        false
      );

    }

  }


  /*
   * START SHOW
   *
   * This button is intentionally the
   * direct user action that starts music.
   *
   * No Prepare Music step.
   */
  async function startShow() {

    console.log(
      'START SHOW clicked'
    );


    if (!eventId) {

      console.error(
        'No event ID.'
      );

      return;

    }


    if (!generatedTimeline) {

      console.error(
        'No generated timeline.'
      );

      setAnalysisMessage(
        'Analyze the song before starting the show.'
      );

      return;

    }


    if (!audioRef.current) {

      console.error(
        'No audio player.'
      );

      setAnalysisMessage(
        'Please select the song again.'
      );

      return;

    }


    setStarting(
      true
    );


    try {

      /*
       * Five seconds gives phones time
       * to receive the Firebase update.
       */
      const startTime =
        Date.now() + 5000;


      /*
       * Reset laptop music.
       */
      audioRef.current.currentTime =
        0;


      /*
       * IMPORTANT:
       *
       * Firebase receives only:
       *
       * - status
       * - start time
       * - light timeline
       *
       * The music file never leaves
       * the organizer's computer.
       */
      await update(
        ref(
          db,
          `events/${eventId}`
        ),
        {
          status:
            'running',

          showStartTime:
            startTime,

          lightTimeline:
            generatedTimeline,
        }
      );


      console.log(
        'Show scheduled:',
        new Date(startTime)
      );


      /*
       * Countdown.
       */
      setCountdown(
        5
      );


      countdownTimerRef.current =
        window.setInterval(
          () => {

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

          },
          1000
        );


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
                '🎵 Music started on organizer laptop.'
              );


            } catch (error) {

              console.error(
                'Music playback failed:',
                error
              );


              setAnalysisMessage(
                'The browser blocked music playback. Click Start Show again.'
              );

            }

          },
          delay
        );


      setStarting(
        false
      );


    } catch (error) {

      console.error(
        'Could not start show:',
        error
      );


      setStarting(
        false
      );


      setCountdown(
        null
      );

    }

  }


  /*
   * STOP SHOW
   */
  async function stopShow() {

    console.log(
      'STOP SHOW clicked'
    );


    if (!eventId) return;


    /*
     * Cancel pending start.
     */
    if (
      startTimerRef.current !== null
    ) {

      window.clearTimeout(
        startTimerRef.current
      );

      startTimerRef.current =
        null;

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

      countdownTimerRef.current =
        null;

    }


    setCountdown(
      null
    );


    /*
     * Stop laptop music.
     */
    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime =
        0;

    }


    try {

      await update(
        ref(
          db,
          `events/${eventId}`
        ),
        {
          status:
            'waiting',

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
   * Loading.
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


  /*
   * The Start button is now disabled
   * ONLY when:
   *
   * - already starting
   * - show already running
   * - no song
   * - no timeline
   */
  const startDisabled =
    starting ||
    running ||
    !songFile ||
    !generatedTimeline;


  /*
   * Stop is enabled while the show
   * is running OR during countdown.
   */
  const stopDisabled =
    !running &&
    countdown === null;


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
          type="button"
          className="button button-secondary"
          onClick={() =>
            navigate('/admin')
          }
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


          {/* MUSIC */}

          <p className="eyebrow">
            MUSIC
          </p>


          <input
            type="file"
            accept="audio/*,.mp3,.mpeg,.m4a,.wav,.ogg,.webm,.aac,.flac"
            onChange={chooseSong}
          />


          {songName && (
            <p className="song-selected">
              ✓ {songName}
            </p>
          )}


          {songUrl && (
            <audio
              controls
              preload="metadata"
              src={songUrl}
              style={{
                width: '100%',
                marginTop: '12px',
              }}
            >
              Your browser does not support
              audio playback.
            </audio>
          )}


          <button
            type="button"
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
            receive only the synchronized
            light timeline.
          </p>


          {countdown !== null && (
            <div className="event-status-large">
              STARTING IN {countdown}
            </div>
          )}


          <div className="control-actions">


            <button
              type="button"
              className="button button-primary control-button"
              onClick={startShow}
              disabled={startDisabled}
            >
              {starting
                ? 'Starting...'
                : 'Start Show'}
            </button>


            <button
              type="button"
              className="button button-secondary control-button"
              onClick={stopShow}
              disabled={stopDisabled}
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


          {/* DEBUG INFORMATION */}

          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              borderRadius: '10px',
              background:
                'rgba(255,255,255,0.04)',
              fontSize: '12px',
              fontFamily:
                'monospace',
            }}
          >

            <div>
              Song: {songFile ? 'YES' : 'NO'}
            </div>

            <div>
              Timeline:{' '}
              {generatedTimeline
                ? `${generatedTimeline.length} events`
                : 'NO'}
            </div>

            <div>
              Running: {running ? 'YES' : 'NO'}
            </div>

            <div>
              Starting: {starting ? 'YES' : 'NO'}
            </div>

            <div>
              Start disabled:{' '}
              {startDisabled
                ? 'YES'
                : 'NO'}
            </div>

            <div>
              Stop disabled:{' '}
              {stopDisabled
                ? 'YES'
                : 'NO'}
            </div>

          </div>


        </div>

      </section>

    </main>
  );
}
