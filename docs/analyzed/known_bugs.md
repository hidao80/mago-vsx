---
name: analyzed-known-bugs
description: Catalog of known bugs, limitations, and currently unresolved behavior.
type: analysis
---

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

### 20. `shell: true` on Windows re-introduces metacharacter risk

**Location**: `src/magoRunner.ts` `spawnMago` line ~390

**Description**: `spawnMago` uses `shell: process.platform === "win32"`. While `isValidExecutablePath` and `isValidBaselinePath` block obvious metacharacters, enabling the shell on Windows means any unvalidated string that reaches `spawnMago` via future code paths could still be subject to shell expansion. The mitigation depends entirely on the validators remaining comprehensive and being applied consistently.

**Impact**: Low — current call sites all pass validated or hard-coded arguments, and `isValidExecutablePath` is called inside `spawnMago` before spawning.

---

### 21. `magoRunner` not registered in `context.subscriptions`

**Location**: `src/extension.ts` `activate`

**Description**: `MagoRunner` implements `vscode.Disposable` with a no-op `dispose()`, but the instance is not pushed to `context.subscriptions` in `activate()`. `deactivate()` is empty and relies on VS Code's automatic cleanup. If `MagoRunner.dispose()` is given real cleanup logic in the future (e.g. file watchers, persistent processes), those resources will leak on deactivation.

**Impact**: None currently — `dispose()` is a no-op. Risk is forward-looking.

---

## Fixed Issues (archive)

### ~~3. `severityToVSCode` and `magoLevelToVSCode` are duplicate methods~~ ✅ Fixed

**Location**: `src/magoOutputParser.ts`

**Fix**: `magoLevelToVSCode` deleted; calls unified to `severityToVSCode`.

---

### ~~4. Diagnostic accumulation when only one of lintOnSave / analyzeOnSave is enabled~~ ✅ Fixed

**Location**: `src/extension.ts` line ~215

**Fix**: Changed `if (lintOnSave && analyzeOnSave)` to `if (lintOnSave || analyzeOnSave)`.

---

### ~~5. Missing input validation for `baselinePath` user input~~ ✅ Fixed

**Fix**: `isValidBaselinePath` added (now exported from `magoRunner.ts`).

---

### ~~6. Shell injection risk via file path on Windows~~ ✅ Partially fixed

**Fix**: `shell: true` removed unconditionally; re-introduced as `shell: process.platform === "win32"` for PATH resolution. See Bug #20 above.

---

### ~~7. `workspaceFolder` is not checked for `undefined` in `runMagoCommand`~~ ✅ Fixed

**Fix**: Added explicit `undefined` check; logs warning to output channel when file is outside workspace.

---

### ~~8. Unhandled Promise from `showErrorMessage` / `showWarningMessage`~~ ✅ Fixed

**Fix**: `void` keyword applied to all floating Thenables from VS Code window messages.

---

### ~~9. `"ERROR"` string matching in `checkForErrors` is over-broad~~ ✅ Fixed

**Fix**: Replaced `includes("ERROR")` with `/\bERROR\b/i` word-boundary test.

---

### ~~10. `MagoRunner` is not disposed on extension deactivation~~ ✅ Partially fixed

**Fix**: `dispose()` method added and `MagoRunner` implements `vscode.Disposable`. However, the instance is not yet registered in `context.subscriptions` (see Bug #21).

---

### ~~11. `||` operator causes false fallback when line/column is `0`~~ ✅ Fixed

**Fix**: Replaced `||` with `??` for line/column defaults in `parseJsonIssue` and `jsonToIssue`.

---

### ~~12. Double `resolve()` call when child process emits `error` then `close`~~ ✅ Fixed

**Fix**: `resolved` flag added to `spawnMago`; only first handler resolves the Promise.

---

### ~~13. `formatOnSave` may trigger lint/analyze twice via re-save event~~ ✅ Fixed

**Fix**: Module-level `formattingUris: Set<string>` guards against re-entrant saves.

---

### ~~14. `isValidBaselinePath` matches `"foo..bar"` as a path-traversal attempt~~ ✅ Fixed

**Fix**: Per-segment check (`seg === ".."`) instead of substring match.

---

### ~~15. `baselinePath` from settings is not validated in normal lint/analyze execution~~ ✅ Fixed

**Fix**: `buildDiagnosticCommandArgs` validates settings-sourced baseline paths.

---

### ~~16. `isValidBaselinePath` is duplicated in `extension.ts` and `magoRunner.ts`~~ ✅ Fixed

**Fix**: Consolidated into a single exported function in `magoRunner.ts`; `extension.ts` imports it.

---

### ~~17. `%` character is not blocked by `isValidBaselinePath` metacharacter check~~ ✅ Fixed

**Fix**: Added `%` to the metacharacter regex.

---

### ~~18. Negative line/column numbers possible when mago returns `line: 0` or `column: 0`~~ ✅ Fixed

**Fix**: `Math.max(0, ...)` guard added to all four `- 1` expressions in the parser.

---

### ~~19. `issueToDiagnostic` still uses `||` for column fallback~~ ✅ Fixed

**Fix**: `issue.column || 0` → `issue.column ?? 0`; also `json.level || "Error"` → `json.level ?? "Error"`.

---

## Remarks from Test Code

The `magoRunner.test.ts` suite now covers `buildDiagnosticCommandArgs`, `mergeDiagnostics`, `checkForErrors`, and `notifyDiagnosticResult` with direct unit tests using a VS Code API mock. The previous gap of no business-logic coverage has been substantially reduced.

`magoRunner.test.ts` still asserts fixed integer values for `vscode.DiagnosticSeverity` enum members. These tests verify VS Code internal implementation constants rather than extension behaviour and provide no meaningful regression coverage.

The `src/test/unit/isValidBaselinePath.test.ts` file provides comprehensive boundary tests for the exported validator, covering path traversal, absolute paths, shell metacharacters, Windows `%` expansion, false-positive filenames like `"foo..bar"`, and valid relative paths.

<!-- updated at d40c941 -->
