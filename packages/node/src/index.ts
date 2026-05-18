import { serve } from "srvx/node";
import type {
  HtmlImageRenderer,
  HtmlImageRendererInput,
  VuerendRequestHandler,
} from "@vuerend/core";

/**
 * Starts a Node.js server for a Vuerend request handler.
 *
 * This is the usual entrypoint when you want to run a Vuerend application in a
 * long-lived Node process. The function forwards every request into the
 * provided fetch-compatible `handler`, while letting `srvx/node` manage the
 * underlying HTTP server.
 *
 * Pass any `srvx/node` server options through `options`, except for `fetch`.
 * Vuerend always owns the `fetch` entry so the handler cannot be replaced by
 * accident.
 *
 * # Examples
 *
 * ```ts
 * import { createRequestHandler } from "@vuerend/core";
 * import { serveNode } from "@vuerend/node";
 *
 * const handler = createRequestHandler({ app });
 *
 * serveNode(handler, {
 *   port: 3_000,
 * });
 * ```
 *
 * # Returns
 *
 * Returns the server instance created by `srvx/node`. This is the same object
 * `srvx/node` would return if you called `serve()` directly.
 */
export function serveNode(
  handler: VuerendRequestHandler,
  options: Omit<Parameters<typeof serve>[0], "fetch"> = {},
): ReturnType<typeof serve> {
  return serve({
    ...options,
    fetch: handler,
  });
}

/** Browser launch options accepted by the Chromium image renderer. */
export interface ChromiumImageRendererLaunchOptions {
  executablePath?: string | undefined;
  channel?: string | undefined;
  headless?: boolean | undefined;
  args?: string[] | undefined;
}

/** Runtime options for Chromium-backed OG image rendering. */
export interface ChromiumImageRendererOptions {
  deviceScaleFactor?: number | undefined;
  launch?: ChromiumImageRendererLaunchOptions | undefined;
  omitBackground?: boolean | undefined;
  timeout?: number | undefined;
}

/**
 * Creates a Chromium-based HTML image renderer powered by Playwright.
 *
 * Install `playwright` in the app that uses this helper, then pass the result
 * to `createRequestHandler({ imageRenderer })`. The browser package is loaded
 * lazily, so normal Node server routes do not pay for it unless an image route
 * actually renders.
 *
 * # Examples
 *
 * ```ts
 * import app, { requestHandlerOptions } from "./app";
 * import { createRequestHandler } from "@vuerend/core";
 * import { createChromiumImageRenderer, serveNode } from "@vuerend/node";
 *
 * const handler = createRequestHandler({
 *   app,
 *   imageRenderer: createChromiumImageRenderer(),
 * });
 *
 * serveNode(handler, { port: 3_000 });
 * ```
 */
export function createChromiumImageRenderer(
  options: ChromiumImageRendererOptions = {},
): HtmlImageRenderer {
  return {
    async render(input: HtmlImageRendererInput) {
      const playwright = await loadPlaywright();
      const browser = await playwright.chromium.launch({
        headless: options.launch?.headless ?? true,
        executablePath: options.launch?.executablePath,
        channel: options.launch?.channel,
        args: options.launch?.args,
      });

      try {
        const page = await browser.newPage({
          deviceScaleFactor: options.deviceScaleFactor ?? 1,
          viewport: {
            width: input.width,
            height: input.height,
          },
        });

        try {
          await page.setContent(input.html, {
            timeout: options.timeout ?? 30_000,
            waitUntil: "networkidle",
          });
          await page.evaluate(async () => {
            if (typeof document.fonts?.ready?.then === "function") {
              await document.fonts.ready;
            }
          });

          const body = await page.screenshot({
            type: input.format,
            quality: input.format === "jpeg" ? input.quality : undefined,
            animations: "disabled",
            omitBackground: input.format === "png" && (options.omitBackground ?? true),
          });

          return {
            body: toArrayBuffer(body),
          };
        } finally {
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

type PlaywrightModule = {
  chromium: {
    launch(options?: Record<string, unknown>): Promise<{
      close(): Promise<void>;
      newPage(options?: Record<string, unknown>): Promise<{
        close(): Promise<void>;
        evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
        screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
        setContent(html: string, options?: Record<string, unknown>): Promise<void>;
      }>;
    }>;
  };
};

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    const moduleName = "playwright";
    return (await import(moduleName)) as PlaywrightModule;
  } catch (error) {
    throw new Error(
      'Chromium image rendering requires the "playwright" package. Install it with `pnpm add -D playwright` and run `pnpm exec playwright install chromium`.',
      { cause: error instanceof Error ? error : undefined },
    );
  }
}
