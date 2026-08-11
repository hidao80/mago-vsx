import * as child_process from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import type { SpawnResult } from "./types";

/** Maximum stdout+stderr bytes before mago output is truncated and the process killed. */
const MAX_BUFFER_BYTES = 50 * 1024 * 1024; // 50 MB

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
		const childProcess = child_process.spawn(magoPath, args, {
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

		childProcess.on("error", (err: Error) => {
			if (!resolved) {
				resolved = true;
				void vscode.window.showErrorMessage(
					`Failed to run mago: ${err.message}`,
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
