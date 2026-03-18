---
name: analyzed-notes
description: Supplementary implementation notes, observations, and repository-specific context.
type: analysis
---

# Notes & Remarks

Miscellaneous observations about the codebase that do not fit cleanly into other documents.

## Code Quality Observations

### Duplicate Severity Mapping Methods

`MagoOutputParser` contains two private methods — `severityToVSCode` and `magoLevelToVSCode` — that implement identical case-insensitive severity-to-`DiagnosticSeverity` mapping. They differ only in name and call site:
- `severityToVSCode` is used by the text-format path (`parseLine`, `issueToDiagnostic`)
- `magoLevelToVSCode` is used by the JSON-format path (`parseJsonIssue`)

Neither has been removed or consolidated. See known_bugs.md #3.

### Unused `catch` Variable

All four `catch (e)` blocks in `magoOutputParser.ts` capture the exception into `e` but never reference it. The blocks are intentional graceful-degradation fallbacks (JSON parse failure → fall back to text parsing). The variable should be removed: use `catch { }` (ES2019+) or `catch (_)` to silence strict-mode warnings.

### Floating Promise in `showConfigurationError`

`vscode.window.showErrorMessage(...).then(...)` inside `showConfigurationError` and the `checkForErrors` "other errors" branch is not awaited. The `.then()` callback handles the "Show Output" button click. If the callback throws, the error is silently dropped. The method cannot easily be made `async` without refactoring callers, but a `.catch(() => {})` guard would prevent silent failures.

### File-Level Commands: Silent on No Issues

When a single-file lint or analyze command finds zero issues, no notification is shown (by design — `notifyDiagnosticResult` with `isProject=false` is intentionally silent). Project commands always show "No issues found". This asymmetry is deliberate but may surprise users.

## Test Observations

### MagoRunner Tests Test the API, Not the Logic

The `magoRunner.test.ts` suite verifies that `DiagnosticCollection` and `OutputChannel` behave as expected VS Code APIs, and that `MagoRunner` can be instantiated. The actual command-building, subprocess-spawning, output-handling, and diagnostic-merging logic has no dedicated unit tests. See known_bugs.md "Remarks from Test Code".

### Integration Suite Runs on Linux Only

CI test jobs run on `ubuntu-latest` with `xvfb`. Windows path handling (e.g. `\\?\` prefix stripping, drive-letter detection) is covered only by unit tests in `magoOutputParser.test.ts`, not by end-to-end tests.

### `**/**.test.js` Glob Pattern

The Mocha test runner in `src/test/suite/index.ts` uses `**/**.test.js` to discover tests. The double-star `**/**` is redundant (equivalent to `**/*.test.js`) but harmless in practice.

## Architecture Decisions

### Diagnostic Merging vs. Replacing

`handleMagoOutput` and `handleMagoProjectOutput` always **merge** (append) into the existing `DiagnosticCollection` rather than replacing. The responsibility for clearing before a multi-command sequence is delegated to the caller (`extension.ts`). This design allows lint and analyze results to coexist without either command needing to know about the other.

### No Shell Option in `spawnMago`

`child_process.spawn` is called with only `{ cwd }` — no `shell` option. This avoids shell metacharacter expansion and is safe as long as args are passed as an array (which they are). An earlier version reportedly used `shell: true` on Windows; this has been removed.

### `workspaceFolder` Is Optional in `runMagoCommand`

`runMagoCommand` (single-file commands) passes `getWorkspaceFolder(fileUri)` directly to `spawnMago` without checking for `undefined`. When a file is outside any workspace folder, `cwd` will be `undefined` and Node.js will default to the process working directory. This differs from `runMagoProjectCommand`, which explicitly guards against missing workspace folders.

<!-- created at a4509d9 -->
