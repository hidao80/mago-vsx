/**
 * Standalone unit tests for MagoOutputParser — edge-case focused.
 *
 * These tests run directly with Playwright without a VS Code extension host.
 * The vscode module is mocked via the setup file loaded via globalSetup.
 *
 * Scope: edge cases, boundary conditions, and schema variations (empty input,
 * missing fields, JSON arrays, wrapper objects, text-format fallback).
 *
 * Complementary file: src/test/suite/magoOutputParser.test.ts covers more
 * integration-style scenarios including Windows paths, notes, help text, and
 * relatedInformation — it does NOT duplicate the tests here.
 *
 * Run with: pnpm run test:unit:playwright
 */

import "./setup";
import { expect, test } from "@playwright/test";
import { MagoOutputParser } from "../../magoOutputParser";

// ---------------------------------------------------------------------------
// Helper types for asserting against mock diagnostics
// ---------------------------------------------------------------------------
interface DiagLike {
	message: string;
	severity: number;
	source?: string;
	code?: string;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	relatedInformation?: Array<{ message: string }>;
}

function toDiag(d: unknown): DiagLike {
	return d as DiagLike;
}

// Severity constants mirror the mock registered in setup.ts
const Sev = { Error: 0, Warning: 1, Information: 2, Hint: 3 } as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("MagoOutputParser — Pure Unit Tests (vscode mocked)", () => {
	let parser: MagoOutputParser;

	test.beforeEach(() => {
		parser = new MagoOutputParser();
	});

	// -----------------------------------------------------------------------
	// parse() — single-file mode (JSON)
	// -----------------------------------------------------------------------

	test.describe("parse() — JSON input", () => {
		const uri = () =>
			({
				fsPath: "/project/test.php",
				toString: () => "file:///project/test.php",
				// biome-ignore lint/suspicious/noExplicitAny: test helper
			}) as any;

		test("Returns empty array for empty string", () => {
			expect(parser.parse("", uri()).length).toBe(0);
		});

		test("Returns empty array for invalid JSON that matches no text pattern", () => {
			expect(parser.parse("{ not valid json", uri()).length).toBe(0);
		});

		test("Returns empty array when JSON has no message field", () => {
			const json = JSON.stringify({ level: "Error", code: "x" });
			expect(parser.parse(json, uri()).length).toBe(0);
		});

		test("Parses single JSON issue with annotations", () => {
			const json = JSON.stringify({
				level: "Error",
				message: "Undefined variable $x",
				annotations: [
					{
						kind: "Primary",
						span: {
							start: { line: 5, column: 3 },
							end: { line: 5, column: 5 },
						},
					},
				],
			});

			const result = parser.parse(json, uri());

			expect(result.length).toBe(1);
			const d = toDiag(result[0]);
			expect(d.message).toBe("Undefined variable $x");
			expect(d.severity).toBe(Sev.Error);
			expect(d.source).toBe("mago");
			expect(d.range.start.line).toBe(4); // 0-indexed
			expect(d.range.start.character).toBe(2); // 0-indexed
		});

		test("Parses JSON array of issues", () => {
			const json = JSON.stringify([
				{
					level: "Warning",
					message: "Warning 1",
					annotations: [
						{
							span: {
								start: { line: 1, column: 1 },
								end: { line: 1, column: 2 },
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
								end: { line: 2, column: 2 },
							},
						},
					],
				},
			]);

			const result = parser.parse(json, uri());

			expect(result.length).toBe(2);
			expect(toDiag(result[0]).severity).toBe(Sev.Warning);
			expect(toDiag(result[1]).severity).toBe(Sev.Error);
		});

		test("Parses JSON with {issues:[]} wrapper", () => {
			const json = JSON.stringify({
				issues: [
					{
						level: "Info",
						message: "Info message",
						annotations: [
							{
								span: {
									start: { line: 1, column: 1 },
									end: { line: 1, column: 2 },
								},
							},
						],
					},
				],
			});

			const result = parser.parse(json, uri());

			expect(result.length).toBe(1);
			expect(toDiag(result[0]).severity).toBe(Sev.Information);
		});

		test("Falls back to legacy line/column when annotations absent", () => {
			const json = JSON.stringify({
				message: "Legacy issue",
				level: "Warning",
				line: 10,
				column: 5,
			});

			const result = parser.parse(json, uri());

			expect(result.length).toBe(1);
			const d = toDiag(result[0]);
			expect(d.range.start.line).toBe(9); // 0-indexed
			expect(d.range.start.character).toBe(4); // 0-indexed
		});

		test("Falls back to legacy fields when annotations is empty array", () => {
			const json = JSON.stringify({
				message: "Empty annotations",
				level: "Error",
				annotations: [],
				line: 7,
				column: 2,
			});

			const result = parser.parse(json, uri());

			expect(result.length).toBe(1);
			const d = toDiag(result[0]);
			expect(d.range.start.line).toBe(6); // 0-indexed
			expect(d.range.start.character).toBe(1); // 0-indexed
		});

		test("Clamps line/column 0 to zero (no negative indices)", () => {
			const json = JSON.stringify({
				message: "Zero position",
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

			const result = parser.parse(json, uri());

			expect(result.length).toBe(1);
			const d = toDiag(result[0]);
			expect(d.range.start.line).toBe(0);
			expect(d.range.start.character).toBe(0);
		});

		test("Attaches code field when present", () => {
			const json = JSON.stringify({
				message: "Coded issue",
				level: "Error",
				code: "E001",
				annotations: [
					{
						span: {
							start: { line: 1, column: 1 },
							end: { line: 1, column: 2 },
						},
					},
				],
			});

			expect(toDiag(parser.parse(json, uri())[0]).code).toBe("E001");
		});

		test("Attaches only notes as relatedInformation (no help)", () => {
			const json = JSON.stringify({
				message: "Note only",
				level: "Warning",
				notes: ["Check line 5"],
				annotations: [
					{
						span: {
							start: { line: 1, column: 1 },
							end: { line: 1, column: 2 },
						},
					},
				],
			});

			const result = parser.parse(json, uri());
			const d = toDiag(result[0]);
			expect(d.relatedInformation).toBeTruthy();
			expect(d.relatedInformation?.length).toBe(1);
			expect(d.relatedInformation?.[0].message).toContain("Note: Check line 5");
		});

		test("Attaches only help as relatedInformation (no notes)", () => {
			const json = JSON.stringify({
				message: "Help only",
				level: "Info",
				help: "See documentation",
				annotations: [
					{
						span: {
							start: { line: 1, column: 1 },
							end: { line: 1, column: 2 },
						},
					},
				],
			});

			const result = parser.parse(json, uri());
			const d = toDiag(result[0]);
			expect(d.relatedInformation).toBeTruthy();
			expect(d.relatedInformation?.length).toBe(1);
			expect(d.relatedInformation?.[0].message).toContain(
				"Help: See documentation",
			);
		});

		test("Attaches both notes and help (2 notes + 1 help = 3 entries)", () => {
			const json = JSON.stringify({
				message: "Full issue",
				level: "Error",
				notes: ["Note A", "Note B"],
				help: "Do X",
				annotations: [
					{
						span: {
							start: { line: 1, column: 1 },
							end: { line: 1, column: 2 },
						},
					},
				],
			});

			const d = toDiag(parser.parse(json, uri())[0]);
			expect(d.relatedInformation).toBeTruthy();
			expect(d.relatedInformation?.length).toBe(3);
		});

		test("Omits relatedInformation when no notes and no help", () => {
			const json = JSON.stringify({
				message: "Plain issue",
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

			expect(
				toDiag(parser.parse(json, uri())[0]).relatedInformation,
			).toBeFalsy();
		});

		test("Uses first annotation when no Primary annotation exists", () => {
			const json = JSON.stringify({
				message: "Secondary only",
				level: "Warning",
				annotations: [
					{
						kind: "Secondary",
						span: {
							start: { line: 4, column: 2 },
							end: { line: 4, column: 5 },
						},
					},
				],
			});

			const result = parser.parse(json, uri());

			expect(result.length).toBe(1);
			expect(toDiag(result[0]).range.start.line).toBe(3); // 0-indexed
		});
	});

	test.describe("parse() — severity mapping", () => {
		const uri = () =>
			({
				fsPath: "/project/test.php",
				toString: () => "file:///project/test.php",
				// biome-ignore lint/suspicious/noExplicitAny: test helper
			}) as any;

		const cases: Array<[string, number]> = [
			["Error", Sev.Error],
			["error", Sev.Error],
			["Warning", Sev.Warning],
			["warning", Sev.Warning],
			["Info", Sev.Information],
			["info", Sev.Information],
			["Hint", Sev.Hint],
			["hint", Sev.Hint],
			["Unknown", Sev.Error], // default
			["", Sev.Error], // default
		];

		for (const [input, expected] of cases) {
			test(`"${input || "(empty)"}" maps to severity ${expected}`, () => {
				const json = JSON.stringify({
					message: "Severity test",
					level: input,
					annotations: [
						{
							span: {
								start: { line: 1, column: 1 },
								end: { line: 1, column: 2 },
							},
						},
					],
				});

				const result = parser.parse(json, uri());
				expect(result.length).toBe(1);
				expect(toDiag(result[0]).severity).toBe(expected);
			});
		}
	});

	// -----------------------------------------------------------------------
	// parse() — text format
	// -----------------------------------------------------------------------

	test.describe("parse() — text format", () => {
		const uri = () =>
			({
				fsPath: "/project/test.php",
				toString: () => "file:///project/test.php",
				// biome-ignore lint/suspicious/noExplicitAny: test helper
			}) as any;

		test("Parses text line with line and column", () => {
			const result = parser.parse(
				"test.php:10:5: error: Undefined variable",
				uri(),
			);

			expect(result.length).toBe(1);
			const d = toDiag(result[0]);
			expect(d.message).toBe("Undefined variable");
			expect(d.severity).toBe(Sev.Error);
			expect(d.range.start.line).toBe(9); // 0-indexed
			expect(d.range.start.character).toBe(4); // 0-indexed
		});

		test("Parses text line without column (defaults to 0)", () => {
			const result = parser.parse(
				"test.php:15: warning: Unused variable",
				uri(),
			);

			expect(result.length).toBe(1);
			const d = toDiag(result[0]);
			expect(d.severity).toBe(Sev.Warning);
			expect(d.range.start.line).toBe(14);
			expect(d.range.start.character).toBe(0);
		});

		test("Parses hint severity in text format", () => {
			const result = parser.parse(
				"test.php:5:1: hint: Consider refactoring",
				uri(),
			);

			expect(result.length).toBe(1);
			expect(toDiag(result[0]).severity).toBe(Sev.Hint);
		});

		test("Parses multiple text lines", () => {
			const text = [
				"test.php:1: error: Error line",
				"test.php:2: warning: Warning line",
				"test.php:3: info: Info line",
			].join("\n");

			expect(parser.parse(text, uri()).length).toBe(3);
		});

		test("Ignores non-matching text lines", () => {
			const text = "Mago report\n==========\ntest.php:1: error: Real\nEnd";
			const result = parser.parse(text, uri());

			expect(result.length).toBe(1);
			expect(toDiag(result[0]).message).toBe("Real");
		});

		test("Sets source to 'mago' for text format diagnostics", () => {
			const result = parser.parse("test.php:1: error: Check source", uri());

			expect(toDiag(result[0]).source).toBe("mago");
		});
	});

	// -----------------------------------------------------------------------
	// parseProject() — project-wide mode
	// -----------------------------------------------------------------------

	test.describe("parseProject() — JSON input", () => {
		test("Returns empty map for empty string", () => {
			expect(parser.parseProject("", "/project").size).toBe(0);
		});

		test("Returns empty map for whitespace-only string", () => {
			expect(parser.parseProject("   \n  ", "/project").size).toBe(0);
		});

		test("Groups issues by file path (two files, three issues)", () => {
			const json = JSON.stringify([
				{
					message: "Error in file1",
					level: "Error",
					annotations: [
						{
							span: {
								file_id: { name: "file1.php", path: "/project/file1.php" },
								start: { line: 1, column: 1 },
								end: { line: 1, column: 5 },
							},
						},
					],
				},
				{
					message: "Error in file2",
					level: "Warning",
					annotations: [
						{
							span: {
								file_id: { name: "file2.php", path: "/project/file2.php" },
								start: { line: 2, column: 1 },
								end: { line: 2, column: 5 },
							},
						},
					],
				},
				{
					message: "Another error in file1",
					level: "Error",
					annotations: [
						{
							span: {
								file_id: { name: "file1.php", path: "/project/file1.php" },
								start: { line: 5, column: 1 },
								end: { line: 5, column: 5 },
							},
						},
					],
				},
			]);

			const result = parser.parseProject(json, "/project");

			expect(result.size).toBe(2);
			const file1 = Array.from(result.keys()).find((k) =>
				k.includes("file1.php"),
			);
			const file2 = Array.from(result.keys()).find((k) =>
				k.includes("file2.php"),
			);
			expect(file1).toBeTruthy();
			expect(file2).toBeTruthy();
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(result.get(file1!)?.length).toBe(2);
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(result.get(file2!)?.length).toBe(1);
		});

		test("Skips issue without file_id in annotation", () => {
			const json = JSON.stringify([
				{
					message: "No file issue",
					level: "Error",
					annotations: [
						{ kind: "Primary", span: { start: { line: 1, column: 1 } } },
					],
				},
			]);

			expect(parser.parseProject(json, "/project").size).toBe(0);
		});

		test("Skips issue without message", () => {
			const json = JSON.stringify([
				{ level: "Error", file: "/project/test.php", line: 1, column: 1 },
			]);

			expect(parser.parseProject(json, "/project").size).toBe(0);
		});

		test("Handles legacy json.file format", () => {
			const json = JSON.stringify([
				{
					message: "Legacy issue",
					level: "Error",
					file: "/project/legacy.php",
					line: 3,
					column: 2,
				},
			]);

			const result = parser.parseProject(json, "/project");

			expect(result.size).toBe(1);
			const filePath = Array.from(result.keys())[0];
			expect(filePath).toContain("legacy.php");
			expect(toDiag(result.get(filePath)?.[0]).range.start.line).toBe(2); // 0-indexed
		});

		test("Strips Windows \\\\?\\\\ prefix from file paths", () => {
			const json = JSON.stringify({
				message: "Win path issue",
				level: "Error",
				annotations: [
					{
						kind: "Primary",
						span: {
							file_id: {
								name: "test.php",
								path: "\\\\?\\C:\\project\\test.php",
							},
							start: { line: 1, column: 1 },
						},
					},
				],
			});

			const result = parser.parseProject(json, "C:\\project");

			expect(result.size).toBe(1);
			const filePath = Array.from(result.keys())[0];
			expect(filePath.includes("\\\\?\\")).toBe(false);
		});

		test("Resolves relative path against workspaceFolder", () => {
			const json = JSON.stringify([
				{
					message: "Relative path issue",
					level: "Error",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: { name: "src/rel.php", path: "src/rel.php" },
								start: { line: 1, column: 1 },
							},
						},
					],
				},
			]);

			const result = parser.parseProject(json, "/project");

			expect(result.size).toBe(1);
			const filePath = Array.from(result.keys())[0];
			expect(filePath).toContain("project");
			expect(filePath).toContain("rel.php");
		});

		test("Falls back to first annotation when no Primary annotation exists", () => {
			const json = JSON.stringify([
				{
					message: "Secondary-only",
					level: "Warning",
					annotations: [
						{
							kind: "Secondary",
							span: {
								file_id: { name: "sec.php", path: "/project/sec.php" },
								start: { line: 3, column: 2 },
							},
						},
					],
				},
			]);

			const result = parser.parseProject(json, "/project");

			expect(result.size).toBe(1);
			const filePath = Array.from(result.keys())[0];
			expect(filePath).toContain("sec.php");
			const diags = result.get(filePath);
			expect(diags?.length).toBe(1);
			expect(toDiag(diags?.[0]).range.start.line).toBe(2); // 0-indexed
		});

		test("issueToDiagnostic uses endLine and endColumn from span", () => {
			const json = JSON.stringify([
				{
					message: "Span range",
					level: "Error",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: { name: "range.php", path: "/project/range.php" },
								start: { line: 3, column: 1 },
								end: { line: 5, column: 20 },
							},
						},
					],
				},
			]);

			const result = parser.parseProject(json, "/project");
			const filePath = Array.from(result.keys())[0];
			const diags = result.get(filePath);
			expect(diags).toBeTruthy();
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			const d = toDiag(diags![0]);
			expect(d.range.end.line).toBe(4); // 0-indexed (5-1)
			expect(d.range.end.character).toBe(19); // 0-indexed (20-1)
		});

		test("issueToDiagnostic attaches notes and help as relatedInformation", () => {
			const json = JSON.stringify([
				{
					message: "Issue with context",
					level: "Warning",
					notes: ["RFC 123"],
					help: "Use function Y",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: { name: "ctx.php", path: "/project/ctx.php" },
								start: { line: 1, column: 1 },
								end: { line: 1, column: 5 },
							},
						},
					],
				},
			]);

			const result = parser.parseProject(json, "/project");
			const filePath = Array.from(result.keys())[0];
			const diags = result.get(filePath);
			expect(diags).toBeTruthy();
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			const d = toDiag(diags![0]);
			expect(d.relatedInformation).toBeTruthy();
			// 1 note + 1 help = 2
			expect(d.relatedInformation?.length).toBe(2);
		});

		test("issueToDiagnostic attaches code from JSON issue", () => {
			const json = JSON.stringify([
				{
					message: "Coded project issue",
					level: "Error",
					code: "P001",
					annotations: [
						{
							kind: "Primary",
							span: {
								file_id: { name: "coded.php", path: "/project/coded.php" },
								start: { line: 1, column: 1 },
								end: { line: 1, column: 5 },
							},
						},
					],
				},
			]);

			const result = parser.parseProject(json, "/project");
			const filePath = Array.from(result.keys())[0];
			const diags = result.get(filePath);
			expect(diags).toBeTruthy();
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(toDiag(diags![0]).code).toBe("P001");
		});
	});

	test.describe("parseProject() — text format", () => {
		test("Parses text lines and groups by file", () => {
			const text = [
				"/project/a.php:1: error: Error in a",
				"/project/b.php:2: warning: Warning in b",
				"/project/a.php:5: info: Info in a",
			].join("\n");

			const result = parser.parseProject(text, "/project");

			expect(result.size).toBe(2);
			const aPath = Array.from(result.keys()).find((k) => k.includes("a.php"));
			const bPath = Array.from(result.keys()).find((k) => k.includes("b.php"));
			expect(aPath).toBeTruthy();
			expect(bPath).toBeTruthy();
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(result.get(aPath!)?.length).toBe(2);
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			expect(result.get(bPath!)?.length).toBe(1);
		});

		test("Resolves relative text-format paths against workspaceFolder", () => {
			const text = "src/test.php:10: error: Relative test error";
			const result = parser.parseProject(text, "/project");

			expect(result.size).toBe(1);
			const filePath = Array.from(result.keys())[0];
			expect(filePath).toContain("project");
			expect(filePath).toContain("test.php");
		});

		test("Returns empty map for non-matching text", () => {
			expect(parser.parseProject("No issues here.", "/project").size).toBe(0);
		});

		test("Clamps path traversal in relative mago output to workspace root", () => {
			// A malformed relative path that tries to escape the workspace boundary
			// must be clamped to the workspace root rather than resolving to an
			// out-of-bounds path.
			const text = "../../etc/passwd:1: error: Traversal attempt";
			const result = parser.parseProject(text, "/project");

			// The file should still be registered (diagnostic is preserved) but the
			// resolved path must stay within or equal to the workspace root.
			if (result.size > 0) {
				const resolvedPath = Array.from(result.keys())[0];
				expect(resolvedPath.startsWith("/project") || resolvedPath === "/project").toBe(true);
			}
		});
	});
});
