---
name: security
description: Security constraints, known risks, and safe coding patterns for this VS Code extension
type: reference
---

# Security Guide

## Security Model of This Extension

- **No external communication**: No network requests are made. All processing happens locally.
- **No data persistence**: No IndexedDB, localStorage, or file writes. Diagnostics are held only in `vscode.DiagnosticCollection` (in-memory).
- **User-configured executable**: The value of `mago.executablePath` is passed directly to `child_process.spawn`. Validation is left to the user; the extension does not verify the path.

## Safe Use of child_process

### Use spawn, not exec

```typescript
// ✅ Current implementation (correct)
child_process.spawn(magoPath, args, { cwd, shell: process.platform === "win32" });

// ❌ Do not use (risk of shell injection)
child_process.exec(`mago lint ${filePath}`);
```

Always pass `args` as a string array. Never build commands by concatenating template literals or command strings.

### The shell option on Windows

`shell: process.platform === "win32"` is used solely to locate `mago` via PATH on Windows. When `shell` is true, each element of `args` is expanded by the shell, so be careful that paths containing user input do not include shell metacharacters. Currently only workspace file paths are passed, so this is safe.

## Handling File Paths

Mago's JSON output may contain Windows extended path format (`\\?\C:\...`). `magoOutputParser.ts` strips this prefix during normalization.

```typescript
// Strip \\?\ prefix (magoOutputParser.ts:288)
rawPath = rawPath.replace(/^\\\\\?\\/, "");
```

Always use `path.normalize` / `path.join` when constructing paths; never use raw string concatenation.

## Merging and Clearing Diagnostics

Both lint and analyze write into the same `DiagnosticCollection`. When both run simultaneously, clear the collection first to prevent duplicates. Forgetting this step will leave stale diagnostics. Always follow this pattern when adding a new command that displays diagnostics:

```typescript
// Clear before running both
diagnosticCollection.delete(fileUri); // per file
// or
diagnosticCollection.clear();         // entire project
```

## Dependency Management

Known-vulnerable transitive dependencies are pinned via `pnpm.overrides` in `package.json`. Run `pnpm audit` before adding any new dependency and confirm there are no issues.

Current overrides:
- `lodash` (Prototype Pollution)
- `undici` (security fix)
- `diff` (ReDoS)
- `@isaacs/brace-expansion` (ReDoS)
- `qs` (Prototype Pollution)
- `markdown-it` (XSS)
- `ajv` (security fix)
- `minimatch` (ReDoS)

## What Must Not Be Added

The following are prohibited in principle. If unavoidable, state the reason in the commit message.

| Prohibited | Reason |
|---|---|
| External communication via `fetch` / `axios` etc. | Risk of unintended data exfiltration |
| `eval` / `new Function` | Arbitrary code execution risk |
| Shell command execution via `exec` | Shell injection risk |
| File system writes (except baseline generation) | Modifying files without user consent |
| Hardcoded secrets or API keys | Information leakage risk |
