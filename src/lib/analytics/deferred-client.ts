// Holds calls made before an async-loaded client exists and replays them, in order, once it
// does. Bounded so a client that never loads (blocked script, no key) can't grow it forever.
export function createDeferredClient<T>(maxQueued: number) {
  let client: T | null = null;
  let queue: ((client: T) => void)[] = [];

  function run(call: (client: T) => void) {
    if (client) call(client);
    else if (queue.length < maxQueued) queue.push(call);
  }

  return {
    run,
    /** Like run, but resolves once `call` has run or after `timeoutMs`, whichever is first. */
    runWithin(call: (client: T) => void, timeoutMs: number) {
      return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        run((loaded) => {
          clearTimeout(timer);
          call(loaded);
          resolve();
        });
      });
    },
    ready(loaded: T) {
      client = loaded;
      const pending = queue;
      queue = [];
      for (const call of pending) call(loaded);
    },
  };
}
