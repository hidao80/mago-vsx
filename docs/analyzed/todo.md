# TODO

## Bug Fixes

- [x] Merge `severityToVSCode` and `magoLevelToVSCode` into a single method in `MagoOutputParser` — they are identical (known_bugs.md #3) ✅ 2026-03-14
- [x] Replace `catch (e)` with `catch { }` in all four catch blocks in `magoOutputParser.ts` — the variable is never used ✅ 2026-03-14
- [x] Add `undefined` check for `workspaceFolder` in `runMagoCommand` to match the guard in `runMagoProjectCommand` (known_bugs.md #7) ✅ 2026-03-14
- [x] Add `.catch()` guard to the floating Promise in `showConfigurationError` and `checkForErrors` (known_bugs.md #8) ✅ 2026-03-14
- [x] Implement `MagoRunner.dispose()` and register it via `context.subscriptions` for future-safe cleanup (known_bugs.md #10) ✅ 2026-03-14
- [x] Replace `||` with `??` in `parseJsonIssue` and `jsonToIssue` for line/column fallback to fix false `0` handling (known_bugs.md #11) ✅ 2026-03-14
- [x] Fix double `resolve()` in `spawnMago` — add a resolved flag so `error` and `close` handlers cannot both fire (known_bugs.md #12) ✅ 2026-03-14
- [x] Fix over-broad `"ERROR"` match in `checkForErrors` — replace `includes("ERROR")` with `/\bERROR\b/` word-boundary check to avoid false positives on PHP identifiers like `ERROR_CODE` (known_bugs.md #9) ✅ 2026-03-14
- [x] Fix `formatOnSave` double lint: add an in-progress guard in `onDidSaveTextDocument` to skip re-entrant saves triggered by format writes (known_bugs.md #13) ✅ 2026-03-14
- [x] Fix `isValidBaselinePath` to check path segments (`seg === ".."`) instead of substring match to avoid false positives on `"foo..bar"` (known_bugs.md #14) ✅ 2026-03-14
- [x] Apply `isValidBaselinePath` to `mago.lintBaseline` / `mago.analyzeBaseline` settings inside `buildDiagnosticCommandArgs` (known_bugs.md #15) ✅ 2026-03-14
- [x] Consolidate `isValidBaselinePath` into a single exported function in `magoRunner.ts`; remove duplicate in `extension.ts` (known_bugs.md #16) ✅ 2026-03-14
- [x] Add `%` to the metacharacter blocklist in `isValidBaselinePath` to fully cover Windows environment variable expansion syntax (known_bugs.md #17) ✅ 2026-03-14
- [x] Add `Math.max(0, ...)` guard to line/column calculations in `parseJsonIssue` and `jsonToIssue` to prevent negative indices when mago returns `0` (known_bugs.md #18) ✅ 2026-03-14
- [x] Replace `||` with `??` in `issueToDiagnostic` column fallback for consistency with the rest of `magoOutputParser.ts` (known_bugs.md #19) ✅ 2026-03-14

## Code Quality

- [x] Add unit tests for `MagoOutputParser.parseProject` covering relative paths on Windows ✅ 2026-03-14
- [ ] Add a test that verifies the diagnostic clear condition fires when only one of `lintOnSave` / `analyzeOnSave` is enabled
- [x] Add unit tests for `buildDiagnosticCommandArgs` (with and without baseline path) ✅ 2026-03-14
- [x] Add unit tests for `checkForErrors` (TOML error detection and generic ERROR detection) ✅ 2026-03-14
- [x] Add unit tests for `notifyDiagnosticResult` (file vs project, zero vs non-zero issue counts) ✅ 2026-03-14
- [x] Add `readonly` modifier to `diagnosticCollection`, `outputParser`, and `outputChannel` fields in `MagoRunner` ✅ 2026-03-14
- [x] Extract shared logic from `handleMagoOutput` and `handleMagoProjectOutput` to eliminate duplication ✅ 2026-03-14
- [x] Replace `console.log` in `extension.ts` `activate` with `outputChannel.appendLine` and fix initialization order ✅ 2026-03-14
- [x] Fix `MagoAnnotation.kind` type — `"Primary" | "Secondary" | string` is equivalent to `string`; narrow to `"Primary" | "Secondary"` with runtime fallback ✅ 2026-03-14
- [x] Add process timeout to `spawnMago` (via `child_process` `timeout` option or `setTimeout` + `kill()`) to prevent indefinite hang ✅ 2026-03-14
- [x] Declare module-level variables in `extension.ts` as `| undefined` to make uninitialized state visible to the type checker ✅ 2026-03-14
- [x] Remove double `dispose()` risk in `deactivate` — rely on `context.subscriptions` or call `dispose()` manually, not both ✅ 2026-03-14
- [x] Remove unnecessary `async` keyword from `spawnMago` — it returns a `Promise` directly without using `await` ✅ 2026-03-14

## Features / Enhancements

- [ ] Add `mago.clearDiagnostics` command to let users manually clear the Problems pane without reloading
- [ ] Surface annotation `label` text in diagnostic messages or related information
- [ ] Support `Secondary` annotations as additional `DiagnosticRelatedInformation` with file locations
- [ ] Consider adding a status bar item showing the number of active mago diagnostics

## Testing

- [ ] Set up Vitest or additional Mocha unit tests that do not require a VS Code environment (currently only `test:unit` avoids VS Code, but coverage is sparse)
- [ ] Add E2E tests with a real PHP fixture file using `@vscode/test-electron`
- [ ] Add tests for baseline generation command flow (path validation → runner invocation)
- [ ] Run CI test suite on Windows to validate Windows path handling end-to-end
- [ ] Add `glob` to `devDependencies` explicitly (`pnpm add -D glob`) — currently only a transitive dep of `@vscode/test-electron`
- [ ] Fix glob pattern in `src/test/suite/index.ts` from `**/**.test.js` to `**/*.test.js` to avoid double-wildcard duplicate matches
- [ ] Add boundary tests for the exported `isValidBaselinePath` in `magoRunner.ts` (Bug Fixes #16 resolved): `../evil`, absolute paths, shell metacharacters, `%APPDATA%`, `"foo..bar"` (must pass), valid relative paths
- [ ] Add unit tests for `runLint` / `runAnalyze` by mocking `child_process.spawn` — verify `diagnosticCollection` state on success and on binary-not-found error
- [ ] Replace VS Code API usage in `magoRunner.test.ts` with mock implementations so tests can run without a VS Code host (`pnpm test:unit`)
- [ ] Pin VS Code version in `src/test/runTest.ts` to `engines.vscode` minimum (e.g. `"1.80.0"`) instead of `"stable"` to avoid CI breakage on new releases
- [x] Add test cases for `parseProject` with missing `file_id` and with `Secondary`-only annotations ✅ 2026-03-14

## CI / Infra

- [ ] Re-evaluate whether `pull_request` triggers should be re-added to audit/lint/test workflows (currently push-only)
- [ ] Pin `actions/checkout` to a specific SHA in addition to the version tag

<!-- updated 2026-03-14: items #7, #11, #14, #15 closed (code-reviewer audit); items #9, #13, #16, #17 closed 2026-03-14; items #18–#19 remain open; code quality batch closed 2026-03-14: readonly fields, dispose(), async removal, timeout, catch cleanup, MagoAnnotation.kind, mergeDiagnostics, console.log, double-dispose; 2026-03-14 code-quality batch 2: extension.ts | undefined vars, buildDiagnosticCommandArgs/checkForErrors/notifyDiagnosticResult tests, parseProject edge case tests (missing file_id, Secondary-only, relative path), isValidBaselinePath boundary tests -->
