import type {
  CreateSceneGenerationFeedbackRequest,
  CreateSceneGenerationRequest,
  SceneGenerationFeedbackResponse,
  SceneGenerationFeedbackCategory,
  SceneGenerationResponse,
  SceneGenerationStatus,
  SceneStylePreset,
} from '../../../../../../packages/types/dist/scene-generation.js';

export type StoryBoredSceneStatus = SceneGenerationStatus;
export type StoryBoredStylePreset = SceneStylePreset;
export type StoryBoredSceneGeneration = SceneGenerationResponse;
export type StoryBoredFeedbackCategory = SceneGenerationFeedbackCategory;
export type StoryBoredFeedbackRequest = CreateSceneGenerationFeedbackRequest;
export type StoryBoredFeedbackResponse = SceneGenerationFeedbackResponse;

export type StoryBoredPassage = Omit<CreateSceneGenerationRequest, 'stylePreset'> & {
  bookTitle?: string;
  stylePreset: StoryBoredStylePreset;
};
