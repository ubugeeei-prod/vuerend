# @vuerend/service-worker

Service worker runtime adapter for [Vuerend](https://github.com/ubugeeei-prod/vuerend). It installs a Vuerend fetch handler into `srvx/service-worker` for runtimes that expose the standard service worker fetch event model.

## Install

```bash
pnpm add @vuerend/core @vuerend/service-worker
```

## Quick Start

`createRequestHandler()` (from `@vuerend/core`) returns a fetch-compatible handler. `serveServiceWorker()` wires it into the service worker fetch lifecycle. Every option except `fetch` is forwarded to `srvx/service-worker`.

```ts
import app from "./app";
import { createRequestHandler } from "@vuerend/core";
import { serveServiceWorker } from "@vuerend/service-worker";

const handler = createRequestHandler({ app });

serveServiceWorker(handler);
```

## Docs

- Project overview and mental model: https://github.com/ubugeeei-prod/vuerend
- API surface (`createRequestHandler`, routing, islands, caching): [`@vuerend/core`](https://www.npmjs.com/package/@vuerend/core)
