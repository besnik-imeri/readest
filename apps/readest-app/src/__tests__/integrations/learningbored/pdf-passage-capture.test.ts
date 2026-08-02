import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { fromRange, parse, toRange } from 'foliate-js/epubcfi.js';
import { DocumentLoader, type BookDoc } from '@/libs/document';
import { captureLearningBoredPassageText } from '@/integrations/learningbored/passage-context';
import { captureLearningBoredPassage } from '@/integrations/learningbored/passage';
import { LearningBoredPdfCaptureUnsupportedError } from '@/integrations/learningbored/pdf-support';
import { hasValidLearningBoredContextOffset } from '@/integrations/learningbored/types';

const vendorDir = join(process.cwd(), 'public/vendor');
const fixtureDir = resolve(__dirname, '../../fixtures/data');

type LoadedPdf = {
  book: BookDoc;
  pages: Document[];
};

async function loadPdf(name: string): Promise<LoadedPdf> {
  const bytes = readFileSync(resolve(fixtureDir, name));
  const file = new File([bytes], name, { type: 'application/pdf' });
  const { book, format } = await new DocumentLoader(file).open();

  expect(format).toBe('PDF');

  return {
    book,
    pages: await Promise.all(book.sections.map((section) => section.createDocument())),
  };
}

function textLayer(document: Document): Element {
  const layer = document.querySelector('.textLayer');
  if (!layer) throw new Error('PDF fixture did not create a text layer.');
  return layer;
}

function textNodes(root: Element): Text[] {
  const nodes: Text[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
  }

  return nodes;
}

function boundaryAt(
  nodes: Text[],
  position: number,
  preferPreviousAtBoundary: boolean,
): { node: Text; offset: number } {
  let cursor = 0;

  for (const node of nodes) {
    const length = node.data.length;
    const next = cursor + length;
    if (position < next || (preferPreviousAtBoundary && position === next)) {
      return { node, offset: position - cursor };
    }
    cursor = next;
  }

  const last = nodes.at(-1);
  if (last && position === cursor) return { node: last, offset: last.data.length };
  throw new RangeError(`Text offset ${position} is outside the PDF text layer.`);
}

function rangeForText(root: Element, selectedText: string, occurrence = 0): Range {
  const source = root.textContent ?? '';
  let start = -1;
  let from = 0;

  for (let index = 0; index <= occurrence; index += 1) {
    start = source.indexOf(selectedText, from);
    if (start === -1)
      throw new Error(`Could not find ${JSON.stringify(selectedText)} in PDF text.`);
    from = start + selectedText.length;
  }

  const nodes = textNodes(root);
  const startBoundary = boundaryAt(nodes, start, false);
  const endBoundary = boundaryAt(nodes, start + selectedText.length, true);
  const range = root.ownerDocument.createRange();
  range.setStart(startBoundary.node, startBoundary.offset);
  range.setEnd(endBoundary.node, endBoundary.offset);
  return range;
}

