import type { BookFormat } from '@/types/book';
import { captureLearningBoredPassageText } from './passage-context';
import {
  createLearningBoredCfiLocation,
  type CreateLearningBoredCfiLocationInput,
} from './location';
import { assertLearningBoredPdfCaptureSupported } from './pdf-support';
import type { LearningBoredCapturedPassage } from './types';

export interface CaptureLearningBoredPassageInput extends CreateLearningBoredCfiLocationInput {
  selectionRange: Range;
  documentFormat: BookFormat;
  locale?: string;
  chapter?: string;
}

export function captureLearningBoredPassage(
  input: CaptureLearningBoredPassageInput,
): LearningBoredCapturedPassage {
  assertLearningBoredPdfCaptureSupported(input.documentFormat);

  const passageText = captureLearningBoredPassageText(input.selectionRange, input.locale);
  const location = createLearningBoredCfiLocation(input);

  return {
    bookId: input.bookId,
    ...passageText,
    location,
    ...(input.chapter === undefined ? {} : { chapter: input.chapter }),
  };
}
