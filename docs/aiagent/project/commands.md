---
name: project-commands
description: Common development and maintenance commands for this repository
type: reference
---

# Project Commands

## Build and type-check

- `pnpm compile`: Compile TypeScript to `out/`
- `pnpm watch`: Run the TypeScript compiler in watch mode
- `pnpm exec tsc --noEmit`: Type-check without writing output

## Lint

- `pnpm lint`: Run Biome checks for `src/`
- `pnpm lint:fix`: Run Biome with auto-fixes

## Test

- `pnpm test`: Run the full VS Code test suite via `@vscode/test-electron`
- `pnpm test:unit`: Run unit tests only without launching VS Code

## Package and local install

- `pnpm package`: Build and package the extension as a `.vsix`
- `pnpm install:vscode`: Package and install the extension locally
- `pnpm uninstall:vscode`: Uninstall the extension from VS Code
