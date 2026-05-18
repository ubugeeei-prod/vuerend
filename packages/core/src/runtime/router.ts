import type { AnyRouteDefinition, ImageRouteDefinition, RouteDefinition } from "./types.js";

/** A compiled route pattern used by the runtime matcher. */
export interface CompiledRoute {
  definition: AnyRouteDefinition;
  keys: string[];
  pattern: RegExp;
}

/** A route match together with decoded path parameters. */
export interface MatchedRoute {
  definition: AnyRouteDefinition;
  params: Record<string, string>;
}

/**
 * Declares a route without losing the inferred prop type.
 *
 * Use this when building the explicit `routes` array for an app.
 */
export function defineRoute<
  const Path extends string,
  const TComponent extends RouteDefinition["component"],
  Props = RouteDefinition<Path, TComponent> extends RouteDefinition<
    Path,
    TComponent,
    infer InferredProps
  >
    ? InferredProps
    : never,
>(route: RouteDefinition<Path, TComponent, Props>): RouteDefinition<Path, TComponent, Props> {
  return route;
}

/**
 * Declares a route that renders a binary image instead of an HTML document.
 *
 * Image routes still use normal Vue server components, so Vue SFC templates can
 * be used for dynamic OG image layouts.
 */
export function defineImageRoute<
  const Path extends string,
  const TComponent extends RouteDefinition["component"],
  Props = RouteDefinition<Path, TComponent> extends RouteDefinition<
    Path,
    TComponent,
    infer InferredProps
  >
    ? InferredProps
    : never,
>(
  route: ImageRouteDefinition<Path, TComponent, Props>,
): ImageRouteDefinition<Path, TComponent, Props> {
  return route;
}

/** Returns the route tuple unchanged while preserving its literal type. */
export function createRouter<const Routes extends readonly AnyRouteDefinition[]>(
  routes: Routes,
): Routes {
  return routes;
}

/** Compiles explicit route patterns into regular expressions for request matching. */
export function compileRoutes(routes: readonly AnyRouteDefinition[]): CompiledRoute[] {
  return routes.map((definition) => {
    const normalized = normalizePathPattern(definition.path);
    const keys: string[] = [];
    const source = normalized
      .split("/")
      .map((segment) => {
        if (segment === "") {
          return "";
        }

        if (segment === "*") {
          keys.push("wildcard");
          return "(.*)";
        }

        if (segment.startsWith(":")) {
          keys.push(segment.slice(1));
          return "([^/]+)";
        }

        return escapeRegExp(segment);
      })
      .join("/");

    const suffix = normalized === "/" ? "" : "/?";

    return {
      definition,
      keys,
      pattern: new RegExp(`^${source}${suffix}$`),
    };
  });
}

/** Matches a pathname against the compiled route table. */
export function matchRoute(
  routes: readonly CompiledRoute[],
  pathname: string,
): MatchedRoute | undefined {
  const normalized = normalizePathname(pathname);

  for (const route of routes) {
    const match = route.pattern.exec(normalized);

    if (!match) {
      continue;
    }

    const params: Record<string, string> = {};

    for (const [index, key] of route.keys.entries()) {
      const value = decodePathParam(match[index + 1] ?? "");

      if (value === undefined) {
        return undefined;
      }

      params[key] = value;
    }

    return {
      definition: route.definition,
      params,
    };
  }

  return undefined;
}

/** Normalizes a pathname into the canonical form used by the runtime. */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function normalizePathPattern(path: string): string {
  const normalized = normalizePathname(path);
  return normalized === "/" ? "/" : normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function decodePathParam(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
