---
name: code-style
description: TypeScript coding conventions, linter settings, and formatting rules for this project
type: reference
---

# Code Style Guide

## Toolchain

- **Compiler**: TypeScript (`strict: true`, `target: ES2020`, `module: commonjs`)
- **Linter/Formatter**: Biome (`pnpm run lint` / `pnpm run lint:fix`) — do not use ESLint or Prettier
- **Type-check only**: `pnpm exec tsc --noEmit` (no emit)

## TypeScript Strict Settings (tsconfig.json)

All flags below are enabled. Any code additions or modifications must pass all of them.

| Flag | Meaning |
|---|---|
| `strict` | Enables strictNullChecks, noImplicitAny, etc. in one shot |
| `noUnusedLocals` | Unused local variables are errors |
| `noUnusedParameters` | Unused parameters are errors |
| `noImplicitReturns` | All code paths must return a value |
| `noFallthroughCasesInSwitch` | Fall-through in switch cases is forbidden |

## Naming Conventions

| Target | Case | Example |
|---|---|---|
| Classes, interfaces, type aliases | PascalCase | `MagoRunner`, `MagoJsonIssue` |
| Methods, variables, functions | camelCase | `runLint`, `parseJsonIssue` |
| File names | camelCase (including type files) | `magoRunner.ts`, `types.ts` |
| Enum values | PascalCase | `"Primary"`, `"Secondary"` |

## Import Style

```typescript
// Always use the `node:` protocol for built-in Node.js modules
import * as child_process from "node:child_process";
import * as path from "node:path";

// Use `import type` for type-only imports
import type { MagoCommand, SpawnResult } from "./types";

// Use regular import when mixing values and types
import { MagoOutputParser } from "./magoOutputParser";
```

## Basic Formatting

- Indent: **tabs** (Biome default)
- Strings: **double quotes** (enforced by Biome)
- Semicolons: **required**
- Trailing commas: add them to multi-line arguments, arrays, and objects

## Loops and Array Operations

Use `for...of` instead of `forEach` (enforced by Biome rules).

```typescript
// ✅ Correct
for (const item of items) { ... }

// ❌ Do not use
items.forEach(item => { ... });
```

## Non-null Assertions

Avoid `!` (non-null assertion) as much as possible. Use optional chaining `?.` or explicit null checks instead.

```typescript
// ✅ Preferred
diagnosticsByFile.get(filePath)?.push(diagnostic);

// ❌ Avoid
diagnosticsByFile.get(filePath)!.push(diagnostic);
```

## Where to Put Type Definitions

Consolidate all types shared across multiple modules in `src/types.ts`. Types used only within a single file may be defined locally in that file.

## Error Handling

In `catch` blocks, use the short-form `catch` (no variable) when the exception is unused, or type the variable when its content is needed — either way must be accepted by Biome.

```typescript
// When the exception content is not used
try { ... } catch { ... }

// When the exception content is used
try { ... } catch (e: unknown) {
  if (e instanceof Error) { ... }
}
```
