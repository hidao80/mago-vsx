# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) (PHP static analysis tool) into VS Code. Provides lint, analyze, format, and baseline operations with full diagnostics integration.

## Commands

```bash
# Build (compile TypeScript to out/)
pnpm run compile

# Watch mode
pnpm run watch

# Lint with Biome
pnpm run lint

# Lint with auto-fix
pnpm run lint:fix

# Run all tests (requires VS Code environment via @vscode/test-electron)
pnpm test

# Run unit tests only (no VS Code environment needed)
pnpm run test:unit

# Type check without emit
pnpm exec tsc --noEmit

# Package as .vsix
pnpm run package

# Install/uninstall extension locally
pnpm run install:vscode
pnpm run uninstall:vscode
```

## Architecture

Three core modules with a clear data flow:

```
User Command / onDidSaveTextDocument
    ↓
extension.ts  → Registers 11 commands, sets up save listeners, manages DiagnosticCollection + OutputChannel
    ↓
magoRunner.ts → Spawns mago process, builds CLI args, handles errors (TOML errors, execution failures)
    ↓
magoOutputParser.ts → Parses JSON/text output, normalizes Windows paths, converts to vscode.Diagnostic[]
    ↓
vscode.DiagnosticCollection → Displayed in VS Code Problems pane
```

### Key files

- [src/extension.ts](src/extension.ts) — Entry point. Activates on `onLanguage:php`. Creates `MagoRunner` with injected `DiagnosticCollection` and `OutputChannel`. Handles on-save automation (format → lint → analyze order).
- [src/magoRunner.ts](src/magoRunner.ts) — Core executor. Spawns mago subprocess, builds CLI args (`--reporting-format json`, `--baseline`), detects TOML parse errors via regex, merges diagnostics from lint + analyze into the same `DiagnosticCollection`.
- [src/magoOutputParser.ts](src/magoOutputParser.ts) — Parses both JSON and text mago output. Handles Windows path normalization (removes `\\?\` prefix), maps severity strings to `vscode.DiagnosticSeverity`. Supports three JSON shapes: bare array, `{ issues: [] }` wrapper, single object.
- [src/types.ts](src/types.ts) — Shared type definitions: `MagoCommand`, `SpawnResult`, `MagoIssue` (internal normalized form), and raw JSON shapes (`MagoJsonIssue`, `MagoAnnotation`, `MagoSpan`, etc.).

### Test structure

- [src/test/suite/magoOutputParser.test.ts](src/test/suite/magoOutputParser.test.ts) — Unit tests for parser (JSON, text, path normalization, severity)
- [src/test/suite/magoRunner.test.ts](src/test/suite/magoRunner.test.ts) — Unit tests for runner (command building, configuration, baseline, error handling)
- [src/test/runTest.ts](src/test/runTest.ts) — Downloads VS Code and runs integration tests via `@vscode/test-electron`
- [src/test/suite/index.ts](src/test/suite/index.ts) — Mocha TDD runner, discovers `*.test.js` in `out/test/suite/`

## VS Code Extension Notes

- Activation event: `onLanguage:php`
- Min VS Code version: 1.80.0
- Output compiles to `out/` — never edit `out/` directly
- For debugging: press F5 in VS Code to launch Extension Development Host
- Linter: Biome (`@biomejs/biome`) — not ESLint/Prettier
- Configuration keys: `mago.lintOnSave`, `mago.analyzeOnSave`, `mago.formatOnSave`, `mago.lintBaseline`, `mago.analyzeBaseline`, `mago.executablePath`
- Diagnostic merging: lint and analyze both write into the same `DiagnosticCollection`; when both run on save, the collection entry for that file is cleared once before both commands run to avoid duplicates.

## Action History

Record a summary of all user commands and their results in the project's `.claude/histories/{YYYYMM}.md` file in the following format. Before executing a command, check the most recent history to determine what the user wants to do and then decide on an action.
