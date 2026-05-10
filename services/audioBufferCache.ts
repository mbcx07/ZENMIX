// audioBufferCache.ts — LRU cache for decoded AudioBuffers
// Prevents re-decoding the same audio data multiple times during a session.
// Handles long audio (30+ min) by capping total memory.

const MAX_ENTRIES = 8;
const MAX_TOTAL_SAMPLES = 20 * 44100 * 60; // ~20 min at 44.1kHz mono (cap total memory)

interface CacheEntry {
  buffer: AudioBuffer;
  lastUsed: number;
  key: string;
}

class AudioBufferCache {
  private cache = new Map<string, CacheEntry>();
  private totalSamples = 0;

  /** Get a cached buffer by key, or null if not found. Updates LRU timestamp. */
  get(key: string): AudioBuffer | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return entry.buffer;
  }

  /** Store a buffer in the cache with eviction if over capacity. */
  set(key: string, buffer: AudioBuffer): void {
    this.evictIfNeeded(buffer.length);

    const entry: CacheEntry = { buffer, lastUsed: Date.now(), key };
    // Remove old entry with same key if exists
    const old = this.cache.get(key);
    if (old) this.totalSamples -= old.buffer.length;

    this.cache.set(key, entry);
    this.totalSamples += buffer.length;
  }

  /** Check if a key exists in the cache. */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Remove a specific key from the cache. */
  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSamples -= entry.buffer.length;
      this.cache.delete(key);
    }
  }

  /** Clear the entire cache. */
  clear(): void {
    this.cache.clear();
    this.totalSamples = 0;
  }

  /** Get cache stats for debugging. */
  stats(): { entries: number; totalSamples: number; maxSamples: number } {
    return {
      entries: this.cache.size,
      totalSamples: this.totalSamples,
      maxSamples: MAX_TOTAL_SAMPLES,
    };
  }

  private evictIfNeeded(incomingSamples: number): void {
    // Evict by count
    while (this.cache.size >= MAX_ENTRIES) {
      this.evictLRU();
    }
    // Evict by memory
    while (this.totalSamples + incomingSamples > MAX_TOTAL_SAMPLES && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    let oldest: CacheEntry | null = null;
    for (const entry of this.cache.values()) {
      if (!oldest || entry.lastUsed < oldest.lastUsed) {
        oldest = entry;
      }
    }
    if (oldest) {
      this.totalSamples -= oldest.buffer.length;
      this.cache.delete(oldest.key);
    }
  }
}

// Singleton instance
export const audioBufferCache = new AudioBufferCache();

/**
 * Decode audio with caching. Uses a hash of the first 1KB of data as cache key
 * to avoid re-decoding identical blobs.
 */
export async function decodeWithCache(
  audioCtx: BaseAudioContext,
  arrayBuffer: ArrayBuffer,
): Promise<AudioBuffer> {
  // Create a simple hash from first 1KB + length
  const sample = new Uint8Array(arrayBuffer.slice(0, 1024));
  let hash = String(arrayBuffer.byteLength);
  for (let i = 0; i < sample.length; i++) {
    hash = `${hash}-${sample[i]}`;
  }

  const cached = audioBufferCache.get(hash);
  if (cached) return cached;

  const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  audioBufferCache.set(hash, buffer);
  return buffer;
}

export { MAX_ENTRIES, MAX_TOTAL_SAMPLES };
