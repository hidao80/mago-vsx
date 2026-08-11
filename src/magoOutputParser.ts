import * as path from "node:path";
import * as vscode from "vscode";
import type { MagoAnnotation, MagoIssue, MagoJsonIssue } from "./types";

/**
 * Parses raw mago CLI output (both JSON and text-format) into VS Code
 * diagnostics.  Supports single-file and project-wide result sets.
 */
export class MagoOutputParser {
	/** Regex matching mago text-format lines: `path:line[:col]: severity: message` */
	private static readonly LINE_PATTERN =
		/^(.+?):(\d+)(?::(\d+))?:\s*(error|warning|info|hint):\s*(.+)$/;

	/**
	 * Parse mago output for a single file into VS Code diagnostics.
	 *
	 * `fileUri` is used as the location for `relatedInformation` entries when
	 * the JSON output contains annotations (see `parseJsonIssue`).  For
	 * text-format output it is passed through to `parseLine` but not used to
	 * set the diagnostic file — text-format lines already embed the file path.
	 * @param output - Raw stdout string produced by the mago process.
	 * @param fileUri - URI of the PHP file that was analysed.
	 * @returns Array of {@link vscode.Diagnostic} objects ready to be displayed in the editor.
	 */
	parse(output: string, fileUri: vscode.Uri): vscode.Diagnostic[] {
		const diagnostics: vscode.Diagnostic[] = [];

		// First, attempt to parse as a whole JSON value
		try {
			const jsonData = JSON.parse(output.trim());
			for (const item of this.normalizeJsonToArray(jsonData)) {
				const diagnostic = this.parseJsonIssue(item, fileUri);
				if (diagnostic) {
					diagnostics.push(diagnostic);
				}
			}
			return diagnostics;
		} catch {
			// Not JSON — fall back to line-by-line parsing
			const lines = output.split("\n");
			for (const line of lines) {
				const diagnostic = this.parseLine(line, fileUri);
				if (diagnostic) {
					diagnostics.push(diagnostic);
				}
			}
		}

		return diagnostics;
	}

	/**
	 * Parse mago output for a whole-project command into a map of file path → diagnostics.
	 * Supports both JSON and text-format output; groups results by absolute file path.
	 * @param output - Raw stdout string produced by the mago process.
	 * @param workspaceFolder - Absolute path of the workspace root (used to resolve relative paths).
	 * @returns A map from absolute file paths to their corresponding {@link vscode.Diagnostic} arrays.
	 */
	parseProject(
		output: string,
		workspaceFolder: string,
	): Map<string, vscode.Diagnostic[]> {
		const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

		// First, attempt to parse as a whole JSON value
		try {
			const jsonData = JSON.parse(output.trim());
			for (const item of this.normalizeJsonToArray(jsonData)) {
				const issue = this.jsonToIssue(item, workspaceFolder);
				if (issue) {
					this.addDiagnosticForFile(
						diagnosticsByFile,
						issue.file,
						this.issueToDiagnostic(issue),
					);
				}
			}

			return diagnosticsByFile;
		} catch {
			// Not JSON — fall back to line-by-line parsing
			const lines = output.split("\n");
			for (const line of lines) {
				const issue = this.parseLineToIssue(line, workspaceFolder);
				if (issue) {
					this.addDiagnosticForFile(
						diagnosticsByFile,
						issue.file,
						this.issueToDiagnostic(issue),
					);
				}
			}
		}

		return diagnosticsByFile;
	}

	/**
	 * Normalise Mago JSON output to an array.
	 * Handles three shapes: bare array, {issues:[]}, and single object.
	 * @param jsonData - Parsed JSON value of unknown shape from mago stdout.
	 * @returns An array of {@link MagoJsonIssue} objects to iterate over.
	 */
	private normalizeJsonToArray(jsonData: unknown): MagoJsonIssue[] {
		// Type guard that checks for the required `message` field in addition to being an object.
		// This ensures downstream consumers (parseJsonIssue / jsonToIssue) can safely access json.message.
		const isMagoJsonIssue = (v: unknown): v is MagoJsonIssue =>
			v !== null && typeof v === "object" && "message" in v;
		if (Array.isArray(jsonData)) {
			return jsonData.filter(isMagoJsonIssue);
		}
		if (
			jsonData !== null &&
			typeof jsonData === "object" &&
			"issues" in jsonData &&
			Array.isArray((jsonData as Record<string, unknown>).issues)
		) {
			return (
				(jsonData as Record<string, unknown>).issues as unknown[]
			).filter(isMagoJsonIssue);
		}
		if (isMagoJsonIssue(jsonData)) {
			return [jsonData];
		}
		return [];
	}

