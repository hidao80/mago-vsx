---
name: analyzed-components
description: Detailed explanation of the repository's main components and their responsibilities.
type: analysis
---

# Components

## Architecture Overview

```
User Command / onDidSaveTextDocument
    ↓
extension.ts  — activation, command registration, on-save listener
    ↓
MagoRunner    — subprocess management, CLI argument construction, diagnostic merging
    ↓
MagoOutputParser — JSON / text parsing, path normalisation, Diagnostic creation
    ↓
vscode.DiagnosticCollection — Problems pane
```

---

## extension.ts

**Role**: Extension entry point. Owns the two long-lived VS Code resources and wires everything together.

### Lifecycle

| Export | Behaviour |
|---|---|
| `activate(context)` | Creates `DiagnosticCollection("mago")`, `OutputChannel("Mago")`, and a `MagoRunner` instance. Registers all 11 commands. Attaches `onDidSaveTextDocument` listener. All disposables registered via `context.subscriptions`. |
| `deactivate()` | Empty body — all disposables are cleaned up automatically via `context.subscriptions`. |

### Imports

`isValidBaselinePath` is **imported** from `./magoRunner` (not defined locally). `extension.ts` defines no validation logic of its own.

### Module-level State

```typescript
const formattingUris = new Set<string>();
```

