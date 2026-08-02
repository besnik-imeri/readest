import { describe, expect, it } from 'vitest';
import {
  createLearningBoredCfiLocation,
  parseLearningBoredCfiLocation,
  resolveLearningBoredCfiLocation,
  resolveSerializedLearningBoredCfiLocation,
  serializeLearningBoredCfiLocation,
  type LearningBoredCfiResolver,
} from '@/integrations/learningbored/location';

const CFI = 'epubcfi(/6/8!/4/4,/2/1:0,/2/1:11)';

function createDocumentWithText(text: string): { document: Document; range: Range } {
  const doc = document.implementation.createHTMLDocument('fixture');
  const node = doc.createTextNode(text);
  doc.body.append(node);
  const range = doc.createRange();
  range.selectNodeContents(node);
  return { document: doc, range };
}

function resolverFor(document: Document, range: Range, index = 3): LearningBoredCfiResolver {
  return {
    resolveCFI: () => ({ index, anchor: () => range }),
    getDocument: (requestedIndex) => (requestedIndex === index ? document : undefined),
  };
}

describe('LearningBored CFI locations', () => {
  it('serializes fields in a stable order and round-trips them', () => {
    const location = createLearningBoredCfiLocation({
      bookId: 'book-1',
      cfi: CFI,
      pageIndex: 3,
      sectionHref: 'section-4.xhtml',
      pageLabel: 'p. 4',
    });

    const serialized = serializeLearningBoredCfiLocation(location);

    expect(serialized).toBe(
      `{"version":1,"kind":"cfi","bookId":"book-1","cfi":"${CFI}","pageIndex":3,"sectionHref":"section-4.xhtml","pageLabel":"p. 4"}`,
    );
    expect(parseLearningBoredCfiLocation(serialized)).toEqual(location);
  });

  it('rejects corrupt, unsupported, and incomplete serialized locations', () => {
    expect(parseLearningBoredCfiLocation('not json')).toBeNull();
    expect(
      parseLearningBoredCfiLocation(
        JSON.stringify({ version: 2, kind: 'cfi', bookId: 'book-1', cfi: CFI, pageIndex: 3 }),
      ),
    ).toBeNull();
    expect(
      parseLearningBoredCfiLocation(
        JSON.stringify({ version: 1, kind: 'cfi', bookId: 'book-1', pageIndex: 3 }),
      ),
    ).toBeNull();
  });

  it('re-resolves a CFI against a recreated document and verifies selected text', () => {
    const location = createLearningBoredCfiLocation({
      bookId: 'book-1',
      cfi: CFI,
      pageIndex: 3,
    });
    const reloaded = createDocumentWithText('Reloaded text');

    const result = resolveSerializedLearningBoredCfiLocation(
      serializeLearningBoredCfiLocation(location),
      { bookId: 'book-1', selectedText: 'Reloaded text' },
      resolverFor(reloaded.document, reloaded.range),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.index).toBe(3);
      expect(result.range.toString()).toBe('Reloaded text');
    }
  });

  it('distinguishes a wrong book, wrong page, unavailable document, and changed text', () => {
    const location = createLearningBoredCfiLocation({
      bookId: 'book-1',
      cfi: CFI,
      pageIndex: 3,
    });
    const fixture = createDocumentWithText('Original text');
    const resolver = resolverFor(fixture.document, fixture.range);

    expect(
      resolveLearningBoredCfiLocation(
        location,
        { bookId: 'book-2', selectedText: 'Original text' },
        resolver,
      ),
    ).toEqual({ ok: false, reason: 'book_mismatch' });

    expect(
      resolveLearningBoredCfiLocation(
        location,
        { bookId: 'book-1', selectedText: 'Original text' },
        { ...resolver, resolveCFI: () => ({ index: 4, anchor: () => fixture.range }) },
      ),
    ).toEqual({ ok: false, reason: 'page_mismatch' });

    expect(
      resolveLearningBoredCfiLocation(
        location,
        { bookId: 'book-1', selectedText: 'Original text' },
        { ...resolver, getDocument: () => undefined },
      ),
    ).toEqual({ ok: false, reason: 'document_unavailable' });

    expect(
      resolveLearningBoredCfiLocation(
        location,
        { bookId: 'book-1', selectedText: 'Changed text' },
        resolver,
      ),
    ).toEqual({ ok: false, reason: 'text_mismatch' });
  });

  it('fails stale CFIs cleanly when resolution or anchoring no longer works', () => {
    const location = createLearningBoredCfiLocation({
      bookId: 'book-1',
      cfi: CFI,
      pageIndex: 3,
    });

    expect(
      resolveLearningBoredCfiLocation(
        location,
        { bookId: 'book-1', selectedText: 'Text' },
        {
          resolveCFI: () => {
            throw new Error('stale');
          },
          getDocument: () => undefined,
        },
      ),
    ).toEqual({ ok: false, reason: 'stale_location' });

    const fixture = createDocumentWithText('Text');
    expect(
      resolveLearningBoredCfiLocation(
        location,
        { bookId: 'book-1', selectedText: 'Text' },
        {
          resolveCFI: () => ({ index: 3, anchor: () => null }),
          getDocument: () => fixture.document,
        },
      ),
    ).toEqual({ ok: false, reason: 'stale_location' });

    expect(
      resolveSerializedLearningBoredCfiLocation(
        '{broken',
        { bookId: 'book-1', selectedText: 'Text' },
        resolverFor(fixture.document, fixture.range),
      ),
    ).toEqual({ ok: false, reason: 'invalid_location' });
  });
});
