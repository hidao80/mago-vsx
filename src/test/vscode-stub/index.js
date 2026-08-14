// Minimal VS Code API mock, published as a real local "vscode" package via
// Bun's `file:` protocol (see package.json devDependencies). This lets
// production code's `import * as vscode from "vscode"` resolve through
// Node's normal module resolution — no Module._resolveFilename patching
// needed, which avoids fighting Playwright's own static import resolver.

const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
};

/** Mock of vscode.Range: a start/end line-and-character position pair. */
class MockRange {
	/** @param {number} startLine @param {number} startChar @param {number} endLine @param {number} endChar */
	constructor(startLine, startChar, endLine, endChar) {
		this.start = { line: startLine, character: startChar };
		this.end = { line: endLine, character: endChar };
	}
}

/** Mock of vscode.Uri: wraps a filesystem path and formats it as a file:// URI string. */
class MockUri {
	/** @param {string} fsPath */
	constructor(fsPath) {
		this.fsPath = fsPath;
	}
	/** Create a MockUri from a filesystem path, mirroring vscode.Uri.file(). */
	static file(p) {
		return new MockUri(p);
	}
	/** Format this URI as a file:// string. */
	toString() {
		// VS Code Uri.toString() returns file:///path (3 slashes)
		const normalized = this.fsPath.replace(/\\/g, "/");
		const withLeadingSlash = normalized.startsWith("/")
			? normalized
			: `/${normalized}`;
		return `file://${withLeadingSlash}`;
	}
}

/** Mock of vscode.Location: pairs a URI with a range within it. */
class MockLocation {
	/** @param {MockUri} uri @param {MockRange} range */
	constructor(uri, range) {
		this.uri = uri;
		this.range = range;
	}
}

/** Mock of vscode.DiagnosticRelatedInformation: a note attached to a diagnostic. */
class MockDiagnosticRelatedInformation {
	/** @param {MockLocation} location @param {string} message */
	constructor(location, message) {
		this.location = location;
		this.message = message;
	}
}

/** Mock of vscode.Diagnostic: a single reported issue with a range, message, and severity. */
class MockDiagnostic {
	/** @param {MockRange} range @param {string} message @param {number} severity */
	constructor(range, message, severity) {
		this.range = range;
		this.message = message;
		this.severity = severity;
	}
}

// Registry of all active diagnostic collections — used by getDiagnostics() below.
let _activeCollections = [];

/** Mock of vscode.DiagnosticCollection: an in-memory map from URI string to diagnostics. */
class MockDiagnosticCollection {
	/** Register this collection in the active-collections list so getDiagnostics() can find it. */
	constructor() {
		this._map = new Map();
		_activeCollections.push(this);
	}

	/** Return the diagnostics stored for the given URI, or undefined. */
	get(uri) {
		return this._map.get(uri.toString());
	}

	/** Replace the diagnostics stored for the given URI. */
	set(uri, diagnostics) {
		this._map.set(uri.toString(), diagnostics);
	}

	/** Remove all diagnostics stored for the given URI. */
	delete(uri) {
		this._map.delete(uri.toString());
	}

	/** Remove all diagnostics for every URI in this collection. */
	clear() {
		this._map.clear();
	}

	/** Clear the collection and unregister it from the active-collections list. */
	dispose() {
		this._map.clear();
		_activeCollections = _activeCollections.filter((c) => c !== this);
	}

	/** Iterate over all [uri, diagnostics] entries in this collection. */
	entries() {
		return this._map.entries();
	}
}

/** Mock of vscode.OutputChannel: all methods are no-ops, since tests don't assert on log output. */
class MockOutputChannel {
	/** No-op: mirrors vscode.OutputChannel.appendLine(). */
	appendLine(_line) {
		/* no-op */
	}
	/** No-op: mirrors vscode.OutputChannel.append(). */
	append(_text) {
		/* no-op */
	}
	/** No-op: mirrors vscode.OutputChannel.show(). */
	show(_preserveFocus) {
		/* no-op */
	}
	/** No-op: mirrors vscode.OutputChannel.clear(). */
	clear() {
		/* no-op */
	}
	/** No-op: mirrors vscode.OutputChannel.dispose(). */
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
