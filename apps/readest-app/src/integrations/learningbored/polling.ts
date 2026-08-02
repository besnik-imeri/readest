export const LEARNINGBORED_POLL_INTERVAL_MS = 2_000;

export interface LearningBoredPollerOptions<T> {
  request: (signal: AbortSignal) => Promise<T>;
  onResult: (result: T, signal: AbortSignal) => boolean | Promise<boolean>;
  onError?: (error: unknown) => void;
  intervalMs?: number;
  runImmediately?: boolean;
}

export interface LearningBoredPoller {
  stop: () => void;
}

/** Polls serially: the next timer is not scheduled until the current request and result handling end. */
export function startLearningBoredPoller<T>(
  options: LearningBoredPollerOptions<T>,
): LearningBoredPoller {
  const intervalMs = options.intervalMs ?? LEARNINGBORED_POLL_INTERVAL_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestController: AbortController | undefined;

  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(() => void poll(), delay);
  };

  const poll = async () => {
    if (stopped) return;

    requestController = new AbortController();
    try {
      const result = await options.request(requestController.signal);
      if (stopped) return;
      const shouldContinue = await options.onResult(result, requestController.signal);
      if (!stopped && shouldContinue) schedule(intervalMs);
    } catch (error) {
      if (stopped || requestController.signal.aborted) return;
      options.onError?.(error);
      schedule(intervalMs);
    } finally {
      requestController = undefined;
    }
  };

  schedule(options.runImmediately ? 0 : intervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      requestController?.abort();
    },
  };
}