Used to guard against re-entrant `onDidSaveTextDocument` fires triggered by `formatOnSave` write-backs (fix for Bug #13).

### On-Save Listener

Fires for every saved document. Skips non-PHP files. Uses `formattingUris` to skip the re-fire caused by format writing. Reads `lintOnSave`, `analyzeOnSave`, `formatOnSave` from config. Execution order:

1. Run `mago fmt` if `formatOnSave` is true (with `formattingUris` guard).
2. Clear the per-file `DiagnosticCollection` entry if `lintOnSave` **or** `analyzeOnSave` is true.
3. Run `mago lint` if `lintOnSave` is true.
4. Run `mago analyze` if `analyzeOnSave` is true.

### Commands

See [screens.md](screens.md) for the full command table. Guard: file-scoped commands check `editor.document.languageId === "php"` before delegating to `MagoRunner`. Baseline commands validate the user-supplied path via `isValidBaselinePath` (imported from `./magoRunner`) and show an error message if validation fails.

---

## MagoRunner (`src/magoRunner.ts`)

**Role**: Spawns the `mago` subprocess and maps results into the shared `DiagnosticCollection`. Implements `vscode.Disposable`.

### Module-level Exports

In addition to the class, `magoRunner.ts` exports two validator functions:

| Function | Description |
|---|---|
| `isValidBaselinePath(inputPath)` | Validates baseline file paths; rejects `..` segments, absolute paths, and shell metacharacters including `%`. Imported by `extension.ts`. |
| `isValidExecutablePath(executablePath)` | Validates the `mago.executablePath` setting; rejects shell metacharacters. Called inside `spawnMago` before every spawn. |

### Constructor

```typescript
new MagoRunner(diagnosticCollection: vscode.DiagnosticCollection, outputChannel: vscode.OutputChannel)
```

Internally creates a `MagoOutputParser` instance. All three fields are `private readonly`.

### Public API

| Method | Description |
|---|---|
| `runLint(fileUri)` | Lint a single PHP file |
| `runAnalyze(fileUri)` | Analyze a single PHP file |
| `runLintProject()` | Lint the entire workspace (`.`) |
| `runAnalyzeProject()` | Analyze the entire workspace (`.`) |
| `runFormat(fileUri)` | Format a single PHP file |
| `runFormatProject()` | Format the entire workspace |
| `runFormatCheck()` | Dry-run format check (`fmt --check .`) |
| `runGenerateLintBaseline(path)` | Generate lint baseline at the given path |
| `runGenerateAnalyzeBaseline(path)` | Generate analyze baseline at the given path |
| `dispose()` | No-op; exists for future-safe cleanup via `vscode.Disposable` |

### Key Private Methods

| Method | Description |
|---|---|
| `runMagoCommand(cmd, fileUri)` | Single-file diagnostic command; checks workspace folder |
| `runMagoProjectCommand(cmd)` | Project-wide diagnostic command; guards against missing workspace |
| `runFormatCommand(target, fileUri?)` | Format a file or project |
| `runFormatCheckCommand()` | Format check (CI mode) |
| `runGenerateBaselineCommand(cmd, path)` | Baseline generation |
| `buildDiagnosticCommandArgs(cmd, config)` | Constructs `[cmd, "--reporting-format", "json", ...]` with optional `--baseline` |
| `spawnMago(args, cwd?)` | Wraps `child_process.spawn`; validates executable path, applies 60 s timeout, `shell: process.platform === "win32"` |
| `logOutput(output, cmd)` | Appends raw output to the output channel |
| `mergeDiagnostics(fileUri, newDiagnostics)` | Appends new diagnostics to existing collection entry |
| `handleMagoOutput(output, fileUri, cmd)` | Parses single-file output and merges into `DiagnosticCollection` |
| `handleMagoProjectOutput(output, cwd, cmd)` | Parses project output and merges per-file |
| `checkForErrors(output, cmd)` | Dispatches to `handleDatabaseError`, `handleTomlError`, `handleGenericError` in order |
| `handleDatabaseError(stderr, cmd)` | Detects `"Failed to load database"` in stderr; shows database-access error notification |
| `handleTomlError(stderr, cmd)` | Detects `"Failed to build the configuration"` in stderr; shows TOML parse error notification |
| `handleGenericError(stderr, cmd)` | Detects `\bERROR\b` lines in stderr; shows generic execution error notification |
| `notifyDiagnosticResult(count, ...)` | Shows info/warning message summarising results |
| `showConfigurationError(command, details?)` | Shows TOML error dialog; `void` keyword suppresses floating Thenable warning |
| `getWorkspaceFolder(fileUri)` | Returns workspace folder URI for a file |
| `getFirstWorkspaceFolder()` | Returns first workspace folder URI |

### Diagnostic Merging

`mergeDiagnostics` always **appends** into existing entries:

```typescript
const existing = this.diagnosticCollection.get(fileUri) ?? [];
this.diagnosticCollection.set(fileUri, [...existing, ...newDiagnostics]);
```

The caller (`extension.ts`) is responsible for clearing before running commands to prevent accumulation.

### spawnMago Notes

- Validates `mago.executablePath` via `isValidExecutablePath` before spawning; returns early with an error notification if invalid.
- Applies a 60-second `timeout` option to prevent indefinite hangs.
- Uses `shell: process.platform === "win32"` (conditionally enabled on Windows for PATH resolution).
- A `resolved` flag prevents double-resolution when both `error` and `close` events fire.

### Result Notifications

| Condition | File command | Project command |
|---|---|---|
| Issues found | Shows count message | Shows count + file count message |
| No issues, empty output | Silent | Shows "No issues found" |
| No issues, valid JSON | Silent | Shows "No issues found" |
| Invalid JSON output | Shows warning | Shows warning |

---

## MagoOutputParser (`src/magoOutputParser.ts`)

**Role**: Parses raw mago subprocess output into `vscode.Diagnostic[]` or `Map<string, vscode.Diagnostic[]>`.

### Public API

| Method | Signature | Description |
|---|---|---|
| `parse` | `(output, fileUri) → Diagnostic[]` | Single-file parse (JSON first, text fallback) |
| `parseProject` | `(output, workspaceFolder) → Map<string, Diagnostic[]>` | Project-wide parse, groups by absolute file path |

### JSON Formats Supported

| Shape | Detection |
|---|---|
| Bare array | `Array.isArray(jsonData)` |
| `{ issues: [...] }` wrapper | `jsonData.issues && Array.isArray(jsonData.issues)` |
| Single object | fallback |

### Text Format

Regex: `/^(.+?):(\d+)(?::(\d+))?:\s*(error|warning|info|hint):\s*(.+)$/`

Supports paths with or without column number.

### Path Normalisation

1. Converts backslashes to forward slashes
2. Strips Windows extended path prefix `\\?\` via `rawPath.replace(/^\\\\\\?\\/, "")`
3. Detects absolute vs relative paths (`path.isAbsolute` or `/^[a-zA-Z]:/` test)
4. Joins relative paths with `workspaceFolder`
5. Normalises separators with `path.normalize`

### Severity Mapping

| Mago level/text | `vscode.DiagnosticSeverity` |
|---|---|
| `error` / `Error` | `Error` (0) |
| `warning` / `Warning` | `Warning` (1) |
| `info` / `Info` | `Information` (2) |
| `hint` / `Hint` | `Hint` (3) |
| _(unknown)_ | `Error` |

A single `severityToVSCode` method handles both text and JSON severity strings (case-insensitive). The previously duplicate `magoLevelToVSCode` has been removed (Bug #3 fixed).

### Related Information

Notes (`json.notes[]`) and help text (`json.help`) are attached as `DiagnosticRelatedInformation` entries prefixed with `"Note: "` and `"Help: "` respectively. All entries reference the same location as the parent diagnostic.

### Span End Positions

When JSON output includes end positions in the annotation span, they are used to create a precise `Range`. End line/column are stored in `MagoIssue.endLine` and `MagoIssue.endColumn` (both 0-indexed) and applied in `issueToDiagnostic`.

<!-- updated at d40c941 -->
