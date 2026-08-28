import { equalTo, onValue, orderByChild, push, query, ref, set, update, type Unsubscribe } from 'firebase/database';
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

  // Create the private organizer record first. Firebase rules need the show to exist
  // before allowing the corresponding public record to be written.
  await set(showRef, show);
  await set(ref(db, `publicShows/${showId}`), { name: show.name, date: show.date, venue: show.venue, status: show.status, showStartTime: null, lightTimeline: null });
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
    callback(Object.entries(value)
      .map(([id, show]) => ({ id, ...(show as Omit<Show, 'id'>) }))
      .sort((a, b) => b.createdAt - a.createdAt));
  });
}

export async function updateShow(showId: string, changes: Partial<Omit<Show, 'id' | 'organizerId'>>) {
  // IMPORTANT: Firebase's multi-location update() replaces whatever value
  // already exists at each given path rather than merging into it. Writing
  // `{ [`shows/${showId}`]: changes }` would therefore overwrite the WHOLE
  // show node with just `changes`, deleting organizerId/name/date/venue/
  // createdAt — which then fails the `.validate` rule requiring those fields
  // and makes the write silently fail. To do a real partial update we must
  // target each changed field's own leaf path.
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) updates[`shows/${showId}/${key}`] = value;
  for (const key of ['name', 'date', 'venue', 'status', 'showStartTime', 'lightTimeline']) if (key in changes) updates[`publicShows/${showId}/${key}`] = (changes as Record<string, unknown>)[key];
  await update(ref(db), updates);
}