import * as vscode from "vscode";
import { checkForErrors } from "./magoErrorHandler";
import { logMagoOutput, spawnMagoProcess } from "./magoSpawner";
import { MagoOutputParser } from "./magoOutputParser";
import type { MagoCommand, SpawnResult } from "./types";

/**
 * Validates the mago executable path from user settings.
 * Rejects shell metacharacters as a defence-in-depth measure even when shell: false is used.
 *
 * Absolute paths are intentionally permitted so users can specify custom mago installations
 * (e.g., "/usr/local/bin/mago", "C:\\tools\\mago.exe").  Unlike baseline paths, the
 * executable path must be user-configurable across a wide range of environments, so
 * restricting it to relative paths would break valid setups.
 *
 * Security note: VS Code workspace settings (.vscode/settings.json) can override user
 * settings, which means a malicious repository could attempt to redirect the executable
 * path to an arbitrary binary.  This risk is inherent to any extension that executes
 * user-configured commands; users should only open repositories they trust.
 * See: https://code.visualstudio.com/docs/editor/workspace-trust
 *
 * @param executablePath - The executable path string to validate (from VS Code settings).
 * @returns `true` if the path is safe to pass to child_process.spawn, `false` otherwise.
 */
export function isValidExecutablePath(executablePath: string): boolean {
	if (!executablePath) {
		return false;
	}
	// Reject shell metacharacters that enable command injection via cmd.exe on Windows.
	// * is included for consistency with isValidBaselinePath and to prevent glob expansion.
	if (/[&|;<>$`!*?()\[\]{}%]/.test(executablePath)) {
		return false;
	}
	// Reject path traversal segments (consistent with isValidBaselinePath)
	const segments = executablePath.split(/[\\/]/);
	if (segments.some((s) => s === "..")) {
		return false;
	}
	return true;
}

/**
 * Validates a baseline path from user settings or configuration.
 * Rejects path traversal, absolute paths, and shell metacharacters (including %).
 * Exported at module level so that extension.ts can share the same validation logic.
 * @param inputPath - The baseline path string to validate (from VS Code settings).
 * @returns `true` if the path is safe to use as a mago `--baseline` argument, `false` otherwise.
 */
export function isValidBaselinePath(inputPath: string): boolean {
	if (!inputPath) {
		return false;
	}
	// Reject absolute paths (Unix, Windows drive-letter, and Windows UNC \\server\share)
	if (
		inputPath.startsWith("/") ||
		/^[a-zA-Z]:\\/.test(inputPath) ||
		inputPath.startsWith("\\\\")
	) {
		return false;
	}
	// Reject shell metacharacters (including %: risk of environment variable expansion in Windows CMD)
	if (/[&|;<>$`!*?()\[\]{}%]/.test(inputPath)) {
		return false;
	}
	// Reject "." (current directory) — not a valid baseline file path
	if (inputPath === ".") {
		return false;
	}
	// Reject only ".." path segments (filenames like "foo..bar" are allowed)
	const segments = inputPath.split(/[\\/]/);
	return !segments.some((segment) => segment === "..");
}

/**
 * Orchestrates mago CLI invocations and translates their output into
 * VS Code diagnostics.  Each public method corresponds to a user-facing
 * command registered in `extension.ts`.
 */
export class MagoRunner implements vscode.Disposable {
	/** VS Code diagnostic collection that receives parsed mago issues. */
	private readonly diagnosticCollection: vscode.DiagnosticCollection;
	/** Parser that converts raw mago stdout into {@link vscode.Diagnostic} objects. */
	private readonly outputParser: MagoOutputParser;
	/** Output channel used to display raw mago command output and log messages. */
	private readonly outputChannel: vscode.OutputChannel;
	/**
	 * Tracks URI keys of files currently being formatted via {@link runFormatOnSave}.
	 * Prevents the re-fired onDidSaveTextDocument event (caused by the format write-back)
	 * from triggering a duplicate lint/analyze run.
	 */
	private readonly formattingUris = new Set<string>();

	/**
	 * Creates a new MagoRunner.
	 * @param diagnosticCollection - VS Code collection that receives mago diagnostics.
	 * @param outputChannel - Output channel for raw mago command output and log messages.
	 */
	constructor(
		diagnosticCollection: vscode.DiagnosticCollection,
		outputChannel: vscode.OutputChannel,
	) {
		this.diagnosticCollection = diagnosticCollection;
		this.outputParser = new MagoOutputParser();
		this.outputChannel = outputChannel;
	}

	// Public API methods

