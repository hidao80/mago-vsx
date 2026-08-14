# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) (PHP static analysis tool) into VS Code. Provides lint, analyze, format, and baseline operations with full diagnostics integration.

`CLAUDE.md` at the repo root is a thin pointer alias to this file — this file is the canonical source of agent guidance.

## Architecture

- `src/extension.ts` — activation entry point, registers commands and the `formatOnSave`/`lintOnSave`/`analyzeOnSave` handlers.
- `src/magoRunner.ts` — spawns the `mago` CLI (`child_process.spawn`, never `shell: true`), builds command args, and orchestrates lint/analyze/format/baseline runs. Implements `vscode.Disposable`.
- `src/magoSpawner.ts` — low-level subprocess spawning with a double-resolution guard and timeout.
- `src/magoOutputParser.ts` — parses Mago's JSON/line output into `vscode.Diagnostic`s.
- `src/magoErrorHandler.ts` — classifies and surfaces Mago failures (including the Windows "database access" failure mode) as user-facing errors.
- `src/types.ts` — shared types for the Mago JSON contract (`MagoJsonOutput`, `MagoJsonIssue`, `MagoPosition`, etc.) — single source of truth, do not redefine these inline.
- `src/test/` — Playwright-based test suite; see `docs/TESTING.md`.

Security-relevant invariants (see `docs/ADR.md` for the full history):
- Never reintroduce `shell: true` in `magoSpawner.ts`/`magoRunner.ts` — it was removed to close a command-injection vector.
- Baseline file paths must go through `isValidBaselinePath`; executable paths through `isValidExecutablePath`. Do not add a second, divergent validation path.
- Use `??` (not `||`) for numeric/level fallbacks from Mago output — `0` is a valid value, not a falsy default.

## Commands

- `bun run compile` — TypeScript build (`tsc -p ./`).
- `bun run watch` — incremental build.
- `bun run lint` / `bun run lint:fix` — Biome checks on `src/`.
- `bun run test` — compile, type-check tests (`tsconfig.test.json`), then run the Playwright suite.
- `bun run package` — compile and produce a `.vsix` via `vsce`.
- `bun run install:vscode` — package and install the extension locally.

## Testing

All tests run via Playwright — there is no VS Code headless test runner. The VS Code API is mocked in `src/test/unit/setup.ts`, which intercepts `require('vscode')` before production code loads (see `src/test/vscode-stub/`). Both production and test files are type-checked (`tsconfig.json` and `tsconfig.test.json` respectively). See `docs/TESTING.md` for the full layout and workflow.

## Workflow

- Check `docs/ADR.md` before changing security-sensitive code (subprocess spawning, path validation, error classification) — it records the bug numbers and reasoning behind the current behavior so fixes aren't silently reverted.
- CI runs audit, build, lint, and test workflows (`.github/workflows/`), each gated by a Takumi Guard supply-chain scan. Keep new dependencies and scripts compatible with that gate.
- Update `docs/CHANGELOG.md` for user-visible changes and bump `package.json` version per `ADR-014`'s release convention.
