import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../firebase/config';
import { onValue, ref, set } from 'firebase/database';

const BUILT_IN_SONGS = [
  {
    id: 'song1',
    name: 'Song 1',
    file: '/songs/song1.mp3',
  },
  {
    id: 'song2',
    name: 'Song 2',
    file: '/songs/song2.mp3',
  },
  {
    id: 'song3',
    name: 'Song 3',
    file: '/songs/song3.mp3',
  },
  {
    id: 'song4',
    name: 'Song 4',
    file: '/songs/song4.mp3',
  },
  {
    id: 'song5',
    name: 'Song 5',
    file: '/songs/song5.mp3',
  },
];

type Song = {
  id: string;
  name: string;
  file: string;
  uploaded?: boolean;
};

type EventData = {
  name: string;
  createdAt: number;
  status: string;
  selectedSong?: {
    id: string;
    name: string;
    type: 'built-in' | 'upload';
  };
  showStartTime?: number | null;
  flashPattern?: number[];
};

export default function EventControl() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<EventData | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [uploadedSong, setUploadedSong] = useState<Song | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [starting, setStarting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const eventRef = ref(db, `events/${eventId}`);

    const unsubscribeEvent = onValue(eventRef, snapshot => {
      setEvent(snapshot.val());
    });

    const participantsRef = ref(
      db,
      `events/${eventId}/participants`
    );

    const unsubscribeParticipants = onValue(
      participantsRef,
      snapshot => {
        const data = snapshot.val();

        if (!data) {
          setParticipantCount(0);
          return;
        }

        const active = Object.values(data).filter(
          (participant: any) =>
            participant.active === true
        );

        setParticipantCount(active.length);
      }
    );

    return () => {
      unsubscribeEvent();
      unsubscribeParticipants();
    };
  }, [eventId]);

  function stopCurrentAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }

  async function loadAudio(song: Song) {
    stopCurrentAudio();

    const audio = new Audio(song.file);
    audio.preload = 'auto';

    audioRef.current = audio;

    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('canplaythrough', () => resolve(), {
        once: true,
      });

      audio.addEventListener('error', () => {
        reject(new Error('Could not load audio.'));
      }, {
        once: true,
      });

      audio.load();
    });
  }

  async function analyzeAudio(
    audioSource: string
  ): Promise<number[]> {
    const response = await fetch(audioSource);
    const arrayBuffer = await response.arrayBuffer();

    const AudioContextClass =
      window.AudioContext ||
      (window as any).webkitAudioContext;

    const context = new AudioContextClass();

    const audioBuffer =
      await context.decodeAudioData(arrayBuffer);

    const channelData =
      audioBuffer.getChannelData(0);

    const sampleRate = audioBuffer.sampleRate;

    /*
     * Analyze approximately every 50ms.
     */
    const windowSize =
      Math.floor(sampleRate * 0.05);

    const energy: number[] = [];

    for (
      let i = 0;
      i < channelData.length;
      i += windowSize
    ) {
      let sum = 0;

      const end = Math.min(
        i + windowSize,
        channelData.length
      );

      for (let j = i; j < end; j++) {
        sum += channelData[j] * channelData[j];
      }

      const rms = Math.sqrt(
        sum / Math.max(1, end - i)
      );

      energy.push(rms);
    }

    /*
     * Calculate average energy.
     */
    const average =
      energy.reduce((a, b) => a + b, 0) /
      Math.max(1, energy.length);

    /*
     * Detect strong peaks.
     */
    const pattern: number[] = [];

    const minimumGap = 0.25;

    let lastBeat = -Infinity;

    for (let i = 1; i < energy.length - 1; i++) {
      const current = energy[i];

      const previous = energy[i - 1];
      const next = energy[i + 1];

      const isPeak =
        current > previous &&
        current >= next &&
        current > average * 1.6;

      if (!isPeak) continue;

      const time = i * 0.05;

      if (time - lastBeat < minimumGap) {
        continue;
      }

      pattern.push(
        Math.round(time * 1000)
      );

      lastBeat = time;
    }

    await context.close();

    return pattern;
  }

  async function prepareSong(song: Song) {
    if (!eventId) return;

    setAnalyzing(true);

    try {
      await loadAudio(song);

      const pattern = await analyzeAudio(song.file);

      console.log(
        `Detected ${pattern.length} flash points`
      );

      await set(
        ref(
          db,
          `events/${eventId}/selectedSong`
        ),
        {
          id: song.id,
          name: song.name,
          type: song.uploaded
            ? 'upload'
            : 'built-in',
        }
      );

      await set(
        ref(
          db,
          `events/${eventId}/flashPattern`
        ),
        pattern
      );

      setSelectedSong(song);

    } catch (error) {
      console.error(
        'Could not prepare song:',
        error
      );

      alert(
        'Could not load or analyze this song.'
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function chooseBuiltInSong(song: Song) {
    if (event?.status === 'running') return;

    await prepareSong(song);
  }

  async function chooseUploadedSong(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file.');
      return;
    }

    if (event?.status === 'running') return;

    const url = URL.createObjectURL(file);

    const song: Song = {
      id: 'uploaded',
      name: file.name,
      file: url,
      uploaded: true,
    };

    setUploadedSong(song);

    await prepareSong(song);
  }

  async function startShow() {
    if (
      !eventId ||
      !event ||
      !audioRef.current ||
      !selectedSong ||
      analyzing ||
      starting
    ) {
      return;
    }

    setStarting(true);

    try {
      const startTime =
        Date.now() + 5000;

      await set(
        ref(db, `events/${eventId}`),
        {
          ...event,
          status: 'running',
          showStartTime: startTime,
        }
      );

      audioRef.current.currentTime = 0;

      const delay =
        Math.max(0, startTime - Date.now());

      await new Promise<void>(resolve => {
        setTimeout(resolve, delay);
      });

      await audioRef.current.play();

    } catch (error) {
      console.error(
        'Could not start show:',
        error
      );
    } finally {
      setStarting(false);
    }
  }

  async function stopShow() {
    if (!eventId || !event) return;

    stopCurrentAudio();

    await set(
      ref(db, `events/${eventId}`),
      {
        ...event,
        status: 'waiting',
        showStartTime: null,
      }
    );
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
        </div>

        <button
          className="button button-secondary"
          onClick={() => navigate('/admin')}
        >
          Back
        </button>
      </header>

      <section className="event-control-grid">

        <div className="card qr-card">

          <p className="eyebrow">
            SCAN TO JOIN
          </p>

          <h2>Join the Show</h2>

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
            Fans scan this QR code.
          </p>

          <div className="connected-number">
            {participantCount}
          </div>

          <p className="connected-label">
            Connected Phones
          </p>

        </div>

        <div className="card control-card">

          <p className="eyebrow">
            MUSIC
          </p>

          <h2>Built-in Music</h2>

          <div
            style={{
              display: 'grid',
              gap: '10px',
              marginTop: '16px',
            }}
          >
            {BUILT_IN_SONGS.map(song => (
              <button
                key={song.id}
                className={
                  selectedSong?.id === song.id
                    ? 'button button-primary'
                    : 'button button-secondary'
                }
                style={{
                  width: '100%',
                  textAlign: 'left',
                }}
                disabled={
                  running || analyzing
                }
                onClick={() =>
                  chooseBuiltInSong(song)
                }
              >
                {selectedSong?.id === song.id
                  ? '✓ '
                  : ''}
                {song.name}
              </button>
            ))}
          </div>

          <hr
            style={{
              margin: '28px 0',
              borderColor: '#292932',
            }}
          />

          <p className="eyebrow">
            CUSTOM MUSIC
          </p>

          <h2>Upload Your Own</h2>

          <input
            type="file"
            accept="audio/*"
            disabled={
              running || analyzing
            }
            onChange={chooseUploadedSong}
          />

          {uploadedSong && (
            <p className="song-selected">
              ✓ {uploadedSong.name}
            </p>
          )}

          {analyzing && (
            <p>
              Analyzing music and creating
              flash pattern...
            </p>
          )}

          {selectedSong && !analyzing && (
            <div
              style={{
                marginTop: '20px',
                padding: '14px',
                background: '#0d0d13',
                borderRadius: '12px',
              }}
            >
              <strong>Selected:</strong>

              <div
                style={{
                  color: '#9999a5',
                  marginTop: '5px',
                }}
              >
                {selectedSong.name}
              </div>
            </div>
          )}

          <div
            className="control-actions"
            style={{
              marginTop: '24px',
            }}
          >

            <button
              className="button button-primary control-button"
              onClick={startShow}
              disabled={
                starting ||
                running ||
                analyzing ||
                !selectedSong
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
              : 'READY'}
          </div>

        </div>

      </section>

    </main>
  );
}