describe('LearningBored PDF passage-capture spike', () => {
  const pdfs = new Map<string, LoadedPdf>();

  beforeAll(async () => {
    await import('foliate-js/pdf.js');
    const pdfjsLib = (globalThis as Record<string, unknown>)['pdfjsLib'] as {
      GlobalWorkerOptions: { workerSrc: string };
    };
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      `file://${join(vendorDir, 'pdfjs/pdf.worker.min.mjs')}`,
    ).href;

    for (const fixture of [
      'learningbored-single-column.pdf',
      'learningbored-two-column.pdf',
      'learningbored-table-heavy.pdf',
      'learningbored-code-heavy.pdf',
      'learningbored-ocr-imperfect.pdf',
      'learningbored-image-only-scan.pdf',
    ]) {
      pdfs.set(fixture, await loadPdf(fixture));
    }
  }, 30_000);

  it('captures exact single-column text with useful bounded context and an exact offset', () => {
    const page = pdfs.get('learningbored-single-column.pdf')!.pages[0]!;
    const target = 'The selected chamber stays full while the handle rises.';
    const range = rangeForText(textLayer(page), target);
    const captured = captureLearningBoredPassageText(range);

    expect(range.toString()).toBe(target);
    expect(captured.selectedText).toBe(target);
    expect(hasValidLearningBoredContextOffset(captured)).toBe(true);
    expect(
      captured.surroundingContext.slice(
        captured.contextOffset,
        captured.contextOffset + captured.selectedText.length,
      ),
    ).toBe(target);
    expect(captured.contextOffset).toBeGreaterThan(0);
    expect(captured.surroundingContext).toContain('Before each demonstration');
    expect(captured.surroundingContext).toContain('When the handle falls');
  });

  it('round-trips a PDF CFI but rejects passage construction at the fail-closed guard', async () => {
    const fixture = 'learningbored-single-column.pdf';
    const firstLoad = pdfs.get(fixture)!;
    const target = 'The selected chamber stays full while the handle rises.';
    const range = rangeForText(textLayer(firstLoad.pages[0]!), target);
    const cfi = fromRange(range);

    expect(toRange(firstLoad.pages[0]!, parse(cfi))?.toString()).toBe(target);

    const reconstructed = await loadPdf(fixture);
    expect(toRange(reconstructed.pages[0]!, parse(cfi))?.toString()).toBe(target);

    expect(() =>
      captureLearningBoredPassage({
        selectionRange: range,
        documentFormat: 'PDF',
        bookId: 'fictional-alder-rig',
        cfi,
        pageIndex: 0,
        sectionHref: firstLoad.book.sections[0]!.href ?? 'pdf-page-1',
        pageLabel: '1',
        chapter: 'The Alder Pump Demonstration Rig',
      }),
    ).toThrow(LearningBoredPdfCaptureUnsupportedError);
  });

  // Spike gate: remove `.fails` only when PDF selection reconstruction preserves these boundaries.
  it.fails('preserves visible word boundaries inside wrapped two-column prose', () => {
    const page = pdfs.get('learningbored-two-column.pdf')!.pages[0]!;
    const layer = textLayer(page);
    const pageText = layer.textContent ?? '';
    const leftTarget =
      'The left-column selection ends before the gutter. It must not continue into the right column until the reader reaches the next logical block.';
    const rightTarget =
      'The right-column selection begins after the gutter. Reading order is correct only when the extracted text finishes the left column before starting this paragraph.';

    expect(pageText.indexOf(leftTarget)).toBeGreaterThanOrEqual(0);
    expect(pageText.indexOf(rightTarget)).toBeGreaterThan(pageText.indexOf(leftTarget));

    const captured = captureLearningBoredPassageText(rangeForText(layer, leftTarget));
    expect(captured.selectedText).toBe(leftTarget);
    expect(captured.selectedText).not.toContain('The cooling coil returns');
    expect(captured.selectedText).not.toContain(rightTarget);
    expect(hasValidLearningBoredContextOffset(captured)).toBe(true);
  });

  it('extracts a controlled cross-column selection in content-stream reading order', () => {
    const page = pdfs.get('learningbored-two-column.pdf')!.pages[0]!;
    const layer = textLayer(page);
    const pageText = layer.textContent ?? '';
    const selectionStart = 'The left-column selection ends before';
    const firstRightColumnSentence = 'The cooling coil returns water toward';
    const start = pageText.indexOf(selectionStart);
    const end = pageText.indexOf(firstRightColumnSentence) + firstRightColumnSentence.length;

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const expected = pageText.slice(start, end);
    const captured = captureLearningBoredPassageText(rangeForText(layer, expected));
    expect(captured.selectedText).toBe(expected);
    expect(captured.selectedText.indexOf(selectionStart)).toBe(0);
    expect(captured.selectedText.indexOf(firstRightColumnSentence)).toBeGreaterThan(0);
    expect(captured.selectedText).not.toContain('The right-column selection begins');
    expect(captured.selectedText).toContain('logical block.The cooling coil');
    expect(hasValidLearningBoredContextOffset(captured)).toBe(true);
  });

  it('keeps a table-cell selection exact and excludes adjacent cells', () => {
    const page = pdfs.get('learningbored-table-heavy.pdf')!.pages[0]!;
    const layer = textLayer(page);
    const pageText = layer.textContent ?? '';
    const target = 'No trapped bubble';

    expect(pageText.indexOf('Clear chamber')).toBeLessThan(pageText.indexOf(target));
    expect(pageText.indexOf(target)).toBeLessThan(pageText.indexOf('Continue the demonstration'));

    const captured = captureLearningBoredPassageText(rangeForText(layer, target));
    expect(captured.selectedText).toBe(target);
    expect(captured.selectedText).not.toContain('Clear chamber');
    expect(captured.selectedText).not.toContain('Continue the demonstration');
    expect(hasValidLearningBoredContextOffset(captured)).toBe(true);
  });

  // Spike gate: raw PDF text items currently discard the leading indentation before this Range exists.
  it.fails('preserves code indentation and punctuation inside the exact selection', () => {
    const page = pdfs.get('learningbored-code-heavy.pdf')!.pages[0]!;
    const layer = textLayer(page);
    const target = '  const sample = probe.read();';
    const range = rangeForText(layer, target);
    const captured = captureLearningBoredPassageText(range);

    expect(range.toString()).toBe(target);
    expect(captured.selectedText).toBe(target);
    expect(captured.selectedText.startsWith('  ')).toBe(true);
    expect(captured.selectedText.endsWith(';')).toBe(true);
    expect(hasValidLearningBoredContextOffset(captured)).toBe(true);
  });

  it('has no selectable text substrate for the image-only scan', () => {
    const page = pdfs.get('learningbored-image-only-scan.pdf')!.pages[0]!;
    const layer = textLayer(page);
    const nonEmptyTextNodes = textNodes(layer).filter((node) => node.data.trim().length > 0);

    expect(layer.textContent?.trim()).toBe('');
    expect(nonEmptyTextNodes).toHaveLength(0);
  });

  it('exposes selectable embedded OCR text even when it disagrees with the visible raster', () => {
    const page = pdfs.get('learningbored-ocr-imperfect.pdf')!.pages[0]!;
    const layer = textLayer(page);
    const layerText = layer.textContent ?? '';
    const visibleRasterText = 'Valve A remains closed while the gauge returns to zero.';
    const imperfectOcrText = 'Valve A remains c1osed while the gauge returns to zer0.';

    expect(layerText).toContain(imperfectOcrText);
    expect(layerText).not.toContain(visibleRasterText);
    expect(layerText).toContain('Spacing check: alphabetagamma.');
    expect(layerText).not.toContain('Spacing check: alpha beta gamma.');

    const range = rangeForText(layer, imperfectOcrText);
    const capturedText = captureLearningBoredPassageText(range);
    expect(range.toString()).toBe(imperfectOcrText);
    expect(capturedText.selectedText).toBe(imperfectOcrText);
    expect(hasValidLearningBoredContextOffset(capturedText)).toBe(true);

    expect(() =>
      captureLearningBoredPassage({
        selectionRange: range,
        documentFormat: 'PDF',
        bookId: 'fictional-ocr-calibration-sheet',
        cfi: fromRange(range),
        pageIndex: 0,
      }),
    ).toThrow(LearningBoredPdfCaptureUnsupportedError);
  });

  it('cannot retain endpoints in two separately rendered PDF page documents', () => {
    const { pages } = pdfs.get('learningbored-single-column.pdf')!;
    const pageOneText = textNodes(textLayer(pages[0]!)).find((node) => node.data.length > 0)!;
    const pageTwoText = textNodes(textLayer(pages[1]!)).find((node) => node.data.length > 0)!;
    const crossPageRange = pages[0]!.createRange();

    crossPageRange.setStart(pageOneText, 0);

    let crossDocumentError: unknown;
    try {
      crossPageRange.setEnd(pageTwoText, Math.min(10, pageTwoText.length));
    } catch (error) {
      crossDocumentError = error;
    }

    if (crossDocumentError) {
      expect(crossDocumentError).toBeInstanceOf(DOMException);
    } else {
      expect(crossPageRange.startContainer.ownerDocument).toBe(
        crossPageRange.endContainer.ownerDocument,
      );
      expect(
        crossPageRange.startContainer.ownerDocument === pages[0] &&
          crossPageRange.endContainer.ownerDocument === pages[1],
      ).toBe(false);
    }
  });
});
