import type { Book, BookProgress } from '@/types/book';
import type { BookDoc } from '@/libs/document';
import { findTocItemBS } from '@/services/nav';
import type { TextSelection } from '@/utils/sel';
import type { StoryBoredPassage } from './types';

const MAX_CONTEXT_LENGTH = 12000;
const CONTEXT_RADIUS = 1600;

interface CreateStoryBoredPassageInput {
  bookKey: string;
  book?: Book;
  bookDoc?: BookDoc;
  progress?: BookProgress;
  selection: TextSelection;
}

export function getStoryBoredBookId(bookKey: string, book?: Book): string {
  return book?.metaHash || book?.hash || bookKey.split('-')[0] || bookKey;
}

function getSelectionContext(selection: TextSelection): string | undefined {
  const text = selection.range.commonAncestorContainer.textContent?.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;

  const selectedText = selection.text.replace(/\s+/g, ' ').trim();
  const selectedIndex = text.indexOf(selectedText);

  if (selectedIndex === -1) {
    return text.slice(0, MAX_CONTEXT_LENGTH);
  }

  const start = Math.max(0, selectedIndex - CONTEXT_RADIUS);
  const end = Math.min(text.length, selectedIndex + selectedText.length + CONTEXT_RADIUS);
  return text.slice(start, end).slice(0, MAX_CONTEXT_LENGTH);
}

function getChapter(bookDoc: BookDoc | undefined, selection: TextSelection): string | undefined {
  if (!bookDoc?.toc?.length || !selection.cfi) return undefined;
  return findTocItemBS(bookDoc.toc, selection.cfi)?.label;
}

function getLocation(selection: TextSelection, progress?: BookProgress): string | undefined {
  const parts = [
    selection.cfi ? `cfi:${selection.cfi}` : undefined,
    progress?.sectionHref ? `href:${progress.sectionHref}` : undefined,
    selection.page ? `page:${selection.page}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function createStoryBoredPassage({
  bookKey,
  book,
  bookDoc,
  progress,
  selection,
}: CreateStoryBoredPassageInput): StoryBoredPassage {
  const passage: StoryBoredPassage = {
    bookId: getStoryBoredBookId(bookKey, book),
    selectedText: selection.text.trim(),
    stylePreset: 'cinematic-literary',
  };
  const surroundingContext = getSelectionContext(selection);
  const chapter = getChapter(bookDoc, selection);
  const location = getLocation(selection, progress);

  if (book?.title) passage.bookTitle = book.title;
  if (surroundingContext) passage.surroundingContext = surroundingContext;
  if (chapter) passage.chapter = chapter;
  if (location) passage.location = location;

  return passage;
}
