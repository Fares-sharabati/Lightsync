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


/*
 * Determine a browser-friendly MIME type.
 */
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


  if (
    name.endsWith('.wav')
  ) {
    return 'audio/wav';
  }


  if (
    name.endsWith('.ogg') ||
    name.endsWith('.oga')
  ) {
    return 'audio/ogg';
  }


  if (
    name.endsWith('.webm')
  ) {
    return 'audio/webm';
  }


  if (
    name.endsWith('.aac')
  ) {
    return 'audio/aac';
  }


  if (
    name.endsWith('.flac')
  ) {
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


  const [musicReady, setMusicReady] =
    useState(false);


  const [audioSupported, setAudioSupported] =
    useState<boolean | null>(null);


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

        audioRef.current.removeAttribute(
          'src'
        );

        audioRef.current.load();

      }


      if (songUrl) {

        URL.revokeObjectURL(
          songUrl
        );

      }

    };

  }, [songUrl]);


  /*
   * Select a song.
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

      audioRef.current.removeAttribute(
        'src'
      );

      audioRef.current.load();

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
     * Remove previous URL.
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
     * Create browser-friendly Blob.
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
     * Create audio element.
     */
    const audio =
      new Audio();


    audio.preload =
      'auto';

    audio.volume =
      1;

    audio.src =
      localUrl;


    /*
     * Load it.
     */
    audio.load();


    /*
     * Check browser support.
     */
    const canPlay =
      audio.canPlayType(
        mimeType
      );


    console.log(
      'Browser audio support:',
      {
        mimeType,
        canPlay,
      }
    );


    setAudioSupported(
      canPlay !== ''
    );


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


    setGeneratedTimeline(
      null
    );


    setAnalysisMessage(
      ''
    );


    setMusicReady(
      false
    );


    setCountdown(
      null
    );

  }


  /*
   * Analyze song.
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
   * Prepare music.
   *
   * IMPORTANT:
   *
   * We do NOT wait for loadedmetadata here.
   *
   * The audio player has already demonstrated
   * that the browser can load/play this file.
   *
   * The user's click on this button is the
   * important browser permission gesture.
   */
  async function prepareMusic() {

    const audio =
      audioRef.current;


    if (!audio) {

      setAnalysisMessage(
        'Please select a song first.'
      );

      return;

    }


    if (!generatedTimeline) {

      setAnalysisMessage(
        'Analyze the song first.'
      );

      return;

    }


    try {

      console.log(
        'Preparing music...'
      );


      /*
       * Make sure playback starts from
       * the beginning.
       */
      audio.currentTime =
        0;


      /*
       * This happens directly from the
       * button click.
       */
      await audio.play();


      console.log(
        'Music playback permission granted.'
      );


      /*
       * Immediately pause.
       */
      audio.pause();

      audio.currentTime =
        0;


      setMusicReady(
        true
      );


      setAnalysisMessage(
        '✓ Music ready. You can start the show.'
      );


      console.log(
        '✓ Music is ready.'
      );


    } catch (error) {

      console.error(
        'Could not prepare music:',
        error
      );


      setMusicReady(
        false
      );


      setAnalysisMessage(
        'The browser blocked music playback. Click Prepare Music again.'
      );

    }

  }


  /*
   * Start synchronized show.
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

      console.warn(
        'Cannot start show. Missing:',
        {
          eventId: !!eventId,
          event: !!event,
          timeline: !!generatedTimeline,
          timelineLength:
            generatedTimeline?.length,
          audio:
            !!audioRef.current,
          musicReady,
        }
      );

      return;

    }


    setStarting(
      true
    );


    try {

      /*
       * Five-second synchronization window.
       */
      const startTime =
        Date.now() + 5000;


      /*
       * Reset local music.
       */
      audioRef.current.currentTime =
        0;


      /*
       * Send ONLY the timeline and timing
       * information to Firebase.
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
        'Show scheduled for:',
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
       * Schedule local music.
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
   * Stop show.
   */
  async function stopShow() {

    if (!eventId) return;


    /*
     * Cancel pending music.
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
     * Stop local music.
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


          {audioSupported === false && (
            <p className="muted">
              This browser does not appear to
              support playback of this audio file.
            </p>
          )}


          {audioSupported === true && (
            <p className="song-selected">
              ✓ Browser can play this audio
            </p>
          )}


          {/* AUDIO PLAYER */}

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


          {/* ANALYZE */}

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
            Music stays on the organizer's
            computer. Phones receive only
            the synchronized light timeline.
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
