# @vuerend/bun

Bun runtime adapter for [Vuerend](https://github.com/ubugeeei-prod/vuerend). It exposes a Vuerend fetch handler through `srvx/bun` for Bun-native deployments.

## Install

```bash
bun add @vuerend/core @vuerend/bun
```

## Quick Start

`createRequestHandler()` (from `@vuerend/core`) returns a fetch-compatible handler. `serveBun()` installs it as the Bun server's fetch entry. Every option except `fetch` is forwarded to `srvx/bun`.

```ts
import app from "./app";
import { createRequestHandler } from "@vuerend/core";
import { serveBun } from "@vuerend/bun";

const handler = createRequestHandler({ app });

serveBun(handler, { port: 3_000 });
```

## Docs

- Project overview and mental model: https://github.com/ubugeeei-prod/vuerend
- API surface (`createRequestHandler`, routing, islands, caching): [`@vuerend/core`](https://www.npmjs.com/package/@vuerend/core)
