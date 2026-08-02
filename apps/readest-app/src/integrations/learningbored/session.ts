import { parseLearningBoredCfiLocation } from './location';
import { hasValidLearningBoredContextOffset, type LearningBoredCapturedPassage } from './types';

export const LEARNINGBORED_READER_SESSION_VERSION = 1 as const;
export const LEARNINGBORED_READER_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY_PREFIX = 'learningbored.reader-capture-session.v1';

export interface LearningBoredReaderSession {
  version: typeof LEARNINGBORED_READER_SESSION_VERSION;
  bookId: string;
  panelOpen: boolean;
  passage: LearningBoredCapturedPassage | null;
  updatedAt: number;
}

export interface LearningBoredReaderSessionOptions {
  storage?: Storage | null;
  now?: number;
  maxAgeMs?: number;
}

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storageFrom(options?: LearningBoredReaderSessionOptions): Storage | null {
  return options && 'storage' in options ? (options.storage ?? null) : defaultStorage();
}

function isCapturedPassage(value: unknown, bookId: string): value is LearningBoredCapturedPassage {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  if (
    candidate['bookId'] !== bookId ||
    typeof candidate['selectedText'] !== 'string' ||
    typeof candidate['surroundingContext'] !== 'string' ||
    typeof candidate['contextOffset'] !== 'number' ||
    typeof candidate['location'] !== 'object' ||
    candidate['location'] === null ||
    (candidate['chapter'] !== undefined && typeof candidate['chapter'] !== 'string')
  ) {
    return false;
  }

  const serializedLocation = JSON.stringify(candidate['location']);
  const location = parseLearningBoredCfiLocation(serializedLocation);
  if (!location || location.bookId !== bookId) return false;

  return hasValidLearningBoredContextOffset({
    selectedText: candidate['selectedText'],
    surroundingContext: candidate['surroundingContext'],
    contextOffset: candidate['contextOffset'],
  });
}

function parseSession(value: unknown): LearningBoredReaderSession | null {
  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as Record<string, unknown>;
  if (
    candidate['version'] !== LEARNINGBORED_READER_SESSION_VERSION ||
    typeof candidate['bookId'] !== 'string' ||
    candidate['bookId'].length === 0 ||
    typeof candidate['panelOpen'] !== 'boolean' ||
    typeof candidate['updatedAt'] !== 'number' ||
    !Number.isFinite(candidate['updatedAt'])
  ) {
    return null;
  }

  const passage = candidate['passage'];
  if (passage !== null && !isCapturedPassage(passage, candidate['bookId'])) return null;

  return {
    version: LEARNINGBORED_READER_SESSION_VERSION,
    bookId: candidate['bookId'],
    panelOpen: candidate['panelOpen'],
    passage,
    updatedAt: candidate['updatedAt'],
  };
}

export function getLearningBoredReaderSessionStorageKey(bookId: string): string {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(bookId)}`;
}

export function writeLearningBoredReaderSession(
  session: Omit<LearningBoredReaderSession, 'version'>,
  options?: LearningBoredReaderSessionOptions,
): void {
  const storage = storageFrom(options);
  if (!storage) return;

  const value = { ...session, version: LEARNINGBORED_READER_SESSION_VERSION };
  if (!parseSession(value)) throw new TypeError('Invalid LearningBored reader session.');

  try {
    storage.setItem(getLearningBoredReaderSessionStorageKey(session.bookId), JSON.stringify(value));
  } catch {}
}

export function readLearningBoredReaderSession(
  bookId: string,
  options?: LearningBoredReaderSessionOptions,
): LearningBoredReaderSession | null {
  const storage = storageFrom(options);
  if (!storage) return null;

  const key = getLearningBoredReaderSessionStorageKey(bookId);

  try {
    const session = parseSession(JSON.parse(storage.getItem(key) ?? 'null'));
    const now = options?.now ?? Date.now();
    const maxAgeMs = options?.maxAgeMs ?? LEARNINGBORED_READER_SESSION_MAX_AGE_MS;
    const invalidAge = !session || session.updatedAt > now || now - session.updatedAt > maxAgeMs;
    const wrongBook = session?.bookId !== bookId;

    if (invalidAge || wrongBook) {
      storage.removeItem(key);
      return null;
    }

    return session;
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
}

export function clearLearningBoredReaderSession(
  bookId: string,
  options?: LearningBoredReaderSessionOptions,
): void {
  const storage = storageFrom(options);
  if (!storage) return;

  try {
    storage.removeItem(getLearningBoredReaderSessionStorageKey(bookId));
  } catch {}
}
