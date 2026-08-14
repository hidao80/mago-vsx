# Testing Guide

This document describes how to test the Mago VSX extension.

## Test Architecture

All tests run via **Playwright** (no VS Code headless runner). The VS Code API is provided
by a lightweight mock registered in `src/test/unit/setup.ts`, which intercepts `require('vscode')`
at Node module resolution level before any production code is imported.

```
src/test/
├── unit/
│   ├── setup.ts                        # VS Code API mock + Playwright globalSetup
│   ├── isValidBaselinePath.test.ts     # Path validation unit tests
│   └── magoOutputParser.unit.test.ts   # Parser unit tests
└── suite/
    ├── magoOutputParser.test.ts        # MagoOutputParser integration tests
    └── magoRunner.test.ts              # MagoRunner integration tests
```

TypeScript type checking is enforced on **both** production and test files:

| Config | Covers | Purpose |
|--------|--------|---------|
| `tsconfig.json` | `src/**` (excl. tests) | Production build |
| `tsconfig.test.json` | `src/**` (incl. tests) | Test type checking |

## Running Tests

### Full test suite

```bash
bun run test
```

This command:
1. Compiles TypeScript (`tsc -p ./`)
2. Type-checks all test files (`tsc -p tsconfig.test.json --noEmit`)
3. Runs Playwright tests (`playwright test --config playwright.config.ts`)

### Compile only

```bash
bun run compile
```

### Lint

```bash
# Check
bun run lint

# Auto-fix
bun run lint:fix
```

### Manual testing via local install

```bash
# Build and install to your local VS Code (version is resolved automatically)
bun run install:vscode

# Uninstall
bun run uninstall:vscode
```

## F5 Debug Mode

1. Open the project in VS Code
2. Press **F5** (or select **Run Extension** in the Run & Debug panel)
3. A new VS Code window opens with the extension loaded
4. Open any PHP file to test

## Test Coverage

### `isValidBaselinePath`

- Accepts valid relative paths and nested paths without traversal
- Rejects empty strings
- Rejects `..` path traversal (both `/` and `\` separators)
- Rejects absolute Unix paths (`/etc/passwd`)
- Rejects absolute Windows paths (`C:\...`)
- Rejects shell metacharacters (`&`, `|`, `;`, `$`, `>`, `<`, `` ` ``, `!`, `*`, `?`, `()`, `[]`, `{}`, `%`)

### `isValidExecutablePath`

- Accepts plain executable names (`mago`)
- Accepts absolute paths (`/usr/local/bin/mago`, `C:\tools\mago.exe`)
- Rejects shell metacharacters that enable command injection via `cmd.exe`

### `MagoOutputParser`

- JSON output parsing (annotations format)
- JSON array parsing
- JSON with `issues` property
- Windows path normalization (`\\?\` prefix)
- Text-format output parsing
- Project-wide output parsing
- Error handling (empty output, invalid JSON, missing required fields)
- Multiple severity levels (Error, Warning, Info, Hint)
- Type-safe element filtering in `normalizeJsonToArray`

### `MagoRunner`

- Instance creation and configuration reading
- `buildDiagnosticCommandArgs` — correct flags and baseline injection
- `mergeDiagnostics` — appending to existing, empty collection, no-op merge
- `checkForErrors` — clean output, empty stderr, PHP identifier false-positive guard, database error, TOML error, generic error
- `notifyDiagnosticResult` — project mode, file mode, empty output, invalid JSON output
- `isValidBaselinePath` — boundary cases (inline re-export test)
- `DiagnosticCollection` operations (set, get, clear, multi-file)
- `OutputChannel` operations

## Sample mago JSON Output

```json
{
  "level": "Error",
  "code": "malformed-docblock-comment",
  "message": "Failed to parse function-like docblock comment.",
  "notes": ["Parameter must have type followed by variable name"],
  "help": "Ensure type is followed by a valid parameter name (e.g., `$param`)",
  "annotations": [{
    "kind": "Primary",
    "span": {
      "file_id": {
        "name": "app\\framework\\AltoRouter.php",
        "path": "\\\\?\\F:\\project\\HovelAPI\\app\\framework\\AltoRouter.php"
      },
      "start": { "offset": 4801, "line": 142, "column": 1 },
      "end": { "offset": 4877, "line": 142, "column": 77 }
    }
  }]
}
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Compile errors | Run `bun run compile` and check output |
| Test type errors | Run `bunx tsc -p tsconfig.test.json --noEmit` |
| mago command not found | Check `mago.executablePath` setting; verify mago is in `PATH` |
| Nothing in Problems pane | Check **Output** > **Mago** channel for raw output |

## CI/CD

GitHub Actions runs the following checks on every push:

| Workflow | What it checks |
|----------|---------------|
| `audit.yml` | `bun audit` + Takumi Guard supply-chain scan |
| `lint.yml` | Biome lint |
| `build.yml` | TypeScript compile + VSIX package |
| `test.yml` | Full `bun run test` (Xvfb on Linux for Playwright) |

CI test step (Linux):

```yaml
- name: Setup Xvfb for headless testing
  run: |
    sudo apt-get update
    sudo apt-get install -y xvfb libgtk-3-0 libgbm1 libasound2

- name: Run tests
  uses: coactions/setup-xvfb@v1
  with:
    run: bun run test
```

For full workflow details see [.github/workflows/README.md](.github/workflows/README.md).
