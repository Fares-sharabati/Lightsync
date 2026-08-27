import { onValue, push, ref, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStatus = 'waiting' | 'running' | 'finished';
export type Show = { id: string; organizerId: string; name: string; date: string; venue: string; status: ShowStatus; createdAt: number; showStartTime?: number | null; lightTimeline?: unknown };
export type PublicShow = Omit<Show, 'organizerId' | 'createdAt'>;
export type CreateShowInput = { name: string; date: string; venue: string };

export async function createShow(organizerId: string, input: CreateShowInput) {
  const showRef = push(ref(db, 'shows'));
  const showId = showRef.key;
  if (!showId) throw new Error('Could not create show ID.');
  const show = { organizerId, name: input.name.trim(), date: input.date, venue: input.venue.trim(), status: 'waiting' as ShowStatus, createdAt: Date.now(), showStartTime: null };
  await update(ref(db), {
    [`shows/${showId}`]: show,
    [`publicShows/${showId}`]: { name: show.name, date: show.date, venue: show.venue, status: show.status, showStartTime: null, lightTimeline: null },
    [`showStats/${showId}`]: { totalScans: 0, totalJoined: 0, peakConnected: 0 },
  });
  return showId;
}

export function watchShow(showId: string, callback: (show: Show | null) => void): Unsubscribe {
  return onValue(ref(db, `shows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? { id: showId, ...value } : null); });
}

export function watchPublicShow(showId: string, callback: (show: PublicShow | null) => void): Unsubscribe {
  return onValue(ref(db, `publicShows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? { id: showId, ...value } : null); });
}

export function watchOrganizerShows(organizerId: string, callback: (shows: Show[]) => void): Unsubscribe {
  return onValue(ref(db, 'shows'), snapshot => { const value = snapshot.val() ?? {}; callback(Object.entries(value).map(([id, show]) => ({ id, ...(show as Omit<Show, 'id'>) })).filter(show => show.organizerId === organizerId).sort((a, b) => b.createdAt - a.createdAt)); });
}

export async function updateShow(showId: string, changes: Partial<Omit<Show, 'id' | 'organizerId'>>) {
  const updates: Record<string, unknown> = { [`shows/${showId}`]: changes };
  const publicChanges: Record<string, unknown> = {};
  for (const key of ['name', 'date', 'venue', 'status', 'showStartTime', 'lightTimeline']) if (key in changes) publicChanges[key] = (changes as Record<string, unknown>)[key];
  if (Object.keys(publicChanges).length) updates[`publicShows/${showId}`] = publicChanges;
  await update(ref(db), updates);
}
