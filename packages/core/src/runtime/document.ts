import type {
  ClientBuildAssets,
  DocumentConfig,
  HeadLink,
  HeadMeta,
  HeadScript,
  RouteHead,
} from "./types.js";

const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z_:][A-Za-z0-9:._-]*$/;

/** Input required to assemble the final HTML document string. */
export interface RenderDocumentInput {
  appDocument?: DocumentConfig | undefined;
  body: string;
  head?: RouteHead | undefined;
  islandsRendered: boolean;
  assets?: ClientBuildAssets | undefined;
}

/** Input required to assemble an image-document string for Chromium screenshots. */
export interface RenderImageDocumentInput {
  appDocument?: DocumentConfig | undefined;
  body: string;
  head?: RouteHead | undefined;
  width: number;
  height: number;
  baseUrl: URL;
}

/**
 * Renders the full HTML document around a route body.
 *
 * Route head data overrides app-level defaults where both are present.
 */
export function renderDocument(input: RenderDocumentInput): string {
  const document = input.appDocument;
  const head = input.head;
  const title = applyTitleTemplate(head?.title ?? document?.title, document?.titleTemplate);
  const lang = head?.lang ?? document?.lang ?? "en";
  const htmlAttrs = renderAttributes({
    lang,
    ...document?.htmlAttrs,
    ...head?.htmlAttrs,
  });
  const bodyAttrs = renderAttributes({
    ...document?.bodyAttrs,
    ...head?.bodyAttrs,
  });
  const meta = renderTagCollection(
    "meta",
    dedupeTagCollection<HeadMeta>([
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      ...(document?.meta ?? []),
      ...(head?.meta ?? []),
    ]),
  ).join("");
  const links = renderTagCollection(
    "link",
    dedupeLinkCollection([
      ...(document?.links ?? []),
      ...createModulePreloadLinks(input.islandsRendered ? input.assets?.modulepreload : undefined),
      ...createStylesheetLinks(document?.stylesheets),
      ...(head?.links ?? []),
      ...createStylesheetLinks(head?.stylesheets),
      ...createStylesheetLinks(input.assets?.css),
    ]),
  ).join("");
  const scripts = [
    ...renderScripts(
      dedupeScriptCollection([...(document?.scripts ?? []), ...(head?.scripts ?? [])]),
    ),
    ...renderClientEntry(input.assets?.entry, input.islandsRendered),
  ].join("");

  return [
    "<!DOCTYPE html>",
    `<html${htmlAttrs}>`,
    "<head>",
    meta,
    title ? `<title>${escapeHtml(title)}</title>` : "",
    document?.head ?? "",
    head?.head ?? "",
    links,
    scripts,
    "</head>",
    `<body${bodyAttrs}>`,
    document?.bodyOpen ?? "",
    input.body,
    document?.bodyClose ?? "",
    "</body>",
    "</html>",
  ].join("");
}

/**
 * Renders a minimal HTML document for an image route.
 *
 * The resulting document is meant to be loaded by a Chromium-based renderer and
 * captured as a PNG or JPEG.
 */
export function renderImageDocument(input: RenderImageDocumentInput): string {
  const document = input.appDocument;
  const head = input.head;
  const lang = head?.lang ?? document?.lang ?? "en";
  const htmlAttrs = renderAttributes({
    lang,
    ...document?.htmlAttrs,
    ...head?.htmlAttrs,
  });
  const bodyAttrs = renderAttributes({
    ...document?.bodyAttrs,
    ...head?.bodyAttrs,
  });
  const meta = renderTagCollection(
    "meta",
    dedupeTagCollection<HeadMeta>([
      { charset: "utf-8" },
      { name: "viewport", content: `width=${input.width}, initial-scale=1` },
      ...(document?.meta ?? []),
      ...(head?.meta ?? []),
    ]),
  ).join("");
  const links = renderTagCollection(
    "link",
    dedupeLinkCollection([
      ...(document?.links ?? []),
      ...createStylesheetLinks(document?.stylesheets),
      ...(head?.links ?? []),
      ...createStylesheetLinks(head?.stylesheets),
    ]),
  ).join("");

  return [
    "<!DOCTYPE html>",
    `<html${htmlAttrs}>`,
    "<head>",
    meta,
    `<base href="${escapeAttribute(resolveBaseHref(input.baseUrl))}">`,
    document?.head ?? "",
    head?.head ?? "",
    `<style>${createImageViewportCss(input.width, input.height)}</style>`,
    links,
    "</head>",
    `<body${bodyAttrs}>`,
    '<div id="vuerend-og-root">',
    input.body,
    "</div>",
    "</body>",
    "</html>",
  ].join("");
}

