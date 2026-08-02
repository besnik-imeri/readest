import { LEARNINGBORED_CFI_LOCATION_VERSION, type LearningBoredCfiLocation } from './types';

export interface CreateLearningBoredCfiLocationInput {
  bookId: string;
  cfi: string;
  pageIndex: number;
  sectionHref?: string;
  pageLabel?: string;
}

export interface LearningBoredCfiResolver {
  resolveCFI(cfi: string):
    | {
        index: number;
        anchor(document: Document): Node | Range | null | undefined;
      }
    | null
    | undefined;
  getDocument(index: number): Document | undefined;
}

export type LearningBoredCfiResolution =
  | { ok: true; location: LearningBoredCfiLocation; index: number; range: Range }
  | {
      ok: false;
      reason:
        | 'invalid_location'
        | 'book_mismatch'
        | 'page_mismatch'
        | 'document_unavailable'
        | 'stale_location'
        | 'text_mismatch';
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isLearningBoredCfiLocation(value: unknown): value is LearningBoredCfiLocation {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate['version'] === LEARNINGBORED_CFI_LOCATION_VERSION &&
    candidate['kind'] === 'cfi' &&
    isNonEmptyString(candidate['bookId']) &&
    isNonEmptyString(candidate['cfi']) &&
    Number.isInteger(candidate['pageIndex']) &&
    (candidate['pageIndex'] as number) >= 0 &&
    isOptionalString(candidate['sectionHref']) &&
    isOptionalString(candidate['pageLabel'])
  );
}

function isRangeLike(value: unknown): value is Range {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Range>;

  return (
    typeof candidate.cloneRange === 'function' &&
    typeof candidate.toString === 'function' &&
    candidate.startContainer !== undefined &&
    candidate.endContainer !== undefined
  );
}

function isNodeLike(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<Node>).nodeType === 'number'
  );
}

function anchorToRange(anchor: Node | Range, document: Document): Range | null {
  if (isRangeLike(anchor)) return anchor;
  if (!isNodeLike(anchor)) return null;

  try {
    const range = document.createRange();
    range.selectNodeContents(anchor);
    return range;
  } catch {
    return null;
  }
}

export function createLearningBoredCfiLocation(
  input: CreateLearningBoredCfiLocationInput,
): LearningBoredCfiLocation {
  const location = {
    version: LEARNINGBORED_CFI_LOCATION_VERSION,
    kind: 'cfi',
    bookId: input.bookId,
    cfi: input.cfi,
    pageIndex: input.pageIndex,
    ...(input.sectionHref === undefined ? {} : { sectionHref: input.sectionHref }),
    ...(input.pageLabel === undefined ? {} : { pageLabel: input.pageLabel }),
  } satisfies LearningBoredCfiLocation;

  if (!isLearningBoredCfiLocation(location)) {
    throw new TypeError('Invalid LearningBored CFI location.');
  }

  return location;
}

/** Serializes keys in a fixed order so persisted locations remain stable across reloads. */
export function serializeLearningBoredCfiLocation(location: LearningBoredCfiLocation): string {
  if (!isLearningBoredCfiLocation(location)) {
    throw new TypeError('Invalid LearningBored CFI location.');
  }

  return JSON.stringify({
    version: LEARNINGBORED_CFI_LOCATION_VERSION,
    kind: 'cfi',
    bookId: location.bookId,
    cfi: location.cfi,
    pageIndex: location.pageIndex,
    ...(location.sectionHref === undefined ? {} : { sectionHref: location.sectionHref }),
    ...(location.pageLabel === undefined ? {} : { pageLabel: location.pageLabel }),
  });
}

export function parseLearningBoredCfiLocation(serialized: string): LearningBoredCfiLocation | null {
  try {
    const value: unknown = JSON.parse(serialized);
    return isLearningBoredCfiLocation(value) ? value : null;
  } catch {
    return null;
  }
}

export function resolveLearningBoredCfiLocation(
  location: LearningBoredCfiLocation,
  expected: { bookId: string; selectedText: string },
  resolver: LearningBoredCfiResolver,
): LearningBoredCfiResolution {
  if (!isLearningBoredCfiLocation(location)) return { ok: false, reason: 'invalid_location' };
  if (location.bookId !== expected.bookId) return { ok: false, reason: 'book_mismatch' };

  let resolved: ReturnType<LearningBoredCfiResolver['resolveCFI']>;
  try {
    resolved = resolver.resolveCFI(location.cfi);
  } catch {
    return { ok: false, reason: 'stale_location' };
  }

  if (!resolved || !Number.isInteger(resolved.index) || typeof resolved.anchor !== 'function') {
    return { ok: false, reason: 'stale_location' };
  }
  if (resolved.index !== location.pageIndex) return { ok: false, reason: 'page_mismatch' };

  const document = resolver.getDocument(resolved.index);
  if (!document) return { ok: false, reason: 'document_unavailable' };

  let anchor: Node | Range | null | undefined;
  try {
    anchor = resolved.anchor(document);
  } catch {
    return { ok: false, reason: 'stale_location' };
  }

  if (!anchor) return { ok: false, reason: 'stale_location' };
  const range = anchorToRange(anchor, document);
  if (!range) return { ok: false, reason: 'stale_location' };
  if (range.toString() !== expected.selectedText) return { ok: false, reason: 'text_mismatch' };

  return { ok: true, location, index: resolved.index, range };
}

export function resolveSerializedLearningBoredCfiLocation(
  serialized: string,
  expected: { bookId: string; selectedText: string },
  resolver: LearningBoredCfiResolver,
): LearningBoredCfiResolution {
  const location = parseLearningBoredCfiLocation(serialized);
  return location
    ? resolveLearningBoredCfiLocation(location, expected, resolver)
    : { ok: false, reason: 'invalid_location' };
}
