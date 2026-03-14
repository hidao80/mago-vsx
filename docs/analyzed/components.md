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
| `activate(context)` | Creates `DiagnosticCollection("mago")`, `OutputChannel("Mago")`, and a `MagoRunner` instance. Registers all 11 commands. Attaches `onDidSaveTextDocument` listener. |
| `deactivate()` | Disposes `DiagnosticCollection` and `OutputChannel`. (`MagoRunner` has no disposable resources.) |

### Helper: `isValidBaselinePath(path: string): boolean`

Module-level validator called before passing user-supplied baseline paths to the runner. Rejects:
- Empty / falsy strings
- Path traversal sequences (`..`)
- Absolute paths (Unix `/…` or Windows `C:\…`)
- Shell metacharacters: `&`, `|`, `;`, `<`, `>`, `$`, `` ` ``, `!`, `*`, `?`, `()`, `[]`, `{}`

Returns `true` only when the path passes all checks.

### On-Save Listener

Fires for every saved document. Skips non-PHP files. Reads `lintOnSave`, `analyzeOnSave`, `formatOnSave` from config. Execution order:

1. Run `mago fmt` if `formatOnSave` is true.
2. Clear the per-file `DiagnosticCollection` entry if `lintOnSave` **or** `analyzeOnSave` is true (prevents accumulation across saves).
3. Run `mago lint` if `lintOnSave` is true.
4. Run `mago analyze` if `analyzeOnSave` is true.

### Commands

See [screens.md](screens.md) for the full command table. Guard: file-scoped commands check `editor.document.languageId === "php"` before delegating to `MagoRunner`. Baseline commands validate the user-supplied path via `isValidBaselinePath` and show an error message if validation fails.

---

## MagoRunner (`src/magoRunner.ts`)

**Role**: Spawns the `mago` subprocess and maps results into the shared `DiagnosticCollection`.

### Constructor

```typescript
new MagoRunner(diagnosticCollection: vscode.DiagnosticCollection, outputChannel: vscode.OutputChannel)
```

Internally creates a `MagoOutputParser` instance.

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

### Key Private Methods

| Method | Description |
|---|---|
| `buildDiagnosticCommandArgs(cmd, config)` | Constructs `[cmd, "--reporting-format", "json", ...]` with optional `--baseline` |
| `spawnMago(args, cwd?)` | Wraps `child_process.spawn` with `{ cwd }` only (no `shell` option); returns `SpawnResult` |
| `handleMagoOutput(output, fileUri, cmd)` | Parses single-file output and **merges** into `DiagnosticCollection` |
| `handleMagoProjectOutput(output, cwd, cmd)` | Parses project output and merges per-file |
| `checkForErrors(output, cmd)` | Detects `"ERROR"` / TOML errors; shows appropriate notifications |
| `notifyDiagnosticResult(count, ...)` | Shows info/warning message summarising results |
| `showConfigurationError(command, details?)` | Shows TOML error dialog; `.then()` callback handles "Show Output" button (Promise not awaited) |

### Diagnostic Merging

Both `runLint` and `runAnalyze` **merge** (append) into existing entries:

```typescript
const existing = this.diagnosticCollection.get(fileUri) || [];
this.diagnosticCollection.set(fileUri, [...existing, ...newDiagnostics]);
```

The caller (`extension.ts`) is responsible for clearing before running commands to prevent accumulation.

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
2. Strips Windows extended path prefix `\\?\` via `rawPath.replace(/^\\\\\?\\/, "")`
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

Two private methods exist for the same mapping: `severityToVSCode` (text format) and `magoLevelToVSCode` (JSON format). Both behave identically — this is a known maintenance hazard (see known_bugs.md #3).

### Related Information

Notes (`json.notes[]`) and help text (`json.help`) are attached as `DiagnosticRelatedInformation` entries prefixed with `"Note: "` and `"Help: "` respectively. All entries reference the same location as the parent diagnostic.

<!-- updated at a4509d9 -->
