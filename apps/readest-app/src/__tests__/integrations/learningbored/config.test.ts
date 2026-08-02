import { describe, expect, it } from 'vitest';

import { getLearningBoredReaderConfig } from '@/integrations/learningbored/config';

describe('LearningBored reader feature gate', () => {
  it.each([
    {},
    { enabled: 'false', apiBaseUrl: 'https://api.learningbored.localhost' },
    { enabled: 'TRUE', apiBaseUrl: 'https://api.learningbored.localhost' },
    { enabled: 'true' },
    { enabled: 'true', apiBaseUrl: '   ' },
  ])('stays absent unless both public settings are explicit: %o', (environment) => {
    expect(getLearningBoredReaderConfig(environment)).toMatchObject({ enabled: false });
  });

  it('enables only exact true plus a nonempty URL and canonicalizes one trailing slash', () => {
    expect(
      getLearningBoredReaderConfig({
        enabled: 'true',
        apiBaseUrl: '  https://api.learningbored.localhost/  ',
      }),
    ).toEqual({
      enabled: true,
      apiBaseUrl: 'https://api.learningbored.localhost',
    });
  });
});
