import { onDisconnect, onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ParticipantInfo = {
  connected: boolean;
  device: string;
  browser: string;
  joinedAt: number;
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
  };
  await set(participantRef, info);
  await onDisconnect(participantRef).update({ connected: false });
  return participantRef;
}

export async function setParticipantConnected(showId: string, participantId: string, connected: boolean) {
  await update(ref(db, `showParticipants/${showId}/${participantId}`), { connected });
}

export function watchParticipants(showId: string, callback: (participants: Record<string, ParticipantInfo>) => void): Unsubscribe {
  return onValue(ref(db, `showParticipants/${showId}`), snapshot => {
    callback((snapshot.val() ?? {}) as Record<string, ParticipantInfo>);
  });
}
