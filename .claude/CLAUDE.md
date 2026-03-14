# CLAUDE.md

This file provides guidance to any AI coding Agenet (claude.ai/code/Codex/Gemini/Cursor/Windsurf/Antigravity/and more) when working with code in this repository.

## Project Overview

VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) (PHP static analysis tool) into VS Code. Provides lint, analyze, format, and baseline operations with full diagnostics integration.

## Rules for AI Codeing Agent

- **Codde style:** @docs/aiagent/rules/code-style.md
- **Security guidelines:** @docs/aiagent/rules/security.md
- **Version controll system guidelines:** @docs/aiagent/rules/version-controll-system.md

## Source Code Explained documents

- **Overview:** @docs/analyzed/overview.md
- **Configurations:**  @docs/analyzed/configurations.md
- **Databases:**  @docs/analyzed/databases.md
- **Components:**  @docs/analyzed/components.md
- **Utitlities:**  @docs/analyzed/utilities.md
- **Screens:**  @docs/analyzed/screens.md
- **Known bugs:**  @docs/analyzed/known_bugs.md
- **Other notes:** @docs/analyzed/notes.md
- **To-do list:** @docs/analyzed/todo.md

## Subagents

Use the following sub-agents in parallel, if available.

- **Code Review:** `code-reviewer`
- **Test:** `code-tester`

## Commands

```bash
# Build (compile TypeScript to out/)
pnpm compile

# Watch mode
pnpm watch

# Lint with Biome
pnpm lint

# Lint with auto-fix
pnpm lint:fix

# Run all tests (requires VS Code environment via @vscode/test-electron)
pnpm test

# Run unit tests only (no VS Code environment needed)
pnpm test:unit

# Type check without emit
pnpm exec tsc --noEmit

# Package as .vsix
pnpm package

# Install/uninstall extension locally
pnpm install:vscode
pnpm uninstall:vscode
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
