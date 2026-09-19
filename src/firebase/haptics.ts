import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type HapticEventType = 'THREE_POINTER' | 'DUNK' | 'BLOCK' | 'BUZZER_BEATER';

export type HapticEvent = {
  activeHaptic: HapticEventType;
  timestamp: number;
};

// Patterns defined as [vibrateMs, pauseMs, vibrateMs, pauseMs, ...]
export const HAPTIC_PATTERNS: Record<HapticEventType, number[]> = {
  THREE_POINTER: [280, 90, 280, 90, 280],
  DUNK: [1200],
  BLOCK: [420, 80, 700],
  BUZZER_BEATER: [220, 70, 220, 70, 320, 70, 420, 70, 1200],
};

let hapticAudioContext: AudioContext | null = null;

function getHapticAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!hapticAudioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    hapticAudioContext = new AudioContextClass();
  }
  return hapticAudioContext;
}

export function initializeHapticAudio() {
  const context = getHapticAudioContext();
  if (!context) return;
  if (context.state === 'suspended') {
    void context.resume().catch(() => {});
  }
}

function playHapticSound(type: HapticEventType) {
  const context = getHapticAudioContext();
  if (!context) return;

  const runSound = () => {
    const rawPattern = HAPTIC_PATTERNS[type];
    const startTime = context.currentTime + 0.01;
    let currentTimeCursor = startTime;

    // Master Gain set to optimal level (prevents speaker distortion while staying punchy)
    const master = context.createGain();
    master.gain.setValueAtTime(0.45, startTime);
    master.connect(context.destination);

    // 340 Hz pierces through crowd noise significantly better than 180 Hz on mobile speakers
    const baseFrequency = 340;

    for (let i = 0; i < rawPattern.length; i += 2) {
      const pulseDuration = rawPattern[i] / 1000;
      const pauseDuration = i + 1 < rawPattern.length ? rawPattern[i + 1] / 1000 : 0;

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'triangle'; // Richer harmonics than pure sine for small phone speakers
      
      // Pitch drop effect gives a tight 'thud' feeling
      oscillator.frequency.setValueAtTime(baseFrequency, currentTimeCursor);
      oscillator.frequency.exponentialRampToValueAtTime(
        baseFrequency * 0.5,
        currentTimeCursor + Math.min(0.08, pulseDuration)
      );

      const attack = Math.min(0.008, pulseDuration / 4);
      const release = Math.min(0.04, pulseDuration / 3);
      const pulseEnd = currentTimeCursor + pulseDuration;

      // Clean linear envelope prevents clicking noise
      gain.gain.setValueAtTime(0.001, currentTimeCursor);
      gain.gain.linearRampToValueAtTime(1.0, currentTimeCursor + attack);
      gain.gain.setValueAtTime(1.0, Math.max(currentTimeCursor + attack, pulseEnd - release));
      gain.gain.linearRampToValueAtTime(0.001, pulseEnd);

      oscillator.connect(gain);
      gain.connect(master);

      oscillator.start(currentTimeCursor);
      oscillator.stop(pulseEnd + 0.02);

      // Correctly advance cursor by pulse duration PLUS gap duration
      currentTimeCursor = pulseEnd + pauseDuration;
    }

    // Cleanup node after playback ends
    const totalDurationMs = (currentTimeCursor - startTime) * 1000;
    window.setTimeout(() => {
      master.disconnect();
    }, Math.max(1500, totalDurationMs + 200));
  };

  if (context.state === 'suspended') {
    void context.resume().then(runSound).catch(() => {});
  } else {
    runSound();
  }
}

export function triggerHaptic(type: HapticEventType, visible: boolean) {
  if (!visible) return;

  // Execute synthesized haptic audio tone
  playHapticSound(type);

  // Execute physical device vibration where supported (Android Chrome)
  const supportsVibration =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  if (supportsVibration) {
    try {
      navigator.vibrate(HAPTIC_PATTERNS[type]);
    } catch {
      // Fail silently if restricted by OS policy
    }
  }
}

export function triggerHapticEvent(showId: string, activeHaptic: HapticEventType) {
  return set(ref(db, `hapticEvents/${showId}`), {
    activeHaptic,
    timestamp: Date.now(),
  });
}

export function watchHapticEvent(
  showId: string,
  callback: (event: HapticEvent | null) => void
): Unsubscribe {
  return onValue(ref(db, `hapticEvents/${showId}`), snapshot => {
    const value = snapshot.val();
    if (!value || typeof value !== 'object') {
      callback(null);
      return;
    }
    const activeHaptic = value.activeHaptic as HapticEventType;
    const timestamp = Number(value.timestamp);
    if (!(activeHaptic in HAPTIC_PATTERNS) || !Number.isFinite(timestamp)) {
      callback(null);
      return;
    }
    callback({ activeHaptic, timestamp });
  });
}