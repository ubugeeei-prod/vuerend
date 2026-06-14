<script setup lang="ts">
import type { NavItem } from "../app";
import type { TocEntry } from "../content.d";

defineProps<{
  title: string;
  html: string;
  toc: TocEntry[];
  nav: NavItem[];
  current: string;
  pageIndex: number;
  pageCount: number;
  previous: NavItem | null;
  next: NavItem | null;
}>();
</script>

<template>
  <div class="docs-shell">
    <aside class="docs-sidebar">
      <div class="docs-sidebar-inner">
        <a class="docs-brand" href="/">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcset="/logo-wordmark-dark.svg" />
            <img
              class="docs-brand-mark"
              src="/logo-wordmark.svg"
              width="154"
              height="35"
              alt="Vuerend"
            />
          </picture>
        </a>

        <nav class="docs-nav" aria-label="Documentation">
          <a
            v-for="(item, index) in nav"
            :key="item.path"
            :href="item.path"
            :class="['docs-nav-link', { 'is-active': item.path === current }]"
          >
            <span class="docs-nav-index">{{ String(index + 1).padStart(2, "0") }}</span>
            <span class="docs-nav-copy">
              <span class="docs-nav-title">{{ item.title }}</span>
              <span class="docs-nav-path">{{ item.path }}</span>
            </span>
          </a>
        </nav>

        <div class="docs-rail-meta" aria-label="Project">
          <span>@vuerend/core</span>
          <span>Vue 3.6</span>
        </div>
      </div>
    </aside>

    <main class="docs-main">
      <header class="docs-doc-header">
        <p class="docs-doc-kicker">docs{{ current === "/" ? "" : current }}</p>
        <p class="docs-doc-count">
          {{ String(pageIndex + 1).padStart(2, "0") }}/{{ String(pageCount).padStart(2, "0") }}
        </p>
      </header>

      <article class="docs-article" v-html="html" />

      <nav class="docs-pager" aria-label="Adjacent pages">
        <a v-if="previous" class="docs-pager-link is-previous" :href="previous.path">
          <span>Previous</span>
          <strong>{{ previous.title }}</strong>
        </a>
        <a v-if="next" class="docs-pager-link is-next" :href="next.path">
          <span>Next</span>
          <strong>{{ next.title }}</strong>
        </a>
      </nav>
    </main>

    <nav v-if="toc.length" class="docs-toc" aria-label="On this page">
      <p class="docs-toc-title">Contents</p>
      <ul>
        <li v-for="entry in toc" :key="entry.slug">
          <a :href="`#${entry.slug}`">{{ entry.text }}</a>
          <ul v-if="entry.children.length">
            <li v-for="child in entry.children" :key="child.slug">
              <a :href="`#${child.slug}`">{{ child.text }}</a>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
</template>
