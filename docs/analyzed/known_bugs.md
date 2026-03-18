---
name: analyzed-known-bugs
description: Catalog of known bugs, limitations, and currently unresolved behavior.
type: analysis
---

# Known Bugs

## Active Issues

### ~~3. `severityToVSCode` and `magoLevelToVSCode` are duplicate methods~~ ✅ Fixed

**Location**: `src/magoOutputParser.ts`

**Fix**: `magoLevelToVSCode` を削除し、`parseJsonIssue` 内の呼び出しを `severityToVSCode` に統一。メソッドが1本になり実装の乖離リスクを解消した。

---

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

### ~~4. Diagnostic accumulation when only one of lintOnSave / analyzeOnSave is enabled~~ ✅ Fixed

**Location**: `src/extension.ts` line 201

**Fix**: Changed `if (lintOnSave && analyzeOnSave)` to `if (lintOnSave || analyzeOnSave)` so that `diagnosticCollection.delete(uri)` is called before any on-save diagnostic command runs, regardless of which flags are enabled.

---

### ~~5. Missing input validation for `baselinePath` user input~~ ✅ Fixed

**Location**: `src/extension.ts` `generateLintBaseline` / `generateAnalyzeBaseline`

**Fix**: `isValidBaselinePath` was added and is called before forwarding user-supplied input to the CLI. Path traversal, absolute paths, and shell metacharacters are all rejected with an error message.

---

### ~~6. Shell injection risk via file path on Windows~~ ✅ Fixed

**Location**: `src/magoRunner.ts` `spawnMago`

**Fix**: `shell: true` was removed from the `child_process.spawn` options. All args are now passed as an array without shell expansion, eliminating the injection surface.

---

### ~~7. `workspaceFolder` is not checked for `undefined` in `runMagoCommand`~~ ✅ Fixed

**Location**: `src/magoRunner.ts` `runMagoCommand`

**Fix**: Added an explicit `undefined` check after `getWorkspaceFolder`. When the file is outside any workspace folder, a warning is logged to the output channel before execution continues. The absolute `fsPath` is still passed as the CLI argument so lint/analyze succeeds; only relative paths (e.g. baseline) may not resolve correctly, which is now clearly surfaced to the user.

---

### ~~8. Unhandled Promise from `showErrorMessage` / `showWarningMessage`~~ ✅ Fixed

**Location**: `src/magoRunner.ts` (`checkForErrors`, `showConfigurationError`)

**Fix**: VS Codeの`showErrorMessage`は`Thenable`を返すため`.catch()`は使えない。代わりに`void`キーワードを付与し、浮遊Thenableを明示的に破棄する形に変更した。

---

### ~~9. `"ERROR"` string matching in `checkForErrors` is over-broad~~ ✅ Fixed

**Location**: `src/magoRunner.ts` `checkForErrors`

**Fix**: Replaced `output.includes("ERROR")` with `/\bERROR\b/.test(output)` and the per-line filter with `/\bERROR\b/.test(line)`. Word-boundary matching prevents false positives from PHP identifiers like `ERROR_CODE`.

---

### 10. `MagoRunner` is not disposed on extension deactivation

**Location**: `src/extension.ts` lines 184–191 (`deactivate`), `src/magoRunner.ts`

**Description**: `diagnosticCollection` and `outputChannel` are disposed in `deactivate`, but `magoRunner` is never added to `context.subscriptions` and has no `dispose()` method. If `MagoRunner` acquires long-lived resources in the future (e.g. file watchers, persistent child processes), they will leak on deactivation.

**Impact**: Low — no current leak; risk is forward-looking.

---

### ~~11. `||` operator causes false fallback when line/column is `0` in `magoOutputParser`~~ ✅ Fixed

**Location**: `src/magoOutputParser.ts` `parseJsonIssue` and `jsonToIssue`

**Fix**: Replaced all `||` with `??` in line/column default expressions (`(start?.line ?? 1) - 1`, `(start?.column ?? 1) - 1`, etc.) so that the value `0` is treated as a valid position and is no longer overridden by the fallback.

---

### ~~12. Double `resolve()` call when child process emits `error` then `close`~~ ✅ Fixed

**Location**: `src/magoRunner.ts` `spawnMago`

