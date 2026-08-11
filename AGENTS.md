# AGENTS.md

This file provides guidance to any AI coding agent (Codex.ai/code/Codex/Gemini/Cursor/Windsurf/Antigravity/and more) when working with code in this repository.

## Project Overview

VS Code extension that integrates [Mago](https://github.com/carthage-software/mago) (PHP static analysis tool) into VS Code. Provides lint, analyze, format, and baseline operations with full diagnostics integration.

## Workflow

When starting a task, use the everything-Codex features relevant to that task.

- When performing code reviews, fix issues by severity (CRITICAL → HIGH → MEDIUM → LOW) and run tests after each fix before proceeding to the next. Do not batch large refactoring changes together.
- Add under a ## General Rules section\n\nWhen exploring the project structure, always check ALL directories including agents/, skills/, and any plugin/config directories. Do not skip non-standard directories.
