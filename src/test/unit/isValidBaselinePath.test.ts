/**
 * Standalone unit tests for isValidBaselinePath.
 *
 * These tests run directly with Playwright (no VS Code extension host required).
 * The vscode module is mocked via the setup file loaded via globalSetup.
 *
 * Run with: pnpm run test:unit:playwright
 */
import "./setup";
import { expect, test } from "@playwright/test";
import { isValidBaselinePath } from "../../magoRunner";

test.describe("isValidBaselinePath - Pure Unit Tests", () => {
	test.describe("Valid paths (should return true)", () => {
		test("Simple filename", () => {
			expect(isValidBaselinePath("baseline.toml")).toBe(true);
		});

		test("Nested relative path with forward slashes", () => {
			expect(isValidBaselinePath("baselines/lint.toml")).toBe(true);
		});

		test("Deeply nested relative path", () => {
			expect(isValidBaselinePath("a/b/c/baseline.toml")).toBe(true);
		});

		test("Filename with double dot inside (not a traversal segment)", () => {
			// "foo..bar" is a single segment, not a traversal
			expect(isValidBaselinePath("foo..bar.toml")).toBe(true);
		});

		test("Filename with numbers and hyphens", () => {
			expect(isValidBaselinePath("lint-baseline-v2.toml")).toBe(true);
		});

		test("Filename with underscores", () => {
			expect(isValidBaselinePath("lint_baseline.toml")).toBe(true);
		});

		test("Filename with uppercase letters", () => {
			expect(isValidBaselinePath("LintBaseline.toml")).toBe(true);
		});

		test("Path with backslash separator (Windows-style, no traversal)", () => {
			expect(isValidBaselinePath("baselines\\lint.toml")).toBe(true);
		});

		test("Valid path with multiple segments", () => {
			expect(isValidBaselinePath("reports/2025/lint-baseline.toml")).toBe(true);
		});
	});

	test.describe("Empty / null-like inputs (should return false)", () => {
		test("Empty string", () => {
			expect(isValidBaselinePath("")).toBe(false);
		});
	});

	test.describe("Path traversal (should return false)", () => {
		test("Leading ../", () => {
			expect(isValidBaselinePath("../evil.toml")).toBe(false);
		});

		test("Middle ../../", () => {
			expect(isValidBaselinePath("foo/../../etc/passwd")).toBe(false);
		});

		test("Exactly '..'", () => {
			expect(isValidBaselinePath("..")).toBe(false);
		});

		test("Backslash-separated traversal on Windows (..\\)", () => {
			expect(isValidBaselinePath("foo\\..\\evil.toml")).toBe(false);
		});

		test("Mixed separator traversal", () => {
			expect(isValidBaselinePath("foo/../evil.toml")).toBe(false);
		});
	});

	test.describe("Absolute paths (should return false)", () => {
		test("Unix absolute path /etc/passwd", () => {
			expect(isValidBaselinePath("/etc/passwd")).toBe(false);
		});

		test("Windows absolute path C:\\baseline.toml", () => {
			expect(isValidBaselinePath("C:\\baseline.toml")).toBe(false);
		});

		test("Windows absolute path with lowercase drive letter c:\\", () => {
			expect(isValidBaselinePath("c:\\baseline.toml")).toBe(false);
		});

		test("Windows absolute path D:\\deep\\path\\baseline.toml", () => {
			expect(isValidBaselinePath("D:\\deep\\path\\baseline.toml")).toBe(false);
		});

		test("Windows UNC path \\\\server\\share\\baseline.toml", () => {
			expect(isValidBaselinePath("\\\\server\\share\\baseline.toml")).toBe(
				false,
			);
		});

		test("Windows UNC path \\\\server\\share (no trailing filename)", () => {
			expect(isValidBaselinePath("\\\\server\\share")).toBe(false);
		});
	});

	test.describe("Shell metacharacters (should return false)", () => {
		test("Ampersand &", () => {
			expect(isValidBaselinePath("base&line.toml")).toBe(false);
		});

		test("Pipe |", () => {
			expect(isValidBaselinePath("base|line.toml")).toBe(false);
		});

		test("Semicolon ;", () => {
			expect(isValidBaselinePath("base;line.toml")).toBe(false);
		});

		test("Dollar sign $", () => {
			expect(isValidBaselinePath("base$line.toml")).toBe(false);
		});

		test("Greater-than >", () => {
			expect(isValidBaselinePath("file>output.toml")).toBe(false);
		});

		test("Less-than <", () => {
			expect(isValidBaselinePath("file<input.toml")).toBe(false);
		});

		test("Backtick `", () => {
			expect(isValidBaselinePath("file`cmd`.toml")).toBe(false);
		});

		test("Exclamation mark !", () => {
			expect(isValidBaselinePath("file!flag.toml")).toBe(false);
		});

		test("Glob asterisk *", () => {
			expect(isValidBaselinePath("file*.toml")).toBe(false);
		});

		test("Glob question mark ?", () => {
			expect(isValidBaselinePath("file?.toml")).toBe(false);
		});

		test("Opening parenthesis (", () => {
			expect(isValidBaselinePath("file(paren.toml")).toBe(false);
		});

		test("Closing parenthesis )", () => {
			expect(isValidBaselinePath("fileparen).toml")).toBe(false);
		});

		test("Opening square bracket [", () => {
			expect(isValidBaselinePath("file[0].toml")).toBe(false);
		});

		test("Opening curly brace {", () => {
			expect(isValidBaselinePath("file{a}.toml")).toBe(false);
		});

		test("Percent sign % (Windows env var expansion)", () => {
			expect(isValidBaselinePath("%APPDATA%\\baseline.toml")).toBe(false);
		});

		test("Percent sign % standalone", () => {
			expect(isValidBaselinePath("file%data.toml")).toBe(false);
		});
	});

	test.describe("Boundary / combined cases", () => {
		test("Path that is only a dot '.'", () => {
			// A single '.' refers to a directory, not a file — not a valid baseline path
			expect(isValidBaselinePath(".")).toBe(false);
		});

		test("Traversal combined with metacharacter", () => {
			expect(isValidBaselinePath("../evil&file.toml")).toBe(false);
		});
	});
});