	private addDiagnosticForFile(
		diagnosticsByFile: Map<string, vscode.Diagnostic[]>,
		filePath: string,
		diagnostic: vscode.Diagnostic,
	): void {
		const existing = diagnosticsByFile.get(filePath) ?? [];
		diagnosticsByFile.set(filePath, [...existing, diagnostic]);
	}

	/**
	 * Parse a single line of mago text-format output into a VS Code diagnostic.
	 * Also handles lines that contain an inline JSON object.
	 * Returns null if the line does not match any known format.
	 * @param line - A single line of mago stdout.
	 * @param fileUri - URI of the PHP file being parsed (passed to {@link parseJsonIssue} for `relatedInformation`).
	 * @returns A {@link vscode.Diagnostic}, or `null` if the line is unrecognised.
	 */
	private parseLine(
		line: string,
		fileUri: vscode.Uri,
	): vscode.Diagnostic | null {
		// Parse according to mago's output format.
		// Common shapes: filename:line:column: severity: message
		//            or: filename:line: severity: message
		// Also handles inline JSON objects.

		// Check for JSON object
		if (line.trim().startsWith("{")) {
			try {
				const json = JSON.parse(line);
				return this.parseJsonIssue(json, fileUri);
			} catch {
				// Not JSON — continue to text-format parsing
			}
		}

		// Parse text format.
		// Example: /path/to/file.php:10:5: error: Undefined variable
		const match = line.match(MagoOutputParser.LINE_PATTERN);
		if (match) {
			const [, , lineStr, columnStr, severity, message] = match;
			const lineNum = Math.max(0, Number.parseInt(lineStr, 10) - 1); // VS Code uses 0-indexed lines
			const column = columnStr
				? Math.max(0, Number.parseInt(columnStr, 10) - 1)
				: 0;

			const range = new vscode.Range(lineNum, column, lineNum, column + 1);
			const diagnostic = new vscode.Diagnostic(
				range,
				message,
				this.severityToVSCode(severity),
			);
			diagnostic.source = "mago";
			return diagnostic;
		}

		return null;
	}

	/**
	 * Parse a single line of mago text-format output into an intermediate MagoIssue.
	 * Used by parseProject so that file-path normalisation can be applied before
	 * constructing the final vscode.Diagnostic.
	 * Returns null if the line does not match any known format.
	 * @param line - A single line of mago stdout.
	 * @param workspaceFolder - Absolute workspace root path used to resolve relative file paths.
	 * @returns A {@link MagoIssue} with 0-indexed positions, or `null` if the line is unrecognised.
	 */
	private parseLineToIssue(
		line: string,
		workspaceFolder: string,
	): MagoIssue | null {
		// Check for JSON object
		if (line.trim().startsWith("{")) {
			try {
				const json = JSON.parse(line);
				return this.jsonToIssue(json, workspaceFolder);
			} catch {
				// Not JSON — continue to text-format parsing
			}
		}

		// Parse text format.
		// Windows: C:\path\to\file.php:10:5: error: message
		// Unix:    /path/to/file.php:10:5: error: message
		const match = line.match(MagoOutputParser.LINE_PATTERN);
		if (match) {
			const [, file, lineStr, columnStr, severity, message] = match;
			const filePath = this.normalizeFilePath(file, workspaceFolder);

			return {
				file: filePath,
				line: Math.max(0, Number.parseInt(lineStr, 10) - 1),
				column: columnStr ? Math.max(0, Number.parseInt(columnStr, 10) - 1) : 0,
				severity,
				message,
			};
		}

		return null;
	}

