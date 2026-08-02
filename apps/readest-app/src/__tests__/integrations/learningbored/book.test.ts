import { describe, expect, it } from 'vitest';

import { getLearningBoredBookId } from '@/integrations/learningbored/book';
import type { Book } from '@/types/book';

function bookWithIdentifiers(hash: string, metaHash?: string): Book {
  return {
    hash,
    ...(metaHash === undefined ? {} : { metaHash }),
    format: 'EPUB',
    title: 'The Fictional Alder Manual',
    author: 'A. Reader',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('LearningBored reader book ids', () => {
  it('prefers the content-unique file hash over an aggregating metadata hash', () => {
    expect(
      getLearningBoredBookId('reader-session-key', bookWithIdentifiers(' file-a ', 'meta-1')),
    ).toBe('file-a');
  });

  it('keeps different editions distinct even when their metadata hash matches', () => {
    const firstEdition = bookWithIdentifiers('file-a', 'shared-metadata');
    const secondEdition = bookWithIdentifiers('file-b', 'shared-metadata');

    expect(getLearningBoredBookId('reader-a', firstEdition)).not.toBe(
      getLearningBoredBookId('reader-b', secondEdition),
    );
  });

  it('falls back to the metadata hash and then the reader key when needed', () => {
    expect(getLearningBoredBookId('reader-key', bookWithIdentifiers('   ', ' meta-1 '))).toBe(
      'meta-1',
    );
    expect(getLearningBoredBookId('reader-key', bookWithIdentifiers('   ', '   '))).toBe(
      'reader-key',
    );
    expect(getLearningBoredBookId('reader-key')).toBe('reader-key');
  });
});
