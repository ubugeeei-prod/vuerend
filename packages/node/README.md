# @vuerend/node

Node.js runtime adapter for [Vuerend](https://github.com/ubugeeei-prod/vuerend). It runs a Vuerend fetch handler in a long-lived Node process via `srvx/node`, and ships an optional Playwright + Chromium image renderer for dynamic Open Graph cards.

## Install

```bash
pnpm add @vuerend/core @vuerend/node
```

## Quick Start

`createRequestHandler()` (from `@vuerend/core`) returns a fetch-compatible handler. `serveNode()` runs it on a Node HTTP server. Every option except `fetch` is forwarded to `srvx/node`.

```ts
import app from "./app";
import { createRequestHandler } from "@vuerend/core";
import { serveNode } from "@vuerend/node";

const handler = createRequestHandler({ app });

serveNode(handler, { port: 3_000 });
```

## Dynamic OG Images

`createChromiumImageRenderer()` backs `defineImageRoute()` with Playwright + Chromium. The browser is loaded lazily, so normal routes do not pay for it unless an image route renders.

```ts
import app from "./app";
import { createRequestHandler } from "@vuerend/core";
import { createChromiumImageRenderer, serveNode } from "@vuerend/node";

const handler = createRequestHandler({
  app,
  imageRenderer: createChromiumImageRenderer(),
});

serveNode(handler, { port: 3_000 });
```

Install Playwright in the app that renders image routes:

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

## Docs

- Project overview and mental model: https://github.com/ubugeeei-prod/vuerend
- API surface (`createRequestHandler`, routing, islands, OG images): [`@vuerend/core`](https://www.npmjs.com/package/@vuerend/core)
