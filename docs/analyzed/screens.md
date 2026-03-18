---
name: analyzed-screens
description: Overview of user-facing screens, views, or VS Code surfaces used by the extension.
type: analysis
---

# Screens / UI Entry Points

This extension has no custom webview or panel UI. All user-facing surfaces are provided by the VS Code API.

## Command Palette

All 11 commands are registered and accessible via `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS):

| Command ID | Title | Scope |
|---|---|---|
| `mago.lintCurrentFile` | Mago: Lint Current File | Active PHP file |
| `mago.analyzeCurrentFile` | Mago: Analyze Current File | Active PHP file |
| `mago.lintAndAnalyzeCurrentFile` | Mago: Lint & Analyze Current File | Active PHP file |
| `mago.lintProject` | Mago: Lint Project | Entire workspace |
| `mago.analyzeProject` | Mago: Analyze Project | Entire workspace |
| `mago.lintAndAnalyzeProject` | Mago: Lint & Analyze Project | Entire workspace |
| `mago.formatCurrentFile` | Mago: Format Current File | Active PHP file |
| `mago.formatProject` | Mago: Format Project | Entire workspace |
| `mago.formatCheck` | Mago: Format Check (CI) | Entire workspace |
| `mago.generateLintBaseline` | Mago: Generate Lint Baseline | Entire workspace |
| `mago.generateAnalyzeBaseline` | Mago: Generate Analyze Baseline | Entire workspace |

Guard condition: file-scoped commands show a warning message if the active editor is not a PHP file.

## Problems Pane

Diagnostics are pushed to a single `vscode.DiagnosticCollection` named `"mago"` and appear in VS Code's built-in Problems pane. Each diagnostic includes:
- Range (line/column, 0-indexed internally)
- Severity (Error / Warning / Information / Hint)
- Message
- Source: `"mago"`
- Code (e.g. rule ID, when available)
- Related information: `Note:` and `Help:` entries as collapsible items

## Output Channel

A `vscode.OutputChannel` named `"Mago"` logs raw mago subprocess output and parse summaries. It is shown automatically on error or format-check failure.

## Notification Messages

| Situation | Type | Message pattern |
|---|---|---|
| Issues found | Information | `Mago {cmd}: Found N issue(s) [in M file(s)]` |
| No issues (project) | Information | `Mago {cmd}: No issues found` |
| No issues (file) | _(silent)_ | No message shown |
| Unexpected output | Warning | `Mago {cmd}: Output received but no issues parsed. Check "Mago" output channel.` |
| Format success | Information | `Mago fmt: [File/Project] formatted successfully` |
| Format check pass | Information | `Mago fmt --check: All files are correctly formatted` |
| Format check fail | Warning | `Mago fmt --check: Some files need formatting. …` |
| Execution error | Error | `Mago {cmd}: Execution error occurred. …` |
| TOML error (with location) | Error | `Mago {cmd}: Configuration error in mago.toml at line X, column Y. …` |
| TOML error (no location) | Error | `Mago {cmd}: Failed to build configuration. …` |
| No workspace | Error | `No workspace folder open` |
| Invalid baseline path | Error | `Invalid baseline path. Check for path traversal ('..'), absolute paths, or special characters.` |

## Input Box (Baseline Generation)

When `mago.generateLintBaseline` or `mago.generateAnalyzeBaseline` is invoked and the corresponding baseline config key is empty, VS Code's `showInputBox` prompts for a file path:
- Lint default: `lint-baseline.toml`
- Analyze default: `analysis-baseline.toml`

The entered path is validated by `isValidBaselinePath` before being forwarded to the runner. Invalid paths (containing `..`, absolute paths, or shell metacharacters) are rejected with an error notification and the command is aborted.

<!-- updated at a4509d9 -->
