# Vuerend Monorepo

Vuerend is a Zero JavaScript-first way to build Vue applications for MPAs. It treats server-rendered documents as the default unit, supports SSR and SSG out of the box, and keeps client JavaScript opt-in through explicit islands while the same fetch handler can run on Node, Bun, Deno, Cloudflare Workers, or service workers.

## Why This Exists

- Many Vue stacks assume a client router, route-level hydration, and a large baseline JavaScript payload even when the app mostly wants HTML documents.
- Some teams want Vue as a rendering language for content sites, dashboards, documentation, storefronts, or internal tools without buying into an SPA-first architecture.
- Some teams want an MPA-first model where SSR and SSG feel like the default, not like side modes hanging off a client app shell.
- Runtime portability is usually bolted on later. Vuerend starts from a fetch-compatible handler so the app model stays the same across runtimes.
- Interactivity still matters, but it should be narrow and intentional. Vuerend uses explicit islands so only the parts that need JavaScript hydrate.

## Mental Model

- Zero JavaScript is the baseline until you opt into an island.
- Route components are server components by default.
- There is no filesystem router and no client router included.
- The default navigation model is MPA-style documents and links.
- Add interactivity by rendering `defineIsland()` components inside a server-rendered page.
- Start with `ssr` or `ssg`, then add `isr` only where freshness needs it.
- Keep browser-only behavior explicit by importing client utilities from `@vuerend/core/client`.
- Dynamic OG images can be authored as Vue SFCs and rendered through headless Chromium.

## Workspace Layout

- `packages/core`: the Vite plugin, runtime, islands implementation, middleware, document metadata, and client utilities
- `packages/node`: Node adapter powered by `srvx/node`
- `packages/bun`: Bun adapter
- `packages/deno`: Deno adapter
- `packages/cloudflare`: Cloudflare Worker adapter
- `packages/service-worker`: service worker adapter

## Example Tour

Read the examples in this order if you want the clearest picture of the project motivation.

Every example now follows the same clean-room layout:

- `README.md`: motivation and route map
- `src/app.ts`: app contract and route table
- `src/data/*`: scenario content
- `src/routes/*`: route components
- `src/islands/*`: optional client boundaries

| Example                      | What Question It Answers                                                         | What It Demonstrates                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `examples/explicit-routes`   | What if I want a handbook or docs hub with Zero JavaScript by default?           | explicit route tables, server-only pages, shared metadata, social cards, `ssg` routes                    |
| `examples/secure-islands`    | How do I ship a launch page that stays mostly static but still has live widgets? | explicit islands, targeted hydration, client-only forms, static sections living next to interactive ones |
| `examples/mixed-sfc-jsx`     | Can a buying guide mix SFC pages, JSX islands, and MPA-friendly browser state?   | SFC + JSX together, `useClientState()`, page-to-page shared shortlist state                              |
| `examples/isr-cache`         | How do I keep a release-notes home fresh while older entries stay static?        | `isr`, prerendered long-tail entries, route-level metadata                                               |
| `examples/node-srvx`         | How does this fit into an existing Node support or admin process?                | middleware, request-scoped state, Node adapter entry                                                     |
| `examples/cloudflare-worker` | Can the same app model ship cleanly to Cloudflare Workers?                       | Cloudflare Worker adapter, fetch-first deployment model, runtime portability                             |
| `examples/social-cards`      | How do I generate dynamic social cards from Vue SFCs?                            | `defineImageRoute()`, Chromium-backed image rendering, route-owned OG metadata                           |

## Commands

From the repo root, use `vp` for the packages:

```bash
vp check
vp test
vp pack
node ./scripts/build-examples.mjs
vp run release patch
```

Run any example from its own directory:

```bash
cd examples/explicit-routes
pnpm exec vite dev
```

Examples alias the workspace source directly, so they always exercise the in-repo implementation.

There is also a scenario-first index at [examples/README.md](examples/README.md).

## Dynamic OG Images

Vuerend can render explicit image routes through Chromium, which makes it possible to author Open Graph cards as normal Vue SFC templates.

At the app level, pass an `imageRenderer` into `createRequestHandler()`. In Vite-powered apps, export `requestHandlerOptions` from the app module so the virtual server entry can pick it up automatically.

```ts
// src/app.ts
import HomeRoute from "./routes/HomeRoute";
import OgCardRoute from "./routes/OgCardRoute.vue";
import {
  defineApp,
  defineImageRoute,
  defineRequestHandlerOptions,
  defineRoute,
} from "@vuerend/core";
import { createChromiumImageRenderer } from "@vuerend/node";

export const requestHandlerOptions = defineRequestHandlerOptions(() => ({
  imageRenderer: createChromiumImageRenderer(),
}));

export default defineApp({
  routes: [
    defineRoute({
      path: "/",
      component: HomeRoute,
      head(context) {
        const imageUrl = new URL("/og/home.png", context.url).href;

        return {
          meta: [{ property: "og:image", content: imageUrl }],
        };
      },
    }),
    defineImageRoute({
      path: "/og/home.png",
      component: OgCardRoute,
      getProps() {
        return {
          title: "Hello from Vue SFC",
        };
      },
      head: {
        stylesheets: ["/styles/og.css"],
      },
      image: {
        width: 1200,
        height: 630,
      },
    }),
  ],
});
```

```vue
<!-- src/routes/OgCardRoute.vue -->
<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <main class="og-card">
    <h1>{{ title }}</h1>
  </main>
</template>
```

Install Playwright in the app that renders the images, then download Chromium once:

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

The explicit-routes example includes this pattern at [examples/explicit-routes/src/app.ts](examples/explicit-routes/src/app.ts).

## Releases

Tag releases are driven by `vp run release ...`. Stable releases use `major`, `minor`, or `patch`. Pre-releases use `alpha`, `beta`, `rc`, and `allpha` is accepted as an alias for `alpha`.

```bash
vp run release patch
vp run release alpha
```

The command does this in one go:

- runs release-file formatting checks, `vp test`, and `vp pack`
- bumps every published package to the next shared version
- creates `chore(release): vX.Y.Z`
- creates and pushes the `vX.Y.Z` tag
- lets GitHub Actions publish from that tag

For the very first publish, use local npm auth once and publish from your machine:

```bash
npm login
vp run release patch --publish=local
```

If your npm account requires 2FA for publish, pass the OTP as well:

```bash
vp run release patch --publish=local --otp 123456
```

After that first publish succeeds, configure npm Trusted Publishing for each package on npm:

- `@vuerend/core`
- `@vuerend/node`
- `@vuerend/bun`
- `@vuerend/deno`
- `@vuerend/cloudflare`
- `@vuerend/service-worker`

Use this GitHub repository and workflow file:

- repository: `ubugeeei/vuerend`
- workflow: `.github/workflows/publish.yml`

Once those trusted publishers are saved, future releases only need:

```bash
vp run release patch
```

## Where To Start

- Start with `examples/explicit-routes` if the main appeal is “Zero JavaScript-first Vue for MPAs.”
- Move to `examples/secure-islands` if the main appeal is “mostly static pages with tiny interactive pockets.”
- Open `examples/mixed-sfc-jsx` if the sticking point is “I still need MPA-friendly client state for a few interactive islands.”
- Read `examples/social-cards` if the main draw is “Chromium-backed OG cards authored as Vue.”
- Read `packages/core/README.md` when you want the API surface rather than the motivation.

## Documentation

The core package README lives at [packages/core/README.md](packages/core/README.md).
