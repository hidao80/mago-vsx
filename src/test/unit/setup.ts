/**
 * Playwright globalSetup for tests that need the "vscode" module mocked.
 *
 * The mock itself lives in src/test/vscode-stub and is wired up as a real,
 * npm-resolvable "vscode" package via pnpm's `link:` protocol (see
 * package.json devDependencies). Node's normal module resolution finds it,
 * so production code's `import * as vscode from "vscode"` just works —
 * no Module._resolveFilename patching required.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
// biome-ignore lint/suspicious/noExplicitAny: vscode stub has no type declarations
const vscodeMock = require("vscode") as any;

/**
 * Force-clear the internal registry of active MockDiagnosticCollection instances.
 *
 * Call this in a `beforeEach` block whenever a test file creates diagnostic
 * collections but may not always reach its `afterEach` teardown (e.g. on
 * unexpected test failure). This prevents stale entries from leaking into
 * `vscode.languages.getDiagnostics()` in subsequent tests.
 *
 * @example
 * import { resetMockState } from "../unit/setup";
 * test.beforeEach(() => resetMockState());
 */
export function resetMockState(): void {
	vscodeMock.resetMockState();
}

// ---------------------------------------------------------------------------
// Playwright globalSetup export
// ---------------------------------------------------------------------------
export default async function setup(): Promise<void> {
	// The vscode mock is already resolvable via normal module resolution;
	// nothing to do here.
}
