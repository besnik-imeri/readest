import type { LearningBoredCapturedPassage } from './types';

export interface LearningBoredCaptureEvent {
  bookKey: string;
  passage: LearningBoredCapturedPassage;
}

type LearningBoredCaptureListener = (event: LearningBoredCaptureEvent) => void;

const captureListeners = new Set<LearningBoredCaptureListener>();

export function publishLearningBoredCapture(event: LearningBoredCaptureEvent): void {
  for (const listener of captureListeners) listener(event);
}

export function subscribeToLearningBoredCaptures(
  listener: LearningBoredCaptureListener,
): () => void {
  captureListeners.add(listener);
  return () => captureListeners.delete(listener);
}