	/**
	 * Run mago lint on a single file and update diagnostics.
	 * @param fileUri - URI of the PHP file to lint.
	 * @returns A promise that resolves when the lint operation is complete.
	 */
	async runLint(fileUri: vscode.Uri): Promise<void> {
		await this.runMagoCommand("lint", fileUri);
	}

	/**
	 * Run mago analyze on a single file and update diagnostics.
	 * @param fileUri - URI of the PHP file to analyze.
	 * @returns A promise that resolves when the analyze operation is complete.
	 */
	async runAnalyze(fileUri: vscode.Uri): Promise<void> {
		await this.runMagoCommand("analyze", fileUri);
	}

	/**
	 * Run mago lint across the entire workspace and update diagnostics.
	 * @returns A promise that resolves when the project-wide lint is complete.
	 */
	async runLintProject(): Promise<void> {
		await this.runMagoProjectCommand("lint");
	}

	/**
	 * Run mago analyze across the entire workspace and update diagnostics.
	 * @returns A promise that resolves when the project-wide analyze is complete.
	 */
	async runAnalyzeProject(): Promise<void> {
		await this.runMagoProjectCommand("analyze");
	}

	/**
	 * Run mago fmt on a single file.
	 * @param fileUri - URI of the PHP file to format.
	 * @returns A promise that resolves when formatting is complete.
	 */
	async runFormat(fileUri: vscode.Uri): Promise<void> {
		await this.runFormatCommand(fileUri.fsPath, fileUri);
	}

	/**
	 * Run mago fmt on a single file as part of the on-save workflow.
	 * Marks the URI as "formatting in progress" for the duration of the call so
	 * that the re-fired onDidSaveTextDocument event (caused by the format write-back)
	 * can be detected via {@link isFormatting} and skipped.
	 * @param fileUri - URI of the PHP file to format.
	 * @returns A promise that resolves when formatting is complete.
	 */
	async runFormatOnSave(fileUri: vscode.Uri): Promise<void> {
		const uriKey = fileUri.toString();
		this.formattingUris.add(uriKey);
		try {
			await this.runFormatCommand(fileUri.fsPath, fileUri);
		} finally {
			this.formattingUris.delete(uriKey);
		}
	}

	/**
	 * Returns `true` if a format-on-save operation is currently in progress for the given URI key.
	 * Used by the onDidSaveTextDocument handler to suppress duplicate lint/analyze runs.
	 * @param uriKey - The string form of the file URI (from `vscode.Uri.toString()`).
	 */
	isFormatting(uriKey: string): boolean {
		return this.formattingUris.has(uriKey);
	}

	/**
	 * Run mago fmt on the entire workspace.
	 * @returns A promise that resolves when project-wide formatting is complete.
	 */
	async runFormatProject(): Promise<void> {
		await this.runFormatCommand(".");
	}

	/**
	 * Run mago fmt --check on the entire workspace to verify formatting.
	 * @returns A promise that resolves when the format check is complete.
	 */
	async runFormatCheck(): Promise<void> {
		await this.runFormatCheckCommand();
	}

	/**
	 * Generate a lint baseline file at the specified path.
	 * @param baselinePath - Relative path where the baseline TOML file will be written.
	 * @returns A promise that resolves when baseline generation is complete.
	 */
	async runGenerateLintBaseline(baselinePath: string): Promise<void> {
		await this.runGenerateBaselineCommand("lint", baselinePath);
	}

	/**
	 * Generate an analyze baseline file at the specified path.
	 * @param baselinePath - Relative path where the baseline TOML file will be written.
	 * @returns A promise that resolves when baseline generation is complete.
	 */
	async runGenerateAnalyzeBaseline(baselinePath: string): Promise<void> {
		await this.runGenerateBaselineCommand("analyze", baselinePath);
	}

	// Core command execution methods

	/**
	 * Run a diagnostic mago command (lint or analyze) on a single file.
	 * Builds the CLI arguments, spawns mago, and routes the output to handleMagoOutput.
	 * @param command - The mago sub-command to run (`"lint"` or `"analyze"`).
	 * @param fileUri - URI of the target PHP file.
	 * @returns A promise that resolves when the command finishes and diagnostics are updated.
	 */
	private async runMagoCommand(
		command: MagoCommand,
		fileUri: vscode.Uri,
	): Promise<void> {
		const config = vscode.workspace.getConfiguration("mago");
		const args = this.buildDiagnosticCommandArgs(command, config);
		args.push(fileUri.fsPath);

		const workspaceFolder = this.getWorkspaceFolder(fileUri);
		if (!workspaceFolder) {
			const message = `Mago ${command}: File is outside any workspace folder. Open the file's folder in VS Code to enable mago analysis.`;
			this.outputChannel.appendLine(`[${command}] Error: ${message}`);
			void vscode.window.showErrorMessage(message);
			return;
		}
		const result = await this.spawnMago(args, workspaceFolder);

		logMagoOutput(command, fileUri.fsPath, result, this.outputChannel);
		this.handleMagoOutput(result.stdout, result.stderr, fileUri, command);
	}

