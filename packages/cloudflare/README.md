# @vuerend/cloudflare

Cloudflare Workers runtime adapter for [Vuerend](https://github.com/ubugeeei-prod/vuerend). It wraps a Vuerend fetch handler with `srvx/cloudflare` so the same app model deploys to the edge.

## Install

```bash
pnpm add @vuerend/core @vuerend/cloudflare
```

## Quick Start

`createRequestHandler()` (from `@vuerend/core`) returns a fetch-compatible handler. `serveCloudflare()` produces the Worker export. Every option except `fetch` is forwarded to `srvx/cloudflare`.

```ts
import app from "./app";
import { createRequestHandler } from "@vuerend/core";
import { serveCloudflare } from "@vuerend/cloudflare";

const handler = createRequestHandler({ app });

export default serveCloudflare(handler);
```

## Docs

- Project overview and mental model: https://github.com/ubugeeei-prod/vuerend
- API surface (`createRequestHandler`, routing, islands, caching): [`@vuerend/core`](https://www.npmjs.com/package/@vuerend/core)
