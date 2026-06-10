---
title: Routing & Rendering
order: 3
---

# Routing & Rendering

## Explicit routes

- Routing is explicit with `defineRoute()`.
- No filesystem router is required, and no client router is included.
- The navigation model is ordinary MPA links and documents.
- Route params come from the server request path, and pages can resolve props with `getProps(context)`.

## Rendering strategies

- `ssr`: render on demand
- `ssg`: render at build time and include the route in prerender output
- `isr`: cache rendered HTML and revalidate based on `revalidate`

Runtime cache is opt-in. Use `render.cache: true` when you want HTML caching.

```ts
defineRoute({
  path: "/about",
  component: AboutPage,
  render: {
    cache: true,
    strategy: "isr",
    revalidate: 60,
  },
});
```

## Runtime targets

`createRequestHandler()` returns a fetch-compatible handler. Use `@vuerend/node`, `@vuerend/bun`, `@vuerend/deno`, `@vuerend/cloudflare`, and `@vuerend/service-worker` for thin runtime adapters.
