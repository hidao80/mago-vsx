/**
 * Mago VS Code Extension — shared type definitions.
 *
 * All types that are used across more than one module live here so that
 * the individual source files stay focused on behaviour rather than
 * data-shape declarations.
 */

// ---------------------------------------------------------------------------
// Runner types
// ---------------------------------------------------------------------------

/** The two Mago sub-commands that produce diagnostics. */
export type MagoCommand = "lint" | "analyze";

/** Raw result returned after spawning a mago child process. */
export interface SpawnResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

// ---------------------------------------------------------------------------
// Parsed issue (internal representation)
// ---------------------------------------------------------------------------

/**
 * Normalised issue created by MagoOutputParser before it is converted into a
 * vscode.Diagnostic.  Line / column values are already 0-indexed here.
 */
export interface MagoIssue {
	/** Absolute file path (normalised for the current platform). */
	file: string;
	/** 0-indexed line number. */
	line: number;
	/** 0-indexed column number. */
	column?: number;
	/** Raw severity string as received from mago (e.g. "Error", "warning"). */
	severity: string;
	message: string;
	code?: string;
	notes?: string[];
	help?: string;
}

// ---------------------------------------------------------------------------
// Mago JSON output shapes (raw, before normalisation)
// ---------------------------------------------------------------------------

/** A source position inside a Mago span (1-indexed). */
export interface MagoPosition {
	line: number;
	column: number;
	offset?: number;
}

/** Identifies the source file referenced by a span. */
export interface MagoFileId {
	/** Human-readable name (often the same as `path`). */
	name: string;
	/** Absolute path on disk; may carry a Windows `\\?\` prefix. */
	path?: string;
}

/** A source range (span) inside a Mago annotation. */
export interface MagoSpan {
	file_id?: MagoFileId;
	start: MagoPosition;
	end: MagoPosition;
}

/** A single annotation attached to a Mago issue. */
export interface MagoAnnotation {
	/** `"Primary"` marks the main location; `"Secondary"` marks related sites. */
	kind: "Primary" | "Secondary" | string;
	span: MagoSpan;
	/** Optional label displayed next to the span in Mago's own output. */
	label?: string;
}

/**
 * Severity levels used in Mago's JSON output (`level` field).
 * The string comparison in the parser is case-insensitive, but these are the
 * canonical values produced by Mago itself.
 */
export type MagoLevel = "Error" | "Warning" | "Info" | "Hint";

/**
 * Severity strings used in Mago's text-format output.
 * These are always lower-case in the text representation.
 */
export type MagoSeverityText = "error" | "warning" | "info" | "hint";

/**
 * A single issue as it arrives in Mago's JSON output.
 *
 * Both the array-of-issues format and the `{ issues: [...] }` wrapper format
 * contain objects of this shape.
 */
export interface MagoJsonIssue {
	message: string;
	level?: MagoLevel | string;
	code?: string;
	annotations?: MagoAnnotation[];
	notes?: string[];
	help?: string;
	/** Present only in older / legacy Mago output. */
	file?: string;
	/** Present only in older / legacy Mago output (1-indexed). */
	line?: number;
	/** Present only in older / legacy Mago output (1-indexed). */
	column?: number;
}

/**
 * Top-level shape of Mago's JSON output.
 *
 * Mago may return:
 *   - a bare array:              `MagoJsonIssue[]`
 *   - a wrapper object:          `{ issues: MagoJsonIssue[] }`
 *   - a single issue object:     `MagoJsonIssue`
 */
export type MagoJsonOutput =
	| MagoJsonIssue[]
	| { issues: MagoJsonIssue[] }
	| MagoJsonIssue;
