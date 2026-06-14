---
title: Introduction
order: 1
---

# Vuerend

Vuerend is a **Zero JavaScript-first** way to build Vue applications for MPAs. It treats server-rendered documents as the default unit, supports SSR and SSG out of the box, and keeps client JavaScript opt-in through explicit islands — while the same fetch handler runs on Node, Bun, Deno, Cloudflare Workers, and service workers.

## Why this exists

- Many Vue stacks assume a client router, route-level hydration, and a large baseline JavaScript payload even when the app mostly wants HTML documents.
- Some teams want Vue as a rendering language for content sites, dashboards, documentation, storefronts, or internal tools without buying into an SPA-first architecture.
- Runtime portability is usually bolted on later. Vuerend starts from a fetch-compatible handler so the app model stays the same across runtimes.
- Interactivity still matters, but it should be narrow and intentional. Vuerend uses explicit islands so only the parts that need JavaScript hydrate.

## Mental model

- Zero JavaScript is the baseline until you opt into an island.
- Route components are server components by default.
- There is no filesystem router and no client router included.
- The default navigation model is MPA-style documents and links.
- Start with `ssr` or `ssg`, then add `isr` only where freshness needs it.

> This very site is built with Vuerend. Pages are authored in Markdown, parsed by [Ox Content](https://vizejs.dev), and rendered through Zero JavaScript-first SSG routes.