	/**
	 * Convert a raw MagoJsonIssue object into a vscode.Diagnostic.
	 * Extracts position from the primary annotation span; falls back to legacy top-level
	 * line/column fields if annotations are absent.
	 * Returns null if the issue has no message.
	 * @param json - A single raw issue object from mago's JSON output.
	 * @param fileUri - URI used as the location of `relatedInformation` entries (notes / help).
	 * @returns A populated {@link vscode.Diagnostic}, or `null` if the issue lacks a message.
	 */
	private parseJsonIssue(
		json: MagoJsonIssue,
		fileUri: vscode.Uri,
	): vscode.Diagnostic | null {
		// Mago JSON shape: { level, code, message, annotations: [{ span: { start: { line }, end }, ... }] }
		if (!json.message) {
			return null;
		}

		// Extract position information from annotations
		let lineNum = 0;
		let column = 0;
		let endLine = 0;
		let endColumn = 1;

		if (json.annotations && json.annotations.length > 0) {
			const primaryAnnotation =
				json.annotations.find((a: MagoAnnotation) => a.kind === "Primary") ||
				json.annotations[0];
			if (primaryAnnotation?.span) {
				const start = primaryAnnotation.span.start;
				const end = primaryAnnotation.span.end;

				// Math.max(0, …) guards against negative indices when mago returns line/column: 0
				lineNum = Math.max(0, (start?.line ?? 1) - 1); // VS Code uses 0-indexed lines
				column = Math.max(0, (start?.column ?? 1) - 1);
				endLine = Math.max(0, (end?.line ?? start?.line ?? 1) - 1);
				endColumn = Math.max(0, (end?.column ?? (start?.column ?? 1) + 1) - 1);
			}
		} else if (json.line !== undefined) {
			// Fallback: legacy output format
			lineNum = Math.max(0, (json.line ?? 1) - 1);
			column = Math.max(0, (json.column ?? 1) - 1);
			endLine = lineNum;
			endColumn = column + 1;
		}

		const range = new vscode.Range(lineNum, column, endLine, endColumn);

		// Keep the main message to a single line
		const diagnostic = new vscode.Diagnostic(
			range,
			json.message,
			this.severityToVSCode(json.level ?? "Error"),
		);

		diagnostic.source = "mago";
		if (json.code) {
			diagnostic.code = json.code;
		}

		// Attach notes and help as RelatedInformation (collapsible in VS Code)
		const relatedInfo: vscode.DiagnosticRelatedInformation[] = [];

		if (json.notes && json.notes.length > 0) {
			for (const note of json.notes) {
				relatedInfo.push(
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(fileUri, range),
						`Note: ${note}`,
					),
				);
			}
		}

		if (json.help) {
			relatedInfo.push(
				new vscode.DiagnosticRelatedInformation(
					new vscode.Location(fileUri, range),
					`Help: ${json.help}`,
				),
			);
		}

		if (relatedInfo.length > 0) {
			diagnostic.relatedInformation = relatedInfo;
		}

