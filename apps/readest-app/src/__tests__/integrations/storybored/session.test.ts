import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoryBoredSceneSession,
  isStoryBoredSceneActive,
  readStoryBoredSceneSession,
  writeStoryBoredSceneSession,
} from '@/integrations/storybored/session';
import type { StoryBoredPassage } from '@/integrations/storybored/types';

const passage: StoryBoredPassage = {
  bookId: 'book-1',
  selectedText: 'A doorway opened in the wall of fog.',
  stylePreset: 'cinematic-literary',
};

describe('StoryBored scene panel session', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T10:00:00Z'));
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('restores a recent active generation for the matching book', () => {
    writeStoryBoredSceneSession({
      bookId: 'book-1',
      generationId: 'generation-1',
      generationStatus: 'generating',
      passage,
      updatedAt: Date.now(),
    });

    expect(readStoryBoredSceneSession('book-1')).toMatchObject({
      bookId: 'book-1',
      generationId: 'generation-1',
      generationStatus: 'generating',
      passage,
    });
  });

  it('does not restore inactive, wrong-book, or stale sessions', () => {
    writeStoryBoredSceneSession({
      bookId: 'book-1',
      generationId: 'generation-1',
      generationStatus: 'completed',
      passage,
      updatedAt: Date.now(),
    });
    expect(readStoryBoredSceneSession('book-1')).toBeNull();

    writeStoryBoredSceneSession({
      bookId: 'book-1',
      generationId: 'generation-2',
      generationStatus: 'queued',
      passage,
      updatedAt: Date.now(),
    });
    expect(readStoryBoredSceneSession('book-2')).toBeNull();

    vi.setSystemTime(new Date('2026-05-02T10:00:01Z'));
    expect(readStoryBoredSceneSession('book-1')).toBeNull();
  });

  it('clears only the matching generation session', () => {
    writeStoryBoredSceneSession({
      bookId: 'book-1',
      generationId: 'generation-1',
      generationStatus: 'queued',
      passage,
      updatedAt: Date.now(),
    });

    clearStoryBoredSceneSession('another-generation');
    expect(readStoryBoredSceneSession('book-1')?.generationId).toBe('generation-1');

    clearStoryBoredSceneSession('generation-1');
    expect(readStoryBoredSceneSession('book-1')).toBeNull();
  });

  it('identifies active statuses', () => {
    expect(isStoryBoredSceneActive('queued')).toBe(true);
    expect(isStoryBoredSceneActive('prompting')).toBe(true);
    expect(isStoryBoredSceneActive('generating')).toBe(true);
    expect(isStoryBoredSceneActive('completed')).toBe(false);
  });
});
