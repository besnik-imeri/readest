import { isLearningBoredBoardKind, type LearningBoredBoardKind } from './client';
import { parseLearningBoredCfiLocation } from './location';
import { hasValidLearningBoredContextOffset, type LearningBoredCapturedPassage } from './types';

export const LEARNINGBORED_READER_SESSION_VERSION = 2 as const;
export const LEARNINGBORED_READER_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY_PREFIX = 'learningbored.reader-session.v2';
const LEGACY_STORAGE_KEY_PREFIX = 'learningbored.reader-capture-session.v1';

export interface LearningBoredReaderSession {
  version: typeof LEARNINGBORED_READER_SESSION_VERSION;
  bookId: string;
  panelOpen: boolean;
  passage: LearningBoredCapturedPassage | null;
  generationId: string | null;
  boardId: string | null;
  showScaffold: boolean;
  kind: LearningBoredBoardKind | null;
  updatedAt: number;
}

interface LegacyLearningBoredReaderSession {
  version: 1;
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

function isOptionalIdentifier(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0);
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

function hasSessionBase(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate['bookId'] === 'string' &&
    candidate['bookId'].length > 0 &&
    typeof candidate['panelOpen'] === 'boolean' &&
    typeof candidate['updatedAt'] === 'number' &&
    Number.isFinite(candidate['updatedAt'])
  );
}

function parseLegacySession(value: unknown): LegacyLearningBoredReaderSession | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate['version'] !== 1 || !hasSessionBase(candidate)) return null;

  const bookId = candidate['bookId'] as string;
  const passage = candidate['passage'];
  if (passage !== null && !isCapturedPassage(passage, bookId)) return null;

  return {
    version: 1,
    bookId,
    panelOpen: candidate['panelOpen'] as boolean,
    passage,
    updatedAt: candidate['updatedAt'] as number,
  };
}

function parseSession(value: unknown): LearningBoredReaderSession | null {
  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as Record<string, unknown>;
  if (
    candidate['version'] !== LEARNINGBORED_READER_SESSION_VERSION ||
    !hasSessionBase(candidate) ||
    !isOptionalIdentifier(candidate['generationId']) ||
    !isOptionalIdentifier(candidate['boardId']) ||
    typeof candidate['showScaffold'] !== 'boolean' ||
    (candidate['kind'] !== null && !isLearningBoredBoardKind(candidate['kind']))
  ) {
    return null;
  }

  const bookId = candidate['bookId'] as string;
  const passage = candidate['passage'];
  if (passage !== null && !isCapturedPassage(passage, bookId)) return null;
  if ((candidate['generationId'] !== null || candidate['boardId'] !== null) && passage === null) {
    return null;
  }
  if (candidate['boardId'] !== null && candidate['generationId'] === null) return null;

  return {
    version: LEARNINGBORED_READER_SESSION_VERSION,
    bookId,
    panelOpen: candidate['panelOpen'] as boolean,
    passage,
    generationId: candidate['generationId'],
    boardId: candidate['boardId'],
    showScaffold: candidate['showScaffold'],
    kind: candidate['kind'],
    updatedAt: candidate['updatedAt'] as number,
  };
}

function hasValidAge(
  session: { updatedAt: number } | null,
  now: number,
  maxAgeMs: number,
): session is { updatedAt: number } {
  return !!session && session.updatedAt <= now && now - session.updatedAt <= maxAgeMs;
}

export function getLearningBoredReaderSessionStorageKey(bookId: string): string {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(bookId)}`;
}

export function getLegacyLearningBoredReaderSessionStorageKey(bookId: string): string {
  return `${LEGACY_STORAGE_KEY_PREFIX}:${encodeURIComponent(bookId)}`;
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
  const legacyKey = getLegacyLearningBoredReaderSessionStorageKey(bookId);
  const now = options?.now ?? Date.now();
  const maxAgeMs = options?.maxAgeMs ?? LEARNINGBORED_READER_SESSION_MAX_AGE_MS;

  try {
    const session = parseSession(JSON.parse(storage.getItem(key) ?? 'null'));
    if (hasValidAge(session, now, maxAgeMs) && session.bookId === bookId) return session;
    storage.removeItem(key);

    const legacy = parseLegacySession(JSON.parse(storage.getItem(legacyKey) ?? 'null'));
    if (!hasValidAge(legacy, now, maxAgeMs) || legacy.bookId !== bookId) {
      storage.removeItem(legacyKey);
      return null;
    }

    const migrated: LearningBoredReaderSession = {
      version: LEARNINGBORED_READER_SESSION_VERSION,
      bookId: legacy.bookId,
      panelOpen: legacy.panelOpen,
      passage: legacy.passage,
      generationId: null,
      boardId: null,
      showScaffold: true,
      kind: null,
      updatedAt: legacy.updatedAt,
    };
    writeLearningBoredReaderSession(migrated, { ...options, storage });
    storage.removeItem(legacyKey);
    return migrated;
  } catch {
    try {
      storage.removeItem(key);
      storage.removeItem(legacyKey);
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
    storage.removeItem(getLegacyLearningBoredReaderSessionStorageKey(bookId));
  } catch {}
}
