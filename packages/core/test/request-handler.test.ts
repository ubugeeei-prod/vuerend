import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { createRequestHandler, defineApp, defineImageRoute, defineRoute } from "../src/runtime";

describe("createRequestHandler", () => {
  it("renders explicit routes and passes route params into props", async () => {
    const PostPage = defineComponent({
      props: {
        slug: {
          required: true,
          type: String,
        },
      },
      setup(props) {
        return () => h("article", { "data-slug": props.slug }, props.slug);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/posts/:slug",
            component: PostPage,
            getProps(context) {
              const slug = context.params.slug;

              if (!slug) {
                throw new TypeError("missing slug");
              }

              return {
                slug,
              };
            },
          }),
        ],
      }),
    });

    const response = await handler(new Request("https://example.test/posts/hello-world"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("hello-world");
    expect(html).toContain('data-slug="hello-world"');
  });

  it("renders static route head metadata and shared stylesheets", async () => {
    const HomePage = defineComponent({
      setup() {
        return () => h("main", "home");
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        document: {
          title: "Vuerend",
          titleTemplate: "%s | Vuerend",
          head: '<meta name="theme-color" content="#111111">',
          meta: [{ name: "description", content: "Shared description" }],
          links: [{ rel: "stylesheet", href: "/assets/common.css" }],
          stylesheets: ["/assets/common.css", "/assets/reset.css"],
        },
        routes: [
          defineRoute({
            path: "/",
            component: HomePage,
            head: {
              title: "Home",
              meta: [
                { property: "og:title", content: "Home Page" },
                { property: "og:type", content: "website" },
              ],
              stylesheets: ["/assets/page.css", "/assets/common.css"],
              head: '<meta property="og:image" content="https://example.test/og.png">',
            },
          }),
        ],
      }),
      assets: {
        css: ["/assets/page.css", "/assets/runtime.css"],
      },
    });

    const response = await handler(new Request("https://example.test/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<title>Home | Vuerend</title>");
    expect(html).toContain('name="description" content="Shared description"');
    expect(html).toContain('property="og:title" content="Home Page"');
    expect(html).toContain('property="og:image" content="https://example.test/og.png"');
    expect(html.match(/\/assets\/common\.css/g)).toHaveLength(1);
    expect(html.match(/\/assets\/page\.css/g)).toHaveLength(1);
    expect(html.match(/\/assets\/runtime\.css/g)).toHaveLength(1);
  });

  it("rejects invalid rendered HTML attribute names", async () => {
    const HomePage = defineComponent({
      setup() {
        return () => h("main", "home");
      },
    });
    const unsafeMeta = {
      name: "description",
      'content" autofocus="true': "boom",
    };

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/",
            component: HomePage,
            head: {
              meta: [unsafeMeta],
            },
          }),
        ],
      }),
    });

    await expect(handler(new Request("https://example.test/"))).rejects.toThrow(
      'Invalid HTML attribute name: content" autofocus="true',
    );
  });

  it("resolves route head functions per request", async () => {
    const PostPage = defineComponent({
      props: {
        slug: {
          required: true,
          type: String,
        },
      },
      setup(props) {
        return () => h("article", props.slug);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineRoute({
            path: "/posts/:slug",
            component: PostPage,
            getProps(context) {
              return {
                slug: context.params.slug,
              };
            },
            head(context, props) {
              return {
                title: props.slug,
                meta: [{ property: "og:url", content: context.url.href }],
              };
            },
          }),
        ],
      }),
    });

    const response = await handler(new Request("https://example.test/posts/hello-world"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<title>hello-world</title>");
    expect(html).toContain('property="og:url" content="https://example.test/posts/hello-world"');
  });

  it("lets middleware populate request state and decorate the response", async () => {
    const HomePage = defineComponent({
      props: {
        message: {
          required: true,
          type: String,
        },
      },
      setup(props) {
        return () => h("main", props.message);
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        middleware: [
          async (request, context, next) => {
            context.state.message = `${request.method}:${new URL(request.url).pathname}`;
            const response = await next();
            response.headers.set("x-middleware", "enabled");
            return response;
          },
        ],
        routes: [
          defineRoute({
            path: "/",
            component: HomePage,
            getProps(context) {
              const message =
                typeof context.state.message === "string" ? context.state.message : "";

              return {
                message,
              };
            },
          }),
        ],
      }),
    });

    const response = await handler(new Request("https://example.test/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware")).toBe("enabled");
    expect(html).toContain("GET:/");
  });

  it("lets middleware rewrite the request before route matching", async () => {
    const DestinationPage = defineComponent({
      setup() {
        return () => h("main", "rewritten");
      },
    });

    const handler = createRequestHandler({
      app: defineApp({
        middleware: [
          async (request, context, next) => {
            const url = new URL(request.url);

            if (url.pathname !== "/") {
              return next();
            }

            const rewritten = new URL("/destination", url);
            return next(new Request(rewritten, request), context);
          },
        ],
        routes: [
          defineRoute({
            path: "/destination",
            component: DestinationPage,
          }),
        ],
      }),
    });

    const response = await handler(new Request("https://example.test/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("rewritten");
  });

  it("renders image routes through the configured HTML image renderer", async () => {
    const OgImagePage = defineComponent({
      props: {
        title: {
          required: true,
          type: String,
        },
      },
      setup(props) {
        return () => h("main", { class: "og-root" }, props.title);
      },
    });

    const renders: string[] = [];
    const handler = createRequestHandler({
      app: defineApp({
        routes: [
          defineImageRoute({
            path: "/og/example.png",
            component: OgImagePage,
            getProps() {
              return {
                title: "Dynamic OG",
              };
            },
            head: {
              title: "Dynamic OG",
              stylesheets: ["/styles/og.css"],
            },
            image: {
              width: 1200,
              height: 630,
            },
          }),
        ],
      }),
      imageRenderer: {
        async render(input) {
          renders.push(input.html);

          return {
            body: new Uint8Array([1, 2, 3, 4]),
          };
        },
      },
    });

    const response = await handler(new Request("https://example.test/og/example.png"));
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-vuerend-image-size")).toBe("1200x630");
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
    expect(renders).toHaveLength(1);
    expect(renders[0]).toContain('<base href="https://example.test/og/example.png">');
    expect(renders[0]).toContain("/styles/og.css");
    expect(renders[0]).toContain("Dynamic OG");
  });
});
