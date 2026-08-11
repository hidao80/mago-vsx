# Changelog

All notable changes to the Mago VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-08-11

### Fixed

- Fixed a Playwright test-collection crash (`TypeError: Cannot read properties of null (reading 'includes')`) that made `audit`/`build`/`lint`/`test` CI workflows fail on every run. The `vscode` module mock previously patched `Module._resolveFilename` to return the non-existent path `"vscode"`, which broke Playwright's TS-transform loader when it probed the resolved path on disk before the `require.cache` lookup kicked in.
- Replaced the `Module._resolveFilename` patch with a real, npm-resolvable `vscode` package (`src/test/vscode-stub`) wired up via pnpm's `link:` protocol, so `require("vscode")` resolves through Node's normal module resolution instead of fighting Playwright's internal resolver.
- Fixed `magoOutputParser.unit.test.ts`'s path-traversal clamp test, which hardcoded a POSIX-style `"/project"` prefix — `normalizeFilePath()` runs paths through `node:path`, which rewrites separators per OS, so the test now normalizes its expected root the same way.
- Fixed `magoRunner.test.ts`'s "Should clear diagnostics" test, which asserted `get()` returns an empty array after `clear()`; `clear()` empties the underlying map entirely, matching real `vscode.DiagnosticCollection` behavior, so `get()` correctly returns `undefined`.

### Tests

- Added `src/test/vscode-stub` — a minimal, real `vscode` package (not a runtime monkey-patch) used as the `vscode` module mock for all Playwright-based unit and suite tests.

---

## [0.4.0] - 2026-03-21

### Security

- Added `isValidExecutablePath` validation — `mago.executablePath` setting is now checked for shell metacharacters before spawning, preventing command injection via `cmd.exe` on Windows
- Consolidated `qs` pnpm overrides: two prior range rules (`qs@<6.14.1` and `qs@>=6.7.0 <=6.14.1`) merged into a single `qs@<6.14.2: >=6.14.2` pin — forces all transitive dependents to the minimum safe version of qs (prototype-pollution fix)

### Fixed

- `runFormat` now resolves the workspace folder from the file URI (`getWorkspaceFolder`) instead of always using the first workspace folder, so single-file formatting no longer silently fails in multi-root or file-only workspaces
- `checkForErrors` and `handleGenericError` now use case-insensitive matching (`/\bERROR\b/i`) to catch `error:` and `Error:` output from future mago versions

### Changed

- `normalizeJsonToArray` now filters non-object array elements with a type guard instead of unsafe `as` casts
- Extracted `addDiagnosticForFile` helper to eliminate duplicated map-insertion logic in `parseProject`
- `install:vscode` script now resolves the version dynamically from `package.json` instead of a hardcoded string

### Tests

- Added `tsconfig.test.json` — test files are now type-checked separately from the production build; `pretest` enforces this on every `pnpm test` run
- Removed redundant `typeof method === "function"` assertions (TypeScript guarantees these at compile time)

### Docs

- Translated `TESTING.md` from Japanese to English; added architecture table and script reference

---

## [0.3.0] - 2024-12-29

### Security

- Added `isValidBaselinePath` validation — rejects path traversal, absolute paths, and shell metacharacters (including `%`) for both user input and settings-sourced baseline paths

### Fixed

- Fixed 16 bugs — highlights: double `resolve()` in `spawnMago`, false-positive `ERROR` matching via word-boundary regex, `formatOnSave` double lint via re-entrant save guard, negative line/column indices, `||` → `??` for zero-value positions

### Changed

- Added `readonly` fields, `MagoRunner.dispose()`, process timeout in `spawnMago`, consolidated duplicate logic, removed unnecessary `async`, fixed `MagoAnnotation.kind` type

### Tests

- Expanded unit test coverage — `buildDiagnosticCommandArgs`, `checkForErrors`, `notifyDiagnosticResult`, `parseProject` edge cases, and `isValidBaselinePath` boundary cases

---

## [0.2.0] - 2024-12-29

### Changed

