/**
 * Per-host token bucket rate limiter.
 *
 * Each host gets its own bucket. Callers await `throttle(host)` before
 * issuing a request. Tokens refill continuously at `rps` tokens/second;
 * when the bucket is empty the call waits until one token is available.
 */

interface Bucket {
  tokens: number;
  lastRefill: number; // ms (Date.now())
  rps: number;
}

const buckets = new Map<string, Bucket>();

/** Default requests-per-second for hosts that have no explicit limit. */
const DEFAULT_RPS = 2;

/**
 * Per-host RPS overrides. Keys are lower-case hostnames.
 *
 * Note: throttle buckets are per-process. With N shards running in parallel,
 * the effective rate per host is N × the value here. Keep values conservative
 * enough that N=3 shards stay within each host's published limits.
 */
const HOST_RPS: Record<string, number> = {
  // Official store APIs — documented or observed limits
  "marketplace.visualstudio.com": 2,
  "open-vsx.org": 2,
  "addons.mozilla.org": 2,
  "plugins.jetbrains.com": 2,

  // GitHub: 5000 req/hr with token → ~1.39/s. 1 RPS × 3 shards = 3/s = 10800/hr.
  // Safe at current scale (<100 tracked repos); lower to 0.4 if repos exceed ~500.
  "api.github.com": 1,

  // Docker Hub: unauthenticated API limit is ~180 req/hr → 0.05/s per shard.
  // Being conservative; raise if authenticated token is added later.
  "hub.docker.com": 0.5,

  // npm public APIs have very high limits; 2 RPS is fine.
  "api.npmjs.org": 2,
  "registry.npmjs.org": 2,
};

function getBucket(host: string): Bucket {
  const existing = buckets.get(host);
  if (existing) {
    return existing;
  }
  const rps = HOST_RPS[host] ?? DEFAULT_RPS;
  const bucket: Bucket = { tokens: rps, lastRefill: Date.now(), rps };
  buckets.set(host, bucket);
  return bucket;
}

function refill(bucket: Bucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  bucket.tokens = Math.min(bucket.rps, bucket.tokens + elapsed * bucket.rps);
  bucket.lastRefill = now;
}

/**
 * Waits until a request token is available for the given host, then consumes
 * one token. Resolves immediately when a token is already available.
 */
export async function throttle(host: string): Promise<void> {
  const bucket = getBucket(host.toLowerCase());

  while (true) {
    refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    // Time until next token becomes available
    const waitMs = Math.ceil(((1 - bucket.tokens) / bucket.rps) * 1000);
    await delay(waitMs);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
