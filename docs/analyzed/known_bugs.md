# Known Bugs

## Active Issues

### 1. Duplicate diagnostics on simultaneous lint + analyze (per-file commands)

**Location**: `src/extension.ts` on-save listener; `src/magoRunner.ts` `handleMagoOutput`

**Description**: `MagoRunner.handleMagoOutput` always **merges** (appends) new diagnostics into the existing `DiagnosticCollection` entry. When `lintOnSave` and `analyzeOnSave` are both true, `extension.ts` pre-clears the entry. However, when calling `mago.lintCurrentFile` and `mago.analyzeCurrentFile` as separate commands in rapid succession, the extension does **not** clear between them, potentially doubling up diagnostics.

**Impact**: Low — only affects back-to-back manual command invocations, not on-save.

---

### 2. Project-level commands also merge without clearing

**Location**: `src/magoRunner.ts` `handleMagoProjectOutput`

**Description**: Project commands merge diagnostics per file. Running `mago.lintProject` followed by `mago.analyzeProject` (or `mago.lintAndAnalyzeProject` which only clears once at the project level) accumulates correctly for the combined command, but repeated invocations without a manual "clear" will stack diagnostics.

**Workaround**: Reload the window or run `mago.lintAndAnalyzeProject` (which calls `diagnosticCollection.clear()` before both runs).

---

### 3. `severityToVSCode` and `magoLevelToVSCode` are duplicate methods

**Location**: `src/magoOutputParser.ts` lines ~360–395

**Description**: Two private methods implement identical case-insensitive severity mapping. Not a runtime bug, but a maintenance hazard.

---

### ~~4. Diagnostic accumulation when only one of lintOnSave / analyzeOnSave is enabled~~ ✅ Fixed

**Location**: `src/extension.ts` line 201

**Fix**: Changed `if (lintOnSave && analyzeOnSave)` to `if (lintOnSave || analyzeOnSave)` so that `diagnosticCollection.delete(uri)` is called before any on-save diagnostic command runs, regardless of which flags are enabled.

---

### 5. Missing input validation for `baselinePath` user input

**Location**: `src/extension.ts` lines 111–124, 133–146 (`generateLintBaseline` / `generateAnalyzeBaseline`)

**Description**: `showInputBox` accepts arbitrary user input that is passed directly as a CLI argument to the mago subprocess without any validation or sanitization. On Windows (`shell: true`), a crafted value such as `; rm -rf /` or a path-traversal string such as `../../etc/passwd` could cause unintended behavior.

**Impact**: High — arbitrary input reachable by the user is forwarded to a shell-spawned process.

---

### 6. Shell injection risk via file path on Windows

**Location**: `src/magoRunner.ts` lines 199–203 (`spawnMago`)

**Description**: On Windows, mago is spawned with `shell: true`. All elements of the `args` array — including `fileUri.fsPath` and `baselinePath` — are expanded by the shell. A file path containing shell metacharacters (`&`, `|`, `;`, `%`) could cause unintended commands to run.

**Impact**: High — exploitable only with a crafted workspace file path, but the combination with issue #5 (unvalidated `baselinePath`) makes this reachable.

---

### 7. `workspaceFolder` is not checked for `undefined` in `runMagoCommand`

**Location**: `src/magoRunner.ts` lines 58–71

