<script setup lang="ts">
import type { NavItem } from "../app";
import type { TocEntry } from "../content.d";

defineProps<{
  title: string;
  html: string;
  toc: TocEntry[];
  nav: NavItem[];
  current: string;
}>();
</script>

<template>
  <div class="docs-shell">
    <aside class="docs-sidebar">
      <a class="docs-brand" href="/">
        <img class="docs-brand-mark" src="/logo.svg" width="30" height="30" alt="" aria-hidden="true" />
        <span>vuerend</span>
      </a>
      <nav class="docs-nav">
        <a
          v-for="item in nav"
          :key="item.path"
          :href="item.path"
          :class="['docs-nav-link', { 'is-active': item.path === current }]"
        >
          {{ item.title }}
        </a>
      </nav>
    </aside>

    <main class="docs-main">
      <article class="docs-article" v-html="html" />
    </main>

    <nav v-if="toc.length" class="docs-toc" aria-label="On this page">
      <p class="docs-toc-title">On this page</p>
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
