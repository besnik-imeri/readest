import type { StoryBoredPassage, StoryBoredSceneStatus } from './types';

const STORAGE_KEY = 'storybored.scene-panel-session.v1';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set<StoryBoredSceneStatus>(['queued', 'prompting', 'generating']);

export interface StoryBoredSceneSession {
  version: 1;
  bookId: string;
  generationId: string;
  generationStatus: StoryBoredSceneStatus;
  passage: StoryBoredPassage;
  updatedAt: number;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSession(value: unknown): StoryBoredSceneSession | null {
  if (!isObject(value)) return null;
  const passage = value['passage'];

  if (
    value['version'] !== 1 ||
    typeof value['bookId'] !== 'string' ||
    typeof value['generationId'] !== 'string' ||
    typeof value['generationStatus'] !== 'string' ||
    typeof value['updatedAt'] !== 'number' ||
    !isObject(passage) ||
    typeof passage['bookId'] !== 'string' ||
    typeof passage['selectedText'] !== 'string' ||
    typeof passage['stylePreset'] !== 'string'
  ) {
    return null;
  }

  return {
    version: 1,
    bookId: value['bookId'],
    generationId: value['generationId'],
    generationStatus: value['generationStatus'] as StoryBoredSceneStatus,
    passage: passage as StoryBoredPassage,
    updatedAt: value['updatedAt'],
  };
}

export function isStoryBoredSceneActive(status: StoryBoredSceneStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function writeStoryBoredSceneSession(
  session: Omit<StoryBoredSceneSession, 'version'>,
): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...session, version: 1 }));
  } catch {}
}

export function readStoryBoredSceneSession(bookId?: string): StoryBoredSceneSession | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const session = parseSession(JSON.parse(storage.getItem(STORAGE_KEY) || 'null'));
    if (!session) return null;

    const isExpired = Date.now() - session.updatedAt > SESSION_MAX_AGE_MS;
    const isWrongBook = bookId !== undefined && session.bookId !== bookId;
    if (isExpired || isWrongBook || !isStoryBoredSceneActive(session.generationStatus)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function clearStoryBoredSceneSession(generationId?: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const session = readStoryBoredSceneSession();
    if (generationId && session?.generationId !== generationId) return;
    storage.removeItem(STORAGE_KEY);
  } catch {}
}
