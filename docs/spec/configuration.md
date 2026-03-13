# Configuration

All settings live under the `mago` namespace in VS Code's workspace/user settings.

## Settings Reference

| Key | Type | Default | Description |
|---|---|---|---|
| `mago.lintOnSave` | `boolean` | `true` | Run `mago lint` automatically on PHP file save |
| `mago.analyzeOnSave` | `boolean` | `true` | Run `mago analyze` automatically on PHP file save |
| `mago.formatOnSave` | `boolean` | `false` | Run `mago fmt` automatically on PHP file save (runs before lint/analyze) |
| `mago.lintBaseline` | `string` | `""` | Path to lint baseline TOML file (passed as `--baseline`). Empty = disabled |
| `mago.analyzeBaseline` | `string` | `""` | Path to analyze baseline TOML file (passed as `--baseline`). Empty = disabled |
| `mago.executablePath` | `string` | `"mago"` | Path or name of the mago binary. Defaults to resolving via PATH |

## On-Save Execution Order

When a PHP file is saved, the extension executes in this fixed order:

1. `mago fmt` (if `formatOnSave: true`)
2. Clear `DiagnosticCollection` for that file (only if both `lintOnSave` and `analyzeOnSave` are true)
3. `mago lint` (if `lintOnSave: true`)
4. `mago analyze` (if `analyzeOnSave: true`)

The pre-clear step (2) prevents duplicate diagnostics when both lint and analyze are active.

## CLI Arguments Built from Config

### Diagnostic commands (lint / analyze)

```
mago <command> --reporting-format json [--baseline <path>] <target>
```

- `--reporting-format json` is always appended
- `--baseline <path>` is appended only when the corresponding baseline setting is non-empty
- `<target>` is either the file's `fsPath` (single-file) or `.` (project)

### Format commands

```
mago fmt <target>          # format
mago fmt --check .         # format check
```

### Baseline generation

```
mago <command> --generate-baseline --baseline <path> .
```

## mago.toml

The `mago` binary itself reads a `mago.toml` configuration file in the workspace. If the TOML is malformed, the extension detects the `Failed to build the configuration` error in subprocess output and surfaces a TOML parse-error notification with line/column details.

<!-- created at d1374d8 -->
