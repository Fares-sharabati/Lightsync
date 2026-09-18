import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type HapticEventType = 'THREE_POINTER' | 'DUNK' | 'BLOCK' | 'BUZZER_BEATER';

export type HapticEvent = {
  activeHaptic: HapticEventType;
  timestamp: number;
};

export const HAPTIC_PATTERNS: Record<HapticEventType, number[]> = {
  THREE_POINTER: [150, 100, 150, 100, 150],
  DUNK: [800],
  BLOCK: [200, 50, 400],
  BUZZER_BEATER: [100, 50, 100, 50, 200, 50, 300, 50, 1000],
};

let audioContext: AudioContext | null = null;

export function initializeHapticAudio() {
  if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) return;
  try {
    const AudioContextCtor = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioContextCtor) return;
    if (!audioContext) audioContext = new AudioContextCtor();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
  } catch {
    audioContext = null;
  }
}

export function playHapticFallback() {
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  } catch {
    // Haptic/audio support is optional and must never affect the show.
  }
}

export function triggerHaptic(type: HapticEventType, visible: boolean) {
  if (visible && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(HAPTIC_PATTERNS[type]);
      return;
    } catch {
      // Continue silently to the audio fallback.
    }
  }
  if (!visible) playHapticFallback();
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