		return diagnostic;
	}

	/**
	 * Convert a raw MagoJsonIssue object into an intermediate MagoIssue.
	 * Resolves the file path relative to the workspace folder and normalises
	 * Windows \\?\ path prefixes.
	 * Returns null if no file path can be determined.
	 * @param json - A single raw issue object from mago's JSON output.
	 * @param workspaceFolder - Absolute workspace root path used to resolve relative file paths.
	 * @returns A normalised {@link MagoIssue} with 0-indexed positions, or `null` if no file path is available.
	 */
	private jsonToIssue(
		json: MagoJsonIssue,
		workspaceFolder: string,
	): MagoIssue | null {
		if (!json.message) {
			return null;
		}

		// Extract position information from annotations
		let filePath = "";
		let lineNum = 0;
		let column = 0;
		let endLine: number | undefined;
		let endColumn: number | undefined;

		if (json.annotations && json.annotations.length > 0) {
			const primaryAnnotation =
				json.annotations.find((a: MagoAnnotation) => a.kind === "Primary") ||
				json.annotations[0];
			if (primaryAnnotation?.span) {
				const fileId = primaryAnnotation.span.file_id;
				const start = primaryAnnotation.span.start;
				const end = primaryAnnotation.span.end;

				if (fileId?.name) {
					// Normalise Windows path format (strip \\?\ prefix)
					let rawPath = fileId.path || fileId.name;
					rawPath = rawPath.replace(/^\\\\\?\\/, ""); // Strip \\?\ prefix
					filePath = this.normalizeFilePath(rawPath, workspaceFolder);
				}

				// Math.max(0, …) guards against negative indices when mago returns line/column: 0
				lineNum = Math.max(0, (start?.line ?? 1) - 1);
				column = Math.max(0, (start?.column ?? 1) - 1);
				endLine = Math.max(0, (end?.line ?? 1) - 1);
				endColumn = Math.max(0, (end?.column ?? 1) - 1);
			}
		} else if (json.file) {
			// Fallback: legacy output format
			filePath = this.normalizeFilePath(json.file, workspaceFolder);
			lineNum = Math.max(0, (json.line ?? 1) - 1);
			column = Math.max(0, (json.column ?? 1) - 1);
		}

		if (!filePath) {
			return null;
		}

		return {
			file: filePath,
			line: lineNum,
			column,
			endLine,
			endColumn,
			severity: json.level ?? "Error",
			message: json.message,
			code: json.code,
			notes: json.notes,
			help: json.help,
		};
	}

	/**
	 * Resolve a file path string to an absolute, platform-normalised path.
	 * Absolute paths (both Unix and Windows styles) are returned as-is after
	 * separator normalisation; relative paths are joined with workspaceFolder and
	 * validated to stay within the workspace boundary.
	 * @param file - Raw file path string from mago output (may be relative or absolute).
	 * @param workspaceFolder - Absolute workspace root path used as the base for relative paths.
	 * @returns An absolute, platform-normalised file path string.
	 */
	private normalizeFilePath(file: string, workspaceFolder: string): string {
		// Normalise path separators (convert backslashes to forward slashes)
		const normalizedFile = file.replace(/\\/g, "/");

		// Check whether the path is absolute.
		// Windows: C:/... or /c/... (Git Bash style)
		// Unix/macOS: /...
		const isAbsolute =
			path.isAbsolute(file) || /^[a-zA-Z]:/.test(normalizedFile);

		if (isAbsolute) {
			// Absolute path — use normalizedFile (backslashes already converted) so
			// both branches consistently feed forward-slash strings into path.normalize.
			return path.normalize(normalizedFile);
		}

		// Relative path — join with the workspace folder
		const resolved = path.normalize(path.join(workspaceFolder, normalizedFile));

		// Guard against path traversal in mago output escaping the workspace boundary.
		// e.g. a malformed relative path like "../../etc/passwd" must not escape.
		const workspaceRoot = path.normalize(workspaceFolder);
		const prefix = workspaceRoot.endsWith(path.sep)
			? workspaceRoot
			: workspaceRoot + path.sep;
		if (resolved !== workspaceRoot && !resolved.startsWith(prefix)) {
			// Clamp to workspace root as a safe fallback rather than silently using
			// an out-of-bounds path.
			return workspaceRoot;
		}

		return resolved;
	}

	/**
	 * Convert an intermediate MagoIssue into a vscode.Diagnostic.
	 * Uses endLine/endColumn from JSON spans when available; falls back to column+1.
	 * Attaches notes and help text as RelatedInformation entries.
	 * @param issue - A normalised {@link MagoIssue} with 0-indexed position fields.
	 * @returns A fully populated {@link vscode.Diagnostic} ready for the diagnostic collection.
	 */
	private issueToDiagnostic(issue: MagoIssue): vscode.Diagnostic {
		const range = new vscode.Range(
			issue.line,
			issue.column ?? 0,
			issue.endLine ?? issue.line,
			issue.endColumn ?? (issue.column ?? 0) + 1,
		);

		const diagnostic = new vscode.Diagnostic(
			range,
			issue.message,
			this.severityToVSCode(issue.severity),
		);

		diagnostic.source = "mago";
		if (issue.code) {
			diagnostic.code = issue.code;
		}

		// Attach notes and help as RelatedInformation
		const relatedInfo: vscode.DiagnosticRelatedInformation[] = [];
		const fileUri = vscode.Uri.file(issue.file);

		if (issue.notes && issue.notes.length > 0) {
			for (const note of issue.notes) {
				relatedInfo.push(
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(fileUri, range),
						`Note: ${note}`,
					),
				);
			}
		}

		if (issue.help) {
			relatedInfo.push(
				new vscode.DiagnosticRelatedInformation(
					new vscode.Location(fileUri, range),
					`Help: ${issue.help}`,
				),
			);
		}

		if (relatedInfo.length > 0) {
			diagnostic.relatedInformation = relatedInfo;
		}

		return diagnostic;
	}

	/**
	 * Map a mago severity string to the corresponding vscode.DiagnosticSeverity value.
	 * Comparison is case-insensitive; unrecognised values default to Error.
	 * @param severity - Severity string from mago (e.g. `"error"`, `"Warning"`, `"hint"`).
	 * @returns The matching {@link vscode.DiagnosticSeverity} enum value.
	 */
	private severityToVSCode(severity: string): vscode.DiagnosticSeverity {
		switch (severity.toLowerCase()) {
			case "error":
				return vscode.DiagnosticSeverity.Error;
			case "warning":
				return vscode.DiagnosticSeverity.Warning;
			case "info":
				return vscode.DiagnosticSeverity.Information;
			case "hint":
				return vscode.DiagnosticSeverity.Hint;
			default:
				return vscode.DiagnosticSeverity.Error;
		}
	}
}
