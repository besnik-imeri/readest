import { describe, expect, it } from 'vitest';
import {
  annotationToolButtons,
  annotationToolQuickActions,
  isAnnotationToolQuickAction,
} from '@/app/reader/components/annotator/AnnotationTools';

describe('AnnotationTools', () => {
  it('keeps StoryBored primary and removes Readest cleanup actions', () => {
    const toolTypes = annotationToolButtons.map((button) => button.type);
    const quickActionTypes = annotationToolQuickActions.map((button) => button.type);

    expect(toolTypes).toEqual([
      'copy',
      'highlight',
      'annotate',
      'search',
      'dictionary',
      'translate',
      'tts',
      'storybored',
    ]);
    expect(quickActionTypes).not.toContain('wikipedia');
    expect(quickActionTypes).not.toContain('proofread');
    expect(isAnnotationToolQuickAction('wikipedia')).toBe(false);
    expect(isAnnotationToolQuickAction('proofread')).toBe(false);
  });
});
