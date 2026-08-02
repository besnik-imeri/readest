import { beforeAll, describe, expect, it } from 'vitest';
import {
  GlobalWorkerOptions,
  TextLayer,
  getDocument,
} from '../../../../public/vendor/pdfjs/pdf.min.mjs';

const TWO_COLUMN_URL = new URL('../../fixtures/data/learningbored-two-column.pdf', import.meta.url)
  .href;
const CODE_URL = new URL('../../fixtures/data/learningbored-code-heavy.pdf', import.meta.url).href;
const OCR_URL = new URL('../../fixtures/data/learningbored-ocr-imperfect.pdf', import.meta.url)
  .href;

type SpanEvidence = {
  text: string;
  left: string;
  top: string;
  width: string;
  height: string;
  fontSize: string;
  fontFamily: string;
  transform: string;
  cssText: string;
  rect: { left: number; top: number; width: number; height: number };
  attributes: Record<string, string>;
  canvasWidth: string | null;
  dir: string | null;
  nextElement: string | null;
};

type TextLayerOptions = ConstructorParameters<typeof TextLayer>[0];
type BrowserPdfDocument = {
  getPage(pageNumber: number): Promise<{
    streamTextContent(): unknown;
    getViewport(options: { scale: number }): unknown;
  }>;
};

async function renderFirstPageTextLayer(url: string): Promise<HTMLElement> {
  const response = await fetch(url);
  const loadingTask = getDocument({
    data: new Uint8Array(await response.arrayBuffer()),
    isEvalSupported: false,
  });
  const pdf = (await loadingTask.promise) as BrowserPdfDocument;
  const page = await pdf.getPage(1);
  const container = document.createElement('div');
  container.className = 'textLayer';
  container.style.setProperty('--total-scale-factor', '1');
  document.body.append(container);
  const textLayer = new TextLayer({
    textContentSource: (await page.streamTextContent()) as TextLayerOptions['textContentSource'],
    container,
    viewport: page.getViewport({ scale: 1 }) as TextLayerOptions['viewport'],
  });
  await textLayer.render();
  return container;
}

function evidenceFor(textLayer: Element, pattern: RegExp): SpanEvidence[] {
  return [...textLayer.querySelectorAll<HTMLSpanElement>('span')]
    .filter((span) => pattern.test(span.textContent ?? ''))
    .map((span) => {
      const rect = span.getBoundingClientRect();
      return {
        text: span.textContent ?? '',
        left: span.style.left,
        top: span.style.top,
        width: span.style.width,
        height: span.style.height,
        fontSize: span.style.fontSize,
        fontFamily: span.style.fontFamily,
        transform: span.style.transform,
        cssText: span.style.cssText,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        attributes: Object.fromEntries(
          [...span.attributes].map((attribute) => [attribute.name, attribute.value]),
        ),
        canvasWidth: span.getAttribute('data-canvas-width'),
        dir: span.getAttribute('dir'),
        nextElement: span.nextElementSibling?.tagName.toLowerCase() ?? null,
      };
    });
}

function browserSelectionText(root: Element): { rangeText: string; selectionText: string } {
  const host = document.createElement('div');
  host.append(root.cloneNode(true));
  document.body.append(host);

  try {
    const range = document.createRange();
    range.selectNodeContents(host);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return { rangeText: range.toString(), selectionText: selection.toString() };
  } finally {
    window.getSelection()?.removeAllRanges();
    host.remove();
  }
}

describe('LearningBored PDF text layer in Chromium', () => {
  let twoColumn: HTMLElement;
  let code: HTMLElement;
  let ocr: HTMLElement;

  beforeAll(async () => {
    GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    [twoColumn, code, ocr] = await Promise.all([
      renderFirstPageTextLayer(TWO_COLUMN_URL),
      renderFirstPageTextLayer(CODE_URL),
      renderFirstPageTextLayer(OCR_URL),
    ]);
  }, 30_000);

  it('records line-item geometry and selection separators for wrapped prose', () => {
    const evidence = evidenceFor(
      twoColumn,
      /left-column selection|gutter|cooling coil returns|reservoir/u,
    );
    const selection = browserSelectionText(twoColumn);

    expect(evidence.length).toBeGreaterThan(1);
    expect(twoColumn.querySelectorAll('br').length).toBeGreaterThan(0);
    expect(evidence.some((span) => span.nextElement === 'br')).toBe(true);
    expect(selection.rangeText).toContain('thegutter');
    expect(selection.selectionText).toContain('the\ngutter');

    console.warn(`LEARNINGBORED_TWO_COLUMN_EVIDENCE ${JSON.stringify(evidence)}`);
    console.warn(`LEARNINGBORED_TWO_COLUMN_SELECTION ${JSON.stringify(selection)}`);
    console.warn(
      `LEARNINGBORED_TWO_COLUMN_MARKED_CONTENT ${twoColumn.querySelectorAll('.markedContent').length}`,
    );
  });

  it('records that code indentation is geometric rather than span text', () => {
    const evidence = evidenceFor(
      code,
      /function readProbe|const sample|if \(!sample\.valid\)|return null|return sample\.value/u,
    );
    const functionLine = evidence.find((span) => span.text.startsWith('function readProbe'))!;
    const constLine = evidence.find((span) => span.text.startsWith('const sample'))!;
    const selection = browserSelectionText(code);

    expect(functionLine).toBeDefined();
    expect(constLine).toBeDefined();
    expect(constLine.text.startsWith('  ')).toBe(false);
    expect(Number.parseFloat(constLine.left)).toBeGreaterThan(Number.parseFloat(functionLine.left));
    expect(selection.rangeText).toContain('{const sample = probe.read();if');
    expect(selection.selectionText).toContain('{\nconst sample = probe.read();\nif');

    console.warn(`LEARNINGBORED_CODE_EVIDENCE ${JSON.stringify(evidence)}`);
    console.warn(`LEARNINGBORED_CODE_SELECTION ${JSON.stringify(selection)}`);
    console.warn(
      `LEARNINGBORED_CODE_MARKED_CONTENT ${code.querySelectorAll('.markedContent').length}`,
    );
  });

  it('records that selectable OCR text can disagree with the visible raster', () => {
    const evidence = evidenceFor(ocr, /c1osed|rnarker|alphabetagamma|4B37/u);
    const selection = browserSelectionText(ocr);
    const visibleRasterText = 'Valve A remains closed while the gauge returns to zero.';
    const imperfectOcrText = 'Valve A remains c1osed while the gauge returns to zer0.';

    expect(evidence.length).toBeGreaterThanOrEqual(4);
    expect(selection.rangeText).toContain(imperfectOcrText);
    expect(selection.selectionText).toContain(imperfectOcrText);
    expect(selection.rangeText).not.toContain(visibleRasterText);
    expect(selection.selectionText).not.toContain(visibleRasterText);
    expect(selection.selectionText).toContain('Spacing check: alphabetagamma.');

    console.warn(`LEARNINGBORED_OCR_EVIDENCE ${JSON.stringify(evidence)}`);
    console.warn(`LEARNINGBORED_OCR_SELECTION ${JSON.stringify(selection)}`);
  });
});
