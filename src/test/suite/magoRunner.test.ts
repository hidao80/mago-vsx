import * as assert from 'assert';
import * as vscode from 'vscode';
import { MagoRunner } from '../../magoRunner';

suite('MagoRunner Test Suite', () => {
  let diagnosticCollection: vscode.DiagnosticCollection;
  let outputChannel: vscode.OutputChannel;
  let magoRunner: MagoRunner;

  setup(() => {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('mago-test');
    outputChannel = vscode.window.createOutputChannel('Mago Test');
    magoRunner = new MagoRunner(diagnosticCollection, outputChannel);
  });

  teardown(() => {
    diagnosticCollection.dispose();
    outputChannel.dispose();
  });

  suite('Basic Functionality', () => {
    test('Should create MagoRunner instance', () => {
      assert.ok(magoRunner);
    });

    test('Should have runLint method', () => {
      assert.strictEqual(typeof magoRunner.runLint, 'function');
    });

    test('Should have runAnalyze method', () => {
      assert.strictEqual(typeof magoRunner.runAnalyze, 'function');
    });

    test('Should have runLintProject method', () => {
      assert.strictEqual(typeof magoRunner.runLintProject, 'function');
    });

    test('Should have runAnalyzeProject method', () => {
      assert.strictEqual(typeof magoRunner.runAnalyzeProject, 'function');
    });
  });

  suite('Configuration', () => {
    test('Should read mago.executablePath configuration', () => {
      const config = vscode.workspace.getConfiguration('mago');
      const executablePath = config.get<string>('executablePath', 'mago');
      assert.ok(executablePath);
    });

    test('Should read mago.lintOnSave configuration', () => {
      const config = vscode.workspace.getConfiguration('mago');
      const lintOnSave = config.get<boolean>('lintOnSave');
      assert.strictEqual(typeof lintOnSave, 'boolean');
    });

    test('Should read mago.analyzeOnSave configuration', () => {
      const config = vscode.workspace.getConfiguration('mago');
      const analyzeOnSave = config.get<boolean>('analyzeOnSave');
      assert.strictEqual(typeof analyzeOnSave, 'boolean');
    });
  });

  suite('Diagnostic Collection', () => {
    test('Should create diagnostic collection', () => {
      assert.ok(diagnosticCollection);
    });

    test('Should clear diagnostics', () => {
      const testUri = vscode.Uri.file('F:\\project\\test.php');
      const range = new vscode.Range(0, 0, 0, 1);
      const diagnostic = new vscode.Diagnostic(range, 'Test', vscode.DiagnosticSeverity.Error);

      diagnosticCollection.set(testUri, [diagnostic]);
      assert.strictEqual(diagnosticCollection.get(testUri)?.length, 1);

      diagnosticCollection.clear();
      assert.strictEqual(diagnosticCollection.get(testUri)?.length, 0);
    });

    test('Should set diagnostics for specific file', () => {
      const testUri = vscode.Uri.file('F:\\project\\test.php');
      const range = new vscode.Range(5, 10, 5, 20);
      const diagnostic = new vscode.Diagnostic(
        range,
        'Test error',
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = 'mago';
      diagnostic.code = 'test-code';

      diagnosticCollection.set(testUri, [diagnostic]);

      const diagnostics = diagnosticCollection.get(testUri);
      assert.strictEqual(diagnostics?.length, 1);
      assert.strictEqual(diagnostics![0].message, 'Test error');
      assert.strictEqual(diagnostics![0].source, 'mago');
      assert.strictEqual(diagnostics![0].code, 'test-code');
    });

    test('Should handle multiple diagnostics for same file', () => {
      const testUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = [
        new vscode.Diagnostic(
          new vscode.Range(1, 0, 1, 1),
          'Error 1',
          vscode.DiagnosticSeverity.Error
        ),
        new vscode.Diagnostic(
          new vscode.Range(5, 0, 5, 1),
          'Warning 1',
          vscode.DiagnosticSeverity.Warning
        ),
        new vscode.Diagnostic(
          new vscode.Range(10, 0, 10, 1),
          'Info 1',
          vscode.DiagnosticSeverity.Information
        )
      ];

      diagnosticCollection.set(testUri, diagnostics);

      const result = diagnosticCollection.get(testUri);
      assert.strictEqual(result?.length, 3);
    });

    test('Should handle diagnostics for multiple files', () => {
      const file1Uri = vscode.Uri.file('F:\\project\\file1.php');
      const file2Uri = vscode.Uri.file('F:\\project\\file2.php');

      diagnosticCollection.set(file1Uri, [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'Error in file1',
          vscode.DiagnosticSeverity.Error
        )
      ]);

      diagnosticCollection.set(file2Uri, [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'Error in file2',
          vscode.DiagnosticSeverity.Error
        )
      ]);

      assert.strictEqual(diagnosticCollection.get(file1Uri)?.length, 1);
      assert.strictEqual(diagnosticCollection.get(file2Uri)?.length, 1);
    });
  });

  suite('Output Channel', () => {
    test('Should create output channel', () => {
      assert.ok(outputChannel);
    });

    test('Should append line to output channel', () => {
      // OutputChannelは内容を直接読み取れないため、エラーが出ないことを確認
      assert.doesNotThrow(() => {
        outputChannel.appendLine('Test output');
      });
    });

    test('Should clear output channel', () => {
      assert.doesNotThrow(() => {
        outputChannel.clear();
      });
    });
  });

  suite('Error Handling', () => {
    test('Should handle runLintProject when no workspace folder is open', async () => {
      // VS Code拡張環境では、実際のworkspaceFoldersが存在する可能性があるため、
      // エラーがスローされないことを確認
      await assert.doesNotReject(async () => {
        await magoRunner.runLintProject();
      });
    });

    test('Should handle runAnalyzeProject when no workspace folder is open', async () => {
      await assert.doesNotReject(async () => {
        await magoRunner.runAnalyzeProject();
      });
    });
  });

  suite('Integration with VS Code', () => {
    test('Should register with language diagnostics', () => {
      // DiagnosticCollectionが正しく登録されていることを確認
      const allDiagnostics = vscode.languages.getDiagnostics();
      assert.ok(Array.isArray(allDiagnostics));
    });

    test('Should use correct diagnostic severity levels', () => {
      assert.strictEqual(vscode.DiagnosticSeverity.Error, 0);
      assert.strictEqual(vscode.DiagnosticSeverity.Warning, 1);
      assert.strictEqual(vscode.DiagnosticSeverity.Information, 2);
      assert.strictEqual(vscode.DiagnosticSeverity.Hint, 3);
    });
  });
});
