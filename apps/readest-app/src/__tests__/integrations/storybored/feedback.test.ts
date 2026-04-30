import { describe, expect, it } from 'vitest';
import {
  buildStoryBoredFeedbackPayload,
  isStoryBoredFeedbackDraftReady,
  type StoryBoredFeedbackDraft,
} from '@/integrations/storybored/feedback';

const draft: StoryBoredFeedbackDraft = {
  rating: 4,
  matchedScene: true,
  category: 'matched-scene',
  comment: '  The mood landed well.  ',
};

describe('StoryBored feedback draft', () => {
  it('builds a typed feedback payload with trimmed comments', () => {
    expect(buildStoryBoredFeedbackPayload(draft)).toEqual({
      rating: 4,
      matchedScene: true,
      category: 'matched-scene',
      comment: 'The mood landed well.',
    });
  });

  it('omits optional fields that the reader did not choose', () => {
    expect(
      buildStoryBoredFeedbackPayload({
        rating: 3,
        matchedScene: null,
        category: '',
        comment: '   ',
      }),
    ).toEqual({ rating: 3 });
  });

  it('requires an explicit reader signal before enabling submission', () => {
    expect(
      isStoryBoredFeedbackDraftReady({
        rating: 3,
        matchedScene: null,
        category: '',
        comment: '',
      }),
    ).toBe(false);
    expect(isStoryBoredFeedbackDraftReady({ ...draft, matchedScene: false })).toBe(true);
  });
});
