---
title: Architecture Decision Records
generated_from: git log
last_updated: 2026-07-12
---

# ADR: mago-vsx

Decisions reconstructed from git history (`78b6de7` → `d40c941`). Each record reflects what the log shows was decided and why; status is "Accepted" unless later superseded (noted inline).

## ADR-001: Spawn the Mago CLI as a subprocess and parse its JSON output

**Context**: The extension needs lint/analyze/format/baseline results from the external `mago` PHP static-analysis binary inside VS Code.

**Decision**: Use Node's `child_process.spawn` (`magoRunner.ts`) to invoke `mago`, capture stdout, and parse it (`magoOutputParser.ts`) into `vscode.Diagnostic`s. Mago-specific shapes (`MagoJsonOutput`, `MagoJsonIssue`, `MagoPosition`, etc.) were centralized into `src/types.ts` (`344449c`) instead of using inline `any`/ad-hoc types scattered across files.

**Consequences**: Single source of truth for the Mago JSON contract; parser and runner both import from `types.ts`.

## ADR-002: Do not use `shell: true` when spawning Mago

**Context**: On Windows, `spawn` was originally called with `shell: true`, letting shell metacharacters in file paths/arguments reach a real shell — a command-injection vector (Bug #6).

**Decision**: Removed `shell: true`; rely on `spawn`'s default of passing argv directly to the executable (`d2fd4cd`).

**Consequences**: Eliminates the primary injection vector at the cost of losing shell features (globbing, `%VAR%` expansion) — none of which were needed.

## ADR-003: Validate baseline file paths before use (defense-in-depth)

**Context**: `generate-baseline` commands and `mago.lintBaseline`/`mago.analyzeBaseline` settings accepted arbitrary strings that could be crafted to exploit the shell-injection surface or escape the workspace (Bugs #5, #7, #14, #15, #16, #17).

**Decision**: Introduced `isValidBaselinePath`, iterated through several corrections:
- Initial version rejected `..`, absolute paths, and shell metacharacters (`d2fd4cd`).
- Switched from `path.includes("..")` to a per-segment check so legitimate filenames like `foo..bar` aren't false-positived (`d405170`).
- Added `%` to the metacharacter blocklist to cover Windows `%APPDATA%`-style expansion (`d2d4379`).
- Promoted the method from a private `MagoRunner` method to a single module-level exported function, deleting the duplicate implementation in `extension.ts` (`d2d4379`).

**Consequences**: One validation path shared by every call site instead of two divergent copies; settings-sourced baseline paths are validated the same as command-provided ones.

## ADR-004: Prefer `??` over `||` for numeric/level fallbacks

**Context**: `||` treats `0` as falsy, so a Mago-reported line/column of `0` or a level value was silently overridden by a hardcoded default (Bugs #11, #19).

**Decision**: Replaced `||` with `??` in `parseJsonIssue`, `jsonToIssue`, `issueToDiagnostic`, and related fallback expressions (`d405170`, `35599bd`, `5da86ef`).

**Consequences**: Zero is now treated as a valid value everywhere fallbacks are computed; established as the project convention for optional numeric/enum fields.

## ADR-005: Clamp diagnostic ranges to non-negative indices

**Context**: `vscode.Range` positions are computed as `line - 1` / `column - 1`; a Mago-emitted `0` produced a negative index (Bug #18).

**Decision**: Wrapped all six index-subtraction expressions in `Math.max(0, ...)` (`35599bd`).

## ADR-006: Guard against double-resolution in `spawnMago`

**Context**: Node can fire both an `error` and a `close` event for the same failed spawn, causing the wrapping Promise's resolve/reject to be called twice (Bug #12).

**Decision**: Added a `resolved` boolean guard flag before settling the Promise, plus a 60s spawn timeout (`35599bd`, `5da86ef`).

## ADR-007: Make `MagoRunner` a `vscode.Disposable`

**Context**: The runner held long-lived state (diagnostic collection, output channel) with no formal cleanup path; `extension.ts` used `console.log` and untyped module-level vars.

**Decision**: `MagoRunner` implements `vscode.Disposable` with a `dispose()` method and is registered via `context.subscriptions`; `deactivate()` was simplified to rely on that registration instead of manual cleanup. Fields (`diagnosticCollection`, `outputParser`, `outputChannel`) marked `readonly`; module-level vars typed `| undefined`; `console.log` replaced with the output channel (`5da86ef`).

**Consequences**: Cleanup follows the standard VS Code extension lifecycle instead of ad-hoc teardown.

## ADR-008: Match `ERROR` on word boundaries, not substring

**Context**: `output.includes("ERROR")` matched inside legitimate PHP identifiers like `ERROR_CODE`, causing false-positive error detection that suppressed valid diagnostics (Bug #9).

**Decision**: Replaced substring checks with `/\bERROR\b/` regex in `checkForErrors` (`d2d4379`).

## ADR-009: Guard against re-entrant saves when `formatOnSave` is enabled

**Context**: When Mago formats a file and writes it back to disk, VS Code's `onDidSaveTextDocument` fires again, triggering a duplicate lint/analyze pass (Bug #13).

**Decision**: Added a module-level `formattingUris` Set; the save handler returns early if the URI is already marked as mid-format (`d2d4379`).

## ADR-010: Detect and explain Mago's "database access" failures separately

**Context**: On Windows, Mago can fail with "Failed to load database" (os error 5 / access denied) — a distinct failure mode from a generic tool error — and it was being reported twice (once by `checkForErrors`, once by a generic fallback) for `fmt`/`fmt-check`.

**Decision**: Added explicit detection for this message in `checkForErrors` with a user-facing explanation of likely causes, and changed `runFormat`/`runFormatCheck` from bare `else` to `else if (!checkForErrors(...))` so the same failure isn't reported through two paths (`0aabe02`).

## ADR-011: Clear diagnostics independently per lint/analyze toggle

**Context**: `diagnosticCollection.delete()` only ran when *both* `lintOnSave` and `analyzeOnSave` were true, leaving stale diagnostics when only one was enabled.

**Decision**: Changed the condition so diagnostics clear when *either* flag is enabled (`16be5ad`).

## ADR-012: GitHub Actions for audit/build/lint/test, with Takumi Guard in CI

**Context**: Project needed CI coverage and a security-scanning gate.

**Decision**: Added GitHub Actions workflows for audit, build, lint, and test (`a692b72`); pinned to `ubuntu-latest` with corrected system-dependency installation (`d17c1e1`); renamed the CI workflow to `Test` (`d85a965`); added Takumi Guard npm setup to all workflows as a security check step (`2db8618`).

## ADR-013: Consolidate multi-agent AI guidance into `CLAUDE.md`, then remove indirection

**Context**: The project accumulated separate config for multiple AI coding agents (Codex, Gemini) and split rule content across `docs/aiagent/rules/*` referenced by `@`-includes from `.claude/rules/*.md`.

**Decision**: Iterated through several structures:
1. Expanded `CLAUDE.md` to address all AI agents generically and added `.gemini/GEMINI.md` / `.codex/AGENTS.md` as pointer aliases (`eb745fb`).
2. Deleted the superseded legacy `.codex/config.toml` and `.gemini/settings.json` (`9a4954d`).
3. Moved specs from `docs/spec/*` into `docs/analyzed/*` and added `docs/analyzed/notes.md`, syncing `known_bugs.md`/`todo.md` with fix status (`b839a9a`).
4. Reversed the indirection: inlined rule content from `docs/aiagent/rules/` directly into `.claude/rules/*.md`, and extracted architecture/commands/VS Code notes out of `CLAUDE.md` into `docs/aiagent/project/` (`d3f32c0`).
5. Added YAML frontmatter to all `docs/analyzed/*` documents for consistency (`8f32ca0`), then adjusted the referenced rules path again (`71d8e7e`, `d40c941`).

**Consequences**: The current state (post `d40c941`) favors rules inlined directly in `.claude/rules/*.md` over `@`-reference indirection, with per-agent files (`AGENTS.md`, `GEMINI.md`) kept as thin aliases to `CLAUDE.md`. This area has churned across five+ commits — treat the current layout as provisional rather than settled.

## ADR-014: Version 0.3.0 release bundles the security/bug-fix batch

**Context**: The above security fixes (ADR-002, 003), correctness fixes (ADR-004–006, 008–011), and expanded unit-test coverage accumulated across many commits.

**Decision**: Bumped `package.json` to `0.3.0` and documented the batch (security fixes, 16 bug fixes, code-quality improvements, expanded tests) in `docs/README.md` release notes (`b3431c5`).

---

## Note on current uncommitted state

At the time this ADR was generated, `.claude/CLAUDE.md` (working tree) contains a line appended under "## General Rules" instructing to check all directories including `agents/`, `skills/`, and plugin/config directories. The line's phrasing (`Add under a ## General Rules section\n\n...`) suggests an edit instruction was pasted into the file verbatim rather than only its intended content — worth a quick look before this file is committed, since it doesn't match the surrounding section's style.
