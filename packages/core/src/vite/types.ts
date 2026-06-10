import type vue from "@vitejs/plugin-vue";
import type vueJsx from "@vitejs/plugin-vue-jsx";
import type { PluginOption } from "vite";
import type { ResolvedVuerendVaporOptions, VuerendVaporOptions } from "../runtime/types.js";

/**
 * Options for the Vuerend Vite plugin.
 *
 * `app` is required and must point to the explicit app entry module.
 */
export interface VuerendPluginOptions {
  app: string;
  /** Optional islands registry. Omit this for server-only apps that return no client JS. */
  islands?: string;
  outDir?: {
    client?: string;
    server?: string;
  };
  /** Enable Vue 3.6 Vapor hydration for client islands. */
  vapor?: VuerendVaporOptions;
  vue?: Parameters<typeof vue>[0] | false;
  jsx?: Parameters<typeof vueJsx>[0] | false;
  /**
   * Override the default `@vitejs/plugin-vue` SFC compiler with an alternative backend.
   *
   * This is the opt-in entry point for swapping in a drop-in compiler such as
   * [Vize](https://vizejs.dev) (`@vizejs/vite-plugin`):
   *
   * ```ts
   * import vize from "@vizejs/vite-plugin";
   * vuerend({ app: "./src/app.ts", vuePlugin: vize() });
   * ```
   *
   * When set, the default Vue SFC plugin is not added and the `vue` option is
   * ignored. JSX handling stays independent via `jsx` / `jsxPlugin`. Pass
   * `false` to disable SFC compilation entirely.
   */
  vuePlugin?: PluginOption | PluginOption[] | false;
  /** Override the default Vue JSX plugin. */
  jsxPlugin?: PluginOption | PluginOption[] | false;
}

export interface ResolvedVuerendPluginOptions {
  app: string;
  islands?: string | undefined;
  clientOutDir: string;
  serverOutDir: string;
  vapor?: ResolvedVuerendVaporOptions | undefined;
}
