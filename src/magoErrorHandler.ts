import * as vscode from "vscode";

/**
 * Show a VS Code error message for a mago configuration failure.
 * @param command - The mago sub-command that failed.
 * @param outputChannel - Output channel for log messages.
 * @param details - Optional TOML location string (e.g. "line 5, column 10").
 */
function showConfigurationError(
	command: string,
	outputChannel: vscode.OutputChannel,
	details?: string,
): void {
	const message = details
		? `Mago ${command}: Configuration error in mago.toml at ${details}. Check "Mago" output for details.`
		: `Mago ${command}: Failed to build configuration. Check "Mago" output for details.`;

	// Explicitly discard the Thenable with void to suppress floating Promise warnings
	void vscode.window
		.showErrorMessage(message, "Show Output")
		.then((selection) => {
			if (selection === "Show Output") {
				outputChannel.show(true);
			}
		});
}

/**
 * Handle a mago database access error in stderr.
 * Shows a detailed error message and returns true if the pattern matches.
 * @param stderr - Raw stderr string from the mago process.
 * @param command - The mago sub-command that was run (used in user-facing messages).
 * @param outputChannel - Output channel for log messages.
 * @returns `true` if the database-error pattern was matched, `false` otherwise.
 */
function handleDatabaseError(
	stderr: string,
	command: string,
	outputChannel: vscode.OutputChannel,
): boolean {
	if (!stderr.includes("Failed to load database")) {
		return false;
	}
	// os error 5 = Access Denied on Windows
	void vscode.window
		.showErrorMessage(
			`Mago ${command}: Database access error. Another process may be locking the database, or permissions are insufficient. Check "Mago" output for details.`,
			"Show Output",
		)
		.then((selection) => {
			if (selection === "Show Output") {
				outputChannel.show(true);
			}
		});
	outputChannel.appendLine("\n[ERROR] Database Access Error Detected:");
	outputChannel.appendLine("  mago could not open its database file.");
	outputChannel.appendLine("  Possible causes:");
	outputChannel.appendLine(
		"    - Another mago process is locking the database",
	);
	outputChannel.appendLine(
		"    - Insufficient file system permissions on the database directory",
	);
	outputChannel.appendLine("    - The database path is read-only");
	outputChannel.appendLine("");
	return true;
}

/**
 * Handle a mago TOML configuration error in stderr.
 * Includes line/column information when available and returns true if the pattern matches.
 * @param stderr - Raw stderr string from the mago process.
 * @param command - The mago sub-command that was run (used in user-facing messages).
 * @param outputChannel - Output channel for log messages.
 * @returns `true` if the TOML-error pattern was matched, `false` otherwise.
 */
function handleTomlError(
	stderr: string,
	command: string,
	outputChannel: vscode.OutputChannel,
): boolean {
	if (!stderr.includes("Failed to build the configuration")) {
		return false;
	}
	const tomlErrorMatch = stderr.match(
		/TOML parse error at line (?<line>\d+), column (?<column>\d+)/,
	);
	if (tomlErrorMatch) {
		const { line, column } = tomlErrorMatch.groups as { line: string; column: string };
		showConfigurationError(command, outputChannel, `line ${line}, column ${column}`);
		outputChannel.appendLine("\n[ERROR] Configuration Error Detected");
		outputChannel.appendLine(
			`TOML parse error at line ${line}, column ${column}`,
		);
		outputChannel.appendLine("Please check your mago.toml file.\n");
	} else {
		showConfigurationError(command, outputChannel);
		outputChannel.appendLine("\n[ERROR] Configuration Error Detected\n");
	}
	return true;
}

/**
 * Handle any other mago error lines found in stderr.
 * Displays all ERROR-prefixed lines in the output channel and returns true if any were found.
 * @param stderr - Raw stderr string from the mago process.
 * @param command - The mago sub-command that was run (used in user-facing messages).
 * @param outputChannel - Output channel for log messages.
 * @returns `true` if at least one `ERROR`-bearing line was found, `false` otherwise.
 */
function handleGenericError(
	stderr: string,
	command: string,
	outputChannel: vscode.OutputChannel,
): boolean {
	const errorLines = stderr
		.split("\n")
		.filter((line) => /\bERROR\b/i.test(line));
	if (errorLines.length === 0) {
		return false;
	}
	// Explicitly discard the Thenable with void to suppress floating Promise warnings
	void vscode.window
		.showErrorMessage(
			`Mago ${command}: Execution error occurred. Check "Mago" output for details.`,
			"Show Output",
		)
		.then((selection) => {
			if (selection === "Show Output") {
				outputChannel.show(true);
			}
		});
	outputChannel.appendLine("\n[ERROR] Error Detected:");
	for (const line of errorLines) {
		outputChannel.appendLine(`  ${line}`);
	}
	outputChannel.appendLine("");
	return true;
}

/**
 * Inspect stderr for known mago error patterns and display an appropriate message.
 * Returns true if an error was detected and handled, false if output looks clean.
 * @param stderr - Raw stderr string from the mago process.
 * @param command - The mago sub-command that was run (used in user-facing messages).
 * @param outputChannel - Output channel for log messages.
 * @returns `true` if a known error pattern was found and handled, `false` otherwise.
 */
export function checkForErrors(
	stderr: string,
	command: string,
	outputChannel: vscode.OutputChannel,
): boolean {
	// Inspect stderr only — stdout may contain diagnostic JSON, mixing them risks false positives.
	// Use \bERROR\b word boundaries to avoid false matches on PHP identifiers like ERROR_CODE.
	// The /i flag is intentional: mago may output both "error:" (lowercase) and "ERROR:" (uppercase).
	if (!/\bERROR\b/i.test(stderr)) {
		return false;
	}
	return (
		handleDatabaseError(stderr, command, outputChannel) ||
		handleTomlError(stderr, command, outputChannel) ||
		handleGenericError(stderr, command, outputChannel)
	);
}
