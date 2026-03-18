---
name: vscode-extension-notes
description: VS Code-specific operational notes for this extension
type: reference
---

# VS Code Extension Notes

- Activation event: `onLanguage:php`
- Minimum VS Code version: `1.80.0`
- Build output is written to `out/`; do not edit compiled files directly
- For debugging, press `F5` in VS Code to launch the Extension Development Host
- The project uses Biome, not ESLint or Prettier
- Configuration keys:
  - `mago.lintOnSave`
  - `mago.analyzeOnSave`
  - `mago.formatOnSave`
  - `mago.lintBaseline`
  - `mago.analyzeBaseline`
  - `mago.executablePath`
- Lint and analyze diagnostics share one `DiagnosticCollection`; clear the target entry once before running both to avoid duplicates
