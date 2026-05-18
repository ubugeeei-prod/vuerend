import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { createRequestHandler, defineApp, defineRoute } from "../src/runtime";

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
