import { expect, test } from "@playwright/test";
import * as vscode from "vscode";
import { checkForErrors } from "../../magoErrorHandler";
import { MagoRunner, isValidBaselinePath } from "../../magoRunner";
import type { MagoCommand } from "../../types";
import { resetMockState } from "../unit/setup";

/**
 * Subclass of MagoRunner that exposes protected methods for testing purposes.
 * Avoids `as any` casts while keeping the production class well-encapsulated.
 */
class TestableMagoRunner extends MagoRunner {
	override buildDiagnosticCommandArgs(
		command: MagoCommand,
		config: vscode.WorkspaceConfiguration,
	): string[] {
		return super.buildDiagnosticCommandArgs(command, config);
	}

	override mergeDiagnostics(
		uri: vscode.Uri,
		newDiagnostics: vscode.Diagnostic[],
	): void {
		super.mergeDiagnostics(uri, newDiagnostics);
	}

	override notifyDiagnosticResult(
		issueCount: number,
		hasOutput: boolean,
		command: MagoCommand,
		isProject: boolean,
		fileCount?: number,
	): void {
		super.notifyDiagnosticResult(
			issueCount,
			hasOutput,
			command,
			isProject,
			fileCount,
		);
	}
}

test.describe("MagoRunner Test Suite", () => {
	let diagnosticCollection: vscode.DiagnosticCollection;
	let outputChannel: vscode.OutputChannel;
	let magoRunner: TestableMagoRunner;

	test.beforeEach(() => {
		// Defensive reset in case a previous test failed before afterEach ran.
		resetMockState();
		diagnosticCollection =
			vscode.languages.createDiagnosticCollection("mago-test");
		outputChannel = vscode.window.createOutputChannel("Mago Test");
		magoRunner = new TestableMagoRunner(diagnosticCollection, outputChannel);
	});

	test.afterEach(() => {
		diagnosticCollection.dispose();
		outputChannel.dispose();
	});

	test.describe("Basic Functionality", () => {
		test("Should create MagoRunner instance", () => {
			expect(magoRunner).toBeTruthy();
		});
	});

	test.describe("Configuration", () => {
		test("Should read mago.executablePath configuration", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const executablePath = config.get<string>("executablePath", "mago");
			expect(executablePath).toBeTruthy();
		});

		test("Should read mago.lintOnSave configuration", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const lintOnSave = config.get<boolean>("lintOnSave");
			expect(typeof lintOnSave).toBe("boolean");
		});

		test("Should read mago.analyzeOnSave configuration", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const analyzeOnSave = config.get<boolean>("analyzeOnSave");
			expect(typeof analyzeOnSave).toBe("boolean");
		});
	});

	test.describe("buildDiagnosticCommandArgs", () => {
		test("Should include --reporting-format json for lint", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const args = magoRunner.buildDiagnosticCommandArgs("lint", config);
			expect(args).toContain("lint");
			expect(args).toContain("--reporting-format");
			expect(args).toContain("json");
		});

		test("Should include --reporting-format json for analyze", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const args = magoRunner.buildDiagnosticCommandArgs("analyze", config);
			expect(args).toContain("analyze");
			expect(args).toContain("--reporting-format");
			expect(args).toContain("json");
		});

		test("Should not include --baseline when no baseline path is set", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const args = magoRunner.buildDiagnosticCommandArgs("lint", config);
			expect(args).not.toContain("--baseline");
		});

		test("Result array starts with the command name", () => {
			const config = vscode.workspace.getConfiguration("mago");
			const lintArgs = magoRunner.buildDiagnosticCommandArgs("lint", config);
			expect(lintArgs[0]).toBe("lint");

			const analyzeArgs = magoRunner.buildDiagnosticCommandArgs(
				"analyze",
				config,
			);
			expect(analyzeArgs[0]).toBe("analyze");
		});
	});

	test.describe("mergeDiagnostics", () => {
		test("Should append new diagnostics to existing ones", () => {
			const testUri = vscode.Uri.file("F:\\project\\merge.php");
			const existing = new vscode.Diagnostic(
				new vscode.Range(0, 0, 0, 1),
				"Existing",
				vscode.DiagnosticSeverity.Error,
			);
			diagnosticCollection.set(testUri, [existing]);

			const newDiag = new vscode.Diagnostic(
				new vscode.Range(1, 0, 1, 1),
				"New",
				vscode.DiagnosticSeverity.Warning,
			);
			magoRunner.mergeDiagnostics(testUri, [newDiag]);

			const result = diagnosticCollection.get(testUri);
			expect(result?.length).toBe(2);
			expect(result?.[0].message).toBe("Existing");
			expect(result?.[1].message).toBe("New");
		});

		test("Should work when no existing diagnostics are present", () => {
			const testUri = vscode.Uri.file("F:\\project\\fresh.php");
			// diagnosticCollection has no diagnostics for testUri at this point

			const newDiag = new vscode.Diagnostic(
				new vscode.Range(5, 3, 5, 10),
				"Fresh diagnostic",
				vscode.DiagnosticSeverity.Information,
			);
			magoRunner.mergeDiagnostics(testUri, [newDiag]);

			const result = diagnosticCollection.get(testUri);
			expect(result?.length).toBe(1);
			expect(result?.[0].message).toBe("Fresh diagnostic");
		});

		test("Should handle merging an empty array (no-op)", () => {
			const testUri = vscode.Uri.file("F:\\project\\noop.php");
			const existing = new vscode.Diagnostic(
				new vscode.Range(0, 0, 0, 1),
				"Only existing",
				vscode.DiagnosticSeverity.Error,
			);
			diagnosticCollection.set(testUri, [existing]);

			magoRunner.mergeDiagnostics(testUri, []);

			const result = diagnosticCollection.get(testUri);
			expect(result?.length).toBe(1);
			expect(result?.[0].message).toBe("Only existing");
		});
	});

	test.describe("checkForErrors", () => {
		test("Should return false for clean output", () => {
			expect(checkForErrors("No issues found", "lint", outputChannel)).toBe(
				false,
			);
		});

		test("Should return false for empty stderr", () => {
			expect(checkForErrors("", "lint", outputChannel)).toBe(false);
		});

		test("Should return false for output containing ERROR in identifier (e.g. PHP_ERROR_CODE)", () => {
			// Only matches \bERROR\b, so PHP_ERROR_CODE does not produce a false positive
			expect(
				checkForErrors("class PHP_ERROR_CODE {}", "lint", outputChannel),
			).toBe(false);
		});

		test("Should return false for ERRORS (plural) — does not match \\bERROR\\b", () => {
			// "ERRORS" has no word boundary on the right side, so it returns false
			expect(checkForErrors("Total ERRORS: 0", "lint", outputChannel)).toBe(
				false,
			);
		});

		test("Should return true when output contains standalone ERROR", () => {
			expect(
				checkForErrors(
					"Some output\nERROR: something went wrong\nmore output",
					"lint",
					outputChannel,
				),
			).toBe(true);
		});

		test("Should return true and handle database access error", () => {
			const dbOutput =
				"ERROR Failed to load database\nos error 5: Access Denied";
			expect(checkForErrors(dbOutput, "lint", outputChannel)).toBe(true);
		});

		test("Should return true and handle TOML configuration error", () => {
			const tomlOutput =
				"ERROR Failed to build the configuration\nTOML parse error at line 5, column 10\nsome detail";
			expect(checkForErrors(tomlOutput, "lint", outputChannel)).toBe(true);
		});

		test("Should return true for configuration error without TOML line info", () => {
			const output =
				"ERROR Failed to build the configuration\nsome other detail";
			expect(checkForErrors(output, "analyze", outputChannel)).toBe(true);
		});

		test("Should return true for generic ERROR not matching known patterns", () => {
			expect(
				checkForErrors(
					"ERROR something completely unexpected happened",
					"lint",
					outputChannel,
				),
			).toBe(true);
		});

		// The /i flag in checkForErrors is intentional: mago may output "error:" in
		// lowercase on some platforms or in future versions.  These tests pin that behaviour.
		test("Should return true for lowercase 'error:' (case-insensitive match)", () => {
			expect(
				checkForErrors("error: something went wrong", "lint", outputChannel),
			).toBe(true);
		});

		test("Should return true for mixed-case 'Error:' (case-insensitive match)", () => {
			expect(
				checkForErrors("Error: something went wrong", "lint", outputChannel),
			).toBe(true);
		});

		test("Should return false for 'errors' (plural, no word boundary on right side)", () => {
			// 'errors' does not match \bERROR\b because 's' is a word character after 'r'
			expect(checkForErrors("errors detected: 0", "lint", outputChannel)).toBe(
				false,
			);
		});
	});

	test.describe("notifyDiagnosticResult", () => {
		test("Should not throw when issueCount > 0 (file mode)", () => {
			expect(() => {
				magoRunner.notifyDiagnosticResult(3, true, "lint", false);
			}).not.toThrow();
		});

		test("Should not throw when issueCount > 0 (project mode)", () => {
			expect(() => {
				magoRunner.notifyDiagnosticResult(5, true, "analyze", true, 2);
			}).not.toThrow();
		});

		test("Should not throw when issueCount is 0 with output present (project)", () => {
			expect(() => {
				magoRunner.notifyDiagnosticResult(0, true, "lint", true);
			}).not.toThrow();
		});

		test("Should not throw when issueCount is 0 with empty output (file)", () => {
			expect(() => {
				magoRunner.notifyDiagnosticResult(0, false, "lint", false);
			}).not.toThrow();
		});

		test("Should not throw when issueCount is 0 with non-empty output (file)", () => {
			expect(() => {
				magoRunner.notifyDiagnosticResult(0, true, "lint", false);
			}).not.toThrow();
		});
	});

	test.describe("isValidBaselinePath", () => {
		test("Should accept valid relative path", () => {
			expect(isValidBaselinePath("baseline.toml")).toBe(true);
			expect(isValidBaselinePath("baselines/lint.toml")).toBe(true);
			expect(isValidBaselinePath("foo..bar.toml")).toBe(true); // not a traversal segment
		});

		test("Should reject empty string", () => {
			expect(isValidBaselinePath("")).toBe(false);
		});

		test("Should reject path traversal with ..", () => {
			expect(isValidBaselinePath("../evil.toml")).toBe(false);
			expect(isValidBaselinePath("foo/../../etc/passwd")).toBe(false);
		});

		test("Should reject path traversal with backslash separator", () => {
			// Rejects traversal even with Windows-style path separators
			expect(isValidBaselinePath("foo\\..\\evil.toml")).toBe(false);
		});

		test("Should reject absolute Unix path", () => {
			expect(isValidBaselinePath("/etc/passwd")).toBe(false);
		});

		test("Should reject absolute Windows path", () => {
			expect(isValidBaselinePath("C:\\baseline.toml")).toBe(false);
		});

		test("Should reject shell metacharacters", () => {
			expect(isValidBaselinePath("base&line.toml")).toBe(false);
			expect(isValidBaselinePath("base|line.toml")).toBe(false);
			expect(isValidBaselinePath("base;line.toml")).toBe(false);
			expect(isValidBaselinePath("base$line.toml")).toBe(false);
		});

		test("Should reject additional shell metacharacters", () => {
			// Individually verify each security-sensitive shell metacharacter
			expect(isValidBaselinePath("file>output.toml")).toBe(false);
			expect(isValidBaselinePath("file<input.toml")).toBe(false);
			expect(isValidBaselinePath("file`cmd`.toml")).toBe(false);
			expect(isValidBaselinePath("file!flag.toml")).toBe(false);
			expect(isValidBaselinePath("file*.toml")).toBe(false);
			expect(isValidBaselinePath("file?.toml")).toBe(false);
			expect(isValidBaselinePath("file(paren).toml")).toBe(false);
			expect(isValidBaselinePath("file[bracket].toml")).toBe(false);
			expect(isValidBaselinePath("file{brace}.toml")).toBe(false);
		});

		test("Should reject Windows environment variable expansion (%)", () => {
			expect(isValidBaselinePath("%APPDATA%\\baseline.toml")).toBe(false);
		});

		test("Should accept nested relative path without traversal", () => {
			// Deeply nested paths are accepted as long as they contain no .. segments
			expect(isValidBaselinePath("a/b/c/baseline.toml")).toBe(true);
		});

		test("Should reject path that is exactly '..'", () => {
			expect(isValidBaselinePath("..")).toBe(false);
		});
	});

	test.describe("Diagnostic Collection", () => {
		test("Should create diagnostic collection", () => {
			expect(diagnosticCollection).toBeTruthy();
		});

		test("Should clear diagnostics", () => {
			const testUri = vscode.Uri.file("F:\\project\\test.php");
			const range = new vscode.Range(0, 0, 0, 1);
			const diagnostic = new vscode.Diagnostic(
				range,
				"Test",
				vscode.DiagnosticSeverity.Error,
			);

			diagnosticCollection.set(testUri, [diagnostic]);
			expect(diagnosticCollection.get(testUri)?.length).toBe(1);

			// clear() removes all entries entirely (matches real vscode.DiagnosticCollection),
			// so get() returns undefined rather than an empty array for a cleared uri.
			diagnosticCollection.clear();
			expect(diagnosticCollection.get(testUri)).toBeUndefined();
		});

		test("Should set diagnostics for specific file", () => {
			const testUri = vscode.Uri.file("F:\\project\\test.php");
			const range = new vscode.Range(5, 10, 5, 20);
			const diagnostic = new vscode.Diagnostic(
				range,
				"Test error",
				vscode.DiagnosticSeverity.Error,
			);
			diagnostic.source = "mago";
			diagnostic.code = "test-code";

			diagnosticCollection.set(testUri, [diagnostic]);

			const diagnostics = diagnosticCollection.get(testUri);
			expect(diagnostics?.length).toBe(1);
			expect(diagnostics?.[0].message).toBe("Test error");
			expect(diagnostics?.[0].source).toBe("mago");
			expect(diagnostics?.[0].code).toBe("test-code");
		});

		test("Should handle multiple diagnostics for same file", () => {
			const testUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = [
				new vscode.Diagnostic(
					new vscode.Range(1, 0, 1, 1),
					"Error 1",
					vscode.DiagnosticSeverity.Error,
				),
				new vscode.Diagnostic(
					new vscode.Range(5, 0, 5, 1),
					"Warning 1",
					vscode.DiagnosticSeverity.Warning,
				),
				new vscode.Diagnostic(
					new vscode.Range(10, 0, 10, 1),
					"Info 1",
					vscode.DiagnosticSeverity.Information,
				),
			];

			diagnosticCollection.set(testUri, diagnostics);

			const result = diagnosticCollection.get(testUri);
			expect(result?.length).toBe(3);
		});

		test("Should handle diagnostics for multiple files", () => {
			const file1Uri = vscode.Uri.file("F:\\project\\file1.php");
			const file2Uri = vscode.Uri.file("F:\\project\\file2.php");

			diagnosticCollection.set(file1Uri, [
				new vscode.Diagnostic(
					new vscode.Range(0, 0, 0, 1),
					"Error in file1",
					vscode.DiagnosticSeverity.Error,
				),
			]);

			diagnosticCollection.set(file2Uri, [
				new vscode.Diagnostic(
					new vscode.Range(0, 0, 0, 1),
					"Error in file2",
					vscode.DiagnosticSeverity.Error,
				),
			]);

			expect(diagnosticCollection.get(file1Uri)?.length).toBe(1);
			expect(diagnosticCollection.get(file2Uri)?.length).toBe(1);
		});
	});

	test.describe("Output Channel", () => {
		test("Should create output channel", () => {
			expect(outputChannel).toBeTruthy();
		});

		test("Should append line to output channel", () => {
			// OutputChannel content cannot be read directly — just verify no error is thrown
			expect(() => {
				outputChannel.appendLine("Test output");
			}).not.toThrow();
		});

		test("Should clear output channel", () => {
			expect(() => {
				outputChannel.clear();
			}).not.toThrow();
		});
	});

	test.describe("Integration with VS Code", () => {
		test("Should register with language diagnostics", () => {
			// Verify that the DiagnosticCollection is correctly registered
			const allDiagnostics = vscode.languages.getDiagnostics();
			expect(Array.isArray(allDiagnostics)).toBeTruthy();
		});

		test("Should use correct diagnostic severity levels", () => {
			expect(vscode.DiagnosticSeverity.Error).toBe(0);
			expect(vscode.DiagnosticSeverity.Warning).toBe(1);
			expect(vscode.DiagnosticSeverity.Information).toBe(2);
			expect(vscode.DiagnosticSeverity.Hint).toBe(3);
		});
	});
});
