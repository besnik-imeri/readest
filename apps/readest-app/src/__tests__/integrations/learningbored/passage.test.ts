import { describe, expect, it } from 'vitest';
import {
  captureLearningBoredPassageText,
  LEARNINGBORED_CONTEXT_AFTER_LIMIT,
  LEARNINGBORED_CONTEXT_BEFORE_LIMIT,
} from '@/integrations/learningbored/passage-context';
import { captureLearningBoredPassage } from '@/integrations/learningbored/passage';
import { hasValidLearningBoredContextOffset } from '@/integrations/learningbored/types';

function selectTextNode(node: Node, start = 0, end = node.textContent?.length ?? 0): Range {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

function expectExactOffset(passage: ReturnType<typeof captureLearningBoredPassageText>): void {
  expect(hasValidLearningBoredContextOffset(passage)).toBe(true);
  expect(
    passage.surroundingContext.slice(
      passage.contextOffset,
      passage.contextOffset + passage.selectedText.length,
    ),
  ).toBe(passage.selectedText);
}

describe('LearningBored passage capture', () => {
  it('anchors the selected occurrence when identical text appears more than once', () => {
    document.body.innerHTML = `
      <main>
        <p>The first marker precedes the repeated sentence.</p>
        <p>The bell rang twice beneath the hill.</p>
        <p>A silver fox crossed between the echoes.</p>
        <p id="selected">The bell rang twice beneath the hill.</p>
        <p>Only then did the hidden stair appear.</p>
      </main>
    `;
    const node = document.querySelector('#selected')!.firstChild!;

    const passage = captureLearningBoredPassageText(selectTextNode(node));

    expect(passage.selectedText).toBe('The bell rang twice beneath the hill.');
    expect(passage.surroundingContext.slice(0, passage.contextOffset)).toContain(
      'A silver fox crossed between the echoes.',
    );
    expect(
      passage.surroundingContext.slice(passage.contextOffset + passage.selectedText.length),
    ).toContain('Only then did the hidden stair appear.');
    expectExactOffset(passage);
  });

  it('excludes hidden, navigation, toolbar, and executable content from context', () => {
    document.body.innerHTML = `
      <header><h1>Visible chapter heading</h1></header>
      <nav>Navigation must not leak.</nav>
      <div role="toolbar">Toolbar must not leak.</div>
      <p hidden>Hidden text must not leak.</p>
      <p aria-hidden="true">ARIA-hidden text must not leak.</p>
      <article>
        <p>Visible context before.</p>
        <p id="selected">Exact selected passage.</p>
        <p>Visible context after.</p>
      </article>
      <script>ignoreThisInstruction()</script>
    `;
    const node = document.querySelector('#selected')!.firstChild!;

    const passage = captureLearningBoredPassageText(selectTextNode(node));

    expect(passage.surroundingContext).toContain('Visible chapter heading');
    expect(passage.surroundingContext).toContain('Visible context before.');
    expect(passage.surroundingContext).toContain('Visible context after.');
    expect(passage.surroundingContext).not.toMatch(
      /Navigation must not leak|Toolbar must not leak|Hidden text must not leak|ARIA-hidden text must not leak|ignoreThisInstruction/,
    );
    expectExactOffset(passage);
  });

  it('uses only the available context side at section edges', () => {
    document.body.innerHTML = '<p id="first">First selected line.</p><p>Context after it.</p>';
    const first = captureLearningBoredPassageText(
      selectTextNode(document.querySelector('#first')!.firstChild!),
    );

    expect(first.contextOffset).toBe(0);
    expect(first.surroundingContext.startsWith('First selected line.')).toBe(true);
    expect(first.surroundingContext).toContain('Context after it.');
    expectExactOffset(first);

    document.body.innerHTML = '<p>Context before it.</p><p id="last">Last selected line.</p>';
    const last = captureLearningBoredPassageText(
      selectTextNode(document.querySelector('#last')!.firstChild!),
    );

    expect(last.contextOffset).toBeGreaterThan(0);
    expect(last.surroundingContext.endsWith('Last selected line.')).toBe(true);
    expect(last.surroundingContext).toContain('Context before it.');
    expectExactOffset(last);
  });

  it('trims long CJK context on sentence boundaries within the asymmetric limits', () => {
    const before = Array.from(
      { length: 220 },
      (_, index) => `前の文${String(index).padStart(3, '0')}で古い天文台を描く。`,
    ).join('');
    const after = Array.from(
      { length: 100 },
      (_, index) => `後の文${String(index).padStart(3, '0')}で星の動きを追う。`,
    ).join('');
    document.body.innerHTML = `<p>${before}</p><p id="selected">美羅は望遠鏡を上げた。</p><p>${after}</p>`;
    const node = document.querySelector('#selected')!.firstChild!;

    const passage = captureLearningBoredPassageText(selectTextNode(node), 'ja');
    const beforeContext = passage.surroundingContext.slice(0, passage.contextOffset);
    const afterContext = passage.surroundingContext.slice(
      passage.contextOffset + passage.selectedText.length,
    );

    expect(beforeContext.length).toBeLessThanOrEqual(LEARNINGBORED_CONTEXT_BEFORE_LIMIT);
    expect(afterContext.length).toBeLessThanOrEqual(LEARNINGBORED_CONTEXT_AFTER_LIMIT);
    expect(beforeContext.trimStart()).toMatch(/^前の文\d{3}/u);
    expect(beforeContext.trimEnd()).toMatch(/。$/u);
    expect(afterContext.trimStart()).toMatch(/^後の文000/u);
    expect(afterContext.trimEnd()).toMatch(/。$/u);
    expectExactOffset(passage);
  });

  it('counts astral characters as JavaScript UTF-16 code units', () => {
    document.body.innerHTML = '<p id="line">🧪alpha target omega</p>';
    const node = document.querySelector('#line')!.firstChild!;
    const source = node.textContent!;
    const start = source.indexOf('target');

    const passage = captureLearningBoredPassageText(selectTextNode(node, start, start + 6));

    expect(passage.selectedText).toBe('target');
    expect(passage.contextOffset).toBe('🫪alpha '.length);
    expect(passage.contextOffset).toBe(8);
    expectExactOffset(passage);
  });

  it('preserves combining sequences and does not normalize NFC or NFD text', () => {
    const nfc = 'é';
    const nfd = 'e\u0301';
    document.body.innerHTML = '<p id="line"></p>';
    const line = document.querySelector('#line')!;
    const node = document.createTextNode(`NFC:${nfc} NFD:${nfd} done`);
    line.append(node);
    const source = node.textContent!;
    const start = source.indexOf(nfd);

    const passage = captureLearningBoredPassageText(
      selectTextNode(node, start, start + nfd.length),
    );

    expect(passage.selectedText).toBe(nfd);
    expect(passage.selectedText).not.toBe(nfc);
    expect(passage.selectedText.length).toBe(2);
    expect(passage.surroundingContext).toContain(`NFC:${nfc}`);
    expectExactOffset(passage);
  });

  it('preserves whitespace inside the Range even when CSS would collapse it visually', () => {
    document.body.innerHTML = '<p id="line"></p>';
    const line = document.querySelector('#line')!;
    const node = document.createTextNode('alpha   \t  beta');
    line.append(node);
    const source = node.textContent!;

    const passage = captureLearningBoredPassageText(selectTextNode(node, 0, source.length));

    expect(passage.selectedText).toBe('alpha   \t  beta');
    expect(passage.surroundingContext).toBe(passage.selectedText);
    expect(passage.contextOffset).toBe(0);
    expectExactOffset(passage);
  });

  it('keeps a mid-word selection contiguous with its context', () => {
    document.body.innerHTML = '<p id="line">prefixunbrokenSuffix</p>';
    const node = document.querySelector('#line')!.firstChild!;
    const source = node.textContent!;
    const selectedText = 'unbroken';
    const start = source.indexOf(selectedText);

    const passage = captureLearningBoredPassageText(
      selectTextNode(node, start, start + selectedText.length),
    );

    expect(passage.selectedText).toBe(selectedText);
    expect(passage.surroundingContext).toBe(source);
    expect(passage.contextOffset).toBe('prefix'.length);
    expectExactOffset(passage);
  });

  it('rejects a collapsed Range before it can become a captured passage', () => {
    document.body.innerHTML = '<p id="line">Nothing selected.</p>';
    const node = document.querySelector('#line')!.firstChild!;
    const range = selectTextNode(node, 4, 4);

    expect(
      hasValidLearningBoredContextOffset({
        selectedText: '',
        surroundingContext: 'Nothing selected.',
        contextOffset: 4,
      }),
    ).toBe(false);
    expect(() => captureLearningBoredPassageText(range)).toThrow(
      'LearningBored passage capture requires a non-empty Range.',
    );
    expect(() =>
      captureLearningBoredPassage({
        bookId: 'book-1',
        selectionRange: range,
        documentFormat: 'EPUB',
        cfi: 'epubcfi(/6/2!/4/2/1:4)',
        pageIndex: 0,
      }),
    ).toThrow('LearningBored passage capture requires a non-empty Range.');
  });

  it('builds a typed captured passage without changing the text contract', () => {
    document.body.innerHTML = '<p id="line">Selected source text.</p>';
    const range = selectTextNode(document.querySelector('#line')!.firstChild!);

    const passage = captureLearningBoredPassage({
      bookId: 'book-1',
      selectionRange: range,
      documentFormat: 'EPUB',
      cfi: 'epubcfi(/6/2!/4/2/1:0)',
      pageIndex: 0,
      sectionHref: 'chapter-1.xhtml',
      pageLabel: 'p. 1',
      chapter: 'Chapter 1',
    });

    expect(passage.bookId).toBe('book-1');
    expect(passage.location).toMatchObject({
      version: 1,
      kind: 'cfi',
      bookId: 'book-1',
      pageIndex: 0,
    });
    expect(passage.chapter).toBe('Chapter 1');
    expectExactOffset(passage);
  });
});
