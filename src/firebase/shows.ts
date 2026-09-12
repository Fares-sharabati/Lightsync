import { equalTo, get, onValue, orderByChild, push, query, ref, set, update, type Unsubscribe } from 'firebase/database';
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
  const publicShow = { name: show.name, date: show.date, venue: show.venue, kind: 'sports' as const, status: show.status, showStartTime: null, showStartOffset: 0, lightTimeline: null, screenLightColor: show.screenLightColor, phoneUiColor: show.phoneUiColor };

  try {
    await set(ref(db, `showOwners/${showId}`), { organizerId });
  } catch (error) {
    throw new Error(`Could not reserve event ${showId}: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await update(ref(db), {
      [`shows/${showId}`]: show,
      [`publicShows/${showId}`]: publicShow,
      [`showStats/${showId}`]: { totalJoined: 0, peakConnected: 0 },
    });
  } catch (error) {
    try { await set(ref(db, `showOwners/${showId}`), null); } catch { /* preserve original error */ }
    throw new Error(`Could not create event ${showId}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return showId;
}

export function watchShow(showId: string, callback: (show: Show | null) => void): Unsubscribe { return onValue(ref(db, `shows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? normalizeShow(showId, value) : null); }); }
export function watchPublicShow(showId: string, callback: (show: PublicShow | null) => void): Unsubscribe { return onValue(ref(db, `publicShows/${showId}`), snapshot => { const value = snapshot.val(); callback(value ? normalizePublicShow(showId, value) : null); }); }
export function watchOrganizerShows(organizerId: string, callback: (shows: Show[]) => void) { const showsQuery = query(ref(db, 'shows'), orderByChild('organizerId'), equalTo(organizerId)); return onValue(showsQuery, snapshot => { const value = snapshot.val() ?? {}; callback(Object.entries(value).map(([id, show]) => normalizeShow(id, show as Record<string, unknown>)).sort((a, b) => b.createdAt - a.createdAt)); }); }

async function writeShowChanges(showId: string, changes: Partial<Omit<Show, 'id' | 'organizerId'>>) {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) updates[`shows/${showId}/${key}`] = value;
  for (const key of ['name', 'date', 'venue', 'kind', 'status', 'showStartTime', 'showStartOffset', 'lightTimeline', 'screenLightColor', 'phoneUiColor']) {
    if (key in changes) updates[`publicShows/${showId}/${key}`] = (changes as Record<string, unknown>)[key];
  }
  await update(ref(db), updates);
}

export async function updateShow(showId: string, changes: Partial<Omit<Show, 'id' | 'organizerId'>>) {
  if (changes.status !== undefined) {
    const currentSnapshot = await get(ref(db, `shows/${showId}`));
    if (!currentSnapshot.exists()) throw new Error('Event not found.');
    const currentStatus = currentSnapshot.child('status').val() as ShowStatus;
    const nextStatus = changes.status;
    const validTransition = currentStatus === nextStatus
      || (currentStatus === 'waiting' && (nextStatus === 'running' || nextStatus === 'finished'))
      || (currentStatus === 'running' && nextStatus === 'finished')
      || (currentStatus === 'finished' && (nextStatus === 'waiting' || nextStatus === 'running'));
    if (!validTransition) throw new Error(`Invalid show status transition: ${currentStatus} -> ${nextStatus}.`);
    if (currentStatus === 'finished' && nextStatus === 'running') await writeShowChanges(showId, { status: 'waiting', showStartTime: null, showStartOffset: 0 });
  }
  await writeShowChanges(showId, changes);
}

export async function deleteShow(showId: string) {
  // Mirrors the fix already used in createShow(): ownership-record writes are
  // sequenced separately from the writes that depend on that ownership record
  // existing. Every dependent path's rule (sportsGames, sportsInteractions,
  // sportsResponses, sportsResults, sportsScreen, showParticipants) checks
  // root.child('shows')...organizerId. Firebase evaluates multi-location
  // update() rules against the fully-applied result of that same update, so
  // deleting `shows/$showId` in the SAME call as those dependents would mean
  // the very record authorizing their deletion is already gone by the time
  // it's checked. Deleting dependents first - while shows/showOwners still
  // exist - avoids relying on that at all, and is correct either way.
  const dependentUpdates: Record<string, null> = {
    [`publicShows/${showId}`]: null,
    [`showParticipants/${showId}`]: null,
    [`showStats/${showId}`]: null,
    [`sportsGames/${showId}`]: null,
    [`sportsInteractions/${showId}`]: null,
    [`sportsResponses/${showId}`]: null,
    [`sportsResults/${showId}`]: null,
    [`sportsScreen/${showId}`]: null,
  };

  try {
    await update(ref(db), dependentUpdates);
  } catch (error) {
    throw new Error(`Could not delete event data for ${showId}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // The shows/showOwners records authorize themselves via their own existing
  // data, not via each other, so they're safe to remove together last.
  try {
    await update(ref(db), { [`showOwners/${showId}`]: null, [`shows/${showId}`]: null });
  } catch (error) {
    throw new Error(`Event data was cleared, but the event record for ${showId} could not be removed: ${error instanceof Error ? error.message : String(error)}`);
  }
}