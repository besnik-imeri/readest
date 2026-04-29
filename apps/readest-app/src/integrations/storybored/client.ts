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
  readonly #accessToken?: string;
  readonly #fetch: typeof fetch;

  constructor(options: StoryBoredReaderClientOptions = {}) {
    this.#baseUrl = getStoryBoredApiBaseUrl();
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async createSceneGeneration(input: StoryBoredPassage): Promise<StoryBoredSceneGeneration> {
    return await this.#request('/v1/scene-generations', {
      method: 'POST',
      body: JSON.stringify({
        bookId: input.bookId,
        selectedText: input.selectedText,
        surroundingContext: input.surroundingContext,
        chapter: input.chapter,
        location: input.location,
        stylePreset: input.stylePreset,
      }),
    });
  }

  async getSceneGeneration(id: string): Promise<StoryBoredSceneGeneration> {
    return await this.#request(`/v1/scene-generations/${encodeURIComponent(id)}`);
  }

  async cancelSceneGeneration(id: string): Promise<StoryBoredSceneGeneration> {
    return await this.#request(`/v1/scene-generations/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  }

  async retrySceneGeneration(id: string): Promise<StoryBoredSceneGeneration> {
    return await this.#request(`/v1/scene-generations/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    });
  }

  async submitFeedback(
    id: string,
    feedback: StoryBoredFeedbackRequest,
  ): Promise<StoryBoredFeedbackResponse> {
    return await this.#request(`/v1/scene-generations/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.#baseUrl) {
      throw new Error('StoryBored API is not configured.');
    }

    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.#accessToken) {
      headers.set('Authorization', `Bearer ${this.#accessToken}`);
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, headers });

    if (!response.ok) {
      throw new Error(`StoryBored request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

export function createStoryBoredReaderClient(
  options: StoryBoredReaderClientOptions = {},
): StoryBoredReaderClient {
  return new StoryBoredReaderClient(options);
}
