import type { RenderCache, RenderCacheEntry } from "./types.js";

/**
 * In-memory render cache for development and single-process deployments.
 *
 * This cache is process-local and does not synchronize across instances.
 */
export class MemoryRenderCache implements RenderCache {
  private readonly entries = new Map<string, RenderCacheEntry>();
  private readonly tags = new Map<string, Set<string>>();

  async get(key: string): Promise<RenderCacheEntry | undefined> {
    return this.entries.get(key);
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
}

/** Creates the default in-memory cache used by the request handler. */
export function createMemoryRenderCache(): RenderCache {
  return new MemoryRenderCache();
}

function normalizeRevalidationPath(path: string): string {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function matchesRevalidationPath(key: string, path: string): boolean {
  if (path === "/") {
    return key.startsWith("/");
  }

  return key === path || key.startsWith(`${path}/`) || key.startsWith(`${path}?`);
}
