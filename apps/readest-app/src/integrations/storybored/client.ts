import { StoryBoredClient } from '@storybored/storybored-sdk';
import type {
  StoryBoredFeedbackRequest,
  StoryBoredFeedbackResponse,
  StoryBoredPassage,
  StoryBoredSceneGeneration,
} from './types';

const STORYBORED_ENABLED_FLAG = process.env['NEXT_PUBLIC_STORYBORED_ENABLED'];
const STORYBORED_API_BASE_URL = process.env['NEXT_PUBLIC_STORYBORED_API_BASE_URL'];
const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:4000';

function getStoryBoredApiBaseUrl(): string {
  if (STORYBORED_API_BASE_URL) return STORYBORED_API_BASE_URL.replace(/\/$/, '');
  return process.env.NODE_ENV === 'development' ? DEFAULT_LOCAL_API_BASE_URL : '';
}

export function isStoryBoredReaderEnabled(): boolean {
  if (STORYBORED_ENABLED_FLAG === 'false') return false;
  return getStoryBoredApiBaseUrl().length > 0;
}

interface StoryBoredReaderClientOptions {
  accessToken?: string;
  fetchImpl?: typeof fetch;
}

export class StoryBoredReaderClient {
  readonly #baseUrl: string;
  readonly #sdk: StoryBoredClient;

  constructor(options: StoryBoredReaderClientOptions = {}) {
    this.#baseUrl = getStoryBoredApiBaseUrl();
    this.#sdk = new StoryBoredClient({
      baseUrl: this.#baseUrl,
      ...options,
    });
  }

  async createSceneGeneration(input: StoryBoredPassage): Promise<StoryBoredSceneGeneration> {
    this.#assertConfigured();

    return await this.#sdk.createSceneGeneration({
      bookId: input.bookId,
      selectedText: input.selectedText,
      surroundingContext: input.surroundingContext,
      chapter: input.chapter,
      location: input.location,
      stylePreset: input.stylePreset,
      userPromptOverride: input.userPromptOverride,
    });
  }

  async getSceneGeneration(id: string): Promise<StoryBoredSceneGeneration> {
    this.#assertConfigured();
    return await this.#sdk.getSceneGeneration(id);
  }

  async cancelSceneGeneration(id: string): Promise<StoryBoredSceneGeneration> {
    this.#assertConfigured();
    return await this.#sdk.cancelSceneGeneration(id);
  }

  async retrySceneGeneration(id: string): Promise<StoryBoredSceneGeneration> {
    this.#assertConfigured();
    return await this.#sdk.retrySceneGeneration(id);
  }

  async submitFeedback(
    id: string,
    feedback: StoryBoredFeedbackRequest,
  ): Promise<StoryBoredFeedbackResponse> {
    this.#assertConfigured();
    return await this.#sdk.submitSceneGenerationFeedback(id, feedback);
  }

  #assertConfigured(): void {
    if (!this.#baseUrl) {
      throw new Error('StoryBored API is not configured.');
    }
  }
}

export function createStoryBoredReaderClient(
  options: StoryBoredReaderClientOptions = {},
): StoryBoredReaderClient {
  return new StoryBoredReaderClient(options);
}
