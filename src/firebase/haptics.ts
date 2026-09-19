import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type HapticEventType = 'THREE_POINTER' | 'DUNK' | 'BLOCK' | 'BUZZER_BEATER';

export type HapticEvent = {
  activeHaptic: HapticEventType;
  timestamp: number;
};

export const HAPTIC_PATTERNS: Record<HapticEventType, number[]> = {
  THREE_POINTER: [280, 90, 280, 90, 280],
  DUNK: [1200],
  BLOCK: [420, 80, 700],
  BUZZER_BEATER: [220, 70, 220, 70, 320, 70, 420, 70, 1200],
};

/**
 * Kept as a no-op for backward compatibility with Join.tsx.
 * Audio fallback was intentionally removed: match-day feedback is vibration-first.
 */
export function initializeHapticAudio() {}

let hapticAudioContext: AudioContext | null = null;

function getHapticAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!hapticAudioContext) {
    const AudioContextClass = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioContextClass) return null;
    hapticAudioContext = new AudioContextClass();
  }
  return hapticAudioContext;
}

/**
 * Must be called from the user's Join button gesture so iOS Safari/Chrome
 * allow subsequent event sounds to play without another tap.
 */
export function initializeHapticAudio() {
  const context = getHapticAudioContext();
  if (!context) return;
  void context.resume().catch(() => {});
}

function playHapticSound(type: HapticEventType) {
  const context = getHapticAudioContext();
  if (!context) return;

  void context.resume().then(() => {
    const pattern = HAPTIC_PATTERNS[type];
    const startTime = context.currentTime + 0.01;
    let cursor = startTime;

    // A short, low-frequency impact tone is intentionally used so the
    // audience feels/hears each pulse without turning the event into music.
    const frequency = 180;
    const master = context.createGain();
    master.gain.value = 0.32;
    master.connect(context.destination);

    pattern.forEach((duration, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, cursor);

      const attack = Math.min(0.012, duration / 1000 / 5);
      const release = Math.min(0.06, duration / 1000 / 4);
      const pulseEnd = cursor + duration / 1000;
      gain.gain.setValueAtTime(0.0001, cursor);
      gain.gain.exponentialRampToValueAtTime(1, cursor + attack);
      gain.gain.setValueAtTime(1, Math.max(cursor + attack, pulseEnd - release));
      gain.gain.exponentialRampToValueAtTime(0.0001, pulseEnd);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(cursor);
      oscillator.stop(pulseEnd + 0.01);

      // Every entry is a vibration "on" duration. Entries after it are
      // separated by the corresponding gap from the existing pattern.
      cursor = pulseEnd;
      if (index < pattern.length - 1) {
        cursor += pattern[index + 1] / 1000;
      }
    });

    window.setTimeout(() => {
      master.disconnect();
    }, Math.max(2500, (cursor - context.currentTime) * 1000 + 100));
  }).catch(() => {});
}

export function triggerHaptic(type: HapticEventType, visible: boolean) {
  if (!visible) return;

  // On iOS Safari/Chrome the Vibration API is unavailable, so use the same
  // timing ratios as the physical vibration pattern as an audible fallback.
  playHapticSound(type);

  const supportsVibration =
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function';

  if (!supportsVibration) return;

  try {
    navigator.vibrate(HAPTIC_PATTERNS[type]);
  } catch {
    // Vibration is optional and must never affect the show.
  }
}

export function triggerHapticEvent(showId: string, activeHaptic: HapticEventType) {
  return set(ref(db, `hapticEvents/${showId}`), {
    activeHaptic,
    timestamp: Date.now(),
  });
}

export function watchHapticEvent(showId: string, callback: (event: HapticEvent | null) => void): Unsubscribe {
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