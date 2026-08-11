---
name: analyzed-overview
description: High-level summary of the repository structure, behavior, and execution flow.
type: analysis
---

# Project Overview

## Summary

**mago-vsx** is a VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) — a PHP static analysis tool — into the VS Code editor. It surfaces lint and analysis results as native VS Code diagnostics in the Problems pane, and provides formatting and baseline generation commands.

- **Extension ID**: `hidao80.mago-vsx`
- **Version**: 0.4.0
- **Activation event**: `onLanguage:php`
- **Minimum VS Code**: 1.80.0
- **License**: MIT
- **Language**: TypeScript (ES2020, strict)
- **Package manager**: pnpm 9.0.0
- **Linter**: Biome

## Core Data Flow

```
User Command / onDidSaveTextDocument
    ↓
extension.ts  → Registers 11 commands, manages DiagnosticCollection + OutputChannel
    ↓
MagoRunner    → Spawns mago subprocess, builds CLI args, handles errors
    ↓
MagoOutputParser → Parses JSON/text, normalises Windows paths, produces Diagnostic[]
    ↓
vscode.DiagnosticCollection → Displayed in Problems pane
```

## Key Source Files

| File | Role |
|---|---|
| `src/extension.ts` | Entry point; activation, command registration, on-save listener |
| `src/magoRunner.ts` | Subprocess execution, CLI arg construction, diagnostic merging; exports `isValidBaselinePath` and `isValidExecutablePath` |
| `src/magoOutputParser.ts` | Output parsing (JSON + text), path normalisation, severity mapping |
| `src/types.ts` | Shared type definitions |

## Test Files

| File | Coverage |
|---|---|
| `src/test/suite/magoOutputParser.test.ts` | Parser: JSON/text formats, path normalisation, severity, edge cases, legacy format, span end positions |
| `src/test/suite/magoRunner.test.ts` | Runner: instance creation, configuration, `buildDiagnosticCommandArgs`, `mergeDiagnostics`, `checkForErrors`, `notifyDiagnosticResult`, `isValidBaselinePath`, DiagnosticCollection, OutputChannel |
| `src/test/unit/magoOutputParser.unit.test.ts` | Unit-level parser tests (Playwright; no VS Code host required) |
| `src/test/unit/isValidBaselinePath.test.ts` | Boundary tests for the exported `isValidBaselinePath` function |
| `src/test/unit/setup.ts` | VS Code mock registered into Node's require cache before production code loads |

**Note**: `src/test/runTest.ts` and `src/test/suite/index.ts` have been removed. The test runner migrated from `@vscode/test-electron` + Mocha to **Playwright** (`playwright.config.ts`).

## CI Workflows

| Workflow | Trigger | Runner | Purpose |
|---|---|---|---|
| `build.yml` | push to master/main/develop | ubuntu-slim | Compile, type-check, build VSIX artifact |
| `lint.yml` | push to master/main/develop | ubuntu-slim | Biome lint |
| `audit.yml` | push to master/main/develop | ubuntu-slim | `pnpm audit` + `pnpm outdated` |
| `test.yml` | push to master/main/develop | ubuntu-latest | Compile + xvfb Playwright test suite |

All workflows use `flatt-security/setup-takumi-guard-npm` for supply-chain security scanning. Pull-request triggers are not currently configured (push-only).

## Security Model

- No external network communication
- No data persistence beyond VS Code's in-memory `DiagnosticCollection`
- `child_process.spawn` with array args; `shell` option is `true` only on Windows (for PATH resolution)
- `isValidBaselinePath` and `isValidExecutablePath` validate user-supplied paths before subprocess invocation
- Settings-sourced baseline paths also validated in `buildDiagnosticCommandArgs`
- `pnpm.overrides` pins known-vulnerable transitive dependencies

<!-- updated at d40c941 -->
