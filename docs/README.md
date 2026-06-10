# @vuerend/docs

The Vuerend documentation site. It is itself a Vuerend app (dogfooding): Markdown
content is parsed by [Ox Content](https://vizejs.dev) into `{ html, frontmatter, toc }`
and rendered through Zero JavaScript-first SSG routes, then hosted on
[Void](https://void.cloud) via `vpx void deploy`.

## How it works

- `content/*.md` — documentation pages. Frontmatter `title` and `order` drive the
  page title and sidebar order.
- `@ox-content/vite-plugin` transforms each `.md` import into `{ html, frontmatter, toc }`.
- `src/app.ts` globs `content/**/*.md`, maps each file to an explicit `defineRoute`
  (`index.md` → `/`, `routing.md` → `/routing`), and renders them with `render.strategy: "ssg"`.
- `src/routes/DocRoute.vue` renders the sidebar, the parsed HTML, and the table of contents.
  No client JavaScript ships by default.
- `voidPlugin()` builds the fetch handler into a Cloudflare Worker bundle under `dist/ssr`.

## Develop

```bash
pnpm --filter @vuerend/docs dev
```

## Build

```bash
pnpm --filter @vuerend/docs build
```

Outputs:

- `dist/client` — prerendered static pages and assets
- `dist/server` — the Vuerend fetch handler
- `dist/ssr` — the Void/Cloudflare Worker bundle (`index.js` + `wrangler.json`)

## Add a page

Drop a new Markdown file into `content/`:

```md
---
title: My Page
order: 5
---

# My Page

...content...
```

It is picked up automatically as a new route and sidebar entry.

## Deploy

The site deploys to Void (Cloudflare Workers):

```bash
pnpm --filter @vuerend/docs deploy
# or, from this directory:
vpx void deploy
```

Deploying requires a Void/Cloudflare account; authenticate with Void before running deploy.
