import type { LearningBoredCapturedPassage } from './types';

export const LEARNINGBORED_BOARD_KINDS = [
  'concept_map',
  'process_flow',
  'comparison_matrix',
  'hierarchy',
  'timeline',
  'decision_tree',
  'system_architecture',
  'labeled_diagram',
  'formula_breakdown',
  'cause_effect',
  'annotated_illustration',
  'analogy_panel',
  'worked_example',
] as const;

export type LearningBoredBoardKind = (typeof LEARNINGBORED_BOARD_KINDS)[number];

export const LEARNINGBORED_GENERATION_STATUSES = [
  'queued',
  'extracting',
  'composing',
  'illustrating',
  'rendering',
  'completed',
  'failed',
  'cancelled',
] as const;

export type LearningBoredGenerationStatus = (typeof LEARNINGBORED_GENERATION_STATUSES)[number];

export interface LearningBoredSourceSpan {
  /** UTF-16 code-unit offset into the exact captured selectedText. */
  sourceStart: number;
  /** Exclusive UTF-16 code-unit offset into the exact captured selectedText. */
  sourceEnd: number;
}

export interface LearningBoredReaderDocument {
  bookId: string;
  title: string;
  author?: string;
  format: string;
}

export interface LearningBoredBoardOutlineItem {
  id: string;
  kind: 'content' | 'figure' | 'relationship' | 'group';
  label: string;
  description: string;
  provenance: 'anchored' | 'scaffold';
  sourceSpan?: LearningBoredSourceSpan;
  scaffoldForm?: 'prerequisite' | 'analogy' | 'worked_example' | 'restatement';
  analogyLimit?: string | null;
  undefined?: boolean;
  undefinedConceptIds?: string[];
  figureFailed?: boolean;
  labels?: LearningBoredFigureLabel[];
}

export interface LearningBoredFigureLabel {
  id: string;
  text: string;
  description: string;
  at: { x: number; y: number };
  provenance: 'anchored' | 'scaffold';
  sourceSpan?: LearningBoredSourceSpan;
}

export interface LearningBoredBoardFigure {
  id: string;
  nodeId: string;
  description: string;
  caption?: string | null;
  imageUrl?: string | null;
  provenance: 'anchored' | 'scaffold';
  sourceSpan?: LearningBoredSourceSpan;
  labels: LearningBoredFigureLabel[];
  failed?: boolean;
}

export const LEARNINGBORED_FIGURE_REGENERATION_ISSUES = [
  'wrong_arrangement',
  'missing_part',
  'too_detailed',
  'too_abstract',
  'unclear',
] as const;

export type LearningBoredFigureRegenerationIssue =
  (typeof LEARNINGBORED_FIGURE_REGENERATION_ISSUES)[number];

export type LearningBoredFigureRegenerationStatus =
  | 'queued'
  | 'illustrating'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface LearningBoredFigureRegenerationSnapshot {
  id: string;
  boardId: string;
  nodeId: string;
  clientRequestId: string;
  issue: LearningBoredFigureRegenerationIssue;
  status: LearningBoredFigureRegenerationStatus;
  chalkCost: number;
  failureReason: string | null;
  refundConfirmed: boolean;
}

export interface LearningBoredRecallQuestionPreview {
  id: string;
  kind: string;
  question: string;
}

export interface LearningBoredBoardResult {
  id: string;
  kind: LearningBoredBoardKind;
  title: string;
  /** Sanitized again at the reader boundary before being inserted into the DOM. */
  svg?: string | null;
  outline: LearningBoredBoardOutlineItem[];
  figures: LearningBoredBoardFigure[];
  recallQuestions: LearningBoredRecallQuestionPreview[];
}

export interface LearningBoredGenerationSnapshot {
  id: string;
  status: LearningBoredGenerationStatus;
  boardId?: string | null;
  board?: LearningBoredBoardResult | null;
  failureReason?: string | null;
}

export interface LearningBoredCreateGenerationInput {
  document: LearningBoredReaderDocument;
  selectedText: string;
  surroundingContext: string;
  contextOffset: number;
  chapter?: string;
  pageLabel?: string;
  location: LearningBoredCapturedPassage['location'];
  requestedBoardKind?: LearningBoredBoardKind;
  recallItemTarget: number;
  allowFigures: boolean;
  allowScaffold: boolean;
}

export type LearningBoredFeedbackCategory =
  | 'factually_wrong'
  | 'not_in_passage'
  | 'scaffold_wrong'
  | 'figure_misleading'
  | 'wrong_board_kind'
  | 'unclear_layout'
  | 'passage_still_unclear';

export interface LearningBoredFeedbackInput {
  generationId?: string;
  boardId?: string;
  figureId?: string;
  nodeId?: string;
  category: LearningBoredFeedbackCategory;
  comment?: string;
}

export interface LearningBoredClientOptions {
  signal?: AbortSignal;
}

/**
 * Reader-owned port for the LearningBored SDK.
 *
 * The integration never performs HTTP directly. The application injects an
 * implementation backed by the versioned SDK once that package is available.
 */
export interface LearningBoredClient {
  createGeneration(
    input: LearningBoredCreateGenerationInput,
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredGenerationSnapshot>;
  getGeneration(
    generationId: string,
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredGenerationSnapshot>;
  getBoard(
    boardId: string,
    input: { kind?: LearningBoredBoardKind; includeScaffold: boolean },
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredBoardResult>;
  rerenderBoard(
    boardId: string,
    input: { kind: LearningBoredBoardKind; includeScaffold: boolean },
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredBoardResult>;
  requestFigureRegeneration(
    boardId: string,
    nodeId: string,
    input: { issue: LearningBoredFigureRegenerationIssue; clientRequestId: string },
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredFigureRegenerationSnapshot>;
  getFigureRegeneration(
    regenerationId: string,
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredFigureRegenerationSnapshot>;
  cancelGeneration(
    generationId: string,
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredGenerationSnapshot>;
  retryGeneration(
    generationId: string,
    options?: LearningBoredClientOptions,
  ): Promise<LearningBoredGenerationSnapshot>;
  submitFeedback(
    input: LearningBoredFeedbackInput,
    options?: LearningBoredClientOptions,
  ): Promise<void>;
}

export function isLearningBoredBoardKind(value: unknown): value is LearningBoredBoardKind {
  return (
    typeof value === 'string' && (LEARNINGBORED_BOARD_KINDS as readonly string[]).includes(value)
  );
}

export function isLearningBoredTerminalStatus(
  status: LearningBoredGenerationStatus,
): status is 'completed' | 'failed' | 'cancelled' {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
