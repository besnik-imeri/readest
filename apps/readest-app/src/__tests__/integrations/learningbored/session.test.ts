import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLearningBoredReaderSession,
  getLearningBoredReaderSessionStorageKey,
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

describe('LearningBored reader capture session', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('round-trips a versioned session including open and closed panel state', () => {
    const passage = createPassage('book-1');

    writeLearningBoredReaderSession({
      bookId: 'book-1',
      panelOpen: true,
      passage,
      updatedAt: NOW,
    });
    expect(readLearningBoredReaderSession('book-1')).toEqual({
      version: 1,
      bookId: 'book-1',
      panelOpen: true,
      passage,
      updatedAt: NOW,
    });

    writeLearningBoredReaderSession({
      bookId: 'book-1',
      panelOpen: false,
      passage,
      updatedAt: NOW,
    });
    expect(readLearningBoredReaderSession('book-1')?.panelOpen).toBe(false);
  });

  it('keeps sessions scoped by book and clears only the requested book', () => {
    writeLearningBoredReaderSession({
      bookId: 'book-1',
      panelOpen: true,
      passage: createPassage('book-1'),
      updatedAt: NOW,
    });
    writeLearningBoredReaderSession({
      bookId: 'book/2',
      panelOpen: false,
      passage: createPassage('book/2'),
      updatedAt: NOW,
    });

    expect(readLearningBoredReaderSession('book-1')?.bookId).toBe('book-1');
    expect(readLearningBoredReaderSession('book/2')?.bookId).toBe('book/2');
    expect(getLearningBoredReaderSessionStorageKey('book/2')).toContain('book%2F2');

    clearLearningBoredReaderSession('book-1');
    expect(readLearningBoredReaderSession('book-1')).toBeNull();
    expect(readLearningBoredReaderSession('book/2')?.bookId).toBe('book/2');
  });

  it('expires stale sessions and removes them from storage', () => {
    const key = getLearningBoredReaderSessionStorageKey('book-1');
    writeLearningBoredReaderSession({
      bookId: 'book-1',
      panelOpen: true,
      passage: createPassage('book-1'),
      updatedAt: NOW,
    });

    vi.setSystemTime(NOW + LEARNINGBORED_READER_SESSION_MAX_AGE_MS + 1);

    expect(readLearningBoredReaderSession('book-1')).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('rejects malformed JSON, unsupported versions, wrong-book payloads, and future timestamps', () => {
    const key = getLearningBoredReaderSessionStorageKey('book-1');
    const base = {
      version: 1,
      bookId: 'book-1',
      panelOpen: true,
      passage: createPassage('book-1'),
      updatedAt: NOW,
    };

    for (const corrupt of [
      '{bad json',
      JSON.stringify({ ...base, version: 2 }),
      JSON.stringify({ ...base, bookId: 'book-2' }),
      JSON.stringify({ ...base, updatedAt: NOW + 1 }),
    ]) {
      localStorage.setItem(key, corrupt);
      expect(readLearningBoredReaderSession('book-1')).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('rejects empty text, a corrupt context offset, or a location scoped to another book', () => {
    const key = getLearningBoredReaderSessionStorageKey('book-1');
    const passage = createPassage('book-1');
    const base = {
      version: 1,
      bookId: 'book-1',
      panelOpen: true,
      passage,
      updatedAt: NOW,
    };

    localStorage.setItem(
      key,
      JSON.stringify({
        ...base,
        passage: { ...passage, selectedText: '' },
      }),
    );
    expect(readLearningBoredReaderSession('book-1')).toBeNull();

    localStorage.setItem(
      key,
      JSON.stringify({
        ...base,
        passage: { ...passage, contextOffset: passage.contextOffset + 1 },
      }),
    );
    expect(readLearningBoredReaderSession('book-1')).toBeNull();

    localStorage.setItem(
      key,
      JSON.stringify({
        ...base,
        passage: { ...passage, location: { ...passage.location, bookId: 'book-2' } },
      }),
    );
    expect(readLearningBoredReaderSession('book-1')).toBeNull();
  });

  it('allows panel state to persist before a passage has been captured', () => {
    writeLearningBoredReaderSession({
      bookId: 'book-1',
      panelOpen: true,
      passage: null,
      updatedAt: NOW,
    });

    expect(readLearningBoredReaderSession('book-1')).toMatchObject({
      panelOpen: true,
      passage: null,
    });
  });
});