**Fix**: `spawnMago` に `resolved` フラグを追加し、`error` と `close` の両ハンドラーが `resolve()` を呼ぶ前にフラグをチェックするよう変更。最初のハンドラーだけがPromiseを解決し、二重解決を防ぐ。

---

### ~~13. `formatOnSave` may trigger lint/analyze twice via re-save event~~ ✅ Fixed

**Location**: `src/extension.ts` `onDidSaveTextDocument`

**Fix**: Added a module-level `formattingUris: Set<string>`. Before calling `runFormat`, the file URI is added to the set. The handler returns early if the URI is already in the set (re-save from format), then removes it in a `finally` block. Lint/analyze now runs only once, on the original user save.

---

### ~~14. `isValidBaselinePath` matches `"foo..bar"` as a path-traversal attempt~~ ✅ Fixed

**Location**: `src/extension.ts` lines 8–26 (`isValidBaselinePath`)

**Fix**: Replaced `path.includes("..")` with a per-segment check (`segments.some(s => s === "..")`), so only path components that are exactly `".."` are rejected. Filenames like `"baseline..backup.toml"` are now accepted correctly.

---

### ~~15. `baselinePath` from settings is not validated in normal lint/analyze execution~~ ✅ Fixed

**Location**: `src/magoRunner.ts` `buildDiagnosticCommandArgs`

**Fix**: Added a private `isValidBaselinePath` method to `MagoRunner`. Settings-sourced baseline paths are now validated before being forwarded to `--baseline`. Invalid paths are skipped and logged to the output channel.

---

### ~~16. `isValidBaselinePath` is duplicated in `extension.ts` and `magoRunner.ts`~~ ✅ Fixed

**Location**: `src/magoRunner.ts` (now a module-level export); `src/extension.ts`

**Fix**: The private `isValidBaselinePath` method in `MagoRunner` and the standalone function in `extension.ts` were consolidated into a single exported function at the top of `magoRunner.ts`. `extension.ts` now imports it from `./magoRunner`. Bug #17 (`%` gap) was fixed in the same change.

---

### ~~17. `%` character is not blocked by `isValidBaselinePath` metacharacter check~~ ✅ Fixed

**Location**: `src/magoRunner.ts` `isValidBaselinePath` (exported)

**Fix**: Added `%` to the metacharacter regex — now `/[&|;<>$\`!*?()\[\]{}%]/` — as part of the Bug #16 consolidation. Fixes the Windows environment variable expansion gap (`%APPDATA%` etc.).

---

### ~~18. Negative line/column numbers possible when mago returns `line: 0` or `column: 0`~~ ✅ Fixed

**Location**: `src/magoOutputParser.ts` `parseJsonIssue`, `jsonToIssue`, `parseLine`, `parseLineToIssue`

**Fix**: 全4箇所の `- 1` 演算に `Math.max(0, ...)` ガードを追加。JSONパス・テキストパス両方を網羅し、負インデックスを完全に排除した。

---

### ~~19. `issueToDiagnostic` still uses `||` for column fallback~~ ✅ Fixed

**Location**: `src/magoOutputParser.ts` `issueToDiagnostic`

**Fix**: `issue.column || 0` を `issue.column ?? 0` に変更し、`0` を有効な列値として扱うよう統一した。あわせて `parseJsonIssue` の `json.level || "Error"` も `json.level ?? "Error"` に修正。

---

## Remarks from Test Code

The runner test suite (`magoRunner.test.ts`) tests `runLintProject` and `runAnalyzeProject` for "no workspace folder" by asserting that they **do not reject** — they may silently do nothing or show an error message. This means the test does not catch regressions where the command throws instead of calling `showErrorMessage`.

Additionally, the suite's `Integration with VS Code` group asserts fixed integer values for `vscode.DiagnosticSeverity` enum members. These tests verify VS Code internal implementation constants rather than extension behaviour and provide no meaningful regression coverage.

Core business logic in `MagoRunner` (argument building, TOML error detection, diagnostic merging, result notification) has no dedicated unit tests.

The `glob` package used in `src/test/suite/index.ts` is not listed as an explicit `devDependency` — it arrives as a transitive dependency of `@vscode/test-electron`. A version bump could silently break the test runner.

<!-- updated 2026-03-14: bugs #5–#7, #11, #14–#17 fixed; bugs #9, #13 fixed 2026-03-14; bugs #3, #8, #12, #18, #19 fixed 2026-03-14 -->
