import type { StoryBoredFeedbackCategory, StoryBoredFeedbackRequest } from './types';

export interface StoryBoredFeedbackDraft {
  rating: number;
  matchedScene: boolean | null;
  category: StoryBoredFeedbackCategory | '';
  comment: string;
}

export function buildStoryBoredFeedbackPayload(
  draft: StoryBoredFeedbackDraft,
): StoryBoredFeedbackRequest | null {
  const comment = draft.comment.trim();
  const payload: StoryBoredFeedbackRequest = {
    rating: draft.rating,
    ...(draft.matchedScene !== null ? { matchedScene: draft.matchedScene } : {}),
    ...(draft.category ? { category: draft.category } : {}),
    ...(comment ? { comment } : {}),
  };

  if (
    payload.rating === undefined &&
    payload.matchedScene === undefined &&
    payload.category === undefined &&
    payload.comment === undefined
  ) {
    return null;
  }

  return payload;
}

export function isStoryBoredFeedbackDraftReady(draft: StoryBoredFeedbackDraft): boolean {
  return draft.matchedScene !== null || Boolean(draft.category) || draft.comment.trim().length > 0;
}
