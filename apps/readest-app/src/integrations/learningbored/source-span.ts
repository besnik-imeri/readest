import type { LearningBoredSourceSpan } from './client';

function isValidSourceSpan(span: LearningBoredSourceSpan, textLength: number): boolean {
  return (
    Number.isInteger(span.sourceStart) &&
    Number.isInteger(span.sourceEnd) &&
    span.sourceStart >= 0 &&
    span.sourceEnd > span.sourceStart &&
    span.sourceEnd <= textLength
  );
}

interface TextBoundary {
  node: Text;
  offset: number;
}

function boundaryAtOffset(
  range: Range,
  offset: number,
  preferNextNode: boolean,
): TextBoundary | null {
  const document = range.startContainer.ownerDocument;
  if (!document) return null;

  const commonAncestor = range.commonAncestorContainer;
  const root =
    commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentNode : commonAncestor;
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch {
        return NodeFilter.FILTER_REJECT;
      }
    },
  });

  let consumed = 0;
  let node = walker.nextNode() as Text | null;
  let lastBoundary: TextBoundary | null = null;

  while (node) {
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);

    if (node === range.startContainer) nodeRange.setStart(node, range.startOffset);
    if (node === range.endContainer) nodeRange.setEnd(node, range.endOffset);

    const startOffset = nodeRange.startOffset;
    const length = nodeRange.toString().length;
    const end = consumed + length;

    if (offset < end || (!preferNextNode && offset === end)) {
      return { node, offset: startOffset + (offset - consumed) };
    }

    if (offset === end) lastBoundary = { node, offset: startOffset + length };
    consumed = end;
    node = walker.nextNode() as Text | null;
  }

  return offset === consumed ? lastBoundary : null;
}

/**
 * Maps a Board source span into a DOM subrange of the exact captured selection.
 * DOM Range and JavaScript string offsets are both UTF-16 code units, including
 * astral characters, so no code-point conversion is performed.
 */
export function createLearningBoredSourceSpanRange(
  selectedRange: Range,
  span: LearningBoredSourceSpan,
): Range | null {
  const selectedText = selectedRange.toString();
  if (!isValidSourceSpan(span, selectedText.length)) return null;

  const start = boundaryAtOffset(selectedRange, span.sourceStart, true);
  const end = boundaryAtOffset(selectedRange, span.sourceEnd, false);
  if (!start || !end) return null;

  try {
    const subrange = selectedRange.cloneRange();
    subrange.setStart(start.node, start.offset);
    subrange.setEnd(end.node, end.offset);
    return subrange.toString() === selectedText.slice(span.sourceStart, span.sourceEnd)
      ? subrange
      : null;
  } catch {
    return null;
  }
}

export interface LearningBoredTemporaryHighlightCallbacks {
  show: (span: LearningBoredSourceSpan) => void;
  clear: () => void;
}

export function createLearningBoredTemporaryHighlightCallbacks(input: {
  resolveSelectedRange: () => Range | null;
  applyHighlight: (range: Range) => void | (() => void);
}): LearningBoredTemporaryHighlightCallbacks {
  let removeHighlight: (() => void) | undefined;

  const clear = () => {
    try {
      removeHighlight?.();
    } catch {}
    removeHighlight = undefined;
  };

  return {
    show: (span) => {
      clear();
      const selectedRange = input.resolveSelectedRange();
      if (!selectedRange) return;
      const sourceRange = createLearningBoredSourceSpanRange(selectedRange, span);
      if (!sourceRange) return;
      try {
        removeHighlight = input.applyHighlight(sourceRange) ?? undefined;
      } catch {
        removeHighlight = undefined;
      }
    },
    clear,
  };
}
