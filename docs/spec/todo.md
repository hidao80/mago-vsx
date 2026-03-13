# TODO

## Code Quality

- [ ] Merge `severityToVSCode` and `magoLevelToVSCode` into a single method in `MagoOutputParser` — they are identical
- [ ] Add unit tests for `MagoOutputParser.parseProject` covering relative paths on Windows
- [ ] Add a test that verifies the duplicate-diagnostic guard (pre-clear) when both lint and analyze fire on save

## Features / Enhancements

- [ ] Add `mago.clearDiagnostics` command to let users manually clear the Problems pane without reloading
- [ ] Surface annotation `label` text in diagnostic messages or related information
- [ ] Support `Secondary` annotations as additional `DiagnosticRelatedInformation` with file locations
- [ ] Consider adding a status bar item showing the number of active mago diagnostics

## Testing

- [ ] Set up Vitest or additional Mocha unit tests that do not require a VS Code environment (currently only `test:unit` avoids VS Code, but coverage is sparse)
- [ ] Add E2E tests with a real PHP fixture file using `@vscode/test-electron`

## CI / Infra

- [ ] Re-evaluate whether `pull_request` triggers should be re-added to audit/lint/test workflows (currently push-only)
- [ ] Pin `actions/checkout` to a specific SHA in addition to the version tag

<!-- created at d1374d8 -->
