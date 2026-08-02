import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLearningBoredReaderSession,
  getLearningBoredReaderSessionStorageKey,
  getLegacyLearningBoredReaderSessionStorageKey,
  LEARNINGBORED_READER_SESSION_MAX_AGE_MS,
  readLearningBoredReaderSession,
  writeLearningBoredReaderSession,
} from '@/integrations/learningbored/session';
import type { LearningBoredCapturedPassage } from '@/integrations/learningbored/types';

const NOW = new Date('2026-08-01T12:00:00Z').getTime();

function createPassage(
  bookId: string,
  selectedText = 'Exact selected text.',
): LearningBoredCapturedPassage {
  const before = 'Context before. ';

  return {
    bookId,
    selectedText,
    surroundingContext: `${before}${selectedText} Context after.`,
    contextOffset: before.length,
    location: {
      version: 1,
      kind: 'cfi',
      bookId,
      cfi: 'epubcfi(/6/2!/4/2/1:0)',
      pageIndex: 0,
    },
    chapter: 'Chapter 1',
  };
}

function createSession(bookId: string, panelOpen = true) {
  return {
    bookId,
    panelOpen,
    passage: createPassage(bookId),
    generationId: 'generation-1',
    boardId: 'board-1',
    showScaffold: false,
    kind: 'process_flow' as const,
    updatedAt: NOW,
  };
}

describe('LearningBored reader session', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('round-trips generation, Board, scaffold, kind, and panel state in v2', () => {
    writeLearningBoredReaderSession(createSession('book-1'));
    expect(readLearningBoredReaderSession('book-1')).toEqual({
      version: 2,
      ...createSession('book-1'),
    });

    writeLearningBoredReaderSession(createSession('book-1', false));
    expect(readLearningBoredReaderSession('book-1')?.panelOpen).toBe(false);
  });

  it('migrates a valid v1 capture without inventing generation state', () => {
    const passage = createPassage('book-1');
    const legacyKey = getLegacyLearningBoredReaderSessionStorageKey('book-1');
    localStorage.setItem(
      legacyKey,
      JSON.stringify({
        version: 1,
        bookId: 'book-1',
        panelOpen: true,
        passage,
        updatedAt: NOW,
      }),
    );

    expect(readLearningBoredReaderSession('book-1')).toEqual({
      version: 2,
      bookId: 'book-1',
      panelOpen: true,
      passage,
      generationId: null,
      boardId: null,
      showScaffold: true,
      kind: null,
      updatedAt: NOW,
    });
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(localStorage.getItem(getLearningBoredReaderSessionStorageKey('book-1'))).not.toBeNull();
  });

  it('keeps sessions scoped by book and clears current and legacy keys for one book', () => {
    writeLearningBoredReaderSession(createSession('book-1'));
    writeLearningBoredReaderSession(createSession('book/2', false));
    localStorage.setItem(getLegacyLearningBoredReaderSessionStorageKey('book-1'), '{}');

    expect(readLearningBoredReaderSession('book-1')?.bookId).toBe('book-1');
    expect(readLearningBoredReaderSession('book/2')?.bookId).toBe('book/2');
    expect(getLearningBoredReaderSessionStorageKey('book/2')).toContain('book%2F2');

    clearLearningBoredReaderSession('book-1');
    expect(readLearningBoredReaderSession('book-1')).toBeNull();
    expect(
      localStorage.getItem(getLegacyLearningBoredReaderSessionStorageKey('book-1')),
    ).toBeNull();
    expect(readLearningBoredReaderSession('book/2')?.bookId).toBe('book/2');
  });

  it('expires stale sessions and removes them from storage', () => {
    const key = getLearningBoredReaderSessionStorageKey('book-1');
    writeLearningBoredReaderSession(createSession('book-1'));

    vi.setSystemTime(NOW + LEARNINGBORED_READER_SESSION_MAX_AGE_MS + 1);

    expect(readLearningBoredReaderSession('book-1')).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('rejects malformed JSON, unsupported versions, wrong books, and future timestamps', () => {
    const key = getLearningBoredReaderSessionStorageKey('book-1');
    const base = { version: 2, ...createSession('book-1') };

    for (const corrupt of [
      '{bad json',
      JSON.stringify({ ...base, version: 3 }),
      JSON.stringify({ ...base, bookId: 'book-2' }),
      JSON.stringify({ ...base, updatedAt: NOW + 1 }),
    ]) {
      localStorage.setItem(key, corrupt);
      expect(readLearningBoredReaderSession('book-1')).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('rejects corrupt passage offsets and impossible Board or kind state', () => {
    const key = getLearningBoredReaderSessionStorageKey('book-1');
    const passage = createPassage('book-1');
    const base = { version: 2, ...createSession('book-1') };

    for (const corrupt of [
      { ...base, passage: { ...passage, contextOffset: passage.contextOffset + 1 } },
      { ...base, generationId: null, boardId: 'board-1' },
      { ...base, kind: 'freeform_picture' },
      { ...base, passage: null },
    ]) {
      localStorage.setItem(key, JSON.stringify(corrupt));
      expect(readLearningBoredReaderSession('book-1')).toBeNull();
    }
  });

  it('allows preferences and panel state before a passage has been captured', () => {
    writeLearningBoredReaderSession({
      bookId: 'book-1',
      panelOpen: true,
      passage: null,
      generationId: null,
      boardId: null,
      showScaffold: false,
      kind: 'timeline',
      updatedAt: NOW,
    });

    expect(readLearningBoredReaderSession('book-1')).toMatchObject({
      version: 2,
      panelOpen: true,
      passage: null,
      showScaffold: false,
      kind: 'timeline',
    });
  });
});
