# Changelog

All notable changes to the Mago VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
