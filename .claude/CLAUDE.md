# CLAUDE.md

This file provides guidance to any AI coding agent (claude.ai/code/Codex/Gemini/Cursor/Windsurf/Antigravity/and more) when working with code in this repository.

## Project Overview

VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) (PHP static analysis tool) into VS Code. Provides lint, analyze, format, and baseline operations with full diagnostics integration.

## Rules for AI Coding Agent

- **Code style:** @docs/.claude/rules/code-style.md
- **Security guidelines:** @docs/.claude/rules/security.md
- **Version control system guidelines:** @docs/.claude/rules/version-controll-system.md

## Project Docs

- **Architecture:** @docs/aiagent/project/architecture.md
- **Commands:** @docs/aiagent/project/commands.md
- **VS Code Extension Notes:** @docs/aiagent/project/vscode-extension-notes.md

## Source Code Explained Documents

- **Overview:** @docs/analyzed/overview.md
- **Configurations:** @docs/analyzed/configurations.md
- **Databases:** @docs/analyzed/databases.md
- **Components:** @docs/analyzed/components.md
- **Utilities:** @docs/analyzed/utilities.md
- **Screens:** @docs/analyzed/screens.md
- **Known bugs:** @docs/analyzed/known_bugs.md
- **Other notes:** @docs/analyzed/notes.md
- **To-do list:** @docs/analyzed/todo.md

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
