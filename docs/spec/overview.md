# Project Overview

## Summary

**mago-vsx** is a VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) — a PHP static analysis tool — into the VS Code editor. It surfaces lint and analysis results as native VS Code diagnostics in the Problems pane, and provides formatting and baseline generation commands.

- **Extension ID**: `hidao80.mago-vsx`
- **Version**: 0.2.0
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
| `src/magoRunner.ts` | Subprocess execution, CLI arg construction, diagnostic merging |
| `src/magoOutputParser.ts` | Output parsing (JSON + text), path normalisation, severity mapping |
| `src/types.ts` | Shared type definitions |

## Test Files

| File | Coverage |
|---|---|
| `src/test/suite/magoOutputParser.test.ts` | Parser: JSON/text formats, path normalisation, severity, edge cases |
| `src/test/suite/magoRunner.test.ts` | Runner: instance creation, configuration, DiagnosticCollection, OutputChannel, error handling |
| `src/test/runTest.ts` | Downloads VS Code and runs integration suite via `@vscode/test-electron` |
| `src/test/suite/index.ts` | Mocha TDD runner; discovers `*.test.js` in `out/test/suite/` |

## CI Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `build.yml` | push to master/main/develop | Compile, type-check, build VSIX artifact |
| `lint.yml` | push to master/main/develop | Biome lint |
| `audit.yml` | push to master/main/develop | `pnpm audit` + `pnpm outdated` |
| `test.yml` | push to master/main/develop | Compile + xvfb VS Code test suite |

All workflows use `ubuntu-slim` (except `test.yml` which uses `ubuntu-latest`) and include `flatt-security/setup-takumi-guard-npm` for supply-chain security scanning.

## Security Model

- No external network communication
- No data persistence beyond VS Code's in-memory `DiagnosticCollection`
- `child_process.spawn` with array args (no shell injection)
- `pnpm.overrides` pins known-vulnerable transitive dependencies

<!-- created at d1374d8 -->
