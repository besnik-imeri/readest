const BEFORE_CONTEXT_LIMIT = 2400;
const AFTER_CONTEXT_LIMIT = 800;

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
  'select',
  'script',
  'style',
  'template',
  'textarea',
]);

const SENTENCE_TERMINATORS = new Set(['.', '!', '?', '。', '！', '？']);
const SENTENCE_CLOSERS = new Set(['"', "'", '”', '’', '»', '›', ')', ']', '}']);

function ownerDocument(node: Node): Document | undefined {
  return node.nodeType === 9 ? (node as Document) : (node.ownerDocument ?? undefined);
}

function isInside(root: Element, node: Node): boolean {
  return node === root || root.contains(node);
}

function serializeFragment(fragment: DocumentFragment): string {
  let output = '';

  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      output += node.nodeValue?.replace(/\s+/g, ' ') ?? '';
      return;
    }

    if (node.nodeType !== 1 && node.nodeType !== 11) return;

    if (node.nodeType === 11) {
      node.childNodes.forEach(visit);
      return;
    }

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    if (
      SKIPPED_ELEMENTS.has(tagName) ||
      element.hasAttribute('hidden') ||
      element.getAttribute('aria-hidden') === 'true' ||
      element.getAttribute('role') === 'navigation' ||
      element.getAttribute('role') === 'toolbar'
    ) {
      return;
    }

    if (tagName === 'br') {
      output += '\n';
      return;
    }

    if (tagName === 'pre') {
      output += element.textContent ?? '';
      output += '\n\n';
      return;
    }

    element.childNodes.forEach(visit);

    if (BLOCK_ELEMENTS.has(tagName)) {
      output += '\n\n';
    }
  };

  visit(fragment);

  return output
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  const starts: number[] = [0];
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
    if (/\s/u.test(text[index]!)) {
      let start = index + 1;
      while (start < text.length && /\s/u.test(text[start]!)) start += 1;
      return start;
    }
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
  if (text.length <= BEFORE_CONTEXT_LIMIT) return text;

  const minimum = text.length - BEFORE_CONTEXT_LIMIT;
  const boundaries = sentenceBoundaries(text, locale);
  const candidates = [...paragraphStarts(text), ...boundaries.starts]
    .filter((start) => start >= minimum && start < text.length)
    .sort((left, right) => left - right);
  const start = candidates[0] ?? wordStartAtOrAfter(text, minimum);

  return text.slice(start).trim();
}

function boundedAfterContext(text: string, locale?: string): string {
  if (text.length <= AFTER_CONTEXT_LIMIT) return text;

  const boundaries = sentenceBoundaries(text, locale);
  const candidates = [...paragraphEnds(text), ...boundaries.ends]
    .filter((end) => end > 0 && end <= AFTER_CONTEXT_LIMIT)
    .sort((left, right) => right - left);
  const end = candidates[0] ?? wordEndAtOrBefore(text, AFTER_CONTEXT_LIMIT);

  return text.slice(0, end).trim();
}

function createContextRanges(selectionRange: Range): { before: Range; after: Range } | undefined {
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

    return { before, after };
  } catch {
    return undefined;
  }
}

export function getSelectionContext(selectionRange: Range, locale?: string): string | undefined {
  const ranges = createContextRanges(selectionRange);
  if (!ranges) return undefined;

  const before = boundedBeforeContext(serializeFragment(ranges.before.cloneContents()), locale);
  const after = boundedAfterContext(serializeFragment(ranges.after.cloneContents()), locale);
  const sections = [
    before ? `Context before the selected passage:\n${before}` : undefined,
    after ? `Context after the selected passage:\n${after}` : undefined,
  ].filter((section): section is string => Boolean(section));

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}
