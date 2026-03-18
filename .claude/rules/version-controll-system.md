---
name: version-controll-system
description: This document outlines the rules for using version control systems.
type: reference
---

# Version controll system guidelines

## Commit message format

Start with gitmoji, leave a space, and briefly describe the commit on the first line. Use bullet points only on subsequent lines if there are many changes. Keep these sentences concise as well.

**for example:**

```plain
# example1
:truck: Move docs and claude rules to subdirectories

# example2
:bug: Fix YAML step indentation in audit and build workflows

# example3
:sparkles: Add AI tool configuration files for Codex and Gemini

# example4
:memo: Add Claude docs and refactor CI workflows
  - Add .claude/CLAUDE.md, code-style.md, security.md for AI assistant guidance
  - Update .gitignore to track .claude/ docs while ignoring settings/histories/skills
  - Simplify CI workflows: remove step names, update checkout@v5, drop pull_request triggers
  - Reformat README badges to one-per-line
```

## Pull Request format

**for example:**

```markdown
## What
Remove `.claude/settings.local.json` from the repository.

## Why
This file contains machine-specific permission allowlists for Claude Code and should not be tracked in version control. It was accidentally committed and is now removed.

## How
Deleted the file. No functional changes to the application.

## Test case
- [ ] {Detail of test case1.}
- [ ] {Detail of test case2.}
- [ ] ...
```
