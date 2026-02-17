export interface EnqueueObjectUrlResult {
  nextQueue: string[];
  expired: string[];
}

export const enqueueObjectUrl = (
  queue: string[],
  url: string,
  maxSize: number
): EnqueueObjectUrlResult => {
  const safeMaxSize = Math.max(1, Math.floor(maxSize));
  const nextQueue = [...queue, url];
  const expired: string[] = [];

  while (nextQueue.length > safeMaxSize) {
    const old = nextQueue.shift();
    if (old) expired.push(old);
  }

  return { nextQueue, expired };
};

