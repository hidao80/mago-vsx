---
name: analyzed-todo
description: List of proposed improvements, follow-up tasks, and future work for the repository.
type: analysis
---

# TODO

## Bug Fixes

- [x] Merge `severityToVSCode` and `magoLevelToVSCode` into a single method in `MagoOutputParser` — they are identical (known_bugs.md #3) ✅ 2026-03-14
- [x] Replace `catch (e)` with `catch { }` in all four catch blocks in `magoOutputParser.ts` — the variable is never used ✅ 2026-03-14
- [x] Add `undefined` check for `workspaceFolder` in `runMagoCommand` to match the guard in `runMagoProjectCommand` (known_bugs.md #7) ✅ 2026-03-14
- [x] Add `.catch()` guard to the floating Promise in `showConfigurationError` and `checkForErrors` (known_bugs.md #8) ✅ 2026-03-14
- [x] Implement `MagoRunner.dispose()` and register it via `context.subscriptions` for future-safe cleanup (known_bugs.md #10) ✅ Partially — `dispose()` added but not pushed to `context.subscriptions` (known_bugs.md #21)
- [x] Replace `||` with `??` in `parseJsonIssue` and `jsonToIssue` for line/column fallback to fix false `0` handling (known_bugs.md #11) ✅ 2026-03-14
- [x] Fix double `resolve()` in `spawnMago` — add a resolved flag so `error` and `close` handlers cannot both fire (known_bugs.md #12) ✅ 2026-03-14
- [x] Fix over-broad `"ERROR"` match in `checkForErrors` — replace `includes("ERROR")` with `/\bERROR\b/` word-boundary check (known_bugs.md #9) ✅ 2026-03-14
- [x] Fix `formatOnSave` double lint: add an in-progress guard in `onDidSaveTextDocument` (known_bugs.md #13) ✅ 2026-03-14
- [x] Fix `isValidBaselinePath` to check path segments (`seg === ".."`) instead of substring match (known_bugs.md #14) ✅ 2026-03-14
- [x] Apply `isValidBaselinePath` to `mago.lintBaseline` / `mago.analyzeBaseline` settings inside `buildDiagnosticCommandArgs` (known_bugs.md #15) ✅ 2026-03-14
- [x] Consolidate `isValidBaselinePath` into a single exported function in `magoRunner.ts`; remove duplicate in `extension.ts` (known_bugs.md #16) ✅ 2026-03-14
- [x] Add `%` to the metacharacter blocklist in `isValidBaselinePath` (known_bugs.md #17) ✅ 2026-03-14
- [x] Add `Math.max(0, ...)` guard to line/column calculations (known_bugs.md #18) ✅ 2026-03-14
- [x] Replace `||` with `??` in `issueToDiagnostic` column fallback (known_bugs.md #19) ✅ 2026-03-14
- [ ] Push `magoRunner` to `context.subscriptions` so `dispose()` is called on deactivation (known_bugs.md #21)

## Code Quality

- [x] Add unit tests for `MagoOutputParser.parseProject` covering relative paths on Windows ✅ 2026-03-14
- [ ] Add a test that verifies the diagnostic clear condition fires when only one of `lintOnSave` / `analyzeOnSave` is enabled
- [x] Add unit tests for `buildDiagnosticCommandArgs` (with and without baseline path) ✅ 2026-03-14
- [x] Add unit tests for `checkForErrors` (TOML error detection and generic ERROR detection) ✅ 2026-03-14
- [x] Add unit tests for `notifyDiagnosticResult` (file vs project, zero vs non-zero issue counts) ✅ 2026-03-14
- [x] Add `readonly` modifier to `diagnosticCollection`, `outputParser`, and `outputChannel` fields in `MagoRunner` ✅ 2026-03-14
- [x] Extract shared logic from `handleMagoOutput` and `handleMagoProjectOutput` to eliminate duplication ✅ 2026-03-14
- [x] Replace `console.log` in `extension.ts` `activate` with `outputChannel.appendLine` and fix initialization order ✅ 2026-03-14
- [x] Fix `MagoAnnotation.kind` type — narrow to `"Primary" | "Secondary"` ✅ 2026-03-14
- [x] Add process timeout to `spawnMago` (60 s `timeout` option) ✅ 2026-03-14
- [x] Declare module-level variables in `extension.ts` as `| undefined` ✅ 2026-03-14
- [x] Remove double `dispose()` risk in `deactivate` — rely on `context.subscriptions` ✅ 2026-03-14
- [x] Remove unnecessary `async` keyword from `spawnMago` ✅ 2026-03-14

## Features / Enhancements

- [ ] Add `mago.clearDiagnostics` command to let users manually clear the Problems pane without reloading
- [ ] Surface annotation `label` text in diagnostic messages or related information
- [ ] Support `Secondary` annotations as additional `DiagnosticRelatedInformation` with file locations
- [ ] Consider adding a status bar item showing the number of active mago diagnostics

## Testing

- [ ] Add E2E tests with a real PHP fixture file using Playwright + VS Code host
- [ ] Add tests for baseline generation command flow (path validation → runner invocation)
- [ ] Run CI test suite on Windows to validate Windows path handling end-to-end
- [x] Add `isValidBaselinePath` boundary tests (path traversal, absolute, metacharacters, `%`, `"foo..bar"`, valid relative) ✅ 2026-03-14
- [x] Add unit tests for `runLint` / `runAnalyze` by mocking subprocess — verify `diagnosticCollection` state ✅ 2026-03-14 (via VS Code mock + Playwright)
- [ ] Replace remaining VS Code API integration assertions in `magoRunner.test.ts` that test VS Code internals (DiagnosticSeverity constants) with behavioural assertions
- [ ] Pin VS Code version in CI test runner to `engines.vscode` minimum (`"1.80.0"`) instead of `"stable"`
- [x] Add test cases for `parseProject` with missing `file_id` and with `Secondary`-only annotations ✅ 2026-03-14

## CI / Infra

- [ ] Re-evaluate whether `pull_request` triggers should be re-added to audit/lint/test workflows (currently push-only)
- [ ] Pin `actions/checkout` to a specific SHA in addition to the version tag

<!-- updated at d40c941 -->
