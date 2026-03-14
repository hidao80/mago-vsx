# TODO

## Bug Fixes

- [ ] Merge `severityToVSCode` and `magoLevelToVSCode` into a single method in `MagoOutputParser` — they are identical (known_bugs.md #3)
- [ ] Replace `catch (e)` with `catch { }` in all four catch blocks in `magoOutputParser.ts` — the variable is never used
- [ ] Add `undefined` check for `workspaceFolder` in `runMagoCommand` to match the guard in `runMagoProjectCommand` (known_bugs.md #7)
- [ ] Add `.catch()` guard to the floating Promise in `showConfigurationError` and `checkForErrors` (known_bugs.md #8)
- [ ] Implement `MagoRunner.dispose()` and register it via `context.subscriptions` for future-safe cleanup (known_bugs.md #10)
- [ ] Replace `||` with `??` in `parseLineToIssue`, `parseJsonIssue`, and `jsonToIssue` for line/column fallback to fix false `0` handling (known_bugs.md #11)
- [ ] Fix double `resolve()` in `spawnMago` — add a resolved flag so `error` and `close` handlers cannot both fire (known_bugs.md #12)
- [ ] Fix `formatOnSave` double lint: add an in-progress guard in `onDidSaveTextDocument` to skip re-entrant saves triggered by format writes (known_bugs.md #13)
- [ ] Fix `isValidBaselinePath` to check path segments (`seg === ".."`) instead of substring match to avoid false positives on `"foo..bar"` (known_bugs.md #14)
- [ ] Apply `isValidBaselinePath` to `mago.lintBaseline` / `mago.analyzeBaseline` settings inside `buildDiagnosticCommandArgs` (known_bugs.md #15)

## Code Quality

- [ ] Add unit tests for `MagoOutputParser.parseProject` covering relative paths on Windows
- [ ] Add a test that verifies the diagnostic clear condition fires when only one of `lintOnSave` / `analyzeOnSave` is enabled
- [ ] Add unit tests for `buildDiagnosticCommandArgs` (with and without baseline path)
- [ ] Add unit tests for `checkForErrors` (TOML error detection and generic ERROR detection)
- [ ] Add unit tests for `notifyDiagnosticResult` (file vs project, zero vs non-zero issue counts)
- [ ] Add `readonly` modifier to `diagnosticCollection`, `outputParser`, and `outputChannel` fields in `MagoRunner`
- [ ] Extract shared logic from `handleMagoOutput` and `handleMagoProjectOutput` to eliminate duplication
- [ ] Replace `console.log` in `extension.ts` `activate` with `outputChannel.appendLine` and fix initialization order
- [ ] Fix `MagoAnnotation.kind` type — `"Primary" | "Secondary" | string` is equivalent to `string`; narrow to `"Primary" | "Secondary"` with runtime fallback
- [ ] Add process timeout to `spawnMago` (via `child_process` `timeout` option or `setTimeout` + `kill()`) to prevent indefinite hang
- [ ] Declare module-level variables in `extension.ts` as `| undefined` to make uninitialized state visible to the type checker
- [ ] Remove double `dispose()` risk in `deactivate` — rely on `context.subscriptions` or call `dispose()` manually, not both
- [ ] Remove unnecessary `async` keyword from `spawnMago` — it returns a `Promise` directly without using `await`

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
- [ ] Export `isValidBaselinePath` from `extension.ts` (or move to a shared module) and add boundary tests (`../evil`, absolute paths, shell metacharacters, valid relative paths)
- [ ] Add unit tests for `runLint` / `runAnalyze` by mocking `child_process.spawn` — verify `diagnosticCollection` state on success and on binary-not-found error
- [ ] Replace VS Code API usage in `magoRunner.test.ts` with mock implementations so tests can run without a VS Code host (`pnpm test:unit`)
- [ ] Pin VS Code version in `src/test/runTest.ts` to `engines.vscode` minimum (e.g. `"1.80.0"`) instead of `"stable"` to avoid CI breakage on new releases
- [ ] Add test cases for `parseProject` with missing `file_id` and with `Secondary`-only annotations

## CI / Infra

- [ ] Re-evaluate whether `pull_request` triggers should be re-added to audit/lint/test workflows (currently push-only)
- [ ] Pin `actions/checkout` to a specific SHA in addition to the version tag

<!-- updated after code-reviewer audit 2026-03-14 -->