	/**
	 * Run a diagnostic mago command (lint or analyze) on the entire workspace.
	 * Spawns mago with "." as the target and routes the output to handleMagoProjectOutput.
	 * @param command - The mago sub-command to run (`"lint"` or `"analyze"`).
	 * @returns A promise that resolves when the command finishes and diagnostics are updated.
	 */
	private async runMagoProjectCommand(command: MagoCommand): Promise<void> {
		const workspaceFolder = this.getFirstWorkspaceFolder();
		if (!workspaceFolder) {
			void vscode.window.showErrorMessage("No workspace folder open");
			return;
		}

		const config = vscode.workspace.getConfiguration("mago");
		const args = this.buildDiagnosticCommandArgs(command, config);
		args.push(".");

		const result = await this.spawnMago(args, workspaceFolder);

		logMagoOutput(`${command} Project`, workspaceFolder, result, this.outputChannel);
		this.handleMagoProjectOutput(
			result.stdout,
			result.stderr,
			workspaceFolder,
			command,
		);
	}

	/**
	 * Run mago fmt on the given target path (file path or ".").
	 * Shows a success message on exit code 0; delegates error display to checkForErrors otherwise.
	 * @param target - Filesystem path of the file to format, or `"."` for the entire workspace.
	 * @returns A promise that resolves when the fmt command is complete.
	 */
	private async runFormatCommand(
		target: string,
		fileUri?: vscode.Uri,
	): Promise<void> {
		let workspaceFolder: string | undefined;
		if (fileUri) {
			workspaceFolder =
				this.getWorkspaceFolder(fileUri) ?? this.getFirstWorkspaceFolder();
		} else {
			workspaceFolder = this.getFirstWorkspaceFolder();
			if (!workspaceFolder) {
				void vscode.window.showErrorMessage("No workspace folder open");
				return;
			}
		}

		const result = await this.spawnMago(["fmt", target], workspaceFolder);
		logMagoOutput("fmt", target, result, this.outputChannel);

		if (result.exitCode === 0) {
			const message =
				target === "."
					? "Mago fmt: Project formatted successfully"
					: "Mago fmt: File formatted successfully";
			void vscode.window.showInformationMessage(message);
		} else if (!checkForErrors(result.stderr, "fmt", this.outputChannel)) {
			void vscode.window.showErrorMessage(
				`Mago fmt: Failed with exit code ${result.exitCode}. Check "Mago" output for details.`,
			);
			this.outputChannel.show(true);
		}
	}

	/**
	 * Run mago fmt --check on the workspace.
	 * Exit code 0 means all files are formatted; exit code 1 means formatting is needed.
	 * @returns A promise that resolves when the format-check command is complete.
	 */
	private async runFormatCheckCommand(): Promise<void> {
		const workspaceFolder = this.getFirstWorkspaceFolder();
		if (!workspaceFolder) {
			void vscode.window.showErrorMessage("No workspace folder open");
			return;
		}

		const result = await this.spawnMago(
			["fmt", "--check", "."],
			workspaceFolder,
		);
		logMagoOutput("fmt --check", workspaceFolder, result, this.outputChannel);

		if (result.exitCode === 0) {
			void vscode.window.showInformationMessage(
				"Mago fmt --check: All files are correctly formatted",
			);
		} else if (result.exitCode === 1) {
			void vscode.window.showWarningMessage(
				'Mago fmt --check: Some files need formatting. Check "Mago" output for details.',
			);
			this.outputChannel.show(true);
		} else if (!checkForErrors(result.stderr, "fmt --check", this.outputChannel)) {
			void vscode.window.showErrorMessage(
				`Mago fmt --check: Failed with exit code ${result.exitCode}. Check "Mago" output for details.`,
			);
			this.outputChannel.show(true);
		}
	}

