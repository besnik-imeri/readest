import type { Book } from '@/types/book';

export function getLearningBoredBookId(bookKey: string, book?: Book): string {
  return book?.hash?.trim() || book?.metaHash?.trim() || bookKey;
}
