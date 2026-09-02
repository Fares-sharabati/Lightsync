import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db, storage } from './config';

export type SportsTeam = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
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

export async function uploadTeamLogo(showId: string, side: 'home' | 'away', file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Logo must be an image.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Logo must be smaller than 2 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read logo.'));
      img.src = objectUrl;
    });

    const size = Math.min(512, Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare logo.');
    context.clearRect(0, 0, size, size);
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not compress logo.')), 'image/webp', 0.82));
    const path = `sportsLogos/${showId}/${side}.webp`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, blob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' });
    return getDownloadURL(fileRef);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
