# @vuerend/deno

Deno runtime adapter for [Vuerend](https://github.com/ubugeeei-prod/vuerend). It connects a Vuerend fetch handler to `srvx/deno` for Deno-first deployments.

## Install

```bash
deno add npm:@vuerend/core npm:@vuerend/deno
```

## Quick Start

`createRequestHandler()` (from `@vuerend/core`) returns a fetch-compatible handler. `serveDeno()` runs it through `srvx/deno`. Every option except `fetch` is forwarded to `srvx/deno`.

```ts
import app from "./app";
import { createRequestHandler } from "@vuerend/core";
import { serveDeno } from "@vuerend/deno";

const handler = createRequestHandler({ app });

serveDeno(handler, { port: 8_000 });
```

## Docs

- Project overview and mental model: https://github.com/ubugeeei-prod/vuerend
- API surface (`createRequestHandler`, routing, islands, caching): [`@vuerend/core`](https://www.npmjs.com/package/@vuerend/core)
