---
name: project-architecture
description: High-level architecture, key files, and test layout for this repository
type: reference
---

# Architecture

## Core data flow

```text
User Command / onDidSaveTextDocument
    -> extension.ts
    -> magoRunner.ts
    -> magoOutputParser.ts
    -> vscode.DiagnosticCollection
```

- `src/extension.ts`: Entry point. Registers commands, save listeners, and shared VS Code services.
- `src/magoRunner.ts`: Spawns the `mago` process, builds CLI arguments, and handles execution errors.
- `src/magoOutputParser.ts`: Parses JSON and text output, normalizes Windows paths, and converts issues into `vscode.Diagnostic[]`.
- `src/types.ts`: Shared types for commands, process results, and parsed Mago output.

## Key files

- `src/extension.ts`: Activates on `onLanguage:php`, wires the runner, and controls save-time ordering for format, lint, and analyze.
- `src/magoRunner.ts`: Adds flags like `--reporting-format json` and `--baseline`, detects TOML parse errors, and merges lint/analyze diagnostics.
- `src/magoOutputParser.ts`: Supports array, wrapper-object, and single-object JSON shapes and strips the Windows `\\?\` prefix.
- `src/types.ts`: Defines `MagoCommand`, `SpawnResult`, `MagoIssue`, and raw JSON structures used by the parser.

## Test structure

- `src/test/suite/magoOutputParser.test.ts`: Unit coverage for parser behavior, path normalization, severities, and output format handling.
- `src/test/suite/magoRunner.test.ts`: Unit coverage for command construction, configuration handling, baselines, and error paths.
- `src/test/runTest.ts`: Launches the VS Code integration suite via `@vscode/test-electron`.
- `src/test/suite/index.ts`: Mocha TDD bootstrap that discovers compiled test files in `out/test/suite/`.
