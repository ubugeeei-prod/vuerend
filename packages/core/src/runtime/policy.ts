import { normalizePathname } from "./router.js";
import type {
  AnyRouteDefinition,
  RenderCacheEntry,
  RouteContext,
  RouteRenderOptions,
} from "./types.js";

/** Route render options with all defaults applied. */
export type NormalizedRenderOptions = Required<RouteRenderOptions>;

/** Fills in the runtime defaults for a route's render options. */
export function normalizeRenderOptions(
  render: AnyRouteDefinition["render"],
): NormalizedRenderOptions {
  return {
    cache: render?.cache ?? false,
    strategy: render?.strategy ?? "ssr",
    revalidate: render?.revalidate ?? 0,
    staleWhileRevalidate: render?.staleWhileRevalidate ?? 0,
    tags: render?.tags ?? [],
    cacheKey: render?.cacheKey ?? (async (context) => context.url.pathname + context.url.search),
  };
}

/** Returns `true` when a request is eligible for HTML caching. */
export function isCacheableRequest(request: Request, render: NormalizedRenderOptions): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (!render.cache) {
    return false;
  }

  if (hasPersonalizedCacheHeaders(request)) {
    return false;
  }

  return (
    render.strategy === "ssg" ||
    render.strategy === "isr" ||
    render.revalidate > 0 ||
    render.staleWhileRevalidate > 0
  );
}

/** Resolves and normalizes the cache key for a matched route. */
export async function resolveCacheKey(
  route: AnyRouteDefinition,
  context: RouteContext,
): Promise<string> {
  const render = normalizeRenderOptions(route.render);
  return normalizePathname(await render.cacheKey(context));
}

/** Resolves the cache tags associated with a rendered route response. */
export async function resolveTags(
  render: NormalizedRenderOptions,
  context: RouteContext,
  props: unknown,
): Promise<string[]> {
  if (typeof render.tags === "function") {
    return render.tags(context, props);
  }

  return render.tags;
}

/** Creates a cache entry from a freshly rendered HTML response. */
export function createCacheEntry(
  html: string,
  response: Response,
  tags: string[],
  render: NormalizedRenderOptions,
): RenderCacheEntry {
  const createdAt = Date.now();
  const maxAge = render.strategy === "ssg" ? Number.POSITIVE_INFINITY : render.revalidate * 1000;
  const staleAge =
    render.strategy === "ssg"
      ? Number.POSITIVE_INFINITY
      : maxAge + render.staleWhileRevalidate * 1000;

  return {
    body: html,
    status: response.status,
    headers: [...response.headers.entries()],
    createdAt,
    expiresAt: createdAt + maxAge,
    staleUntil: createdAt + staleAge,
    tags,
  };
}

/** Reconstructs an HTTP response from a cached HTML entry. */
export function responseFromCache(entry: RenderCacheEntry, status: "HIT" | "STALE"): Response {
  const headers = new Headers(entry.headers);
  headers.set("x-vuerend-cache", status);

  return new Response(entry.body, {
    status: entry.status,
    headers,
  });
}

function hasPersonalizedCacheHeaders(request: Request): boolean {
  return request.headers.has("authorization") || request.headers.has("cookie");
}
