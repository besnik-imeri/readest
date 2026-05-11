import type {
  CreateSceneGenerationFeedbackRequest,
  CreateSceneGenerationRequest,
  SceneGenerationFeedbackResponse,
  SceneGenerationFeedbackCategory,
  SceneGenerationResponse,
  SceneGenerationStatus,
  SceneStylePreset,
} from '../../../../../../packages/types/dist/scene-generation.js';
import type {
  ListOwnedLibraryResponse,
  OwnedLibraryContentResponse,
  OwnedLibraryScenePackResponse,
} from '../../../../../../packages/types/dist/marketplace.js';

export type StoryBoredSceneStatus = SceneGenerationStatus;
export type StoryBoredStylePreset = SceneStylePreset;
export type StoryBoredSceneGeneration = SceneGenerationResponse;
export type StoryBoredFeedbackCategory = SceneGenerationFeedbackCategory;
export type StoryBoredFeedbackRequest = CreateSceneGenerationFeedbackRequest;
export type StoryBoredFeedbackResponse = SceneGenerationFeedbackResponse;
export type StoryBoredOwnedLibrary = ListOwnedLibraryResponse;
export type StoryBoredOwnedLibraryContent = OwnedLibraryContentResponse;
export type StoryBoredOwnedLibraryScenePack = OwnedLibraryScenePackResponse;

export type StoryBoredPassage = Omit<CreateSceneGenerationRequest, 'stylePreset'> & {
  bookTitle?: string;
  stylePreset: StoryBoredStylePreset;
};
