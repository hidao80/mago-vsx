---
name: analyzed-utilities
description: Summary of utility modules, helper functions, and their responsibilities.
type: analysis
---

# Utilities & Types

## Shared Type Definitions (`src/types.ts`)

All cross-module types are centralised here.

### Runner Types

#### `MagoCommand`
```typescript
type MagoCommand = "lint" | "analyze";
```
Union of the two mago sub-commands that produce diagnostics.

#### `SpawnResult`
```typescript
interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
```
Raw result of a `child_process.spawn` call. `exitCode` is `null` on spawn error or signal kill.

### Internal Representation

#### `MagoIssue`
Normalised issue created by `MagoOutputParser` before conversion to `vscode.Diagnostic`. All positions are **0-indexed**.

```typescript
interface MagoIssue {
  file: string;        // Absolute path, normalised for current platform
  line: number;        // 0-indexed
  column?: number;     // 0-indexed
  endLine?: number;    // 0-indexed end line (from JSON span). Absent for text-format issues.
  endColumn?: number;  // 0-indexed end column (from JSON span). Absent for text-format issues.
  severity: string;    // Raw string from mago (e.g. "Error", "warning")
  message: string;
  code?: string;
  notes?: string[];
  help?: string;
}
```

**Change from previous version**: `endLine?` and `endColumn?` fields were added to carry precise end-of-span positions from JSON output.

### Raw JSON Shapes (before normalisation)

#### `MagoPosition`
```typescript
interface MagoPosition { line: number; column: number; offset?: number; }
```
1-indexed in raw output.

#### `MagoFileId`
```typescript
interface MagoFileId { name: string; path?: string; }
```
`path` may carry a Windows `\\?\` prefix.

#### `MagoSpan`
```typescript
interface MagoSpan { file_id?: MagoFileId; start: MagoPosition; end: MagoPosition; }
```

#### `MagoAnnotation`
```typescript
interface MagoAnnotation {
  kind: "Primary" | "Secondary";
  span: MagoSpan;
  label?: string;
}
```
`kind` is now narrowly typed as `"Primary" | "Secondary"` (previously `"Primary" | "Secondary" | string`). The parser prioritises the annotation with `kind === "Primary"` for range extraction; falls back to first annotation if no Primary exists.

#### `MagoLevel` / `MagoSeverityText`
```typescript
type MagoLevel = "Error" | "Warning" | "Info" | "Hint";
type MagoSeverityText = "error" | "warning" | "info" | "hint";
```

#### `MagoJsonIssue`
The shape of a single issue in mago's JSON output.

```typescript
interface MagoJsonIssue {
  message: string;
  level?: MagoLevel | string;
  code?: string;
  annotations?: MagoAnnotation[];
  notes?: string[];
  help?: string;
  // Legacy fields (older mago output only):
  file?: string;
  line?: number;   // 1-indexed
  column?: number; // 1-indexed
}
```

#### `MagoJsonOutput`
Top-level union for the three output shapes mago may produce:

```typescript
type MagoJsonOutput =
  | MagoJsonIssue[]
  | { issues: MagoJsonIssue[] }
  | MagoJsonIssue;
```

## Module-level Validation Functions (`src/magoRunner.ts`)

These are exported from `magoRunner.ts` and usable by other modules:

| Function | Description |
|---|---|
| `isValidBaselinePath(inputPath: string): boolean` | Validates user-supplied baseline paths. Rejects empty, absolute paths, `..` segments, and shell metacharacters including `%`. |
| `isValidExecutablePath(executablePath: string): boolean` | Validates the `mago.executablePath` setting. Rejects empty and shell metacharacters. |

## Build & Development Scripts

Defined in `package.json`:

| Script | Command |
|---|---|
| `vscode:prepublish` | `pnpm run compile` (prepare for publishing) |
| `compile` | `tsc -p ./` |
| `watch` | `tsc -watch -p ./` |
| `pretest` | `pnpm run compile && tsc -p tsconfig.test.json --noEmit` |
| `lint` | `biome check src/` |
| `lint:fix` | `biome check --write src/` |
| `test` | `playwright test --config playwright.config.ts` |
| `package` | `pnpm run compile && vsce package` |
| `publish` | `pnpm run compile && vsce publish` |
| `install:vscode` | Build and install `.vsix` locally |
| `uninstall:vscode` | `code --uninstall-extension hidao80.mago-vsx` |

**Change from previous version**: The test runner was migrated from `@vscode/test-electron` + Mocha to **Playwright**. The old `test:unit` script (mocha) and `src/test/runTest.ts` / `src/test/suite/index.ts` are removed. New unit tests live in `src/test/unit/` and are discovered by `playwright.config.ts`.

<!-- updated at d40c941 -->
