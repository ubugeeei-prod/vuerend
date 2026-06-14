---
title: Getting Started
order: 2
---

# Getting Started

Install the core package and a runtime adapter:

```bash
pnpm add @vuerend/core @vuerend/node
```

Add the Vite plugin:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vuerend } from "@vuerend/core/vite";

export default defineConfig({
  plugins: [
    vuerend({
      app: "./src/app.ts",
      islands: "./src/islands.ts",
    }),
  ],
});
```

The `islands` option is optional. Leave it out when the app is pure server components and should return no client JavaScript.

Define the app and its routes:

```ts
// src/app.ts
import HomeRoute from "./routes/HomeRoute";
import { defineApp, defineRoute } from "@vuerend/core";

export default defineApp({
  routes: [
    defineRoute({
      path: "/",
      component: HomeRoute,
      render: { strategy: "ssg" },
    }),
  ],
});
```

The server build outputs a fetch handler in `dist/server/index.js` and prerendered/static assets in `dist/client`.
