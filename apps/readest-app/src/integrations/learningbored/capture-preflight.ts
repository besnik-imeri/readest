import type { BookFormat } from '@/types/book';
import { assertLearningBoredPdfCaptureSupported } from './pdf-support';

/** Runs the format gate before asking the reader to construct a locator. */
export function getLearningBoredCaptureCfi<T extends string | null | undefined>(
  documentFormat: BookFormat,
  getCfi: () => T,
): T {
  assertLearningBoredPdfCaptureSupported(documentFormat);
  return getCfi();
}
