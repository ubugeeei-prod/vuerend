/// <reference types="vite/client" />

export interface TocEntry {
  depth: number;
  text: string;
  slug: string;
  children: TocEntry[];
}

declare module "*.md" {
  const content: {
    html: string;
    frontmatter: Record<string, unknown>;
    toc: TocEntry[];
  };
  export default content;
  export const html: string;
  export const frontmatter: Record<string, unknown>;
  export const toc: TocEntry[];
}