- Introduced `src/types.ts` centralizing all Mago-specific types; replaced `any` with concrete types (`MagoJsonOutput`, `MagoJsonIssue`, etc.)
- Fixed all lint errors — replaced `forEach` with `for...of` loops and removed non-null assertions

---

## [0.1.0] - 2024-12-29

### Added

- **Lint & Analyze Commands**
  - `Mago: Lint Current File` - Run lint on the currently open PHP file
  - `Mago: Analyze Current File` - Run analyze on the currently open PHP file
  - `Mago: Lint & Analyze Current File` - Run both lint and analyze on the current file
  - `Mago: Lint Project` - Run lint on the entire project
  - `Mago: Analyze Project` - Run analyze on the entire project
  - `Mago: Lint & Analyze Project` - Run both lint and analyze on the entire project

- **Format Commands**
  - `Mago: Format Current File` - Format the currently open PHP file
  - `Mago: Format Project` - Format all PHP files in the project
  - `Mago: Format Check (CI)` - Check if files are correctly formatted without modifying them

- **Baseline Management**
  - `Mago: Generate Lint Baseline` - Generate a baseline file to suppress existing lint issues
  - `Mago: Generate Analyze Baseline` - Generate a baseline file to suppress existing analysis issues
  - Automatic baseline filtering when `mago.lintBaseline` or `mago.analyzeBaseline` is configured

- **Configuration Options**
  - `mago.lintOnSave` (default: `true`) - Run lint automatically when a PHP file is saved
  - `mago.analyzeOnSave` (default: `true`) - Run analyze automatically when a PHP file is saved
  - `mago.formatOnSave` (default: `false`) - Format file automatically when saved
  - `mago.lintBaseline` (default: `""`) - Path to the lint baseline file
  - `mago.analyzeBaseline` (default: `""`) - Path to the analyze baseline file
  - `mago.executablePath` (default: `"mago"`) - Path to the Mago executable

- **Features**
  - Problem pane integration with collapsible details using DiagnosticRelatedInformation
  - Output channel for debugging and verbose logging
  - Cross-platform support (Windows, Linux, macOS)
  - Smart diagnostic merging for combined lint+analyze operations
  - TOML configuration error detection with line/column precision
  - JSON validation to distinguish valid empty results from errors

- **CI/CD**
  - GitHub Actions workflow with automated testing
  - Security audits via `pnpm audit`
  - Dependency checks via `pnpm outdated`
  - VSIX package build verification
  - Headless testing with Xvfb

### Changed

- **Refactored codebase for better maintainability**
  - Reduced code duplication in [magoRunner.ts](src/magoRunner.ts)
  - Extracted common patterns into reusable helper methods
  - Improved error handling consistency across all commands
  - Better separation of concerns with clear method responsibilities

### Technical Details

- **Architecture improvements:**
  - Introduced `SpawnResult` interface for type-safe process execution results
  - Centralized process spawning in `spawnMago()` method
  - Unified command argument building with `buildDiagnosticCommandArgs()`
  - Extracted notification logic to `notifyDiagnosticResult()` with smart JSON validation
  - Reduced code from ~500 lines to ~370 lines (-26%)

- **Error handling enhancements:**
  - Pattern matching for TOML parse errors
  - User-friendly error messages with "Show Output" actions
  - Automatic error detection in mago output
  - Clear distinction between configuration errors and execution errors

- **Output parsing:**
  - Supports mago's `--reporting-format json` output
  - Handles annotations array structure with span details
  - Extracts notes and help text as related information
  - Normalizes Windows paths (removes `\\?\` prefix)
  - Multiple format fallbacks for robustness

- **Process execution:**
  - Cross-platform command spawning with shell option for Windows
  - Proper working directory handling
  - stdout and stderr collection
  - Exit code handling
  - Error event handling for missing executables

### Fixed

- Diagnostic merging issue where lint+analyze combined commands would only show one set of results
- False warning "Output received but no issues parsed" when using baseline filtering
- TOML configuration errors not being properly detected and displayed
- Windows path normalization for `\\?\` prefixed paths

## [Unreleased]

### Planned

- Automated test coverage reporting
- E2E test automation
- Mock-based unit tests for complete isolation
- Additional configuration options for advanced use cases
