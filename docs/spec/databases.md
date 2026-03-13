# Databases / Persistence

## No Persistent Storage

This extension has **no database and no persistent data storage** of any kind:

- No IndexedDB
- No localStorage
- No file writes at runtime (except baseline TOML generation, which is an explicit user action)
- No network requests

## In-Memory State

The only runtime state is held in two VS Code API objects, both disposed on deactivation:

| Object | Type | Lifetime | Contents |
|---|---|---|---|
| `diagnosticCollection` | `vscode.DiagnosticCollection` | Extension session | Per-file `vscode.Diagnostic[]` arrays shown in Problems pane |
| `outputChannel` | `vscode.OutputChannel` | Extension session | Raw subprocess output and parse summaries |

## Baseline Files (User-Generated)

When the user runs `mago.generateLintBaseline` or `mago.generateAnalyzeBaseline`, the `mago` binary itself writes a TOML file at the specified path. The extension only invokes the subprocess — it does not read or write the file directly.

<!-- created at d1374d8 -->
