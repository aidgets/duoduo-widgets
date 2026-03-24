# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`duoduo-widget` is a standalone, public package that provides durable, shareable, interactive web widgets for AI agents. An agent creates a widget via CLI, a user opens a permanent URL in the browser, and the agent can read structured feedback from user interactions.

- **Repository**: `github.com/aidgets/duoduo-widgets`
- **Production URL**: `https://aidgets.dev`
- **Package**: `@openduo/duoduo-widgets` (npm)
- **Install**: `npm install -g @openduo/duoduo-widgets`
- **License**: MIT

## Package Manager

This project uses **npm** as its package manager. Do not use pnpm or yarn.

## Project Structure

```text
.
├── src/
│   ├── cli/              CLI commands (open, update, finalize, wait, get, inspect)
│   └── types/            Shared TypeScript types
├── service/              Cloudflare Workers service
│   ├── src/              Worker + Durable Object + viewer shell
│   ├── wrangler.toml     Wrangler configuration
│   └── package.json      Service-specific dependencies
├── skill/
│   ├── SKILL.md          Agent skill definition for Claude Code integration
│   └── references/       Reference materials for the skill
├── dist/                 Build output (CLI bundle)
├── screenshots/          Gallery screenshots
├── docs/
│   └── design/           Design documents
│       └── widgets.md    Core design document (v5)
├── shared/
│   └── CLAUDE.md         This file (symlinked to repo root)
├── scripts/              Build scripts
├── tsconfig.json         TypeScript configuration
└── package.json          Root package definition
```

## Commands

### Build

- **Build CLI**: `npm run build` (esbuild bundle to `dist/duoduo-widget.js`)
- **Type check**: `npm run typecheck` (TypeScript `--noEmit`)

### Service (Cloudflare Workers)

- **Local dev**: `npm run dev` (runs `wrangler dev` in `service/`)
- **Deploy**: `npm run deploy` (runs `wrangler deploy` in `service/`)
- **Manual wrangler**: `cd service && npx wrangler dev` / `npx wrangler deploy`
- **Set secrets**: `cd service && npx wrangler secret put TOKEN_SECRET`

### Testing

- Tests are not yet configured. When added, use `npm test`.

## Architecture

### Two Build Targets

1. **CLI (`src/cli/`)**: Node.js binary (`duoduo-widget`). Communicates with the widget service over HTTPS. Manages widget lifecycle: `open`, `update`, `finalize`, `wait`, `get`, `inspect`.

2. **Service (`service/`)**: Cloudflare Workers application with three components:
   - **Workers**: HTTP API routing + viewer HTML serving
   - **Durable Objects (DO)**: Draft coordination, wait/get blocking, submit idempotency
   - **R2**: Immutable revision storage (finalized HTML)

### Data Flow

```text
Agent --> CLI --> Widget Service (CF Workers + DO + R2)
                        |  SSE
                 Viewer (Browser)
```

### Key Concepts

- **Widget**: A durable UI artifact with a lifecycle: `draft` -> `finalized` -> `awaiting_input` -> `submitted`
- **viewer_url**: Public, read-only URL for users (no token)
- **control_url**: Private, capability URL for agent/CLI (with token)
- **widget_id**: Durable reference in the widget service (not a cache key)
- **Progressive rendering**: Agent streams HTML updates via `update`; viewer sees live changes via SSE
- **Incremental patching**: Agent can send targeted DOM patches (`--patch`) instead of full HTML, for efficient data-heavy streaming
- **Interaction bridge**: `window.duoduo.submit(action, payload)` in the viewer shell posts structured data back to the service
- **wait/get**: Agent blocks or polls for user interaction results (structured JSON)

### Viewer Shell

The viewer shell is a host-owned HTML wrapper that:

- Renders agent-generated HTML in a sandboxed iframe
- Provides `window.duoduo.submit()` and `window.duoduo.openLink()` bridges
- Connects to SSE for live draft updates
- Supports light/dark themes
- Enforces CSP with CDN allowlist (`cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com`)

## Agent Skill

The skill definition lives at `skill/SKILL.md`. It provides Claude Code (and other agents) with instructions for using the `duoduo-widget` CLI effectively:

- When to create widgets vs. return plain text
- Progressive generation pattern (`open` -> `update` -> `finalize`)
- Interaction handling (`wait` / `get`)
- Security rules (never expose `control_url` to users)

## Environment Variables

- `WIDGET_SERVICE_URL`: Base URL of the widget service (default: `https://aidgets.dev`)
- `TOKEN_SECRET`: (service-side) Secret for signing control tokens

## Design Principles

0. **First Principles Thinking**: Decompose every problem to its fundamental truths before building. Ask "what is this _actually_ trying to do?" and discard inherited assumptions.
1. **Occam's Razor**: Among competing designs that satisfy the same requirements, prefer the one with fewest moving parts, fewest new abstractions, and fewest lines of code.

## Coding Principles

1. **Strong Boundaries**: JSON schema at machine boundaries (API, events). The CLI contract is the hard boundary; the skill is ergonomics.
2. **Test-Driven Changes**: All code changes must have corresponding test cases. Ensure all tests pass before completing any task.
3. **Preserve Test History**: Do not modify existing test cases unless the corresponding functionality is being changed.
4. **Doc-First Changes**: Sync all functional changes or modifications back to relevant documentation and confirm before implementation.
5. **Comment Clarity**: Write clear, concise comments explaining the purpose and functionality of complex code sections.
6. **Test Integrity Guardrail**: Never modify/delete/weaken tests just to make CI pass. If a test itself must change (legitimate spec/behavior change), document the reason and get explicit user authorization before editing test assertions or expected results.
7. **No hidden side effects**: Explicit dependency injection in tests.
8. **Capability separation**: `viewer_url` (read-only, public) and `control_url` (write, private) must never be conflated.

## Key Design Decisions

- Widget is an **external package**, not embedded in any agent runtime
- CLI (`duoduo-widget`) is the stable contract; skill is an ergonomics layer
- `wait/get` is an external CLI blocking model, not an agent ingress mechanism
- `finalized/submitted` artifacts are permanent; only draft windows and tokens expire
- The viewer shell owns the security sandbox; agent HTML never runs in a privileged context
- See `docs/design/widgets.md` for the full design document
