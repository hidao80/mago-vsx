import * as vscode from 'vscode';
import { MagoRunner } from './magoRunner';

let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;
let magoRunner: MagoRunner;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Mago extension is now active');

  diagnosticCollection = vscode.languages.createDiagnosticCollection('mago');
  context.subscriptions.push(diagnosticCollection);

  outputChannel = vscode.window.createOutputChannel('Mago');
  context.subscriptions.push(outputChannel);

  magoRunner = new MagoRunner(diagnosticCollection, outputChannel);

  // コマンド登録
  context.subscriptions.push(
    vscode.commands.registerCommand('mago.lintCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'php') {
        await magoRunner.runLint(editor.document.uri);
      } else {
        vscode.window.showWarningMessage('Please open a PHP file to lint.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.analyzeCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'php') {
        await magoRunner.runAnalyze(editor.document.uri);
      } else {
        vscode.window.showWarningMessage('Please open a PHP file to analyze.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.lintProject', async () => {
      await magoRunner.runLintProject();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.analyzeProject', async () => {
      await magoRunner.runAnalyzeProject();
    })
  );

  // Lint & Analyze 両方実行
  context.subscriptions.push(
    vscode.commands.registerCommand('mago.lintAndAnalyzeCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'php') {
        // 既存の診断をクリアしてから両方実行
        diagnosticCollection.delete(editor.document.uri);
        await magoRunner.runLint(editor.document.uri);
        await magoRunner.runAnalyze(editor.document.uri);
      } else {
        vscode.window.showWarningMessage('Please open a PHP file to lint and analyze.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.lintAndAnalyzeProject', async () => {
      // 既存の診断をクリアしてから両方実行
      diagnosticCollection.clear();
      await magoRunner.runLintProject();
      await magoRunner.runAnalyzeProject();
    })
  );

  // Format commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mago.formatCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'php') {
        await magoRunner.runFormat(editor.document.uri);
      } else {
        vscode.window.showWarningMessage('Please open a PHP file to format.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.formatProject', async () => {
      await magoRunner.runFormatProject();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.formatCheck', async () => {
      await magoRunner.runFormatCheck();
    })
  );

  // Baseline generation commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mago.generateLintBaseline', async () => {
      const config = vscode.workspace.getConfiguration('mago');
      let baselinePath = config.get<string>('lintBaseline', '');

      if (!baselinePath) {
        baselinePath = await vscode.window.showInputBox({
          prompt: 'Enter the path for lint baseline file',
          value: 'lint-baseline.toml',
          placeHolder: 'lint-baseline.toml'
        }) || '';
      }

      if (baselinePath) {
        await magoRunner.runGenerateLintBaseline(baselinePath);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mago.generateAnalyzeBaseline', async () => {
      const config = vscode.workspace.getConfiguration('mago');
      let baselinePath = config.get<string>('analyzeBaseline', '');

      if (!baselinePath) {
        baselinePath = await vscode.window.showInputBox({
          prompt: 'Enter the path for analyze baseline file',
          value: 'analysis-baseline.toml',
          placeHolder: 'analysis-baseline.toml'
        }) || '';
      }

      if (baselinePath) {
        await magoRunner.runGenerateAnalyzeBaseline(baselinePath);
      }
    })
  );

  // ファイル保存時の自動実行
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId !== 'php') {
        return;
      }

      const config = vscode.workspace.getConfiguration('mago');
      const lintOnSave = config.get<boolean>('lintOnSave', true);
      const analyzeOnSave = config.get<boolean>('analyzeOnSave', true);
      const formatOnSave = config.get<boolean>('formatOnSave', false);

      // フォーマットを最初に実行
      if (formatOnSave) {
        await magoRunner.runFormat(document.uri);
      }

      // 両方実行する場合は最初に診断をクリア
      if (lintOnSave && analyzeOnSave) {
        diagnosticCollection.delete(document.uri);
      }

      if (lintOnSave) {
        await magoRunner.runLint(document.uri);
      }

      if (analyzeOnSave) {
        await magoRunner.runAnalyze(document.uri);
      }
    })
  );
}

export function deactivate(): void {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  if (outputChannel) {
    outputChannel.dispose();
  }
}
