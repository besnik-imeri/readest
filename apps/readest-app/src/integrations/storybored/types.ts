export type StoryBoredSceneStatus =
  | 'queued'
  | 'prompting'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StoryBoredStylePreset =
  | 'cinematic-literary'
  | 'watercolor-illustration'
  | 'dark-fantasy'
  | 'soft-storybook'
  | 'realistic-concept-art'
  | 'monochrome-sketch';

export interface StoryBoredPassage {
  bookId: string;
  bookTitle?: string;
  selectedText: string;
  surroundingContext?: string;
  chapter?: string;
  location?: string;
  stylePreset: StoryBoredStylePreset;
}

export interface StoryBoredGeneratedImage {
  id: string;
  generationId: string;
  url: string;
  thumbnailUrl?: string;
  storageKey?: string;
  width?: number;
  height?: number;
  contentType?: string;
  byteSize?: number;
  createdAt: string;
}

export interface StoryBoredSceneGeneration {
  id: string;
  status: StoryBoredSceneStatus;
  bookId: string;
  prompt: string;
  promptVersion?: string;
  provider?: string;
  selectedTextPreview?: string;
  stylePreset?: StoryBoredStylePreset;
  failureReason?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  image?: StoryBoredGeneratedImage;
}

export interface StoryBoredFeedbackRequest {
  rating?: number;
  matchedScene?: boolean;
  category?:
    | 'matched-scene'
    | 'wrong-scene'
    | 'style-mismatch'
    | 'low-quality'
    | 'unsafe-or-inappropriate'
    | 'other';
  comment?: string;
}

export interface StoryBoredFeedbackResponse {
  id: string;
  generationId: string;
  rating?: number;
  matchedScene?: boolean;
  category?: StoryBoredFeedbackRequest['category'];
  comment?: string;
  createdAt: string;
}
