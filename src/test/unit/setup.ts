/**
 * Mocha setup file for pure unit tests.
 *
 * This file is loaded via `--require` before any test files, so the vscode
 * module mock is registered in Node's require cache before any production
 * code is imported.
 *
 * Strategy:
 *   1. Override Module._resolveFilename to return "vscode" as the resolved
 *      id when the request is "vscode" (bypasses the MODULE_NOT_FOUND error).
 *   2. Insert a fake Module into require.cache under the id "vscode".
 *   Any subsequent require('vscode') in production code will return the mock.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
// biome-ignore lint/suspicious/noExplicitAny: module cache manipulation requires any
const NodeModule = require("node:module") as any;

// ---------------------------------------------------------------------------
// Minimal VS Code API mock
// ---------------------------------------------------------------------------

const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
} as const;

class MockRange {
	start: { line: number; character: number };
	end: { line: number; character: number };

	constructor(
		startLine: number,
		startChar: number,
		endLine: number,
		endChar: number,
	) {
		this.start = { line: startLine, character: startChar };
		this.end = { line: endLine, character: endChar };
	}
}

class MockUri {
	fsPath: string;
	private constructor(fsPath: string) {
		this.fsPath = fsPath;
	}
	static file(p: string): MockUri {
		return new MockUri(p);
	}
	toString(): string {
		// VS Code Uri.toString() returns file:///path (3 slashes)
		const normalized = this.fsPath.replace(/\\/g, "/");
		const withLeadingSlash = normalized.startsWith("/")
			? normalized
			: `/${normalized}`;
		return `file://${withLeadingSlash}`;
	}
}

class MockLocation {
	uri: MockUri;
	range: MockRange;
	constructor(uri: MockUri, range: MockRange) {
		this.uri = uri;
		this.range = range;
	}
}

class MockDiagnosticRelatedInformation {
	location: MockLocation;
	message: string;
	constructor(location: MockLocation, message: string) {
		this.location = location;
		this.message = message;
	}
}

class MockDiagnostic {
	range: MockRange;
	message: string;
	severity: number;
	source?: string;
	code?: string;
	relatedInformation?: MockDiagnosticRelatedInformation[];

	constructor(range: MockRange, message: string, severity: number) {
		this.range = range;
		this.message = message;
		this.severity = severity;
	}
}

// Registry of all active diagnostic collections — used by getDiagnostics() below.
let _activeCollections: MockDiagnosticCollection[] = [];

class MockDiagnosticCollection {
	private _map = new Map<string, MockDiagnostic[]>();

	constructor() {
		_activeCollections.push(this);
	}

	get(uri: MockUri): readonly MockDiagnostic[] | undefined {
		return this._map.get(uri.toString());
	}

	set(uri: MockUri, diagnostics: MockDiagnostic[]): void {
		this._map.set(uri.toString(), diagnostics);
	}

	delete(uri: MockUri): void {
		this._map.delete(uri.toString());
	}

	clear(): void {
		this._map.clear();
	}

	dispose(): void {
		this._map.clear();
		_activeCollections = _activeCollections.filter((c) => c !== this);
	}

	/** Iterate over all [uri, diagnostics] entries in this collection. */
	entries(): IterableIterator<[string, MockDiagnostic[]]> {
		return this._map.entries();
	}
}

class MockOutputChannel {
	appendLine(_line: string): void {
		/* no-op */
	}
	append(_text: string): void {
		/* no-op */
	}
	show(_preserveFocus?: boolean): void {
		/* no-op */
	}
	clear(): void {
		/* no-op */
	}
	dispose(): void {
		/* no-op */
	}
}

