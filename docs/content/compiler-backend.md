---
title: Compiler Backend (Vize)
order: 4
---

# Compiler Backend (Vize)

The default SFC compiler is `@vitejs/plugin-vue`. You can opt into an alternative compiler backend through the `vuePlugin` option. [Vize](https://vizejs.dev) is a Rust-native Vue toolchain whose `@vizejs/vite-plugin` is a drop-in replacement for `@vitejs/plugin-vue`, so no component changes are required.

Install the plugin next to Vuerend. It is declared as an optional peer dependency, so it is only needed when you opt in:

```bash
pnpm add -D @vizejs/vite-plugin
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vize from "@vizejs/vite-plugin";
import { vuerend } from "@vuerend/core/vite";

export default defineConfig({
  plugins: [
    vuerend({
      app: "./src/app.ts",
      islands: "./src/islands.ts",
      vuePlugin: vize(),
    }),
  ],
});
```

When `vuePlugin` is set, the default Vue SFC plugin is not installed and the `vue` option is ignored. JSX handling stays independent through `jsx` / `jsxPlugin`, and you can pass `vuePlugin: false` to disable SFC compilation entirely.

## Vize with Vapor

Vize can also compile Vue 3.6 Vapor SFCs. Vuerend's `vapor` option drives the client hydration runtime, and Vize handles the compiler side, so enable both when your islands are authored with `<script setup vapor>`:

```ts
vuerend({
  app: "./src/app.ts",
  islands: "./src/islands.ts",
  vapor: true,
  vuePlugin: vize({ vapor: true }),
});
```

> If you instead run Vize in its host-compiler mode (e.g. `vueVersion: "legacy"`), Vize delegates `.vue` compilation back to `@vitejs/plugin-vue`. In that mode keep the default Vue plugin and add `vize()` as a separate top-level plugin rather than passing it through `vuePlugin`.
