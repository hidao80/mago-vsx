import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { MagoOutputParser } from './magoOutputParser';

type MagoCommand = 'lint' | 'analyze';

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class MagoRunner {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private outputParser: MagoOutputParser;
  private outputChannel: vscode.OutputChannel;

  constructor(diagnosticCollection: vscode.DiagnosticCollection, outputChannel: vscode.OutputChannel) {
    this.diagnosticCollection = diagnosticCollection;
    this.outputParser = new MagoOutputParser();
    this.outputChannel = outputChannel;
  }

  // Public API methods
  async runLint(fileUri: vscode.Uri): Promise<void> {
    await this.runMagoCommand('lint', fileUri);
  }

  async runAnalyze(fileUri: vscode.Uri): Promise<void> {
    await this.runMagoCommand('analyze', fileUri);
  }

  async runLintProject(): Promise<void> {
    await this.runMagoProjectCommand('lint');
  }

  async runAnalyzeProject(): Promise<void> {
    await this.runMagoProjectCommand('analyze');
  }

  async runFormat(fileUri: vscode.Uri): Promise<void> {
    await this.runFormatCommand(fileUri.fsPath);
  }

  async runFormatProject(): Promise<void> {
    await this.runFormatCommand('.');
  }

  async runFormatCheck(): Promise<void> {
    await this.runFormatCheckCommand();
  }

  async runGenerateLintBaseline(baselinePath: string): Promise<void> {
    await this.runGenerateBaselineCommand('lint', baselinePath);
  }

  async runGenerateAnalyzeBaseline(baselinePath: string): Promise<void> {
    await this.runGenerateBaselineCommand('analyze', baselinePath);
  }

  // Core command execution methods
  private async runMagoCommand(command: MagoCommand, fileUri: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration('mago');
    const args = this.buildDiagnosticCommandArgs(command, config);
    args.push(fileUri.fsPath);

    const workspaceFolder = this.getWorkspaceFolder(fileUri);
    const result = await this.spawnMago(args, workspaceFolder);

    this.logOutput(command, fileUri.fsPath, result);
    this.handleMagoOutput(result.stdout + result.stderr, fileUri, command);
  }

  private async runMagoProjectCommand(command: MagoCommand): Promise<void> {
    const workspaceFolder = this.getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const config = vscode.workspace.getConfiguration('mago');
    const args = this.buildDiagnosticCommandArgs(command, config);
    args.push('.');

    const result = await this.spawnMago(args, workspaceFolder);

    this.logOutput(`${command} Project`, workspaceFolder, result);
    this.handleMagoProjectOutput(result.stdout + result.stderr, workspaceFolder, command);
  }

  private async runFormatCommand(target: string): Promise<void> {
    const workspaceFolder = this.getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const result = await this.spawnMago(['fmt', target], workspaceFolder);
    this.logOutput('fmt', target, result);

    if (result.exitCode === 0) {
      const message = target === '.'
        ? 'Mago fmt: Project formatted successfully'
        : 'Mago fmt: File formatted successfully';
      vscode.window.showInformationMessage(message);
    } else {
      vscode.window.showErrorMessage(
        `Mago fmt: Failed with exit code ${result.exitCode}. Check "Mago" output for details.`
      );
      this.outputChannel.show(true);
    }
  }

  private async runFormatCheckCommand(): Promise<void> {
    const workspaceFolder = this.getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const result = await this.spawnMago(['fmt', '--check', '.'], workspaceFolder);
    this.logOutput('fmt --check', workspaceFolder, result);

    if (result.exitCode === 0) {
      vscode.window.showInformationMessage('Mago fmt --check: All files are correctly formatted');
    } else if (result.exitCode === 1) {
      vscode.window.showWarningMessage(
        'Mago fmt --check: Some files need formatting. Check "Mago" output for details.'
      );
      this.outputChannel.show(true);
    } else {
      vscode.window.showErrorMessage(
        `Mago fmt --check: Failed with exit code ${result.exitCode}. Check "Mago" output for details.`
      );
      this.outputChannel.show(true);
    }
  }

  private async runGenerateBaselineCommand(command: MagoCommand, baselinePath: string): Promise<void> {
    const workspaceFolder = this.getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const result = await this.spawnMago(
      [command, '--generate-baseline', '--baseline', baselinePath, '.'],
      workspaceFolder
    );

    this.logOutput(`${command} --generate-baseline`, workspaceFolder, result);

    if (result.exitCode === 0) {
      vscode.window.showInformationMessage(`Mago ${command}: Baseline generated at ${baselinePath}`);
    } else {
      vscode.window.showErrorMessage(
        `Mago ${command}: Failed to generate baseline. Check "Mago" output for details.`
      );
      this.outputChannel.show(true);
    }
  }

  // Helper methods
  private buildDiagnosticCommandArgs(command: MagoCommand, config: vscode.WorkspaceConfiguration): string[] {
    const args = [command, '--reporting-format', 'json'];

    const baselineConfig = command === 'lint' ? 'lintBaseline' : 'analyzeBaseline';
    const baselinePath = config.get<string>(baselineConfig, '');
    if (baselinePath) {
      args.push('--baseline', baselinePath);
    }

    return args;
  }

  private async spawnMago(args: string[], cwd?: string): Promise<SpawnResult> {
    const config = vscode.workspace.getConfiguration('mago');
    const magoPath = config.get<string>('executablePath', 'mago');

    return new Promise((resolve) => {
      const childProcess = child_process.spawn(magoPath, args, {
        cwd,
        shell: process.platform === 'win32',
        windowsVerbatimArguments: false
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode });
      });

      childProcess.on('error', (err: Error) => {
        vscode.window.showErrorMessage(`Failed to run mago: ${err.message}`);
        resolve({ stdout: '', stderr: err.message, exitCode: null });
      });
    });
  }

  private logOutput(command: string, target: string, result: SpawnResult): void {
    const output = result.stdout + result.stderr;
    this.outputChannel.appendLine(`\n[${command}] ${target}`);
    this.outputChannel.appendLine('--- Raw Output ---');
    this.outputChannel.appendLine(output);
    this.outputChannel.appendLine('--- End Output ---\n');
  }

  private handleMagoOutput(output: string, fileUri: vscode.Uri, command: string): void {
    if (this.checkForErrors(output, command)) {
      return;
    }

    const diagnostics = this.outputParser.parse(output, fileUri);
    this.outputChannel.appendLine(`Parsed ${diagnostics.length} diagnostic(s)`);

    const existingDiagnostics = this.diagnosticCollection.get(fileUri) || [];
    const mergedDiagnostics = [...existingDiagnostics, ...diagnostics];
    this.diagnosticCollection.set(fileUri, mergedDiagnostics);

    this.notifyDiagnosticResult(diagnostics.length, output, command, false);
  }

  private handleMagoProjectOutput(output: string, workspaceFolder: string, command: string): void {
    if (this.checkForErrors(output, command)) {
      return;
    }

    const diagnosticsByFile = this.outputParser.parseProject(output, workspaceFolder);
    this.outputChannel.appendLine(`Parsed ${diagnosticsByFile.size} file(s)`);

    let totalIssues = 0;
    for (const [filePath, diagnostics] of diagnosticsByFile.entries()) {
      const uri = vscode.Uri.file(filePath);
      const existingDiagnostics = this.diagnosticCollection.get(uri) || [];
      const mergedDiagnostics = [...existingDiagnostics, ...diagnostics];
      this.diagnosticCollection.set(uri, mergedDiagnostics);
      totalIssues += diagnostics.length;
      this.outputChannel.appendLine(`  ${filePath}: ${diagnostics.length} issue(s)`);
    }

    this.notifyDiagnosticResult(totalIssues, output, command, true, diagnosticsByFile.size);
  }

  private notifyDiagnosticResult(
    issueCount: number,
    output: string,
    command: string,
    isProject: boolean,
    fileCount?: number
  ): void {
    if (issueCount > 0) {
      const message = isProject && fileCount !== undefined
        ? `Mago ${command}: Found ${issueCount} issue(s) in ${fileCount} file(s)`
        : `Mago ${command}: Found ${issueCount} issue(s)`;
      vscode.window.showInformationMessage(message);
      return;
    }

    // No issues found - check if output is valid JSON
    const trimmedOutput = output.trim();
    if (trimmedOutput.length === 0) {
      if (isProject) {
        vscode.window.showInformationMessage(`Mago ${command}: No issues found`);
      }
      return;
    }

    try {
      JSON.parse(trimmedOutput);
      // Valid JSON, no issues - show message only for project-level commands
      if (isProject) {
        vscode.window.showInformationMessage(`Mago ${command}: No issues found`);
      }
    } catch {
      // Invalid JSON - unexpected output
      vscode.window.showWarningMessage(
        `Mago ${command}: Output received but no issues parsed. Check "Mago" output channel.`
      );
      this.outputChannel.show(true);
    }
  }

  private checkForErrors(output: string, command: string): boolean {
    if (!output.includes('ERROR')) {
      return false;
    }

    // TOML configuration error
    if (output.includes('Failed to build the configuration')) {
      const tomlErrorMatch = output.match(/TOML parse error at line (\d+), column (\d+)/);
      if (tomlErrorMatch) {
        const [, line, column] = tomlErrorMatch;
        this.showConfigurationError(command, `line ${line}, column ${column}`);
        this.outputChannel.appendLine(`\n⚠️ Configuration Error Detected`);
        this.outputChannel.appendLine(`TOML parse error at line ${line}, column ${column}`);
        this.outputChannel.appendLine(`Please check your mago.toml file.\n`);
        return true;
      }

      this.showConfigurationError(command);
      this.outputChannel.appendLine(`\n⚠️ Configuration Error Detected\n`);
      return true;
    }

    // Other errors
    const errorLines = output.split('\n').filter(line => line.includes('ERROR'));
    if (errorLines.length > 0) {
      vscode.window.showErrorMessage(
        `Mago ${command}: Execution error occurred. Check "Mago" output for details.`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          this.outputChannel.show(true);
        }
      });
      this.outputChannel.appendLine(`\n⚠️ Error Detected:`);
      errorLines.forEach(line => this.outputChannel.appendLine(`  ${line}`));
      this.outputChannel.appendLine('');
      return true;
    }

    return false;
  }

  private showConfigurationError(command: string, details?: string): void {
    const message = details
      ? `Mago ${command}: Configuration error in mago.toml at ${details}. Check "Mago" output for details.`
      : `Mago ${command}: Failed to build configuration. Check "Mago" output for details.`;

    vscode.window.showErrorMessage(message, 'Show Output').then(selection => {
      if (selection === 'Show Output') {
        this.outputChannel.show(true);
      }
    });
  }

  private getWorkspaceFolder(fileUri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    return workspaceFolder?.uri.fsPath;
  }

  private getFirstWorkspaceFolder(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
  }
}
