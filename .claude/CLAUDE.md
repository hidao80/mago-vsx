# CLAUDE.md

This file provides guidance to any AI coding agent (claude.ai/code/Codex/Gemini/Cursor/Windsurf/Antigravity/and more) when working with code in this repository.

## Project Overview

VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) (PHP static analysis tool) into VS Code. Provides lint, analyze, format, and baseline operations with full diagnostics integration.

## Workflow

When starting any task, read the files below that are relevant to the task:

- Modifying UI components or screens → read `docs/analyzed/components.md`, `docs/analyzed/screens.md`, `docs/.claude/rules/version-controll-system.md`
- Modifying data persistence → read `docs/analyzed/databases.md`
- Modifying utilities or helper functions → read `docs/analyzed/utilities.md`
- Adding new features → read `docs/analyzed/todo.md`, `docs/analyzed/known_bugs.md`, `docs/analyzed/notes.md`, `docs/aiagent/project/vscode-extension-notes.md`
- Checking build or dev commands → read `docs/aiagent/project/commands.md`
- Reviewing configuration (Vite, TypeScript, Tailwind, i18n) → read `docs/analyzed/configuration.md`

## Always-loaded Documents

- @.claude/rules/code-style.md
- @.claude/rules/security.md
- @docs/aiagent/project/architecture.md
- @docs/analyzed/overview.md

## Subagents

Use the following sub-agents in parallel, if available.

- **Code Review:** `code-reviewer`
- **Test:** `code-tester`

## Key Files

- `src/extension.ts`: Entry point for activation, command registration, and save listeners
- `src/magoRunner.ts`: Executes the `mago` process and builds CLI arguments
- `src/magoOutputParser.ts`: Converts Mago output into VS Code diagnostics
- `src/types.ts`: Shared types used across the extension

## Test Structure

- `src/test/suite/magoOutputParser.test.ts`: Parser-focused unit tests
- `src/test/suite/magoRunner.test.ts`: Runner-focused unit tests
- `src/test/runTest.ts`: VS Code integration test entry point
