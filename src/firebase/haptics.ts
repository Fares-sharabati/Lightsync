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
  if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) {
    console.info('[haptics] AudioContext unsupported on this device; audio fallback will be unavailable.');
    return;
  }
  try {
    const AudioContextCtor = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioContextCtor) return;
    if (!audioContext) audioContext = new AudioContextCtor();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    console.info(`[haptics] Audio context initialized (state: ${audioContext.state}).`);
  } catch (error) {
    console.warn('[haptics] Could not initialize audio context.', error);
    audioContext = null;
  }
}

export function playHapticFallback() {
  if (!audioContext) {
    console.warn('[haptics] Audio fallback unavailable: audio context was never initialized (joinShow() must run first).');
    return;
  }
  try {
    // iOS Safari can silently re-suspend an AudioContext after a period of
    // inactivity, even after it was successfully resumed once inside the
    // join button's user gesture. Nudge it awake before scheduling sound so
    // a haptic that fires minutes into the show doesn't play into a
    // suspended context and produce no audible result.
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
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
  } catch (error) {
    // Haptic/audio support is optional and must never affect the show.
    console.warn('[haptics] Audio fallback failed to play.', error);
  }
}

export function triggerHaptic(type: HapticEventType, visible: boolean) {
  // A backgrounded tab is the one case we deliberately do nothing for: mobile
  // browsers throttle/suspend both the Vibration API and AudioContext in
  // background tabs, so attempting either there is unreliable at best and,
  // for the audio fallback, would mean an unexpected chime playing from a
  // tab the fan isn't even looking at. Skip cleanly and silently.
  if (!visible) {
    console.info(`[haptics] Skipped ${type}: tab not visible.`);
    return;
  }

  const supportsVibration = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  if (supportsVibration) {
    try {
      // navigator.vibrate() returns false (without throwing) if the pattern
      // could not be queued - e.g. permissions, or a browser that defines
      // the method but doesn't actually support it. Treat that the same as
      // a thrown error and fall through to the audio fallback below, rather
      // than silently doing nothing.
      const accepted = navigator.vibrate(HAPTIC_PATTERNS[type]);
      if (accepted !== false) {
        console.info(`[haptics] Vibrated for ${type}.`);
        return;
      }
      console.warn(`[haptics] navigator.vibrate() rejected the pattern for ${type}; falling back to audio.`);
    } catch (error) {
      console.warn(`[haptics] navigator.vibrate() threw for ${type}; falling back to audio.`, error);
    }
  } else {
    console.info(`[haptics] Vibration API unsupported (likely iOS Safari); using audio fallback for ${type}.`);
  }

  playHapticFallback();
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