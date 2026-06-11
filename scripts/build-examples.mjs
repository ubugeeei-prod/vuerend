#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL, fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = path.join(repoRoot, "examples");
const examples = readdirSync(examplesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((example) => existsSync(path.join(examplesRoot, example, "package.json")))
  .sort();

/**
 * Smoke-test plan per example.
 *
 * After each example builds, we import its `dist/server/index.js` fetch handler
 * (the server entry exports both `export const fetch` and `export default { fetch }`;
 * see packages/core/src/vite/virtual.ts) and issue one or two representative
 * `Request`s against it. Each check asserts a 2xx status plus a route-specific
 * signal: the `x-vuerend-title` response header (URL-encoded, set from the route
 * head title in packages/core/src/runtime/render.ts), an example-specific
 * middleware header, and/or a body substring.
 *
 * Chromium/OG image routes (defineImageRoute) are intentionally NOT smoke-tested
 * here: they require Playwright/Chromium, which we keep optional.
 *
 * If an example has no smoke target it can be listed with `skip` + `reason`.
 */
const smokePlans = {
  "cloudflare-worker": {
    checks: [
      {
        path: "/",
        title: "Edge Overview",
        headers: { "x-runtime": "cloudflare-worker" },
        bodyIncludes: "Edge",
      },
    ],
  },
  "explicit-routes": {
    // `/og/explicit-routes-home.png` is a Chromium image route and is skipped.
    checks: [{ path: "/", title: "Handbook Home", bodyIncludes: "Handbook" }],
  },
  "isr-cache": {
    checks: [
      { path: "/", title: "Landing", bodyIncludes: "Release" },
      { path: "/posts/hello", title: "Fresh enough for a release notes home" },
    ],
  },
  "mixed-sfc-jsx": {
    checks: [
      { path: "/", title: "Guide Home", bodyIncludes: "Guide" },
      { path: "/library", title: "Shortlist" },
    ],
  },
  "node-srvx": {
    checks: [
      {
        path: "/",
        title: "Support Overview",
        headers: { "x-powered-by": "vuerend" },
        bodyIncludes: "Support",
      },
    ],
  },
  "secure-islands": {
    checks: [
      { path: "/", title: "Launch Site", bodyIncludes: "Launch" },
      { path: "/pricing", title: "Programs" },
    ],
  },
  "social-cards": {
    // `/cards/launch-week.png` is a Chromium image route and is skipped.
    checks: [{ path: "/", title: "Overview", bodyIncludes: "Social" }],
  },
  "vapor-islands": {
    checks: [{ path: "/", title: "Vapor Islands", bodyIncludes: "Vapor" }],
  },
};

const BASE_URL = "https://vuerend.local";
let importCounter = 0;
const failures = [];
const skipped = [];

function describeCheck(example, check) {
  return `${example} ${check.path}`;
}

async function smokeTestExample(example) {
  const plan = smokePlans[example];

  if (!plan) {
    skipped.push({ example, reason: "no smoke plan defined for this example" });
    console.log(`  - skipped smoke (no smoke plan defined)`);
    return;
  }

  if (plan.skip) {
    skipped.push({ example, reason: plan.reason ?? "explicitly skipped" });
    console.log(`  - skipped smoke (${plan.reason ?? "explicitly skipped"})`);
    return;
  }

  const entryPath = path.join(examplesRoot, example, "dist", "server", "index.js");

  if (!existsSync(entryPath)) {
    failures.push(`${example}: built server entry missing at ${entryPath}`);
    return;
  }

  const moduleUrl = `${pathToFileURL(entryPath).href}?t=${importCounter++}`;
  let mod;
  try {
    mod = await import(moduleUrl);
  } catch (error) {
    failures.push(`${example}: failed to import built server entry: ${error?.message ?? error}`);
    return;
  }

  const fetchHandler = typeof mod.fetch === "function" ? mod.fetch : mod.default?.fetch;

  if (typeof fetchHandler !== "function") {
    failures.push(`${example}: built server entry does not export a fetch handler`);
    return;
  }

  for (const check of plan.checks) {
    const label = describeCheck(example, check);
    let response;
    try {
      response = await fetchHandler(new Request(`${BASE_URL}${check.path}`));
    } catch (error) {
      const message = `${label}: request threw: ${error?.message ?? error}`;
      if (check.optional) {
        console.log(`  - skipped optional check (${message})`);
      } else {
        failures.push(message);
      }
      continue;
    }

    if (!response || typeof response.status !== "number") {
      failures.push(`${label}: handler did not return a Response`);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      const message = `${label}: expected 2xx, got ${response.status}`;
      if (check.optional) {
        console.log(`  - skipped optional check (${message})`);
      } else {
        failures.push(message);
      }
      continue;
    }

    // Header assertions.
    if (check.title) {
      const titleHeader = response.headers.get("x-vuerend-title");
      const decoded = titleHeader ? decodeURIComponent(titleHeader) : "";
      if (decoded !== check.title) {
        failures.push(
          `${label}: expected x-vuerend-title "${check.title}", got "${decoded || "(missing)"}"`,
        );
        continue;
      }
    }

    if (check.headers) {
      let headerOk = true;
      for (const [name, expected] of Object.entries(check.headers)) {
        const actual = response.headers.get(name);
        if (actual !== expected) {
          failures.push(
            `${label}: expected header ${name}="${expected}", got "${actual ?? "(missing)"}"`,
          );
          headerOk = false;
          break;
        }
      }
      if (!headerOk) {
        continue;
      }
    }

    // Body assertion (only read body when needed).
    if (check.bodyIncludes) {
      const body = await response.text();
      if (!body.includes(check.bodyIncludes)) {
        failures.push(`${label}: response body did not include "${check.bodyIncludes}"`);
        continue;
      }
    }

    console.log(`  - ok ${check.path} (status ${response.status})`);
  }
}

for (const example of examples) {
  const cwd = path.join(examplesRoot, example);
  console.log(`\nBuilding example: ${example}`);

  const result = spawnSync("pnpm", ["exec", "vite", "build"], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`Smoke-testing example: ${example}`);
  await smokeTestExample(example);
}

if (skipped.length > 0) {
  console.log("\nSkipped smoke checks:");
  for (const { example, reason } of skipped) {
    console.log(`  - ${example}: ${reason}`);
  }
}

if (failures.length > 0) {
  console.error("\nSmoke checks failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("\nAll examples built and smoke checks passed.");
