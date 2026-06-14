import { defineConfig } from "vite";
import { oxContent } from "@ox-content/vite-plugin";
import { voidPlugin } from "void";
import { vuerend } from "../packages/core/src/vite";
import { vuerendAliases } from "../examples/shared/vuerend-alias";

// The Vuerend documentation site is itself a Vuerend app (dogfooding):
// Markdown content is parsed by Ox Content into `{ html, frontmatter, toc }`
// and rendered through Zero JavaScript-first SSG routes. `voidPlugin()` makes
// the built fetch handler deployable with `vpx void deploy`.
export default defineConfig({
  plugins: [
    voidPlugin(),
    oxContent({
      srcDir: "content",
      ssg: false,
      gfm: true,
      tables: true,
      taskLists: true,
      strikethrough: true,
      highlight: true,
      highlightTheme: "github-dark",
      toc: true,
      tocMaxDepth: 3,
    }),
    vuerend({
      app: "./src/app.ts",
    }),
  ],
  resolve: {
    alias: vuerendAliases(),
  },
});
