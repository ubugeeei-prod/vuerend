import type { RenderCache, RenderCacheEntry } from "./types.js";

const DEFAULT_MAX_ENTRIES = 1_000;

/** Options for the default process-local render cache. */
export interface MemoryRenderCacheOptions {
  maxEntries?: number | undefined;
}

/**
 * In-memory render cache for development and single-process deployments.
 *
 * This cache is process-local and does not synchronize across instances.
 */
export class MemoryRenderCache implements RenderCache {
  private readonly entries = new Map<string, RenderCacheEntry>();
  private readonly maxEntries: number;
  private readonly tags = new Map<string, Set<string>>();

  constructor(options: MemoryRenderCacheOptions = {}) {
    this.maxEntries = normalizeMaxEntries(options.maxEntries);
  }

  async get(key: string): Promise<RenderCacheEntry | undefined> {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  async set(key: string, value: RenderCacheEntry): Promise<void> {
    const previous = this.entries.get(key);

    if (previous) {
      this.unlinkTags(key, previous.tags);
    }

    this.entries.set(key, value);

    for (const tag of value.tags) {
      let keys = this.tags.get(tag);

      if (!keys) {
        keys = new Set<string>();
        this.tags.set(tag, keys);
      }

      keys.add(key);
    }

    await this.enforceMaxEntries();
  }

  async delete(key: string): Promise<void> {
    const existing = this.entries.get(key);

    if (!existing) {
      return;
    }

    this.entries.delete(key);
    this.unlinkTags(key, existing.tags);
  }

  async revalidatePath(path: string): Promise<void> {
    const normalized = normalizeRevalidationPath(path);

    for (const key of [...this.entries.keys()]) {
      if (matchesRevalidationPath(key, normalized)) {
        await this.delete(key);
      }
    }
  }

  async revalidateTag(tag: string): Promise<void> {
    const keys = this.tags.get(tag);

    if (!keys) {
      return;
    }

    for (const key of keys) {
      await this.delete(key);
    }
  }

  private unlinkTags(key: string, tags: readonly string[]): void {
    for (const tag of tags) {
      const keys = this.tags.get(tag);

      if (!keys) {
        continue;
      }

      keys.delete(key);

      if (keys.size === 0) {
        this.tags.delete(tag);
      }
    }
  }

  private async enforceMaxEntries(): Promise<void> {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;

      if (oldest === undefined) {
        return;
      }

      await this.delete(oldest);
    }
  }
}

/** Creates the default in-memory cache used by the request handler. */
export function createMemoryRenderCache(options?: MemoryRenderCacheOptions): RenderCache {
  return new MemoryRenderCache(options);
}

function normalizeRevalidationPath(path: string): string {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeMaxEntries(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_ENTRIES;
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("MemoryRenderCache maxEntries must be a positive safe integer.");
  }

  return value;
}

function matchesRevalidationPath(key: string, path: string): boolean {
  if (path === "/") {
    return key.startsWith("/");
  }

  return key === path || key.startsWith(`${path}/`) || key.startsWith(`${path}?`);
}
