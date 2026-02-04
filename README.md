# Mago - PHP Static Analysis for VS Code

![hero_image](https://github.com/user-attachments/assets/feee19ec-dace-4dc8-8da6-726035912f29)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![test](https://github.com/hidao80/mago-vsx/actions/workflows/test.yml/badge.svg)](https://github.com/hidao80/mago-vsx/actions/workflows/test.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hidao80/mago-vsx)

VS Code extension for integrating the Mago PHP static analysis tool.

## Features

- **Lint and Analyze PHP Files**: Run Mago's lint and analyze commands on individual files or entire projects
- **Format PHP Files**: Format your PHP code using Mago's formatter with support for format-on-save
- **Baseline Support**: Suppress existing issues and focus on new problems with baseline files
- **Problem Pane Integration**: View all detected issues in VS Code's Problems pane with collapsible details
- **Auto-run on Save**: Automatically lint, analyze, and format files when you save them
- **Command Palette Integration**: Access all Mago commands directly from the command palette
- **Smart Error Handling**: Clear error messages for TOML configuration errors and execution failures

## Commands

### Lint & Analyze

- `Mago: Lint Current File` - Run lint on the currently open PHP file
- `Mago: Analyze Current File` - Run analyze on the currently open PHP file
- `Mago: Lint & Analyze Current File` - Run both lint and analyze on the current file
- `Mago: Lint Project` - Run lint on the entire project
- `Mago: Analyze Project` - Run analyze on the entire project
- `Mago: Lint & Analyze Project` - Run both lint and analyze on the entire project

### Format

- `Mago: Format Current File` - Format the currently open PHP file
- `Mago: Format Project` - Format all PHP files in the project
- `Mago: Format Check (CI)` - Check if files are correctly formatted without modifying them

### Baseline Management

- `Mago: Generate Lint Baseline` - Generate a baseline file to suppress existing lint issues
- `Mago: Generate Analyze Baseline` - Generate a baseline file to suppress existing analysis issues

## Configuration

- `mago.lintOnSave` (default: `true`) - Run lint automatically when a PHP file is saved
- `mago.analyzeOnSave` (default: `true`) - Run analyze automatically when a PHP file is saved
- `mago.formatOnSave` (default: `false`) - Format file automatically when saved
- `mago.lintBaseline` (default: `""`) - Path to the lint baseline file
- `mago.analyzeBaseline` (default: `""`) - Path to the analyze baseline file
- `mago.executablePath` (default: `"mago"`) - Path to the Mago executable

### Baseline Feature

Baseline files allow you to suppress existing issues in your codebase and focus on new issues:

1. Generate a baseline file using `Mago: Generate Lint Baseline` or `Mago: Generate Analyze Baseline`
2. Configure the baseline path in settings: `mago.lintBaseline` or `mago.analyzeBaseline`
3. All lint/analyze commands will automatically use the baseline to filter out existing issues

This is useful for:
- Gradually improving code quality without fixing all existing issues at once
- Focusing on new issues in pull requests
- Establishing quality baselines for legacy codebases

## Requirements

- Mago PHP static analysis tool must be installed and available in your PATH, or you must specify the path in settings
- Node.js and pnpm (or npm) for development

## Development Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   # Using pnpm (recommended)
   pnpm install

   # Or using npm
   npm install
   ```
3. Compile the TypeScript code:
   ```bash
   # Using pnpm (recommended)
   pnpm run compile

   # Or using npm
   npm run compile
   ```
4. Press F5 to open a new VS Code window with the extension loaded

### Testing

For detailed testing instructions, see [TESTING.md](TESTING.md).

Quick test:
```bash
# Run VS Code extension tests
pnpm test

# Or test manually by installing the extension
pnpm run install:vscode
```

### Building VSIX Package

To build a `.vsix` package for distribution:

```bash
# Using pnpm (recommended)
pnpm run package

# Or using npm
npm run package
```

This will create a `mago-vsx-<version>.vsix` file in the project root.

### Installing to VS Code

To build and install the extension to your local VS Code:

```bash
# Using pnpm (recommended)
pnpm run install:vscode

# Or using npm
npm run install:vscode
```

To uninstall the extension from VS Code:

```bash
# Using pnpm (recommended)
pnpm run uninstall:vscode

# Or using npm
npm run uninstall:vscode
```

### Publishing to VS Code Marketplace

```bash
# Using pnpm (recommended)
pnpm run publish

# Or using npm
npm run publish
```

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Mago - PHP Static Analysis"
4. Click Install

### From VSIX File

1. Build or download the `.vsix` file
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
4. Click the "..." menu at the top
5. Select "Install from VSIX..."
6. Select the `mago-vscode-<version>.vsix` file

### Requirements

- Mago PHP static analysis tool must be installed and available in your PATH, or you must specify the path in settings

## Usage

1. Open a PHP file
2. The extension will automatically run lint and analyze on save (if enabled)
3. Or use the command palette (Ctrl+Shift+P / Cmd+Shift+P) and search for "Mago" commands
4. View detected issues in the Problems pane (View > Problems)

## Technical Highlights

- **Clean Architecture**: Refactored codebase with 26% code reduction while adding features
- **Type Safety**: Full TypeScript strict mode with comprehensive type definitions
- **Cross-Platform**: Tested on Windows, Linux, and macOS
- **Efficient Diagnostics**: Smart diagnostic merging for combined lint+analyze operations
- **JSON Validation**: Intelligent output parsing to distinguish valid empty results from errors
- **CI/CD**: Automated testing with security audits via GitHub Actions

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### 0.1.0

Initial release with comprehensive features:
- Lint and analyze support for current file and entire project
- Format support with format-on-save option
- Baseline generation and filtering
- Combined lint & analyze commands
- Auto-run on save (enabled by default)
- Problem pane integration with collapsible details
- Smart error handling for TOML configuration errors
