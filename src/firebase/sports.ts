import { get, onChildAdded, onChildChanged, onChildRemoved, onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
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

export type InteractionType = 'poll' | 'question';
export type InteractionStatus = 'open' | 'closed';
export type SportsInteraction = { id: string; type: InteractionType; question: string; status: InteractionStatus; options?: Record<string, string>; createdAt: number; closedAt?: number; displayOnScreen?: boolean; screenMode?: 'percentages' | 'question' };
export type SportsResult = { total: number; counts?: Record<string, number>; answers?: Record<string, string>; updatedAt: number };
export type SportsScreenState = { activeInteractionId?: string | null; displayMode: 'results' | 'question' | 'idle'; updatedAt: number };
export function watchSportsInteractions(showId: string, callback: (items: SportsInteraction[]) => void): Unsubscribe { return onValue(ref(db, `sportsInteractions/${showId}`), snapshot => { const value = snapshot.val() ?? {}; callback(Object.entries(value).map(([id, item]) => ({ id, ...(item as Omit<SportsInteraction, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt)); }); }
type SportsResponse = { optionId?: string; answer?: string; submittedAt: number };

export function watchSportsResponses(showId: string, interactionId: string, callback: (responses: Record<string, SportsResponse>) => void): Unsubscribe {
  // Same fix as watchParticipants: onValue on the whole responses node would
  // re-download every vote cast so far on every single new vote. During a
  // live poll with a full arena that turns thousands of votes into an
  // ever-growing payload hitting the organizer's tab on every tap. Instead,
  // listen for individual added/changed/removed children and keep the
  // merged tally in memory locally.
  const baseRef = ref(db, `sportsResponses/${showId}/${interactionId}`);
  const raw: Record<string, SportsResponse> = {};
  let frame: number | null = null;

  function scheduleEmit() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; callback({ ...raw }); });
  }

  const stopAdded = onChildAdded(baseRef, snapshot => {
    if (!snapshot.key) return;
    raw[snapshot.key] = snapshot.val() as SportsResponse;
    scheduleEmit();
  });
  const stopChanged = onChildChanged(baseRef, snapshot => {
    if (!snapshot.key) return;
    raw[snapshot.key] = snapshot.val() as SportsResponse;
    scheduleEmit();
  });
  const stopRemoved = onChildRemoved(baseRef, snapshot => {
    if (!snapshot.key) return;
    delete raw[snapshot.key];
    scheduleEmit();
  });

  callback({ ...raw });

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    stopAdded();
    stopChanged();
    stopRemoved();
  };
}
export function watchSportsResult(showId: string, interactionId: string, callback: (result: SportsResult | null) => void): Unsubscribe { return onValue(ref(db, `sportsResults/${showId}/${interactionId}`), snapshot => callback(snapshot.val() as SportsResult | null)); }
export function watchSportsScreen(showId: string, callback: (state: SportsScreenState | null) => void): Unsubscribe { return onValue(ref(db, `sportsScreen/${showId}`), snapshot => callback(snapshot.val() as SportsScreenState | null)); }
export async function createSportsInteraction(showId: string, interaction: Omit<SportsInteraction, 'id'>) { const id = `interaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; await set(ref(db, `sportsInteractions/${showId}/${id}`), { ...interaction, status: 'open', displayOnScreen: true }); await publishSportsScreen(showId, id, interaction.type === 'poll' ? 'results' : 'question'); return id; }
export async function openSportsInteraction(showId: string, interactionId: string) { await update(ref(db, `sportsInteractions/${showId}/${interactionId}`), { status: 'open', closedAt: null, displayOnScreen: true }); }
export async function closeSportsInteraction(showId: string, interactionId: string) { await update(ref(db, `sportsInteractions/${showId}/${interactionId}`), { status: 'closed', closedAt: Date.now(), displayOnScreen: false }); }
export async function publishSportsScreen(showId: string, activeInteractionId: string | null, displayMode: SportsScreenState['displayMode']) { await set(ref(db, `sportsScreen/${showId}`), { activeInteractionId, displayMode, updatedAt: Date.now() }); }
export async function publishSportsResult(showId: string, interactionId: string, result: SportsResult) { await set(ref(db, `sportsResults/${showId}/${interactionId}`), result); }
export async function submitSportsResponse(showId: string, interactionId: string, uid: string, response: { optionId?: string; answer?: string }) {
  const audienceId = getAudienceId();
  await set(ref(db, `sportsResponses/${showId}/${interactionId}/${audienceId}`), { ...response, uid, audienceId, submittedAt: Date.now() });
}
export async function hasRespondedToInteraction(showId: string, interactionId: string, uid: string) {
  const audienceId = getAudienceId();
  const current = await get(ref(db, `sportsResponses/${showId}/${interactionId}/${audienceId}`));
  if (current.exists()) return true;

  // Compatibility with responses created before the stable audience identity
  // was introduced. This prevents an existing vote from being submitted a
  // second time during the migration.
  const legacy = await get(ref(db, `sportsResponses/${showId}/${interactionId}/${uid}`));
  return legacy.exists();
}