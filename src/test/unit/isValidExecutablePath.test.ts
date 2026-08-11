/**
 * Standalone unit tests for isValidExecutablePath.
 *
 * These tests run directly with Playwright (no VS Code extension host required).
 * The vscode module is mocked via the setup file loaded via globalSetup.
 *
 * Run with: pnpm run test:unit:playwright
 */
import "./setup";
import { expect, test } from "@playwright/test";
import { isValidExecutablePath } from "../../magoRunner";

test.describe("isValidExecutablePath - Pure Unit Tests", () => {
	test.describe("Valid paths (should return true)", () => {
		test("Plain executable name", () => {
			expect(isValidExecutablePath("mago")).toBe(true);
		});

		test("Unix absolute path", () => {
			// Absolute paths are intentionally allowed — users may install mago anywhere.
			expect(isValidExecutablePath("/usr/local/bin/mago")).toBe(true);
		});

		test("Windows absolute path with backslash", () => {
			expect(isValidExecutablePath("C:\\tools\\mago.exe")).toBe(true);
		});

		test("Windows absolute path with forward slash", () => {
			expect(isValidExecutablePath("C:/tools/mago.exe")).toBe(true);
		});

		test("Relative path without traversal", () => {
			expect(isValidExecutablePath("bin/mago")).toBe(true);
		});

		test("Executable name with hyphen", () => {
			expect(isValidExecutablePath("mago-cli")).toBe(true);
		});

		test("Executable name with underscore", () => {
			expect(isValidExecutablePath("mago_tool")).toBe(true);
		});

		test("Executable name with version suffix", () => {
			expect(isValidExecutablePath("mago-0.26.0")).toBe(true);
		});
	});

	test.describe("Empty / null-like inputs (should return false)", () => {
		test("Empty string", () => {
			expect(isValidExecutablePath("")).toBe(false);
		});
	});

	test.describe("Path traversal (should return false)", () => {
		test("Leading ../", () => {
			expect(isValidExecutablePath("../evil")).toBe(false);
		});

		test("Middle ../../", () => {
			expect(isValidExecutablePath("foo/../../evil")).toBe(false);
		});

		test("Exactly '..'", () => {
			expect(isValidExecutablePath("..")).toBe(false);
		});

		test("Backslash-separated traversal on Windows (..\\)", () => {
			expect(isValidExecutablePath("foo\\..\\evil.exe")).toBe(false);
		});

		test("Mixed separator traversal", () => {
			expect(isValidExecutablePath("foo/../evil")).toBe(false);
		});
	});

	test.describe("Shell metacharacters (should return false)", () => {
		test("Ampersand &", () => {
			expect(isValidExecutablePath("mago&evil")).toBe(false);
		});

		test("Pipe |", () => {
			expect(isValidExecutablePath("mago|evil")).toBe(false);
		});

		test("Semicolon ;", () => {
			expect(isValidExecutablePath("mago;evil")).toBe(false);
		});

		test("Less-than <", () => {
			expect(isValidExecutablePath("mago<input")).toBe(false);
		});

		test("Greater-than >", () => {
			expect(isValidExecutablePath("mago>output")).toBe(false);
		});

		test("Dollar sign $", () => {
			expect(isValidExecutablePath("$PATH/mago")).toBe(false);
		});

		test("Glob asterisk * (consistent with isValidBaselinePath)", () => {
			expect(isValidExecutablePath("mago*")).toBe(false);
		});

		test("Backtick `", () => {
			expect(isValidExecutablePath("`cmd`")).toBe(false);
		});

		test("Exclamation mark !", () => {
			expect(isValidExecutablePath("mago!")).toBe(false);
		});

		test("Question mark ?", () => {
			expect(isValidExecutablePath("mago?")).toBe(false);
		});

		test("Opening parenthesis (", () => {
			expect(isValidExecutablePath("mago(")).toBe(false);
		});

		test("Opening square bracket [", () => {
			expect(isValidExecutablePath("mago[0]")).toBe(false);
		});

		test("Opening curly brace {", () => {
			expect(isValidExecutablePath("mago{a}")).toBe(false);
		});

		test("Percent sign % (Windows env var expansion)", () => {
			expect(isValidExecutablePath("%APPDATA%\\mago.exe")).toBe(false);
		});
	});

	test.describe("Boundary / combined cases", () => {
		test("Traversal combined with metacharacter", () => {
			expect(isValidExecutablePath("../evil&cmd")).toBe(false);
		});

		test("Executable name with dot (not traversal segment)", () => {
			// A single-segment name containing a dot is valid — it is not path traversal
			expect(isValidExecutablePath("mago.exe")).toBe(true);
		});
	});
});
