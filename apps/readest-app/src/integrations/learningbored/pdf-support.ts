import type { BookFormat } from '@/types/book';

export const LEARNINGBORED_PDF_CAPTURE_UNSUPPORTED_CODE =
  'learningbored_pdf_capture_unsupported' as const;

export class LearningBoredPdfCaptureUnsupportedError extends Error {
  readonly code = LEARNINGBORED_PDF_CAPTURE_UNSUPPORTED_CODE;

  constructor() {
    super('LearningBored passage capture is unavailable for PDF documents.');
    this.name = 'LearningBoredPdfCaptureUnsupportedError';
  }
}

/** Fails before locator work for every PDF substrate at the current reader pin. */
export function assertLearningBoredPdfCaptureSupported(documentFormat: BookFormat): void {
  if (documentFormat === 'PDF') {
    throw new LearningBoredPdfCaptureUnsupportedError();
  }
}

export function isLearningBoredPdfCaptureUnsupportedError(
  error: unknown,
): error is LearningBoredPdfCaptureUnsupportedError {
  return (
    error instanceof LearningBoredPdfCaptureUnsupportedError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === LEARNINGBORED_PDF_CAPTURE_UNSUPPORTED_CODE)
  );
}
