# Agent guidance

- Use conventional commit messages.
- Treat all human-authored storefront source as developer-owned and customizable.
- Preserve downstream intent during upgrades unless it violates an explicit upstream invariant; surface irreconcilable tradeoffs.
- Keep Next.js files under `src/app/` thin and place substantial behavior in the owning feature.
- Import another feature through its top-level modules, never through its `components/` or `routes/` internals.
- Colocate GraphQL operations and translations with their owning feature.
- Add or explicitly exempt an upgrade note for every downstream-impacting pull request.
- Run `npm run upgrade:validate`, tests, lint, type checks, and the production build before declaring work complete.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
