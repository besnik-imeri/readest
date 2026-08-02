import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLearningBoredSourceSpanRange,
  createLearningBoredTemporaryHighlightCallbacks,
} from '@/integrations/learningbored/source-span';

function createSelectedRange(): Range {
  const paragraph = document.createElement('p');
  paragraph.append('Before ');
  const emphasis = document.createElement('em');
  emphasis.textContent = 'a 😀 signal';
  paragraph.append(emphasis, ' moves after.');
  document.body.append(paragraph);

  const range = document.createRange();
  range.selectNodeContents(paragraph);
  return range;
}

describe('LearningBored source-span mapping', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('maps UTF-16 offsets across inline text nodes, including an astral character', () => {
    const selectedRange = createSelectedRange();
    const selectedText = selectedRange.toString();
    const sourceStart = selectedText.indexOf('😀');
    const sourceEnd = sourceStart + '😀 signal moves'.length;

    const result = createLearningBoredSourceSpanRange(selectedRange, {
      sourceStart,
      sourceEnd,
    });

    expect(result?.toString()).toBe('😀 signal moves');
    expect(sourceEnd - sourceStart).toBe(15); // 😀 occupies two UTF-16 code units.
  });

  it('maps a source span contained in one text node', () => {
    const text = document.createTextNode('alpha beta gamma');
    document.body.append(text);
    const selectedRange = document.createRange();
    selectedRange.setStart(text, 6);
    selectedRange.setEnd(text, 16);

    expect(
      createLearningBoredSourceSpanRange(selectedRange, {
        sourceStart: 0,
        sourceEnd: 4,
      })?.toString(),
    ).toBe('beta');
  });

  it('rejects empty, negative, reversed, or out-of-bounds spans', () => {
    const selectedRange = createSelectedRange();

    for (const span of [
      { sourceStart: -1, sourceEnd: 2 },
      { sourceStart: 2, sourceEnd: 2 },
      { sourceStart: 4, sourceEnd: 2 },
      { sourceStart: 0, sourceEnd: selectedRange.toString().length + 1 },
    ]) {
      expect(createLearningBoredSourceSpanRange(selectedRange, span)).toBeNull();
    }
  });

  it('replaces and clears temporary highlights without persisting them', () => {
    const selectedRange = createSelectedRange();
    const removeFirst = vi.fn();
    const removeSecond = vi.fn();
    const applyHighlight = vi
      .fn<(range: Range) => () => void>()
      .mockReturnValueOnce(removeFirst)
      .mockReturnValueOnce(removeSecond);
    const callbacks = createLearningBoredTemporaryHighlightCallbacks({
      resolveSelectedRange: () => selectedRange,
      applyHighlight,
    });

    callbacks.show({ sourceStart: 0, sourceEnd: 6 });
    expect(applyHighlight.mock.calls[0]?.[0].toString()).toBe('Before');

    callbacks.show({ sourceStart: 7, sourceEnd: 8 });
    expect(removeFirst).toHaveBeenCalledTimes(1);
    expect(applyHighlight).toHaveBeenCalledTimes(2);

    callbacks.clear();
    expect(removeSecond).toHaveBeenCalledTimes(1);
    callbacks.clear();
    expect(removeSecond).toHaveBeenCalledTimes(1);
  });

  it('does not apply a highlight when the captured selection cannot be resolved', () => {
    const applyHighlight = vi.fn();
    const callbacks = createLearningBoredTemporaryHighlightCallbacks({
      resolveSelectedRange: () => null,
      applyHighlight,
    });

    callbacks.show({ sourceStart: 0, sourceEnd: 1 });
    expect(applyHighlight).not.toHaveBeenCalled();
  });
});
