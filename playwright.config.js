"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
exports.default = (0, test_1.defineConfig)({
    testDir: './src/test/unit',
    testMatch: ['**/*.test.ts', '**/*.unit.test.ts'],
    reporter: 'list',
    // globalSetup runs before any tests and injects the vscode module mock
    // into Node's require cache so production code can import 'vscode'.
    globalSetup: './src/test/unit/setup.ts',
    projects: [
        {
            name: 'unit',
            testMatch: ['**/*.test.ts', '**/*.unit.test.ts'],
        },
    ],
});
//# sourceMappingURL=playwright.config.js.map