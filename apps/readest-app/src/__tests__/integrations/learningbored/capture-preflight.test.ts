import { describe, expect, it, vi } from 'vitest';
import { getLearningBoredCaptureCfi } from '@/integrations/learningbored/capture-preflight';
import { LearningBoredPdfCaptureUnsupportedError } from '@/integrations/learningbored/pdf-support';

describe('LearningBored capture preflight', () => {
  it('rejects PDF before constructing a CFI', () => {
    const getCfi = vi.fn(() => 'should-not-be-created');

    expect(() => getLearningBoredCaptureCfi('PDF', getCfi)).toThrow(
      LearningBoredPdfCaptureUnsupportedError,
    );
    expect(getCfi).not.toHaveBeenCalled();
  });

  it('constructs the CFI after a supported format passes preflight', () => {
    const getCfi = vi.fn(() => 'epubcfi(/6/2!/4/2/1:0)');

    expect(getLearningBoredCaptureCfi('EPUB', getCfi)).toBe('epubcfi(/6/2!/4/2/1:0)');
    expect(getCfi).toHaveBeenCalledOnce();
  });
});
