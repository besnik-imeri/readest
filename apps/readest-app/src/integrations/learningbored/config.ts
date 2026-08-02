export interface LearningBoredPublicEnvironment {
  enabled?: string;
  apiBaseUrl?: string;
}

export interface LearningBoredReaderConfig {
  enabled: boolean;
  apiBaseUrl: string;
}

function getPublicEnvironment(): LearningBoredPublicEnvironment {
  return {
    enabled: process.env['NEXT_PUBLIC_LEARNINGBORED_ENABLED'],
    apiBaseUrl: process.env['NEXT_PUBLIC_LEARNINGBORED_API_BASE_URL'],
  };
}

/** LearningBored is intentionally absent unless both public settings are explicit. */
export function getLearningBoredReaderConfig(
  environment: LearningBoredPublicEnvironment = getPublicEnvironment(),
): LearningBoredReaderConfig {
  const apiBaseUrl = environment.apiBaseUrl?.trim().replace(/\/$/u, '') ?? '';

  return {
    enabled: environment.enabled === 'true' && apiBaseUrl.length > 0,
    apiBaseUrl,
  };
}

export function isLearningBoredReaderEnabled(): boolean {
  return getLearningBoredReaderConfig().enabled;
}
