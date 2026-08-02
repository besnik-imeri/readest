export const LEARNINGBORED_CFI_LOCATION_VERSION = 1 as const;

export interface LearningBoredCfiLocation {
  version: typeof LEARNINGBORED_CFI_LOCATION_VERSION;
  kind: 'cfi';
  bookId: string;
  cfi: string;
  pageIndex: number;
  sectionHref?: string;
  pageLabel?: string;
}

export interface LearningBoredPassageText {
  /** The exact UTF-16 string returned by the selected DOM Range. */
  selectedText: string;
  /** A bounded context window containing selectedText verbatim. */
  surroundingContext: string;
  /** The UTF-16 code-unit offset of selectedText inside surroundingContext. */
  contextOffset: number;
}

export interface LearningBoredCapturedPassage extends LearningBoredPassageText {
  bookId: string;
  location: LearningBoredCfiLocation;
  chapter?: string;
}

export function hasValidLearningBoredContextOffset(passage: LearningBoredPassageText): boolean {
  return (
    passage.selectedText.length > 0 &&
    Number.isInteger(passage.contextOffset) &&
    passage.contextOffset >= 0 &&
    passage.contextOffset + passage.selectedText.length <= passage.surroundingContext.length &&
    passage.surroundingContext.slice(
      passage.contextOffset,
      passage.contextOffset + passage.selectedText.length,
    ) === passage.selectedText
  );
}