	/**
	 * Run a mago diagnostic command with --generate-baseline to create a baseline file.
	 * @param command - The diagnostic sub-command ("lint" or "analyze").
	 * @param baselinePath - Relative path for the generated baseline TOML file.
	 */
	private async runGenerateBaselineCommand(
		command: MagoCommand,
		baselinePath: string,
	): Promise<void> {
		const workspaceFolder = this.getFirstWorkspaceFolder();
		if (!workspaceFolder) {
			void vscode.window.showErrorMessage("No workspace folder open");
			return;
		}

		const result = await this.spawnMago(
			[command, "--generate-baseline", "--baseline", baselinePath, "."],
			workspaceFolder,
		);

		logMagoOutput(`${command} --generate-baseline`, workspaceFolder, result, this.outputChannel);

		if (result.exitCode === 0) {
			void vscode.window.showInformationMessage(
				`Mago ${command}: Baseline generated at ${baselinePath}`,
			);
		} else {
			void vscode.window.showErrorMessage(
				`Mago ${command}: Failed to generate baseline. Check "Mago" output for details.`,
			);
			this.outputChannel.show(true);
		}
	}

	// Helper methods

	/**
	 * Build the CLI argument list for a diagnostic command.
	 * Appends --baseline if a valid baseline path is configured for the given command.
	 * @param command - The mago sub-command (`"lint"` or `"analyze"`).
	 * @param config - The VS Code workspace configuration for the `mago` namespace.
	 * @returns An array of CLI arguments ready to pass to {@link spawnMago}.
	 * @visibleForTesting Exposed as `protected` to allow overriding in {@link TestableMagoRunner}.
	 */
	protected buildDiagnosticCommandArgs(
		command: MagoCommand,
		config: vscode.WorkspaceConfiguration,
	): string[] {
		const args = [command, "--reporting-format", "json"];

		const baselineConfig =
			command === "lint" ? "lintBaseline" : "analyzeBaseline";
		const baselinePath = config.get<string>(baselineConfig, "");
		if (baselinePath && isValidBaselinePath(baselinePath)) {
			args.push("--baseline", baselinePath);
		} else if (baselinePath) {
			this.outputChannel.appendLine(
				`[${command}] Warning: Skipping invalid baseline path from settings: "${baselinePath}"`,
			);
		}

		return args;
	}

	/**
	 * Validate the configured executable path and delegate process spawning to
	 * {@link spawnMagoProcess}.  Resolves with an error result immediately if the
	 * path is invalid, so callers never need to handle a rejected promise.
	 * @param args - CLI arguments to pass to the mago executable.
	 * @param cwd - Optional working directory for the child process.
	 * @returns A promise that resolves with the collected stdout, stderr, and exit code.
	 */
	private spawnMago(args: string[], cwd?: string): Promise<SpawnResult> {
		const config = vscode.workspace.getConfiguration("mago");
		const magoPath = config.get<string>("executablePath", "mago");

		if (!isValidExecutablePath(magoPath)) {
			void vscode.window.showErrorMessage(
				`Mago: Invalid executablePath setting "${magoPath}". Path must not contain shell metacharacters.`,
			);
			return Promise.resolve({
				stdout: "",
				stderr: "Invalid executable path",
				exitCode: null,
			});
		}

		return spawnMagoProcess(magoPath, args, cwd);
	}

	/**
	 * Merge new diagnostics into the collection for the given URI,
	 * preserving any diagnostics already present from a previous command.
	 * @param uri - The file URI to update.
	 * @param newDiagnostics - Diagnostics to append to any already stored for `uri`.
	 * @visibleForTesting Exposed as `protected` to allow overriding in {@link TestableMagoRunner}.
	 */
	protected mergeDiagnostics(
		uri: vscode.Uri,
		newDiagnostics: vscode.Diagnostic[],
	): void {
		const existing = this.diagnosticCollection.get(uri) ?? [];
		this.diagnosticCollection.set(uri, [...existing, ...newDiagnostics]);
	}

	/**
	 * Process mago output for a single-file command.
	 * Checks stderr for errors first; on success, parses diagnostics and merges them.
	 * @param stdout - Raw stdout from the mago process.
	 * @param stderr - Raw stderr from the mago process.
	 * @param fileUri - URI of the file that was analysed.
	 * @param command - The mago sub-command that was run (used in user-facing messages).
	 */
	private handleMagoOutput(
		stdout: string,
		stderr: string,
		fileUri: vscode.Uri,
		command: MagoCommand,
	): void {
		if (checkForErrors(stderr, command, this.outputChannel)) {
			// Clear stale diagnostics for this file so previously reported issues
			// do not persist after the underlying cause is fixed.
			this.diagnosticCollection.delete(fileUri);
			return;
		}

		const diagnostics = this.outputParser.parse(stdout, fileUri);
		this.outputChannel.appendLine(`Parsed ${diagnostics.length} diagnostic(s)`);
		this.mergeDiagnostics(fileUri, diagnostics);

		this.notifyDiagnosticResult(diagnostics.length, stdout.trim().length > 0, command, false);
	}

