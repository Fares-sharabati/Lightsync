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

function triggerVisualFeedback(type: HapticEventType) {
  if (typeof document === 'undefined') return;

  const existing = document.querySelector('.fc-haptic-feedback');
  existing?.remove();

  const feedback = document.createElement('div');
  feedback.className = `fc-haptic-feedback fc-haptic-${type.toLowerCase()}`;
  feedback.setAttribute('aria-hidden', 'true');
  document.body.appendChild(feedback);

  // Let the browser paint a fresh element so the same event can retrigger
  // immediately when two game moments happen close together.
  window.requestAnimationFrame(() => {
    feedback.classList.add('is-active');
    window.setTimeout(() => feedback.remove(), 1800);
  });
}

export function triggerHaptic(type: HapticEventType, visible: boolean) {
  if (!visible) return;

  // Always provide a distinct visual reaction. This is the cross-browser
  // fallback for iOS Safari and other browsers without the Vibration API.
  triggerVisualFeedback(type);

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