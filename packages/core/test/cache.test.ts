import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { createRequestHandler, defineApp, defineRoute, MemoryRenderCache } from "../src/runtime";
import type { RenderCacheEntry } from "../src/runtime";

describe("route caching", () => {
  it("caches ISR pages and allows manual revalidation by path", async () => {
    let counter = 0;

    const CachedPage = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/cached",
            component: CachedPage,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              revalidate: 60,
            },
          }),
        ],
      }),
    });

    const firstHtml = await (await handler(new Request("https://example.test/cached"))).text();
    const secondHtml = await (await handler(new Request("https://example.test/cached"))).text();

    await handler.revalidatePath("/cached");

    const thirdHtml = await (await handler(new Request("https://example.test/cached"))).text();

    expect(firstHtml).toContain("value:1");
    expect(secondHtml).toContain("value:1");
    expect(thirdHtml).toContain("value:2");
  });

  it("does not cache unless render.cache is enabled", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/uncached",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              strategy: "isr",
              revalidate: 60,
            },
          }),
        ],
      }),
    });

    const firstHtml = await (await handler(new Request("https://example.test/uncached"))).text();
    const secondHtml = await (await handler(new Request("https://example.test/uncached"))).text();

    expect(firstHtml).toContain("value:1");
    expect(secondHtml).toContain("value:2");
  });

  it("evicts least-recently-used memory cache entries beyond the configured limit", async () => {
    const cache = new MemoryRenderCache({ maxEntries: 2 });

    await cache.set("/one", createTestCacheEntry("one", ["one"]));
    await cache.set("/two", createTestCacheEntry("two", ["two"]));
    await cache.get("/one");
    await cache.set("/three", createTestCacheEntry("three", ["three"]));

    expect(await cache.get("/two")).toBeUndefined();
    expect((await cache.get("/one"))?.body).toBe("one");
    expect((await cache.get("/three"))?.body).toBe("three");

    await cache.revalidateTag("two");

    expect((await cache.get("/one"))?.body).toBe("one");
  });

  it("rejects invalid memory cache size options", () => {
    expect(() => new MemoryRenderCache({ maxEntries: 0 })).toThrow(
      "MemoryRenderCache maxEntries must be a positive safe integer.",
    );
  });

  it("bypasses the default cache for personalized request headers", async () => {
    for (const headers of [{ cookie: "session=one" }, { authorization: "Bearer token" }]) {
      let counter = 0;

      const Page = defineComponent({
        props: {
          value: {
            required: true,
            type: Number,
          },
        },
        setup(props) {
          return () => h("p", `value:${props.value}`);
        },
      });

      const handler = createRequestHandler({
        app: defineApp({
          routes: [
            defineRoute({
              path: "/personalized",
              component: Page,
              getProps() {
                counter += 1;
                return { value: counter };
              },
              render: {
                cache: true,
                strategy: "isr",
                revalidate: 60,
              },
            }),
          ],
        }),
      });

      const firstHtml = await (
        await handler(new Request("https://example.test/personalized", { headers }))
      ).text();
      const secondHtml = await (
        await handler(new Request("https://example.test/personalized", { headers }))
      ).text();

      expect(firstHtml).toContain("value:1");
      expect(secondHtml).toContain("value:2");
    }
  });

  it("revalidates paths without evicting prefix collisions", async () => {
    const counters = new Map<string, number>();

    const PostPage = defineComponent({
      props: {
        value: {
          required: true,
          type: String,
        },
      },
      setup(props) {
        return () => h("p", props.value);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/posts/:id",
            component: PostPage,
            getProps(context) {
              const key = context.url.pathname + context.url.search;
              const next = (counters.get(key) ?? 0) + 1;
              counters.set(key, next);
              return { value: `${key}:${next}` };
            },
            render: {
              cache: true,
              strategy: "isr",
              revalidate: 60,
            },
          }),
        ],
      }),
    });

    await (await handler(new Request("https://example.test/posts/1"))).text();
    await (await handler(new Request("https://example.test/posts/1?preview=1"))).text();
    await (await handler(new Request("https://example.test/posts/10"))).text();

    await handler.revalidatePath("/posts/1");

    const exactHtml = await (await handler(new Request("https://example.test/posts/1"))).text();
    const queryHtml = await (
      await handler(new Request("https://example.test/posts/1?preview=1"))
    ).text();
    const siblingHtml = await (await handler(new Request("https://example.test/posts/10"))).text();

    expect(exactHtml).toContain("/posts/1:2");
    expect(queryHtml).toContain("/posts/1?preview=1:2");
    expect(siblingHtml).toContain("/posts/10:1");
  });

  it("serves a stale response and revalidates in the background via waitUntil", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/swr",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              // Expire immediately so the next request is eligible for SWR.
              revalidate: 0,
              staleWhileRevalidate: 60,
            },
          }),
        ],
      }),
    });

    const background: Promise<unknown>[] = [];
    const waitUntil = (promise: Promise<unknown>) => {
      background.push(promise);
    };

    const first = await handler(new Request("https://example.test/swr"), { waitUntil });
    expect(first.headers.get("x-vuerend-cache")).toBeNull();
    expect(await first.text()).toContain("value:1");

    // Second request: entry is past expiresAt but within staleUntil, so it is
    // served stale and a background refresh is scheduled through waitUntil.
    const second = await handler(new Request("https://example.test/swr"), { waitUntil });
    expect(second.headers.get("x-vuerend-cache")).toBe("STALE");
    expect(await second.text()).toContain("value:1");

    // The background refresh was registered on waitUntil.
    expect(background).toHaveLength(1);
    await Promise.all(background);

    // After the background refresh completes, the cache holds the fresh value.
    const refreshed = await handler.cache.get("/swr");
    expect(refreshed?.body).toContain("value:2");
  });

  it("does not serve stale responses once staleWhileRevalidate is exhausted", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/no-swr",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              // Both windows are zero, so a cached entry is never reusable.
              revalidate: 0,
              staleWhileRevalidate: 0,
            },
          }),
        ],
      }),
    });

    // staleWhileRevalidate > 0 makes the route cacheable; with both at 0 the
    // route is not cacheable at all, so every request renders fresh.
    const first = await (await handler(new Request("https://example.test/no-swr"))).text();
    const second = await (await handler(new Request("https://example.test/no-swr"))).text();

    expect(first).toContain("value:1");
    expect(second).toContain("value:2");
  });

  it("revalidates cached entries by tag through the handler", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/tagged",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              revalidate: 60,
              tags: ["articles"],
            },
          }),
        ],
      }),
    });

    const first = await (await handler(new Request("https://example.test/tagged"))).text();
    const second = await (await handler(new Request("https://example.test/tagged"))).text();

    expect(first).toContain("value:1");
    expect(second).toContain("value:1");

    await handler.revalidateTag("articles");

    const third = await (await handler(new Request("https://example.test/tagged"))).text();
    expect(third).toContain("value:2");

    // An unrelated tag does not evict the entry, so it stays a cache hit.
    await handler.revalidateTag("unknown");
    const fourth = await (await handler(new Request("https://example.test/tagged"))).text();

    expect(fourth).toContain("value:2");
  });

  it("supports tags resolved from a function of the request and props", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/posts/:id",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              revalidate: 60,
              tags: (context) => [`post:${context.params.id}`],
            },
          }),
        ],
      }),
    });

    await (await handler(new Request("https://example.test/posts/1"))).text();
    await (await handler(new Request("https://example.test/posts/2"))).text();

    // Revalidate only the tag derived from the first post.
    await handler.revalidateTag("post:1");

    const post1 = await (await handler(new Request("https://example.test/posts/1"))).text();
    const post2 = await (await handler(new Request("https://example.test/posts/2"))).text();

    expect(post1).toContain("value:3");
    expect(post2).toContain("value:2");
  });

  it("uses a custom render.cacheKey to share or split cache entries", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/custom",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              revalidate: 60,
              // Ignore the query string so all variants share one cache entry.
              cacheKey: (context) => context.url.pathname,
            },
          }),
        ],
      }),
    });

    const first = await (await handler(new Request("https://example.test/custom?a=1"))).text();
    const second = await (await handler(new Request("https://example.test/custom?b=2"))).text();

    // Despite differing query strings, both requests hit the same cache key.
    expect(first).toContain("value:1");
    expect(second).toContain("value:1");

    // The custom key is normalized to a pathname and is reachable directly.
    expect((await handler.cache.get("/custom"))?.body).toContain("value:1");
  });

  it("does not cache POST requests even when caching is enabled", async () => {
    let counter = 0;

    const Page = defineComponent({
      props: {
        value: {
          required: true,
          type: Number,
        },
      },
      setup(props) {
        return () => h("p", `value:${props.value}`);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/mutate",
            component: Page,
            getProps() {
              counter += 1;
              return { value: counter };
            },
            render: {
              cache: true,
              strategy: "isr",
              revalidate: 60,
            },
          }),
        ],
      }),
    });

    const first = await (
      await handler(new Request("https://example.test/mutate", { method: "POST" }))
    ).text();
    const second = await (
      await handler(new Request("https://example.test/mutate", { method: "POST" }))
    ).text();

    // POST is not a cacheable method, so each request renders fresh.
    expect(first).toContain("value:1");
    expect(second).toContain("value:2");

    // POST never populates the cache.
    expect(await handler.cache.get("/mutate")).toBeUndefined();
  });

  it("collects SSG and explicit prerender routes", async () => {
    const Page = defineComponent({
      setup() {
        return () => h("div", "page");
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/",
            component: Page,
            render: { strategy: "ssg" },
          }),
          defineRoute({
            path: "/posts/:slug",
            component: Page,
            prerender: ["/posts/hello", "/posts/world"],
          }),
        ],
      }),
    });

    await expect(handler.listPrerenderRoutes()).resolves.toEqual([
      "/",
      "/posts/hello",
      "/posts/world",
    ]);
  });
});

function createTestCacheEntry(body: string, tags: string[] = []): RenderCacheEntry {
  return {
    body,
    status: 200,
    headers: [],
    createdAt: 0,
    expiresAt: Number.POSITIVE_INFINITY,
    staleUntil: Number.POSITIVE_INFINITY,
    tags,
  };
}
