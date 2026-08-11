import * as vscode from "vscode";
import { MagoRunner, isValidBaselinePath } from "./magoRunner";

/** VS Code diagnostic collection that owns all Mago-reported diagnostics. Initialised in {@link activate}. */
let diagnosticCollection: vscode.DiagnosticCollection | undefined;
/** Output channel used for extension log messages and mago stdout/stderr. Initialised in {@link activate}. */
let outputChannel: vscode.OutputChannel | undefined;
/** Singleton runner that spawns mago child processes and converts results to diagnostics. Initialised in {@link activate}. */
let magoRunner: MagoRunner | undefined;


/**
 * Called by VS Code when the extension is activated.
 * Registers all commands, the on-save listener, and creates the
 * DiagnosticCollection and OutputChannel owned by this extension.
 *
 * @param context - The extension context provided by VS Code, used to register
 *   disposables that are automatically cleaned up on deactivation.
 * @returns void
 */
export function activate(context: vscode.ExtensionContext): void {
	diagnosticCollection = vscode.languages.createDiagnosticCollection("mago");
	context.subscriptions.push(diagnosticCollection);

	outputChannel = vscode.window.createOutputChannel("Mago");
	context.subscriptions.push(outputChannel);

	outputChannel.appendLine("Mago extension is now active");

	magoRunner = new MagoRunner(diagnosticCollection, outputChannel);
	context.subscriptions.push(magoRunner);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand("mago.lintCurrentFile", async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === "php") {
				await magoRunner?.runLint(editor.document.uri);
			} else {
				vscode.window.showWarningMessage("Please open a PHP file to lint.");
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("mago.analyzeCurrentFile", async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === "php") {
				await magoRunner?.runAnalyze(editor.document.uri);
			} else {
				vscode.window.showWarningMessage("Please open a PHP file to analyze.");
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("mago.lintProject", async () => {
			await magoRunner?.runLintProject();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("mago.analyzeProject", async () => {
			await magoRunner?.runAnalyzeProject();
		}),
	);

	// Run both Lint & Analyze
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"mago.lintAndAnalyzeCurrentFile",
			async () => {
				const editor = vscode.window.activeTextEditor;
				if (editor && editor.document.languageId === "php") {
					// Clear existing diagnoses before performing both.
					diagnosticCollection?.delete(editor.document.uri);
					// By making execution sequential, race conditions are suppressed.
					await magoRunner?.runLint(editor.document.uri);
					await magoRunner?.runAnalyze(editor.document.uri);
				} else {
					vscode.window.showWarningMessage(
						"Please open a PHP file to lint and analyze.",
					);
				}
			},
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("mago.lintAndAnalyzeProject", async () => {
			// Clear existing diagnostics before running both
			diagnosticCollection?.clear();
			await magoRunner?.runLintProject();
			await magoRunner?.runAnalyzeProject();
		}),
	);

	// Format commands
	context.subscriptions.push(
		vscode.commands.registerCommand("mago.formatCurrentFile", async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === "php") {
				await magoRunner?.runFormat(editor.document.uri);
			} else {
				vscode.window.showWarningMessage("Please open a PHP file to format.");
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("mago.formatProject", async () => {
			await magoRunner?.runFormatProject();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("mago.formatCheck", async () => {
			await magoRunner?.runFormatCheck();
		}),
	);

	// Baseline generation commands
	context.subscriptions.push(
		vscode.commands.registerCommand("mago.generateLintBaseline", async () => {
			const config = vscode.workspace.getConfiguration("mago");
			let baselinePath = config.get<string>("lintBaseline", "");

			if (!baselinePath) {
				baselinePath =
					(await vscode.window.showInputBox({
						prompt: "Enter the path for lint baseline file",
						value: "lint-baseline.toml",
						placeHolder: "lint-baseline.toml",
					})) || "";
			}

			if (baselinePath) {
				if (isValidBaselinePath(baselinePath)) {
					await magoRunner?.runGenerateLintBaseline(baselinePath);
				} else {
					vscode.window.showErrorMessage(
						"Invalid baseline path. Check for path traversal ('..'), absolute paths, or special characters.",
					);
				}
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"mago.generateAnalyzeBaseline",
			async () => {
				const config = vscode.workspace.getConfiguration("mago");
				let baselinePath = config.get<string>("analyzeBaseline", "");

				if (!baselinePath) {
					baselinePath =
						(await vscode.window.showInputBox({
							prompt: "Enter the path for analyze baseline file",
							value: "analysis-baseline.toml",
							placeHolder: "analysis-baseline.toml",
						})) || "";
				}

				if (baselinePath) {
					if (isValidBaselinePath(baselinePath)) {
						await magoRunner?.runGenerateAnalyzeBaseline(baselinePath);
					} else {
						vscode.window.showErrorMessage(
							"Invalid baseline path. Check for path traversal ('..'), absolute paths, or special characters.",
						);
					}
				}
			},
		),
	);

	// Auto-run on file save
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async (document) => {
			if (document.languageId !== "php") {
				return;
			}

			// When formatOnSave writes the file back, onDidSaveTextDocument re-fires.
			// Skip the re-fire to prevent duplicate lint/analyze runs (fix for Bug #13).
			const uriKey = document.uri.toString();
			if (magoRunner?.isFormatting(uriKey)) {
				return;
			}

			const config = vscode.workspace.getConfiguration("mago");
			const lintOnSave = config.get<boolean>("lintOnSave", true);
			const analyzeOnSave = config.get<boolean>("analyzeOnSave", true);
			const formatOnSave = config.get<boolean>("formatOnSave", false);

			// Run format first
			if (formatOnSave) {
				await magoRunner?.runFormatOnSave(document.uri);
			}

			// Clear diagnostics before running to prevent accumulation
			if (lintOnSave || analyzeOnSave) {
				diagnosticCollection?.delete(document.uri);
			}

			if (lintOnSave) {
				await magoRunner?.runLint(document.uri);
			}

			if (analyzeOnSave) {
				await magoRunner?.runAnalyze(document.uri);
			}
		}),
	);
}

/**
 * Called by VS Code when the extension is deactivated.
 * All disposables are cleaned up automatically via context.subscriptions.
 *
 * @returns void
 */
export function deactivate(): void {
	// Disposables are cleaned up automatically via context.subscriptions.
}