function applyTitleTemplate(
  title: string | undefined,
  template: DocumentConfig["titleTemplate"],
): string | undefined {
  if (!template) {
    return title;
  }

  if (typeof template === "function") {
    return template(title);
  }

  return template.replace("%s", title ?? "");
}

function renderTagCollection(
  tagName: "meta" | "link",
  entries?: Array<Record<string, string | undefined>>,
): string[] {
  if (!entries?.length) {
    return [];
  }

  return entries.map((entry) => `<${tagName}${renderAttributes(entry)}>`);
}

function renderScripts(entries?: HeadScript[]): string[] {
  if (!entries?.length) {
    return [];
  }

  return entries.map(({ children, ...attributes }) => {
    return `<script${renderAttributes(attributes)}>${
      children ? escapeScript(children) : ""
    }</script>`;
  });
}

function renderClientEntry(entry: string | undefined, islandsRendered: boolean): string[] {
  if (!entry || !islandsRendered) {
    return [];
  }

  return [`<script type="module" src="${escapeAttribute(entry)}"></script>`];
}

function renderAttributes(attributes: Record<string, string | undefined>): string {
  const rendered = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => {
      assertValidAttributeName(key);
      return ` ${key}="${escapeAttribute(value ?? "")}"`;
    });

  return rendered.join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function escapeScript(value: string): string {
  return value
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function assertValidAttributeName(name: string): void {
  if (!ATTRIBUTE_NAME_PATTERN.test(name)) {
    throw new TypeError(`Invalid HTML attribute name: ${name}`);
  }
}

function createStylesheetLinks(entries?: readonly string[]): HeadLink[] {
  if (!entries?.length) {
    return [];
  }

  return entries.map((href) => ({ rel: "stylesheet", href }));
}

function createModulePreloadLinks(entries?: readonly string[]): HeadLink[] {
  if (!entries?.length) {
    return [];
  }

  return entries.map((href) => ({ rel: "modulepreload", href }));
}

function dedupeTagCollection<TEntry extends Record<string, string | undefined>>(
  entries: readonly TEntry[],
): TEntry[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = serializeAttributes(entry);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeLinkCollection(entries: readonly HeadLink[]): HeadLink[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = entry.href
      ? [
          normalizeToken(entry.rel),
          entry.href,
          normalizeToken(entry.as),
          normalizeToken(entry.type),
          entry.media ?? "",
        ].join("|")
      : serializeAttributes(entry);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeScriptCollection(entries: readonly HeadScript[]): HeadScript[] {
  const seen = new Set<string>();

  return entries.filter(({ children, ...attributes }) => {
    const key = [attributes.src ?? "", serializeAttributes(attributes), children ?? ""].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function serializeAttributes(attributes: Record<string, string | undefined>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function resolveBaseHref(url: URL): string {
  return new URL(url.pathname, url.origin).href;
}

function createImageViewportCss(width: number, height: number): string {
  return [
    "html, body {",
    "  margin: 0;",
    "  padding: 0;",
    "  overflow: hidden;",
    `  width: ${width}px;`,
    `  height: ${height}px;`,
    "}",
    "body {",
    "  background: transparent;",
    "}",
    "#vuerend-og-root {",
    `  width: ${width}px;`,
    `  height: ${height}px;`,
    "  overflow: hidden;",
    "}",
  ].join("");
}
