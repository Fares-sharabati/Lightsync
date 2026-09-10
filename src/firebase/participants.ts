import { onChildAdded, onChildChanged, onChildRemoved, onDisconnect, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

const AUDIENCE_ID_KEY = 'lightsync_audience_id';

function getAudienceId() {
  try {
    const existing = window.localStorage.getItem(AUDIENCE_ID_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(AUDIENCE_ID_KEY, id);
    return id;
  } catch {
    return 'audience_' + Math.random().toString(36).slice(2);
  }
}

export type ParticipantInfo = {
  connected: boolean;
  device: string;
  browser: string;
  joinedAt: number;
  uid?: string;
  audienceId?: string;
};

export function detectDevice() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone/iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows Phone/.test(ua)) return 'Windows Phone';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

export function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Other';
}

export async function registerParticipant(showId: string, participantId: string) {
  const participantRef = ref(db, `showParticipants/${showId}/${participantId}`);
  const info: ParticipantInfo = {
    connected: true,
    device: detectDevice(),
    browser: detectBrowser(),
    joinedAt: Date.now(),
    uid: participantId,
    audienceId: getAudienceId(),
  };

  await set(participantRef, info);
  try {
    await onDisconnect(participantRef).update({ connected: false });
  } catch (err) {
    console.error('Could not arm disconnect handler:', err);
  }
  return participantRef;
}

export function watchParticipants(showId: string, callback: (participants: Record<string, ParticipantInfo>) => void): Unsubscribe {
  // IMPORTANT: this used to be a single onValue() on the whole
  // showParticipants/{showId} node. onValue re-sends the ENTIRE node to
  // this listener every time a single child changes - so with a few
  // thousand fans joining/leaving, every single join would download the
  // whole (growing) participant list again. At thousands of attendees that
  // turns into a firehose of duplicate data hitting the organizer's one
  // browser tab right as the show is starting.
  //
  // Instead we listen for individual child add/change/remove events (each
  // only ships the one record that changed) and keep the merged view in
  // memory locally, which is essentially free.
  const baseRef = ref(db, `showParticipants/${showId}`);
  const raw: Record<string, ParticipantInfo> = {};
  let frame: number | null = null;

  function emit() {
    const unique: Record<string, ParticipantInfo> = {};
    for (const [uid, participant] of Object.entries(raw)) {
      const identity = participant.audienceId || uid;
      const previous = unique[identity];
      if (!previous || participant.joinedAt >= previous.joinedAt) unique[identity] = participant;
    }
    callback(unique);
  }

  // A burst of joins can fire dozens of child events within the same
  // moment (e.g. right before kickoff). Coalesce those into a single UI
  // update per animation frame instead of one React state update per event.
  function scheduleEmit() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; emit(); });
  }

  const stopAdded = onChildAdded(baseRef, snapshot => {
    if (!snapshot.key) return;
    raw[snapshot.key] = snapshot.val() as ParticipantInfo;
    scheduleEmit();
  });
  const stopChanged = onChildChanged(baseRef, snapshot => {
    if (!snapshot.key) return;
    raw[snapshot.key] = snapshot.val() as ParticipantInfo;
    scheduleEmit();
  });
  const stopRemoved = onChildRemoved(baseRef, snapshot => {
    if (!snapshot.key) return;
    delete raw[snapshot.key];
    scheduleEmit();
  });

  // Emit an initial (empty) state immediately so callers relying on a first
  // callback aren't left hanging while child_added events stream in.
  emit();

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    stopAdded();
    stopChanged();
    stopRemoved();
  };
}