import type { LearningBoredPassageText } from './types';
import { hasValidLearningBoredContextOffset } from './types';

export const LEARNINGBORED_CONTEXT_BEFORE_LIMIT = 2400;
export const LEARNINGBORED_CONTEXT_AFTER_LIMIT = 800;

const BLOCK_ELEMENTS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const SKIPPED_ELEMENTS = new Set([
  'button',
  'input',
  'nav',
  'noscript',
  'option',
  'rp',
  'rt',
  'script',
  'select',
  'style',
  'template',
  'textarea',
]);

const SENTENCE_TERMINATORS = new Set(['.', '!', '?', '。', '！', '？']);
const SENTENCE_CLOSERS = new Set(['"', "'", '”', '’', '»', '›', ')', ']', '}']);

type SerializedPiece = {
  kind: 'text' | 'structural-break';
  value: string;
};

function ownerDocument(node: Node): Document | undefined {
  return node.nodeType === 9 ? (node as Document) : (node.ownerDocument ?? undefined);
}

function isInside(root: Element, node: Node): boolean {
  return node === root || root.contains(node);
}

function isSkippedElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();

  return (
    SKIPPED_ELEMENTS.has(tagName) ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.getAttribute('role') === 'navigation' ||
    element.getAttribute('role') === 'toolbar'
  );
}

function normalizeSurroundingWhitespace(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n');
}

function serializeFragment(
  fragment: DocumentFragment,
  stripTrailingStructuralBreaks: boolean,
): string {
  const pieces: SerializedPiece[] = [];

  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      pieces.push({ kind: 'text', value: node.nodeValue ?? '' });
      return;
    }

    if (node.nodeType !== 1 && node.nodeType !== 11) return;

    if (node.nodeType === 11) {
      node.childNodes.forEach(visit);
      return;
    }

    const element = node as Element;
    if (isSkippedElement(element)) return;

    const tagName = element.tagName.toLowerCase();
    if (tagName === 'br') {
      pieces.push({ kind: 'structural-break', value: '\n' });
      return;
    }

    element.childNodes.forEach(visit);

    if (BLOCK_ELEMENTS.has(tagName)) {
      pieces.push({ kind: 'structural-break', value: '\n\n' });
    }
  };

  visit(fragment);

  if (stripTrailingStructuralBreaks) {
    while (pieces.at(-1)?.kind === 'structural-break') pieces.pop();
  }

  const serialized = normalizeSurroundingWhitespace(pieces.map(({ value }) => value).join(''));
  return serialized.trim().length === 0 ? '' : serialized;
}

function nearestBlockAncestor(node: Node, root: Element): Element {
  let element = node.nodeType === 1 ? (node as Element) : node.parentElement;

  while (element && element !== root) {
    if (BLOCK_ELEMENTS.has(element.tagName.toLowerCase())) return element;
    element = element.parentElement;
  }

  return root;
}

function startsAfterContentInSameBlock(selectionRange: Range, root: Element): boolean {
  const doc = ownerDocument(selectionRange.startContainer);
  if (!doc) return false;

  const block = nearestBlockAncestor(selectionRange.startContainer, root);

  try {
    const prefix = doc.createRange();
    prefix.selectNodeContents(block);
    prefix.setEnd(selectionRange.startContainer, selectionRange.startOffset);
    return prefix.toString().length > 0;
  } catch {
    return false;
  }
}

function createContextRanges(
  selectionRange: Range,
): { before: Range; after: Range; root: Element } | undefined {
  const startDocument = ownerDocument(selectionRange.startContainer);
  const endDocument = ownerDocument(selectionRange.endContainer);
  if (!startDocument || startDocument !== endDocument) return undefined;

  const root = startDocument.body ?? startDocument.documentElement;
  if (
    !root ||
    !isInside(root, selectionRange.startContainer) ||
    !isInside(root, selectionRange.endContainer)
  ) {
    return undefined;
  }

  try {
    const before = startDocument.createRange();
    before.selectNodeContents(root);
    before.setEnd(selectionRange.startContainer, selectionRange.startOffset);

    const after = startDocument.createRange();
    after.selectNodeContents(root);
    after.setStart(selectionRange.endContainer, selectionRange.endOffset);

    return { before, after, root };
  } catch {
    return undefined;
  }
}

function fallbackSentenceBoundaries(text: string): { starts: number[]; ends: number[] } {
  const starts = [0];
  const ends: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (!SENTENCE_TERMINATORS.has(text[index]!)) continue;

    let end = index + 1;
    while (end < text.length && SENTENCE_CLOSERS.has(text[end]!)) end += 1;
    ends.push(end);

    let next = end;
    while (next < text.length && /\s/u.test(text[next]!)) next += 1;
    if (next < text.length) starts.push(next);
  }

  return { starts, ends };
}