const vscodeMock = {
	DiagnosticSeverity,
	Range: MockRange,
	Uri: MockUri,
	Location: MockLocation,
	DiagnosticRelatedInformation: MockDiagnosticRelatedInformation,
	Diagnostic: MockDiagnostic,
	languages: {
		createDiagnosticCollection: (_name: string) =>
			new MockDiagnosticCollection(),
		/**
		 * Aggregate all [uri, diagnostics] pairs from every active collection,
		 * mirroring the real vscode.languages.getDiagnostics() array-of-tuples shape.
		 */
		getDiagnostics: (): [MockUri, readonly MockDiagnostic[]][] => {
			const result: [MockUri, readonly MockDiagnostic[]][] = [];
			for (const col of _activeCollections) {
				for (const [uriStr, diags] of col.entries()) {
					// Reconstruct a MockUri from the stored string key (file:///path form)
					const fsPath = uriStr
						.replace(/^file:\/\//, "")
						.replace(/^\/([A-Za-z]:)/, "$1");
					result.push([MockUri.file(fsPath), diags]);
				}
			}
			return result;
		},
	},
	window: {
		createOutputChannel: (_name: string) => new MockOutputChannel(),
		showErrorMessage: (_msg: string, ..._items: string[]) =>
			Promise.resolve(undefined),
		showWarningMessage: (_msg: string, ..._items: string[]) =>
			Promise.resolve(undefined),
		showInformationMessage: (_msg: string, ..._items: string[]) =>
			Promise.resolve(undefined),
	},
	workspace: {
		getConfiguration: (_section?: string) => ({
			get: <T>(key: string, defaultValue?: T): T => {
				const defaults: Record<string, unknown> = {
					executablePath: "mago",
					lintOnSave: true,
					analyzeOnSave: true,
					formatOnSave: false,
					lintBaseline: "",
					analyzeBaseline: "",
				};
				return (key in defaults ? defaults[key] : defaultValue) as T;
			},
		}),
		getWorkspaceFolder: (_uri: MockUri) => undefined,
		workspaceFolders: undefined,
	},
};

// ---------------------------------------------------------------------------
// Step 1: Override _resolveFilename so 'vscode' doesn't throw MODULE_NOT_FOUND
// ---------------------------------------------------------------------------
const originalResolve = NodeModule._resolveFilename.bind(NodeModule);
NodeModule._resolveFilename = (
	request: string,
	// biome-ignore lint/suspicious/noExplicitAny: Module parent type
	parent: any,
	isMain: boolean,
	// biome-ignore lint/suspicious/noExplicitAny: Module options type
	options: any,
) => {
	if (request === "vscode") {
		return "vscode";
	}
	return originalResolve(request, parent, isMain, options);
};

// ---------------------------------------------------------------------------
// Step 2: Insert the fake module into require.cache under the id 'vscode'
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: require.cache type
const cache = (require as any).cache as Record<string, unknown>;
const fakeModule = new NodeModule("vscode");
fakeModule.exports = vscodeMock;
fakeModule.loaded = true;
// biome-ignore lint/complexity/useLiteralKeys: dynamic key required for module cache injection
cache["vscode"] = fakeModule;

// ---------------------------------------------------------------------------
// Test isolation helper
// ---------------------------------------------------------------------------

/**
 * Force-clear the internal registry of active MockDiagnosticCollection instances.
 *
 * Call this in a `beforeEach` block whenever a test file creates diagnostic
 * collections but may not always reach its `afterEach` teardown (e.g. on
 * unexpected test failure).  This prevents stale entries from leaking into
 * `vscode.languages.getDiagnostics()` in subsequent tests.
 *
 * @example
 * import { resetMockState } from "../unit/setup";
 * test.beforeEach(() => resetMockState());
 */
export function resetMockState(): void {
	_activeCollections = [];
}

// ---------------------------------------------------------------------------
// Playwright globalSetup export
// ---------------------------------------------------------------------------
// When this file is loaded as a Playwright globalSetup module, the default
// export is called once before any tests run.  The top-level code above has
// already registered the vscode mock, so nothing extra is needed here.
export default async function setup(): Promise<void> {
	// vscode mock is already registered by the module-level code above.
}
