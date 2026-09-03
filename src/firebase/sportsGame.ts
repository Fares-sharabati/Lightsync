import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type SportsTeam = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
};

export type SportsGame = {
  sport: string;
  homeTeam: SportsTeam;
  awayTeam: SportsTeam;
  lightTeam: 'home' | 'away' | 'custom';
  customLightColor?: string;
  updatedAt: number;
};

const DEFAULT_TEAM_COLOR = '#FFFFFF';

function normalizeColor(value: string, fallback = DEFAULT_TEAM_COLOR) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

export function watchSportsGame(showId: string, callback: (game: SportsGame | null) => void): Unsubscribe {
  return onValue(ref(db, `sportsGames/${showId}`), snapshot => callback(snapshot.val() as SportsGame | null));
}

export async function saveSportsGame(showId: string, game: Omit<SportsGame, 'updatedAt'>) {
  await set(ref(db, `sportsGames/${showId}`), {
    ...game,
    homeTeam: {
      ...game.homeTeam,
      primaryColor: normalizeColor(game.homeTeam.primaryColor),
      secondaryColor: normalizeColor(game.homeTeam.secondaryColor),
    },
    awayTeam: {
      ...game.awayTeam,
      primaryColor: normalizeColor(game.awayTeam.primaryColor),
      secondaryColor: normalizeColor(game.awayTeam.secondaryColor),
    },
    ...(game.customLightColor ? { customLightColor: normalizeColor(game.customLightColor) } : {}),
    updatedAt: Date.now(),
  });
}

export function getSportsLightColor(game: SportsGame | null) {
  if (!game) return DEFAULT_TEAM_COLOR;
  if (game.lightTeam === 'away') return normalizeColor(game.awayTeam.primaryColor);
  if (game.lightTeam === 'custom') return normalizeColor(game.customLightColor || DEFAULT_TEAM_COLOR);
  return normalizeColor(game.homeTeam.primaryColor);
}
