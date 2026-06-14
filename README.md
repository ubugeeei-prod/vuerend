<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/logo-wordmark-dark.svg">
    <img src="docs/public/logo-wordmark.svg" alt="Vuerend" width="420">
  </picture>
</p>

# Vuerend

Vuerend is a Zero JavaScript-first Vue runtime and Vite plugin for MPA-style apps.
It renders HTML documents by default, supports SSR and SSG, and keeps browser
JavaScript explicit through islands. The same fetch handler can target Node,
Bun, Deno, Cloudflare Workers, and service workers.

Most project details live in the documentation site. Start there unless you are
working on package internals.

## Documentation

- [Docs overview](docs/README.md)
- [Introduction](docs/content/index.md)
- [Getting Started](docs/content/getting-started.md)
- [Routing and Rendering](docs/content/routing.md)
- [Compiler Backend (Vize)](docs/content/compiler-backend.md)
- [Scenario examples](examples/README.md)

Run the docs locally:

```bash
vp run docs#dev
```

Build or preview the docs:

```bash
vp run docs#build
vp run docs#preview
```

Deploying the docs uses Void:

```bash
vp run docs#deploy
```

## Packages

This repository contains the Vuerend runtime packages and example apps:

- `packages/core`: Vuerend runtime, Vite plugin, routes, rendering, islands, and client helpers
- `packages/node`: Node adapter
- `packages/bun`: Bun adapter
- `packages/deno`: Deno adapter
- `packages/cloudflare`: Cloudflare Workers adapter
- `packages/service-worker`: service worker adapter
- `examples/*`: focused examples for common app shapes
- `docs`: documentation site, built with Vuerend

## Development

Install dependencies from the repository root:

```bash
pnpm install
```

Common checks:

```bash
vp check
vp test
vp pack
node ./scripts/build-examples.mjs
```

Run an example from its directory:

```bash
cd examples/explicit-routes
pnpm exec vite dev
```

## Releases

Tag releases are driven by `vp run release ...`.

```bash
vp run release patch
vp run release rc
```

The release command runs package checks, bumps all published packages to the
next shared version, creates `chore(release): vX.Y.Z`, tags the commit, pushes
the tag, and lets GitHub Actions publish from that tag.
