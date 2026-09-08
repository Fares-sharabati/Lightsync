import { onDisconnect, onValue, ref, set, type Unsubscribe } from 'firebase/database';
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
  return onValue(ref(db, `showParticipants/${showId}`), snapshot => {
    const raw = (snapshot.val() ?? {}) as Record<string, ParticipantInfo>;
    const unique: Record<string, ParticipantInfo> = {};

    for (const [uid, participant] of Object.entries(raw)) {
      const identity = participant.audienceId || uid;
      const previous = unique[identity];
      if (!previous || participant.joinedAt >= previous.joinedAt) unique[identity] = participant;
    }

    callback(unique);
  });
}