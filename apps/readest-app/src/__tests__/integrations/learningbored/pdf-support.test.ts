import { describe, expect, it } from 'vitest';
import { captureLearningBoredPassage } from '@/integrations/learningbored/passage';
import {
  assertLearningBoredPdfCaptureSupported,
  isLearningBoredPdfCaptureUnsupportedError,
  LEARNINGBORED_PDF_CAPTURE_UNSUPPORTED_CODE,
  LearningBoredPdfCaptureUnsupportedError,
} from '@/integrations/learningbored/pdf-support';

function rangeBetween(start: Node, startOffset: number, end: Node, endOffset: number): Range {
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  return range;
}

function capture(range: Range, documentFormat: 'EPUB' | 'PDF') {
  return captureLearningBoredPassage({
    bookId: 'book-1',
    selectionRange: range,
    documentFormat,
    cfi: 'epubcfi(/6/2!/4/2/1:0)',
    pageIndex: 0,
  });
}

describe('LearningBored PDF capture guard', () => {
  it('rejects a PDF selection whose endpoints are inside its text layer', () => {
    document.body.innerHTML = `
      <div class="textLayer"><span id="pdf-start">PDF start</span></div>
      <p id="ordinary-end">ordinary end</p>
    `;
    const pdfStart = document.querySelector('#pdf-start')!.firstChild!;
    const ordinaryEnd = document.querySelector('#ordinary-end')!.firstChild!;
    const range = rangeBetween(pdfStart, 0, ordinaryEnd, ordinaryEnd.textContent!.length);

    expect(() => assertLearningBoredPdfCaptureSupported('PDF')).toThrow(
      LearningBoredPdfCaptureUnsupportedError,
    );
    expect(() => capture(range, 'PDF')).toThrow(LearningBoredPdfCaptureUnsupportedError);
  });

  it('rejects parent-bounded and select-all PDF Ranges without inspecting their endpoints', () => {
    document.body.innerHTML = '<main><div class="textLayer">All PDF text</div></main>';
    const layer = document.querySelector('.textLayer')!;
    const parentBounded = document.createRange();
    parentBounded.selectNode(layer);
    const selectAll = document.createRange();
    selectAll.selectNodeContents(document.body);

    expect(parentBounded.startContainer).not.toBe(layer);
    expect(selectAll.startContainer).toBe(document.body);
    expect(() => capture(parentBounded, 'PDF')).toThrow(LearningBoredPdfCaptureUnsupportedError);
    expect(() => capture(selectAll, 'PDF')).toThrow(LearningBoredPdfCaptureUnsupportedError);
  });

  it('rejects every PDF substrate even when no text-layer marker is present', () => {
    document.body.innerHTML = '<p id="pdf-text">PDF text without a marker</p>';
    const text = document.querySelector('#pdf-text')!.firstChild!;
    const range = rangeBetween(text, 0, text, text.textContent!.length);

    let thrown: unknown;
    try {
      captureLearningBoredPassage({
        bookId: 'book-1',
        selectionRange: range,
        documentFormat: 'PDF',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        pageIndex: 0,
      });
    } catch (error) {
      thrown = error;
    }

    expect(isLearningBoredPdfCaptureUnsupportedError(thrown)).toBe(true);
    expect((thrown as LearningBoredPdfCaptureUnsupportedError).code).toBe(
      LEARNINGBORED_PDF_CAPTURE_UNSUPPORTED_CODE,
    );
  });

  it('does not reject reflowable content merely because an author used the textLayer class', () => {
    document.body.innerHTML = '<p class="textLayer" id="ordinary">Ordinary selected passage.</p>';
    const text = document.querySelector('#ordinary')!.firstChild!;
    const range = rangeBetween(text, 0, text, text.textContent!.length);

    expect(() => assertLearningBoredPdfCaptureSupported('EPUB')).not.toThrow();

    const passage = capture(range, 'EPUB');
    expect(passage.selectedText).toBe('Ordinary selected passage.');
    expect(passage.location).toMatchObject({
      version: 1,
      kind: 'cfi',
      bookId: 'book-1',
      pageIndex: 0,
    });
  });
});
