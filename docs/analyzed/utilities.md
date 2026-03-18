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
Raw result of a `child_process.spawn` call. `exitCode` is `null` on spawn error.

### Internal Representation

#### `MagoIssue`
Normalised issue created by `MagoOutputParser` before conversion to `vscode.Diagnostic`. All positions are **0-indexed**.

```typescript
interface MagoIssue {
  file: string;       // Absolute path, normalised for current platform
  line: number;       // 0-indexed
  column?: number;    // 0-indexed
  severity: string;   // Raw string from mago (e.g. "Error", "warning")
  message: string;
  code?: string;
  notes?: string[];
  help?: string;
}
```

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
  kind: "Primary" | "Secondary" | string;
  span: MagoSpan;
  label?: string;
}
```
The parser prioritises the annotation with `kind === "Primary"` for range extraction.

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

## Build & Development Scripts

Defined in `package.json`:

| Script | Command |
|---|---|
| `compile` | `tsc -p ./` |
| `watch` | `tsc -watch -p ./` |
| `lint` | `biome check src/` |
| `lint:fix` | `biome check --write src/` |
| `test` | `node ./out/test/runTest.js` (VS Code environment required) |
| `test:unit` | `pnpm run compile && mocha --ui tdd ./out/test/suite/**/*.test.js` |
| `package` | `pnpm run compile && vsce package` |
| `install:vscode` | Build and install `.vsix` locally |
| `uninstall:vscode` | `code --uninstall-extension hidao80.mago-vsx` |

<!-- updated at a4509d9 -->
