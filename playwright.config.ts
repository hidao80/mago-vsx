import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/test',
  globalSetup: './src/test/unit/setup',
  reporter: 'list',
  // Global timeout per test (ms). Prevents a hung async mock from blocking the suite.
  timeout: 10_000,
  // Run projects sequentially to ensure the vscode mock registered by setup.ts
  // in one project does not interfere with the other project's module cache state.
  fullyParallel: false,
  projects: [
    {
      // Pure unit tests that do not require the VS Code Extension Host.
      // Each test file imports ../unit/setup to register the vscode mock.
      name: 'unit',
      testDir: './src/test/unit',
      testMatch: ['**/*.test.ts', '**/*.unit.test.ts'],
    },
    {
      // Integration-style tests that exercise MagoRunner / MagoOutputParser
      // with the vscode mock loaded via ../unit/setup.
      name: 'suite',
      testDir: './src/test/suite',
      testMatch: ['**/*.test.ts'],
    },
  ],
});
