import { defineApp, defineRoute } from "@vuerend/core";
import DocRoute from "./routes/DocRoute.vue";
import type { TocEntry } from "./content.d";

interface DocModule {
  html: string;
  frontmatter: Record<string, unknown>;
  toc: TocEntry[];
}

export interface NavItem {
  path: string;
  title: string;
  order: number;
}

// Ox Content parses every Markdown file under `content/` into structured data.
// Each file becomes one explicit, statically rendered Vuerend route.
const modules = import.meta.glob<DocModule>("../content/**/*.md", { eager: true });

function toPath(file: string): string {
  const slug = file.replace(/^\.\.\/content\//, "").replace(/\.md$/, "");
  return slug === "index" ? "/" : `/${slug}`;
}

const docs = Object.entries(modules).map(([file, mod]) => {
  const path = toPath(file);
  const frontmatter = mod.frontmatter ?? {};
  const title = String(frontmatter.title ?? path);
  const order = Number(frontmatter.order ?? 100);
  return { path, title, order, html: mod.html, toc: mod.toc ?? [] };
});

const nav: NavItem[] = docs
  .map((doc) => ({ path: doc.path, title: doc.title, order: doc.order }))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

export default defineApp({
  document: {
    title: "Vuerend",
    titleTemplate: "%s | Vuerend Docs",
    head: '<link rel="icon" type="image/svg+xml" href="/logo.svg">',
    meta: [
      {
        name: "description",
        content:
          "Documentation for Vuerend, a Zero JavaScript-first Vue runtime and Vite v8 plugin for MPAs.",
      },
    ],
    stylesheets: ["/styles/docs.css"],
  },
  routes: docs.map((doc) =>
    defineRoute({
      path: doc.path,
      component: DocRoute,
      getProps: () => ({
        title: doc.title,
        html: doc.html,
        toc: doc.toc,
        nav,
        current: doc.path,
      }),
      head: { title: doc.title },
      render: { strategy: "ssg" },
    }),
  ),
});
