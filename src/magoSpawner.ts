import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { SpawnResult } from "./types";

/** Maximum stdout+stderr bytes before mago output is truncated and the process killed. */
const MAX_BUFFER_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Convert a Git Bash / MSYS style POSIX path (e.g. `/c/Users/x/mago`) to a
 * native Windows path (e.g. `C:\Users\x\mago`). No-op on non-Windows
 * platforms or paths that don't match the drive-letter pattern.
 *
 * This is a pure string transform, not a security boundary — the resulting
 * path still passes through {@link isValidExecutablePath} validation before
 * ever reaching this function.
 * @param p - Path string to normalise.
 * @returns The Windows-native path, or the original string unchanged.
 */
function normalizeGitBashPath(p: string): string {
	if (process.platform !== "win32") {
		return p;
	}
	const match = p.match(/^\/([a-zA-Z])\/(.*)$/);
	if (!match) {
		return p;
	}
	const [, drive, rest] = match;
	return `${drive.toUpperCase()}:\\${rest.replace(/\//g, "\\")}`;
}

/**
 * Resolve an absolute executable path to one Windows can actually launch.
 * Windows' CreateProcess cannot execute extension-less files directly — even
 * when such a file exists on disk (e.g. Composer's `vendor/bin/mago` shim,
 * whose extension-less sibling is a raw PHP script). Only `.exe` is a valid
 * substitute: since Node.js CVE-2024-27980, `.bat`/`.cmd` cannot be spawned
 * at all without `shell: true` (see {@link describeSpawnError}), so they are
 * intentionally not searched for here.
 * @param p - Candidate executable path (already Git-Bash-normalised).
 * @returns A launchable `.exe` path if one exists, otherwise the original path.
 */
function resolveWindowsExecutable(p: string): string {
	if (process.platform !== "win32" || !path.isAbsolute(p)) {
		return p;
	}
	if (fs.existsSync(`${p}.exe`)) {
		return `${p}.exe`;
	}
	return p;
}

/**
 * Build a user-facing description of a spawn failure, adding a specific hint
 * for the known Windows failure modes: Git Bash style paths, and `.bat`/`.cmd`
 * (or extension-less shim scripts that resolve to one) that Node.js refuses
 * to spawn without `shell: true` — blocked since Node.js CVE-2024-27980 (see
 * ADR-002 for why this extension never re-enables `shell: true`). EINVAL is
 * Node's signal for exactly this case on Windows, regardless of whether the
 * configured path itself carried a `.bat`/`.cmd` extension.
 * @param err - The error raised by the child process's `"error"` event.
 * @param resolvedPath - The path actually passed to `child_process.spawn` (post-normalisation).
 * @returns A human-readable message suitable for `vscode.window.showErrorMessage`.
 */
function describeSpawnError(
	err: NodeJS.ErrnoException,
	resolvedPath: string,
): string {
	if (err.code === "EINVAL") {
		return `Mago: Cannot run "${resolvedPath}" — Windows blocks direct execution of .bat/.cmd files (and script shims that resolve to one) for security reasons. Install the native mago .exe from https://github.com/carthage-software/mago/releases and set mago.executablePath to it.`;
	}
	if (err.code === "ENOENT" && /^\/[a-zA-Z]\//.test(resolvedPath)) {
		return `Mago: Cannot find "${resolvedPath}". This looks like a Git Bash style path — on Windows, set mago.executablePath to a native .exe path instead (e.g. "C:\\Users\\...\\mago.exe").`;
	}
	if (err.code === "ENOENT") {
		return `Mago: Executable not found at "${resolvedPath}". Check that mago is installed and that mago.executablePath (or your PATH) points to a valid mago binary.`;
	}
	return `Failed to run mago: ${err.message}`;
}

/**
 * Spawn the mago executable with the given arguments and collect stdout/stderr.
 * Resolves with a SpawnResult; never rejects — spawn errors are handled internally.
 * @param magoPath - Validated filesystem path or executable name for mago.
 * @param args - CLI arguments to pass to the mago executable.
 * @param cwd - Optional working directory for the child process.
 * @returns A promise that resolves with the collected stdout, stderr, and exit code.
 */
export function spawnMagoProcess(
	magoPath: string,
	args: string[],
	cwd?: string,
): Promise<SpawnResult> {
	return new Promise((resolve) => {
		const resolvedPath = resolveWindowsExecutable(
			normalizeGitBashPath(magoPath),
		);
		const childProcess = child_process.spawn(resolvedPath, args, {
			cwd,
			timeout: 60_000,
			shell: false,
		});

		let stdout = "";
		let stderr = "";
		// Node.js fires events in "error" → "close" order on spawn failure.
		// A guard flag prevents the Promise from being resolved twice if both handlers call resolve().
		let resolved = false;

		childProcess.stdout?.on("data", (data: Buffer) => {
			if (stdout.length + data.length > MAX_BUFFER_BYTES) {
				if (!resolved) {
					resolved = true;
					childProcess.kill();
					void vscode.window.showErrorMessage(
						"Mago: Output exceeded 50 MB limit. The project may be too large to analyse at once.",
					);
					resolve({
						stdout: "",
						stderr: "Output size limit exceeded",
						exitCode: null,
					});
				}
				return;
			}
			stdout += data.toString();
		});

		childProcess.stderr?.on("data", (data: Buffer) => {
			// Silently truncate stderr overflow; the stdout guard handles process abort.
			if (stderr.length + data.length <= MAX_BUFFER_BYTES) {
				stderr += data.toString();
			}
		});

		childProcess.on("close", (exitCode) => {
			if (!resolved) {
				resolved = true;
				resolve({ stdout, stderr, exitCode });
			}
		});

		childProcess.on("error", (err: NodeJS.ErrnoException) => {
			if (!resolved) {
				resolved = true;
				void vscode.window.showErrorMessage(
					describeSpawnError(err, resolvedPath),
				);
				resolve({ stdout: "", stderr: err.message, exitCode: null });
			}
		});
	});
}

/**
 * Write the raw stdout + stderr of a mago invocation to the output channel.
 * @param command - Human-readable label for the mago sub-command (e.g. `"lint"`, `"fmt --check"`).
 * @param target - The file path or workspace folder that was passed to mago.
 * @param result - The {@link SpawnResult} containing stdout, stderr, and exit code.
 * @param outputChannel - VS Code output channel to write to.
 */
export function logMagoOutput(
	command: string,
	target: string,
	result: SpawnResult,
	outputChannel: vscode.OutputChannel,
): void {
	const output = result.stdout + result.stderr;
	outputChannel.appendLine(`\n[${command}] ${path.basename(target)}`);
	outputChannel.appendLine("--- Raw Output ---");
	outputChannel.appendLine(output);
	outputChannel.appendLine("--- End Output ---\n");
}