**Description**: `getWorkspaceFolder` may return `undefined` when a file is opened outside any workspace folder. `runMagoProjectCommand` guards against this, but `runMagoCommand` passes the result directly to `spawnMago` without checking. The subprocess starts with `cwd: undefined` (falls back to the process's working directory), which may produce incorrect relative-path resolution.

**Impact**: Medium — only triggered when linting/analyzing files outside the workspace root.

---

### 8. Unhandled Promise from `showErrorMessage` / `showWarningMessage`

**Location**: `src/magoRunner.ts` lines 369–376, 395–399 (`checkForErrors`, `showConfigurationError`)

**Description**: `vscode.window.showErrorMessage(...).then(...)` is not `await`-ed. If the `.then()` callback throws, the error is silently swallowed. The method is synchronous so it cannot `await`, but the floating Promise prevents proper error propagation.

**Impact**: Low — silent failure only on rare secondary errors inside the callback.

---

### 9. `"ERROR"` string matching in `checkForErrors` is over-broad

**Location**: `src/magoRunner.ts` lines 338–340

**Description**: `output.includes("ERROR")` will match any occurrence of the string, including PHP class names (e.g. `ERROR_CODE`) or legitimate mago output that happens to contain the word. This may suppress valid diagnostics by treating normal output as an error condition.

**Impact**: Medium — false positives possible; actual severity depends on mago's output format.

---

### 10. `MagoRunner` is not disposed on extension deactivation

**Location**: `src/extension.ts` lines 184–191 (`deactivate`), `src/magoRunner.ts`

**Description**: `diagnosticCollection` and `outputChannel` are disposed in `deactivate`, but `magoRunner` is never added to `context.subscriptions` and has no `dispose()` method. If `MagoRunner` acquires long-lived resources in the future (e.g. file watchers, persistent child processes), they will leak on deactivation.

**Impact**: Low — no current leak; risk is forward-looking.

---

### 11. `||` operator causes false fallback when line/column is `0` in `magoOutputParser`

**Location**: `src/magoOutputParser.ts` lines 174–175, 207–210, 292–293

**Description**: `(start?.line || 1) - 1` uses `||` which treats `0` as falsy and falls back to `1`. If mago returns `line: 0` or `column: 0`, the calculation silently produces `0` by coincidence, but the intent is wrong. The same pattern appears in `parseLineToIssue`, `parseJsonIssue`, and `jsonToIssue`. The `endColumn` calculation (`(end?.column || (start?.column || 1) + 1) - 1`) is additionally wrong when `end.column` is `0`.

**Impact**: Medium — produces incorrect diagnostics positions for edge-case mago output.

---

### 12. Double `resolve()` call when child process emits `error` then `close`

**Location**: `src/magoRunner.ts` lines 214–221 (`spawnMago`)

**Description**: Node.js fires the `error` event followed by the `close` event on process spawn failure. Both handlers call `resolve()`, meaning the Promise resolves twice. The second call is silently ignored by the Promise spec, but the `close` handler returns partially accumulated `stdout`/`stderr` while the `error` handler returns empty strings — the order of resolution is indeterminate.

**Impact**: Low — second resolve is a no-op; no observable data corruption in practice, but the logic is fragile.

---

### 13. `formatOnSave` may trigger lint/analyze twice via re-save event

**Location**: `src/extension.ts` lines 196–211 (`onDidSaveTextDocument`)

**Description**: `runFormat` invokes mago, which writes the formatted content back to disk. This write causes VS Code to fire `onDidSaveTextDocument` again for the same file. If `lintOnSave` or `analyzeOnSave` is also enabled, lint/analyze runs once from the first save and again from the format-induced re-save, doubling execution and potentially causing stale diagnostics from the pre-format content.

**Impact**: Medium — double execution on save with `formatOnSave` + `lintOnSave`/`analyzeOnSave` enabled simultaneously.

---

### 14. `isValidBaselinePath` matches `"foo..bar"` as a path-traversal attempt

**Location**: `src/extension.ts` lines 8–26 (`isValidBaselinePath`)

**Description**: The guard uses `path.includes("..")` which matches any occurrence of two consecutive dots, rejecting legitimate file names like `"baseline..backup.toml"`. Conversely, URL-encoded traversal (`%2e%2e`) is not checked. The correct approach is a per-segment check against the normalized path.

**Impact**: Low — false rejection of unusual but valid filenames; encoded traversal is not a practical concern since `shell` is not always true.

---

### 15. `baselinePath` from settings is not validated in normal lint/analyze execution

**Location**: `src/magoRunner.ts` lines 184–189 (`buildDiagnosticCommandArgs`)

**Description**: `isValidBaselinePath` is called when the user types a baseline path via `showInputBox` (generate commands), but when the stored `mago.lintBaseline` / `mago.analyzeBaseline` setting is read and forwarded to `--baseline`, no validation occurs. A malicious workspace `.vscode/settings.json` could supply a crafted baseline path.

**Impact**: Medium — requires a compromised workspace settings file; `spawn` without `shell: true` mitigates injection risk, but path traversal to unintended files remains.

---

## Remarks from Test Code

The runner test suite (`magoRunner.test.ts`) tests `runLintProject` and `runAnalyzeProject` for "no workspace folder" by asserting that they **do not reject** — they may silently do nothing or show an error message. This means the test does not catch regressions where the command throws instead of calling `showErrorMessage`.

Additionally, the suite's `Integration with VS Code` group asserts fixed integer values for `vscode.DiagnosticSeverity` enum members. These tests verify VS Code internal implementation constants rather than extension behaviour and provide no meaningful regression coverage.

Core business logic in `MagoRunner` (argument building, TOML error detection, diagnostic merging, result notification) has no dedicated unit tests.

The `glob` package used in `src/test/suite/index.ts` is not listed as an explicit `devDependency` — it arrives as a transitive dependency of `@vscode/test-electron`. A version bump could silently break the test runner.

<!-- updated after code-reviewer audit 2026-03-14 -->
