import { onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type InteractionType = 'poll' | 'question';
export type InteractionStatus = 'open' | 'closed';

export type SportsInteraction = {
  id: string;
  type: InteractionType;
  question: string;
  status: InteractionStatus;
  options?: Record<string, string>;
  createdAt: number;
  closedAt?: number;
  displayOnScreen?: boolean;
  screenMode?: 'percentages' | 'question';
};

export type SportsResult = {
  total: number;
  counts?: Record<string, number>;
  answers?: Record<string, string>;
  updatedAt: number;
};

export type SportsScreenState = {
  activeInteractionId?: string | null;
  displayMode: 'results' | 'question' | 'idle';
  updatedAt: number;
};

export function watchSportsInteractions(showId: string, callback: (items: SportsInteraction[]) => void): Unsubscribe {
  return onValue(ref(db, `sportsInteractions/${showId}`), snapshot => {
    const value = snapshot.val() ?? {};
    callback(Object.entries(value).map(([id, item]) => ({ id, ...(item as Omit<SportsInteraction, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function watchSportsResponses(showId: string, interactionId: string, callback: (responses: Record<string, { optionId?: string; answer?: string; submittedAt: number }>) => void): Unsubscribe {
  return onValue(ref(db, `sportsResponses/${showId}/${interactionId}`), snapshot => callback((snapshot.val() ?? {}) as Record<string, { optionId?: string; answer?: string; submittedAt: number }>));
}

export function watchSportsResult(showId: string, interactionId: string, callback: (result: SportsResult | null) => void): Unsubscribe {
  return onValue(ref(db, `sportsResults/${showId}/${interactionId}`), snapshot => callback(snapshot.val() as SportsResult | null));
}

export function watchSportsScreen(showId: string, callback: (state: SportsScreenState | null) => void): Unsubscribe {
  return onValue(ref(db, `sportsScreen/${showId}`), snapshot => callback(snapshot.val() as SportsScreenState | null));
}

export async function createSportsInteraction(showId: string, interaction: Omit<SportsInteraction, 'id'>) {
  const id = `interaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await set(ref(db, `sportsInteractions/${showId}/${id}`), interaction);
  return id;
}

export async function openSportsInteraction(showId: string, interactionId: string) {
  await update(ref(db, `sportsInteractions/${showId}/${interactionId}`), {
    status: 'open',
    closedAt: null,
    displayOnScreen: true,
  });
}

export async function closeSportsInteraction(showId: string, interactionId: string) {
  await update(ref(db, `sportsInteractions/${showId}/${interactionId}`), { status: 'closed', closedAt: Date.now(), displayOnScreen: false });
}

export async function publishSportsScreen(showId: string, activeInteractionId: string | null, displayMode: SportsScreenState['displayMode']) {
  await set(ref(db, `sportsScreen/${showId}`), { activeInteractionId, displayMode, updatedAt: Date.now() });
}

export async function publishSportsResult(showId: string, interactionId: string, result: SportsResult) {
  await set(ref(db, `sportsResults/${showId}/${interactionId}`), result);
}

export async function submitSportsResponse(showId: string, interactionId: string, uid: string, response: { optionId?: string; answer?: string }) {
  await set(ref(db, `sportsResponses/${showId}/${interactionId}/${uid}`), { ...response, submittedAt: Date.now() });
}
