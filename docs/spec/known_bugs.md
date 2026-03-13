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

## Remarks from Test Code

The runner test suite (`magoRunner.test.ts`) tests `runLintProject` and `runAnalyzeProject` for "no workspace folder" by asserting that they **do not reject** — they may silently do nothing or show an error message. This means the test does not catch regressions where the command throws instead of calling `showErrorMessage`.

<!-- created at d1374d8 -->
