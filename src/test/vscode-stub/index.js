// Minimal VS Code API mock, published as a real local "vscode" package via
// pnpm's `link:` protocol (see package.json devDependencies). This lets
// production code's `import * as vscode from "vscode"` resolve through
// Node's normal module resolution — no Module._resolveFilename patching
// needed, which avoids fighting Playwright's own static import resolver.

const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
};

class MockRange {
	constructor(startLine, startChar, endLine, endChar) {
		this.start = { line: startLine, character: startChar };
		this.end = { line: endLine, character: endChar };
	}
}

class MockUri {
	constructor(fsPath) {
		this.fsPath = fsPath;
	}
	static file(p) {
		return new MockUri(p);
	}
	toString() {
		// VS Code Uri.toString() returns file:///path (3 slashes)
		const normalized = this.fsPath.replace(/\\/g, "/");
		const withLeadingSlash = normalized.startsWith("/")
			? normalized
			: `/${normalized}`;
		return `file://${withLeadingSlash}`;
	}
}

class MockLocation {
	constructor(uri, range) {
		this.uri = uri;
		this.range = range;
	}
}

class MockDiagnosticRelatedInformation {
	constructor(location, message) {
		this.location = location;
		this.message = message;
	}
}

class MockDiagnostic {
	constructor(range, message, severity) {
		this.range = range;
		this.message = message;
		this.severity = severity;
	}
}

// Registry of all active diagnostic collections — used by getDiagnostics() below.
let _activeCollections = [];

class MockDiagnosticCollection {
	constructor() {
		this._map = new Map();
		_activeCollections.push(this);
	}

	get(uri) {
		return this._map.get(uri.toString());
	}

	set(uri, diagnostics) {
		this._map.set(uri.toString(), diagnostics);
	}

	delete(uri) {
		this._map.delete(uri.toString());
	}

	clear() {
		this._map.clear();
	}

	dispose() {
		this._map.clear();
		_activeCollections = _activeCollections.filter((c) => c !== this);
	}

	/** Iterate over all [uri, diagnostics] entries in this collection. */
	entries() {
		return this._map.entries();
	}
}

class MockOutputChannel {
	appendLine(_line) {
		/* no-op */
	}
	append(_text) {
		/* no-op */
	}
	show(_preserveFocus) {
		/* no-op */
	}
	clear() {
		/* no-op */
	}
	dispose() {
		/* no-op */
	}
}

/**
 * Force-clear the internal registry of active MockDiagnosticCollection instances.
 *
 * Call this in a `beforeEach` block whenever a test file creates diagnostic
 * collections but may not always reach its `afterEach` teardown (e.g. on
 * unexpected test failure). This prevents stale entries from leaking into
 * `vscode.languages.getDiagnostics()` in subsequent tests.
 */
function resetMockState() {
	_activeCollections = [];
}

module.exports = {
	DiagnosticSeverity,
	Range: MockRange,
	Uri: MockUri,
	Location: MockLocation,
	DiagnosticRelatedInformation: MockDiagnosticRelatedInformation,
	Diagnostic: MockDiagnostic,
	languages: {
		createDiagnosticCollection: (_name) => new MockDiagnosticCollection(),
		/**
		 * Aggregate all [uri, diagnostics] pairs from every active collection,
		 * mirroring the real vscode.languages.getDiagnostics() array-of-tuples shape.
		 */
		getDiagnostics: () => {
			const result = [];
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
		createOutputChannel: (_name) => new MockOutputChannel(),
		showErrorMessage: (_msg, ..._items) => Promise.resolve(undefined),
		showWarningMessage: (_msg, ..._items) => Promise.resolve(undefined),
		showInformationMessage: (_msg, ..._items) => Promise.resolve(undefined),
	},
	workspace: {
		getConfiguration: (_section) => ({
			get: (key, defaultValue) => {
				const defaults = {
					executablePath: "mago",
					lintOnSave: true,
					analyzeOnSave: true,
					formatOnSave: false,
					lintBaseline: "",
					analyzeBaseline: "",
				};
				return key in defaults ? defaults[key] : defaultValue;
			},
		}),
		getWorkspaceFolder: (_uri) => undefined,
		workspaceFolders: undefined,
	},
	resetMockState,
};
