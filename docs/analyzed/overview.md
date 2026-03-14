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
| `src/extension.ts` | Entry point; activation, command registration, on-save listener, `isValidBaselinePath` validator |
| `src/magoRunner.ts` | Subprocess execution, CLI arg construction, diagnostic merging |
| `src/magoOutputParser.ts` | Output parsing (JSON + text), path normalisation, severity mapping |
| `src/types.ts` | Shared type definitions |

## Test Files

| File | Coverage |
|---|---|
| `src/test/suite/magoOutputParser.test.ts` | Parser: JSON/text formats, path normalisation, severity, edge cases |
| `src/test/suite/magoRunner.test.ts` | Runner: instance creation, configuration, DiagnosticCollection, OutputChannel, error handling |
| `src/test/runTest.ts` | Downloads VS Code and runs integration suite via `@vscode/test-electron` |
| `src/test/suite/index.ts` | Mocha TDD runner; discovers `**/**.test.js` in `out/test/` |

## CI Workflows

| Workflow | Trigger | Runner | Purpose |
|---|---|---|---|
| `build.yml` | push to master/main/develop | ubuntu-slim | Compile, type-check, build VSIX artifact |
| `lint.yml` | push to master/main/develop | ubuntu-slim | Biome lint |
| `audit.yml` | push to master/main/develop | ubuntu-slim | `pnpm audit` + `pnpm outdated` |
| `test.yml` | push to master/main/develop | ubuntu-latest | Compile + xvfb VS Code test suite |

All workflows use `flatt-security/setup-takumi-guard-npm` for supply-chain security scanning. Pull-request triggers are not currently configured (push-only).

## Security Model

- No external network communication
- No data persistence beyond VS Code's in-memory `DiagnosticCollection`
- `child_process.spawn` with array args and no `shell` option (no shell injection)
- `isValidBaselinePath` validates user-supplied baseline paths before subprocess invocation
- `pnpm.overrides` pins known-vulnerable transitive dependencies

<!-- updated at a4509d9 -->
