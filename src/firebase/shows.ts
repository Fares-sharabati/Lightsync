import { equalTo, onValue, orderByChild, push, query, ref, set, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStatus = 'waiting' | 'running' | 'finished';
export type Show = { id: string; organizerId: string; name: string; date: string; venue: string; status: ShowStatus; kind: 'sports'; createdAt: number; showStartTime?: number | null; showStartOffset?: number; lightTimeline?: unknown; screenLightColor?: string; phoneUiColor?: string };
export type PublicShow = Omit<Show, 'organizerId' | 'createdAt'>;
export type CreateShowInput = { name: string; date: string; venue: string };

function normalizeShow(id: string, value: Record<string, unknown>): Show { return { id, ...(value as Omit<Show, 'id'>), kind: 'sports' } as Show; }
function normalizePublicShow(id: string, value: Record<string, unknown>): PublicShow { return { id, ...(value as Omit<PublicShow, 'id'>), kind: 'sports' } as PublicShow; }

export async function createShow(organizerId: string, input: CreateShowInput) {
  const showRef = push(ref(db, 'shows')); const showId = showRef.key; if (!showId) throw new Error('Could not create event ID.');
  const now = Date.now();
  const show = { organizerId, name: input.name.trim(), date: input.date, venue: input.venue.trim(), kind: 'sports' as const, status: 'waiting' as ShowStatus, createdAt: now, showStartTime: null, showStartOffset: 0, screenLightColor: '#FFFFFF', phoneUiColor: '#FFFFFF' };

  // Create the owner record first. Firebase rules for public/child paths use this record
  // to verify ownership, so creating everything in one multi-location update is rejected.
  await set(showRef, show);
  try {
    await set(ref(db, `publicShows/${showId}`), { name: show.name, date: show.date, venue: show.venue, kind: 'sports', status: show.status, showStartTime: null, showStartOffset: 0, lightTimeline: null, screenLightColor: show.screenLightColor, phoneUiColor: show.phoneUiColor });
    await set(ref(db, `showStats/${showId}`), { totalJoined: 0, peakConnected: 0 });
  } catch (error) {
    try { await set(showRef, null); } catch { /* preserve the original error */ }
    throw error;
  }
  return showId;
}

export function watchShow(showId: string, callback: (show: Show | null) => void): Unsubscribe { return onValue(ref(db, `shows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? normalizeShow(showId, value) : null); }); }
export function watchPublicShow(showId: string, callback: (show: PublicShow | null) => void): Unsubscribe { return onValue(ref(db, `publicShows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? normalizePublicShow(showId, value) : null); }); }
export function watchOrganizerShows(organizerId: string, callback: (shows: Show[]) => void): Unsubscribe { const showsQuery = query(ref(db, 'shows'), orderByChild('organizerId'), equalTo(organizerId)); return onValue(showsQuery, snapshot => { const value = snapshot.val() ?? {}; callback(Object.entries(value).map(([id, show]) => normalizeShow(id, show as Record<string, unknown>)).sort((a, b) => b.createdAt - a.createdAt)); }); }
export async function updateShow(showId: string, changes: Partial<Omit<Show, 'id' | 'organizerId'>>) { const updates: Record<string, unknown> = {}; for (const [key, value] of Object.entries(changes)) updates[`shows/${showId}/${key}`] = value; for (const key of ['name', 'date', 'venue', 'kind', 'status', 'showStartTime', 'showStartOffset', 'lightTimeline', 'screenLightColor', 'phoneUiColor']) if (key in changes) updates[`publicShows/${showId}/${key}`] = (changes as Record<string, unknown>)[key]; await update(ref(db), updates); }

export async function deleteShow(showId: string) {
  const paths = ['publicShows', 'showParticipants', 'showStats', 'sportsGames', 'sportsInteractions', 'sportsResponses', 'sportsResults', 'sportsScreen'];
  for (const path of paths) await set(ref(db, `${path}/${showId}`), null);
  await set(ref(db, `shows/${showId}`), null);
}