	/**
	 * Process mago output for a project-wide command.
	 * Checks stderr for errors first; on success, parses diagnostics grouped by file.
	 * @param stdout - Raw stdout from the mago process.
	 * @param stderr - Raw stderr from the mago process.
	 * @param workspaceFolder - Absolute path of the workspace root used as the mago cwd.
	 * @param command - The mago sub-command that was run (used in user-facing messages).
	 */
	private handleMagoProjectOutput(
		stdout: string,
		stderr: string,
		workspaceFolder: string,
		command: MagoCommand,
	): void {
		if (checkForErrors(stderr, command, this.outputChannel)) {
			// Clear all stale diagnostics so previously reported issues do not
			// persist across a failed project-wide run.
			this.diagnosticCollection.clear();
			return;
		}

		const diagnosticsByFile = this.outputParser.parseProject(
			stdout,
			workspaceFolder,
		);
		this.outputChannel.appendLine(`Parsed ${diagnosticsByFile.size} file(s)`);

		let totalIssues = 0;
		for (const [filePath, diagnostics] of diagnosticsByFile.entries()) {
			const uri = vscode.Uri.file(filePath);
			this.mergeDiagnostics(uri, diagnostics);
			totalIssues += diagnostics.length;
			this.outputChannel.appendLine(
				`  ${filePath}: ${diagnostics.length} issue(s)`,
			);
		}

		this.notifyDiagnosticResult(
			totalIssues,
			stdout.trim().length > 0,
			command,
			true,
			diagnosticsByFile.size,
		);
	}

	/**
	 * Show a VS Code warning or information message summarising the diagnostic result.
	 * Uses `showWarningMessage` when issues are found so the severity is immediately clear,
	 * and `showInformationMessage` when the analysis is clean.
	 * For project commands, includes the file count; skips notification for file commands with no issues.
	 * @param issueCount - Total number of diagnostics found.
	 * @param hasOutput - Whether mago produced any stdout (used to suppress notifications on truly empty output).
	 * @param command - The mago sub-command that was run (used in user-facing messages).
	 * @param isProject - `true` when the command targeted the whole workspace.
	 * @param fileCount - Number of files with issues (only meaningful when `isProject` is `true`).
	 * @visibleForTesting Exposed as `protected` to allow overriding in {@link TestableMagoRunner}.
	 */
	protected notifyDiagnosticResult(
		issueCount: number,
		hasOutput: boolean,
		command: MagoCommand,
		isProject: boolean,
		fileCount?: number,
	): void {
		if (issueCount > 0) {
			const message =
				isProject && fileCount !== undefined
					? `Mago ${command}: Found ${issueCount} issue(s) in ${fileCount} file(s)`
					: `Mago ${command}: Found ${issueCount} issue(s)`;
			void vscode.window.showWarningMessage(message);
			return;
		}

		// No issues found. For project-level commands always notify; for single-file commands
		// only notify when mago produced output (i.e. the file was actually analysed).
		if (isProject || hasOutput) {
			void vscode.window.showInformationMessage(`Mago ${command}: No issues found`);
		}
	}

	/**
	 * Return the filesystem path of the workspace folder that contains the given file URI,
	 * or undefined if the file is outside all open workspace folders.
	 * @param fileUri - URI of the file to look up.
	 * @returns Absolute filesystem path of the containing workspace folder, or `undefined`.
	 */
	private getWorkspaceFolder(fileUri: vscode.Uri): string | undefined {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
		return workspaceFolder?.uri.fsPath;
	}

	/**
	 * Return the filesystem path of the first open workspace folder,
	 * or undefined if no workspace is open.
	 * @returns Absolute filesystem path of `workspaceFolders[0]`, or `undefined`.
	 */
	private getFirstWorkspaceFolder(): string | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		return workspaceFolders && workspaceFolders.length > 0
			? workspaceFolders[0].uri.fsPath
			: undefined;
	}

	/**
	 * Release any resources owned directly by this MagoRunner instance.
	 * DiagnosticCollection and OutputChannel are managed by the extension host
	 * via context.subscriptions and must NOT be disposed here.
	 * @returns void
	 */
	dispose(): void {
		// formattingUris is cleared here so that any in-progress on-save guards
		// are released if the extension is deactivated mid-format.
		this.formattingUris.clear();
	}
}
