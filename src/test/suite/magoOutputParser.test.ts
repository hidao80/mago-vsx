/**
 * Integration-style tests for MagoOutputParser — comprehensive scenario focused.
 *
 * Scope: full mago JSON structure including Windows paths, file_id resolution,
 * notes, help text, and relatedInformation; parseProject multi-file output.
 *
 * Complementary file: src/test/unit/magoOutputParser.unit.test.ts covers
 * edge cases and boundary conditions (empty input, missing fields, JSON arrays,
 * text-format fallback) — it does NOT duplicate the tests here.
 */
import { expect, test } from "@playwright/test";
import "../unit/setup";
import * as vscode from "vscode";
import { MagoOutputParser } from "../../magoOutputParser";

test.describe("MagoOutputParser Test Suite", () => {
	let parser: MagoOutputParser;

	test.beforeEach(() => {
		parser = new MagoOutputParser();
	});

	test.describe("JSON Output Parsing", () => {
		test("Should parse single JSON issue with annotations", () => {
			const jsonOutput = JSON.stringify({
				level: "Error",
				code: "test-error",
				message: "Test error message",
				notes: ["Note 1", "Note 2"],
				help: "This is help text",
				annotations: [
					{
						kind: "Primary",
						span: {
							file_id: {
								name: "test.php",
								path: "F:\\project\\test.php",
							},
							start: { offset: 0, line: 10, column: 5 },
							end: { offset: 20, line: 10, column: 25 },
						},
					},
				],
			});

			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);

			// Message should only contain the main error message
			expect(diagnostics[0].message).toBe("Test error message");
			expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Error);
			expect(diagnostics[0].code).toBe("test-error");
			expect(diagnostics[0].range.start.line).toBe(9); // 0-indexed
			expect(diagnostics[0].range.start.character).toBe(4); // 0-indexed

			// Notes and help should be in relatedInformation
			expect(diagnostics[0].relatedInformation).toBeTruthy();
			expect(diagnostics[0].relatedInformation?.length).toBe(3); // 2 notes + 1 help

			const relatedMessages = diagnostics[0].relatedInformation?.map(
				(r) => r.message,
			);
			expect(relatedMessages?.some((m) => m.includes("Note 1"))).toBeTruthy();
			expect(relatedMessages?.some((m) => m.includes("Note 2"))).toBeTruthy();
			expect(relatedMessages?.some((m) => m.includes("Help:"))).toBeTruthy();
		});

		test("Should parse JSON array of issues", () => {
			const jsonOutput = JSON.stringify([
				{
					level: "Warning",
					message: "Warning 1",
					annotations: [
						{
							span: {
								start: { line: 1, column: 1 },
								end: { line: 1, column: 10 },
							},
						},
					],
				},
				{
					level: "Error",
					message: "Error 1",
					annotations: [
						{
							span: {
								start: { line: 2, column: 1 },
								end: { line: 2, column: 10 },
							},
						},
					],
				},
			]);

			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(2);
			expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
			expect(diagnostics[1].severity).toBe(vscode.DiagnosticSeverity.Error);
		});

		test("Should parse JSON with issues property", () => {
			const jsonOutput = JSON.stringify({
				issues: [
					{
						level: "Info",
						message: "Info message",
						annotations: [
							{
								span: {
									start: { line: 5, column: 10 },
									end: { line: 5, column: 20 },
								},
							},
						],
					},
				],
			});

			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].severity).toBe(
				vscode.DiagnosticSeverity.Information,
			);
		});

		test("Should handle Windows path with \\\\?\\ prefix", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify({
				level: "Error",
				message: "Test",
				annotations: [
					{
						kind: "Primary",
						span: {
							file_id: {
								name: "test.php",
								path: "\\\\?\\F:\\project\\test.php",
							},
							start: { line: 1, column: 1 },
						},
					},
				],
			});

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);

			expect(diagnosticsByFile.size).toBe(1);
			const filePaths = Array.from(diagnosticsByFile.keys());
			expect(filePaths[0].includes("\\\\?\\")).toBe(false);
		});
	});

	test.describe("Text Output Parsing", () => {
		test("Should parse text format with line and column", () => {
			const textOutput = "test.php:10:5: error: Undefined variable";
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(textOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].message).toBe("Undefined variable");
			expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Error);
			expect(diagnostics[0].range.start.line).toBe(9); // 0-indexed
			expect(diagnostics[0].range.start.character).toBe(4); // 0-indexed
		});

		test("Should parse text format without column", () => {
			const textOutput = "test.php:15: warning: Unused variable";
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(textOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].message).toBe("Unused variable");
			expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
			expect(diagnostics[0].range.start.line).toBe(14);
			expect(diagnostics[0].range.start.character).toBe(0);
		});

		test("Should parse multiple text lines", () => {
			const textOutput = `test.php:10: error: Error 1
test.php:20: warning: Warning 1
test.php:30: info: Info 1`;
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(textOutput, fileUri);

			expect(diagnostics.length).toBe(3);
			expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Error);
			expect(diagnostics[1].severity).toBe(vscode.DiagnosticSeverity.Warning);
			expect(diagnostics[2].severity).toBe(
				vscode.DiagnosticSeverity.Information,
			);
		});
	});

	test.describe("Project-wide Parsing", () => {
		test("Should parse project output and group by file", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					level: "Error",
					message: "Error in file1",
					annotations: [
						{
							span: {
								file_id: {
									name: "file1.php",
									path: "F:\\project\\file1.php",
								},
								start: { line: 1, column: 1 },
							},
						},
					],
				},
				{
					level: "Warning",
					message: "Warning in file2",
					annotations: [
						{
							span: {
								file_id: {
									name: "file2.php",
									path: "F:\\project\\file2.php",
								},
								start: { line: 5, column: 10 },
							},
						},
					],
				},
				{
					level: "Error",
					message: "Another error in file1",
					annotations: [
						{
							span: {
								file_id: {
									name: "file1.php",
									path: "F:\\project\\file1.php",
								},
								start: { line: 10, column: 1 },
							},
						},
					],
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);

			expect(diagnosticsByFile.size).toBe(2);

			const file1Path = Array.from(diagnosticsByFile.keys()).find((p) =>
				p.includes("file1.php"),
			);
			const file2Path = Array.from(diagnosticsByFile.keys()).find((p) =>
				p.includes("file2.php"),
			);

			expect(file1Path).toBeTruthy();
			expect(file2Path).toBeTruthy();

			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(diagnosticsByFile.get(file1Path!)?.length).toBe(2);
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(diagnosticsByFile.get(file2Path!)?.length).toBe(1);
		});

		test("Should handle relative paths in project mode", () => {
			const workspaceFolder = "F:\\project";
			const textOutput = "src/test.php:10: error: Test error";
			const diagnosticsByFile = parser.parseProject(
				textOutput,
				workspaceFolder,
			);

			expect(diagnosticsByFile.size).toBe(1);
			const filePaths = Array.from(diagnosticsByFile.keys());
			expect(filePaths[0].includes("F:\\project")).toBe(true);
			expect(filePaths[0].includes("src")).toBe(true);
		});
	});

	test.describe("parseProject - Edge Cases", () => {
		test("Should skip issue when annotation has no file_id", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					level: "Error",
					message: "No file_id issue",
					annotations: [
						{
							kind: "Primary",
							span: {
								// file_id intentionally omitted
								start: { line: 1, column: 1 },
							},
						},
					],
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);
			// Without file_id, filePath remains empty and the issue is skipped
			expect(diagnosticsByFile.size).toBe(0);
		});

		test("Should use first annotation when only Secondary annotations exist", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					level: "Warning",
					message: "Secondary-only annotation",
					annotations: [
						{
							kind: "Secondary",
							span: {
								file_id: {
									name: "secondary.php",
									path: "F:\\project\\secondary.php",
								},
								start: { line: 3, column: 2 },
							},
						},
					],
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);
			// Falls back to annotations[0] when no Primary annotation is present
			expect(diagnosticsByFile.size).toBe(1);
			const filePath = Array.from(diagnosticsByFile.keys())[0];
			expect(filePath.includes("secondary.php")).toBeTruthy();
			const diags = diagnosticsByFile.get(filePath);
			expect(diags?.length).toBe(1);
			expect(diags?.[0].message).toBe("Secondary-only annotation");
			expect(diags?.[0].range.start.line).toBe(2); // 0-indexed
		});

		test("Should join relative paths with workspaceFolder on Windows", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					level: "Error",
					message: "Relative path issue",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: {
									name: "sub/rel.php",
									path: "sub/rel.php",
								},
								start: { line: 1, column: 1 },
							},
						},
					],
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);
			expect(diagnosticsByFile.size).toBe(1);
			const filePath = Array.from(diagnosticsByFile.keys())[0];
			expect(
				filePath.includes("F:\\project") || filePath.includes("F:/project"),
			).toBeTruthy();
			expect(filePath.includes("rel.php")).toBeTruthy();
		});
	});

	test.describe("Edge Cases", () => {
		test("Should handle empty output", () => {
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse("", fileUri);
			expect(diagnostics.length).toBe(0);
		});

		test("Should handle invalid JSON", () => {
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse("{ invalid json", fileUri);
			expect(diagnostics.length).toBe(0);
		});

		test("Should handle JSON without message field", () => {
			const jsonOutput = JSON.stringify({
				level: "Error",
				code: "test",
				// message field is missing
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);
			expect(diagnostics.length).toBe(0);
		});

		test("Should use fallback for old JSON format", () => {
			const jsonOutput = JSON.stringify({
				message: "Old format message",
				level: "Warning",
				line: 15,
				column: 10,
				// No annotations field
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].range.start.line).toBe(14); // 0-indexed
			expect(diagnostics[0].range.start.character).toBe(9); // 0-indexed
		});

		test("Should handle different severity levels", () => {
			const levels = [
				{ input: "Error", expected: vscode.DiagnosticSeverity.Error },
				{ input: "Warning", expected: vscode.DiagnosticSeverity.Warning },
				{ input: "Info", expected: vscode.DiagnosticSeverity.Information },
				{ input: "Hint", expected: vscode.DiagnosticSeverity.Hint },
				{ input: "Unknown", expected: vscode.DiagnosticSeverity.Error }, // Default
			];

			for (const level of levels) {
				const jsonOutput = JSON.stringify({
					level: level.input,
					message: "Test message",
					annotations: [
						{
							span: {
								start: { line: 1, column: 1 },
								end: { line: 1, column: 2 },
							},
						},
					],
				});
				const fileUri = vscode.Uri.file("F:\\project\\test.php");
				const diagnostics = parser.parse(jsonOutput, fileUri);

				expect(diagnostics[0].severity).toBe(level.expected);
			}
		});

		test("Should handle JSON with empty annotations array (uses line/column fallback)", () => {
			// Verifies that the json.line fallback is used when the annotations array is empty
			const jsonOutput = JSON.stringify({
				message: "Empty annotations",
				level: "Error",
				annotations: [],
				line: 8,
				column: 3,
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].range.start.line).toBe(7); // 0-indexed (8-1)
			expect(diagnostics[0].range.start.character).toBe(2); // 0-indexed (3-1)
		});

		test("Should clamp negative line/column to zero", () => {
			// Verifies that negative indices are not produced when mago returns line:0 / column:0
			const jsonOutput = JSON.stringify({
				message: "Zero position issue",
				level: "Error",
				annotations: [
					{
						kind: "Primary",
						span: {
							start: { line: 0, column: 0 },
							end: { line: 0, column: 0 },
						},
					},
				],
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].range.start.line).toBe(0);
			expect(diagnostics[0].range.start.character).toBe(0);
		});

		test("Should handle notes without help in relatedInformation", () => {
			const jsonOutput = JSON.stringify({
				message: "Note only",
				level: "Warning",
				notes: ["Note A"],
				// help is intentionally absent
				annotations: [
					{
						span: {
							start: { line: 1, column: 1 },
							end: { line: 1, column: 5 },
						},
					},
				],
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].relatedInformation).toBeTruthy();
			expect(diagnostics[0].relatedInformation?.length).toBe(1);
			expect(
				diagnostics[0].relatedInformation?.[0].message.includes("Note A"),
			).toBeTruthy();
		});

		test("Should handle help without notes in relatedInformation", () => {
			const jsonOutput = JSON.stringify({
				message: "Help only",
				level: "Info",
				help: "See the docs",
				// notes is intentionally absent
				annotations: [
					{
						span: {
							start: { line: 2, column: 1 },
							end: { line: 2, column: 5 },
						},
					},
				],
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].relatedInformation).toBeTruthy();
			expect(diagnostics[0].relatedInformation?.length).toBe(1);
			expect(
				diagnostics[0].relatedInformation?.[0].message.includes(
					"Help: See the docs",
				),
			).toBeTruthy();
		});

		test("Should produce no relatedInformation when notes and help are absent", () => {
			const jsonOutput = JSON.stringify({
				message: "No related info",
				level: "Hint",
				annotations: [
					{
						span: {
							start: { line: 1, column: 1 },
							end: { line: 1, column: 2 },
						},
					},
				],
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(jsonOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(!diagnostics[0].relatedInformation).toBeTruthy();
		});

		test("Should parse inline JSON object on a text output line", () => {
			// Verifies the path where parseLine sees a leading '{' and parses as JSON
			const jsonIssue = JSON.stringify({
				message: "Inline JSON issue",
				level: "Error",
				annotations: [
					{
						span: {
							start: { line: 3, column: 2 },
							end: { line: 3, column: 10 },
						},
					},
				],
			});
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			// Pass the JSON string as a single line (also interpreted as full JSON, but passes through the parse() entry logic)
			const diagnostics = parser.parse(jsonIssue, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].message).toBe("Inline JSON issue");
		});

		test("Should handle hint severity in text format", () => {
			const textOutput = "test.php:5:1: hint: Consider refactoring";
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(textOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Hint);
			expect(diagnostics[0].message).toBe("Consider refactoring");
		});

		test("Should ignore non-matching lines in text format", () => {
			// Non-matching lines (headers, blank lines) are ignored
			const textOutput = `Mago lint report
=================
test.php:1: error: Real error
Total: 1 issue`;
			const fileUri = vscode.Uri.file("F:\\project\\test.php");
			const diagnostics = parser.parse(textOutput, fileUri);

			expect(diagnostics.length).toBe(1);
			expect(diagnostics[0].message).toBe("Real error");
		});
	});

	test.describe("parseProject - Legacy JSON format", () => {
		test("Should parse legacy JSON format with top-level file field", () => {
			// Verifies the fallback for legacy format with a top-level json.file field
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					message: "Legacy issue",
					level: "Error",
					file: "F:\\project\\legacy.php",
					line: 5,
					column: 3,
					// annotations field is intentionally absent
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);

			expect(diagnosticsByFile.size).toBe(1);
			const filePath = Array.from(diagnosticsByFile.keys())[0];
			expect(filePath.includes("legacy.php")).toBeTruthy();
			const diags = diagnosticsByFile.get(filePath);
			expect(diags?.length).toBe(1);
			expect(diags?.[0].message).toBe("Legacy issue");
			expect(diags?.[0].range.start.line).toBe(4); // 0-indexed
		});

		test("Should skip JSON issue without message in parseProject", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					level: "Error",
					// message is missing
					file: "F:\\project\\no-message.php",
					line: 1,
					column: 1,
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);
			expect(diagnosticsByFile.size).toBe(0);
		});

		test("Should attach notes and help as relatedInformation via issueToDiagnostic", () => {
			// Verifies the notes/help path through issueToDiagnostic via parseProject
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					message: "Issue with notes",
					level: "Warning",
					notes: ["See RFC 123"],
					help: "Use function X instead",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: {
									name: "noted.php",
									path: "F:\\project\\noted.php",
								},
								start: { line: 2, column: 1 },
								end: { line: 2, column: 10 },
							},
						},
					],
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);
			expect(diagnosticsByFile.size).toBe(1);
			const filePath = Array.from(diagnosticsByFile.keys())[0];
			const diags = diagnosticsByFile.get(filePath);
			expect(diags?.length).toBe(1);
			expect(diags?.[0].relatedInformation).toBeTruthy();
			// 1 note + 1 help = 2 entries
			expect(diags?.[0].relatedInformation?.length).toBe(2);
		});

		test("Should use endLine and endColumn from span in issueToDiagnostic", () => {
			const workspaceFolder = "F:\\project";
			const jsonOutput = JSON.stringify([
				{
					message: "Span range issue",
					level: "Error",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: {
									name: "range.php",
									path: "F:\\project\\range.php",
								},
								start: { line: 3, column: 1 },
								end: { line: 5, column: 20 },
							},
						},
					],
				},
			]);

			const diagnosticsByFile = parser.parseProject(
				jsonOutput,
				workspaceFolder,
			);
			const filePath = Array.from(diagnosticsByFile.keys())[0];
			const diags = diagnosticsByFile.get(filePath);
			expect(diags).toBeTruthy();
			// endLine: 5-1=4 (0-indexed), endColumn: 20-1=19 (0-indexed)
			expect(diags?.[0].range.end.line).toBe(4);
			expect(diags?.[0].range.end.character).toBe(19);
		});

		test("Should handle parseProject with empty output string", () => {
			const workspaceFolder = "F:\\project";
			const diagnosticsByFile = parser.parseProject("", workspaceFolder);
			expect(diagnosticsByFile.size).toBe(0);
		});

		test("Should handle parseProject with whitespace-only output", () => {
			const workspaceFolder = "F:\\project";
			const diagnosticsByFile = parser.parseProject("   \n  ", workspaceFolder);
			expect(diagnosticsByFile.size).toBe(0);
		});
	});
});
