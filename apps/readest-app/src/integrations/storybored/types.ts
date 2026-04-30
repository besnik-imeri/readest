import type {
  CreateSceneGenerationFeedbackRequest,
  CreateSceneGenerationRequest,
  SceneGenerationFeedbackResponse,
  SceneGenerationResponse,
  SceneGenerationStatus,
  SceneStylePreset,
} from '@storybored/types';

export type StoryBoredSceneStatus = SceneGenerationStatus;
export type StoryBoredStylePreset = SceneStylePreset;
export type StoryBoredSceneGeneration = SceneGenerationResponse;
export type StoryBoredFeedbackRequest = CreateSceneGenerationFeedbackRequest;
export type StoryBoredFeedbackResponse = SceneGenerationFeedbackResponse;

export type StoryBoredPassage = Omit<CreateSceneGenerationRequest, 'stylePreset'> & {
  bookTitle?: string;
  stylePreset: StoryBoredStylePreset;
};
