# Contributing

Thanks for helping harden Vuerend.

## Local Setup

```bash
pnpm install --frozen-lockfile
```

## Checks

Run the package checks before opening a PR:

```bash
pnpm exec vp check --no-lint .github/workflows package.json pnpm-workspace.yaml README.md scripts packages/core/package.json packages/core/src packages/core/vite.config.ts packages/node/package.json packages/node/src packages/node/vite.config.ts packages/bun/package.json packages/bun/src packages/bun/vite.config.ts packages/deno/package.json packages/deno/src packages/deno/vite.config.ts packages/cloudflare/package.json packages/cloudflare/src packages/cloudflare/vite.config.ts packages/service-worker/package.json packages/service-worker/src packages/service-worker/vite.config.ts
pnpm exec vp test run
pnpm exec vp pack
node ./scripts/build-examples.mjs
pnpm exec vitest run --config vitest.browser.config.ts
```

For narrow changes, run the smallest relevant test first, then run the broader
suite before review.

## Pull Requests

- Keep PRs focused and conventional: `fix:`, `test:`, `docs:`, `ci:`, or
  `chore:`.
- Include validation commands in the PR body.
- Link the issue the PR resolves.
- Avoid unrelated formatting or generated artifact churn.

## Releases

Releases are driven by `vp run release ...` from a clean worktree. See the root
README for the full release flow and npm trusted publishing setup.
