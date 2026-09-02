import { equalTo, onValue, orderByChild, push, query, ref, set, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStatus = 'waiting' | 'running' | 'finished';
export type ShowKind = 'show' | 'sports';
export type Show = { id: string; organizerId: string; name: string; date: string; venue: string; status: ShowStatus; kind: ShowKind; createdAt: number; showStartTime?: number | null; lightTimeline?: unknown; screenLightColor?: string };
export type PublicShow = Omit<Show, 'organizerId' | 'createdAt'>;
export type CreateShowInput = { name: string; date: string; venue: string; kind: ShowKind };

export async function createShow(organizerId: string, input: CreateShowInput) {
  const showRef = push(ref(db, 'shows'));
  const showId = showRef.key;
  if (!showId) throw new Error('Could not create show ID.');
  const show = { organizerId, name: input.name.trim(), date: input.date, venue: input.venue.trim(), kind: input.kind, status: 'waiting' as ShowStatus, createdAt: Date.now(), showStartTime: null, screenLightColor: '#071B3A' };
  await set(showRef, show);
  await set(ref(db, `publicShows/${showId}`), { name: show.name, date: show.date, venue: show.venue, kind: show.kind, status: show.status, showStartTime: null, lightTimeline: null, screenLightColor: show.screenLightColor });
  await set(ref(db, `showStats/${showId}`), { totalScans: 0, totalJoined: 0, peakConnected: 0 });
  return showId;
}

export function watchShow(showId: string, callback: (show: Show | null) => void): Unsubscribe {
  return onValue(ref(db, `shows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? { id: showId, ...value } : null); });
}

export function watchPublicShow(showId: string, callback: (show: PublicShow | null) => void): Unsubscribe {
  return onValue(ref(db, `publicShows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? { id: showId, ...value } : null); });
}

export function watchOrganizerShows(organizerId: string, callback: (shows: Show[]) => void): Unsubscribe {
  const showsQuery = query(ref(db, 'shows'), orderByChild('organizerId'), equalTo(organizerId));
  return onValue(showsQuery, snapshot => {
    const value = snapshot.val() ?? {};
    callback(Object.entries(value).map(([id, show]) => ({ id, ...(show as Omit<Show, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt));
  });
}

export async function updateShow(showId: string, changes: Partial<Omit<Show, 'id' | 'organizerId'>>) {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) updates[`shows/${showId}/${key}`] = value;
  for (const key of ['name', 'date', 'venue', 'kind', 'status', 'showStartTime', 'lightTimeline', 'screenLightColor']) if (key in changes) updates[`publicShows/${showId}/${key}`] = (changes as Record<string, unknown>)[key];
  await update(ref(db), updates);
}

export async function deleteShow(showId: string) {
  await update(ref(db), {
    [`shows/${showId}`]: null, [`publicShows/${showId}`]: null, [`showParticipants/${showId}`]: null, [`showStats/${showId}`]: null,
    [`sportsGames/${showId}`]: null, [`sportsInteractions/${showId}`]: null, [`sportsResponses/${showId}`]: null, [`sportsResults/${showId}`]: null, [`sportsScreen/${showId}`]: null,
  });
}