function sentenceBoundaries(text: string, locale?: string): { starts: number[]; ends: number[] } {
  if (typeof Intl.Segmenter !== 'function') return fallbackSentenceBoundaries(text);

  try {
    const segments = new Intl.Segmenter(locale ?? 'en', { granularity: 'sentence' }).segment(text);
    const starts: number[] = [];
    const ends: number[] = [];

    for (const segment of segments) {
      starts.push(segment.index);
      ends.push(segment.index + segment.segment.trimEnd().length);
    }

    return { starts, ends };
  } catch {
    return fallbackSentenceBoundaries(text);
  }
}

function paragraphStarts(text: string): number[] {
  const starts = [0];
  let index = text.indexOf('\n\n');

  while (index !== -1) {
    let start = index + 2;
    while (start < text.length && text[start] === '\n') start += 1;
    if (start < text.length) starts.push(start);
    index = text.indexOf('\n\n', start);
  }

  return starts;
}

function paragraphEnds(text: string): number[] {
  const ends: number[] = [];
  let index = text.indexOf('\n\n');

  while (index !== -1) {
    ends.push(index);
    index = text.indexOf('\n\n', index + 2);
  }

  ends.push(text.length);
  return ends;
}

function wordStartAtOrAfter(text: string, minimum: number): number {
  for (let index = minimum; index < text.length; index += 1) {
    if (!/\s/u.test(text[index]!)) continue;

    let start = index + 1;
    while (start < text.length && /\s/u.test(text[start]!)) start += 1;
    return start;
  }

  return minimum;
}

function wordEndAtOrBefore(text: string, maximum: number): number {
  for (let index = maximum; index > 0; index -= 1) {
    if (/\s/u.test(text[index - 1]!)) return index - 1;
  }

  return maximum;
}

function boundedBeforeContext(text: string, locale?: string): string {
  if (text.length <= LEARNINGBORED_CONTEXT_BEFORE_LIMIT) return text.trimStart();

  const minimum = text.length - LEARNINGBORED_CONTEXT_BEFORE_LIMIT;
  const boundaries = sentenceBoundaries(text, locale);
  const candidates = [...paragraphStarts(text), ...boundaries.starts]
    .filter((start) => start >= minimum && start < text.length)
    .sort((left, right) => left - right);
  const start = candidates[0] ?? wordStartAtOrAfter(text, minimum);

  return text.slice(start).trimStart();
}

function boundedAfterContext(text: string, locale?: string): string {
  if (text.length <= LEARNINGBORED_CONTEXT_AFTER_LIMIT) return text.trimEnd();

  const boundaries = sentenceBoundaries(text, locale);
  const candidates = [...paragraphEnds(text), ...boundaries.ends]
    .filter((end) => end > 0 && end <= LEARNINGBORED_CONTEXT_AFTER_LIMIT)
    .sort((left, right) => right - left);
  const end = candidates[0] ?? wordEndAtOrBefore(text, LEARNINGBORED_CONTEXT_AFTER_LIMIT);

  return text.slice(0, end).trimEnd();
}

/**
 * Builds a context window without searching for the selected text. The selected Range text is inserted
 * verbatim between independently bounded context halves, so repeated text and Unicode normalization do
 * not make the offset ambiguous.
 */
export function captureLearningBoredPassageText(
  selectionRange: Range,
  locale?: string,
): LearningBoredPassageText {
  const selectedText = selectionRange.toString();
  if (selectedText.length === 0) {
    throw new TypeError('LearningBored passage capture requires a non-empty Range.');
  }

  const ranges = createContextRanges(selectionRange);

  if (!ranges) {
    return { selectedText, surroundingContext: selectedText, contextOffset: 0 };
  }

  const before = boundedBeforeContext(
    serializeFragment(
      ranges.before.cloneContents(),
      startsAfterContentInSameBlock(selectionRange, ranges.root),
    ),
    locale,
  );
  const after = boundedAfterContext(serializeFragment(ranges.after.cloneContents(), false), locale);
  const passage = {
    selectedText,
    surroundingContext: `${before}${selectedText}${after}`,
    contextOffset: before.length,
  } satisfies LearningBoredPassageText;

  if (!hasValidLearningBoredContextOffset(passage)) {
    throw new Error('LearningBored passage context offset invariant failed.');
  }

  return passage;
}
