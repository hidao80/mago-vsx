import * as assert from 'assert';
import * as vscode from 'vscode';
import { MagoOutputParser } from '../../magoOutputParser';

suite('MagoOutputParser Test Suite', () => {
  let parser: MagoOutputParser;

  setup(() => {
    parser = new MagoOutputParser();
  });

  suite('JSON Output Parsing', () => {
    test('Should parse single JSON issue with annotations', () => {
      const jsonOutput = JSON.stringify({
        level: 'Error',
        code: 'test-error',
        message: 'Test error message',
        notes: ['Note 1', 'Note 2'],
        help: 'This is help text',
        annotations: [{
          kind: 'Primary',
          span: {
            file_id: {
              name: 'test.php',
              path: 'F:\\project\\test.php'
            },
            start: { offset: 0, line: 10, column: 5 },
            end: { offset: 20, line: 10, column: 25 }
          }
        }]
      });

      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(jsonOutput, fileUri);

      assert.strictEqual(diagnostics.length, 1);
      assert.strictEqual(diagnostics[0].message.includes('Test error message'), true);
      assert.strictEqual(diagnostics[0].message.includes('Note 1'), true);
      assert.strictEqual(diagnostics[0].message.includes('Note 2'), true);
      assert.strictEqual(diagnostics[0].message.includes('Help:'), true);
      assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(diagnostics[0].code, 'test-error');
      assert.strictEqual(diagnostics[0].range.start.line, 9); // 0-indexed
      assert.strictEqual(diagnostics[0].range.start.character, 4); // 0-indexed
    });

    test('Should parse JSON array of issues', () => {
      const jsonOutput = JSON.stringify([
        {
          level: 'Warning',
          message: 'Warning 1',
          annotations: [{
            span: {
              start: { line: 1, column: 1 },
              end: { line: 1, column: 10 }
            }
          }]
        },
        {
          level: 'Error',
          message: 'Error 1',
          annotations: [{
            span: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 10 }
            }
          }]
        }
      ]);

      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(jsonOutput, fileUri);

      assert.strictEqual(diagnostics.length, 2);
      assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Warning);
      assert.strictEqual(diagnostics[1].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should parse JSON with issues property', () => {
      const jsonOutput = JSON.stringify({
        issues: [
          {
            level: 'Info',
            message: 'Info message',
            annotations: [{
              span: {
                start: { line: 5, column: 10 },
                end: { line: 5, column: 20 }
              }
            }]
          }
        ]
      });

      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(jsonOutput, fileUri);

      assert.strictEqual(diagnostics.length, 1);
      assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Information);
    });

    test('Should handle Windows path with \\\\?\\ prefix', () => {
      const workspaceFolder = 'F:\\project';
      const jsonOutput = JSON.stringify({
        level: 'Error',
        message: 'Test',
        annotations: [{
          kind: 'Primary',
          span: {
            file_id: {
              name: 'test.php',
              path: '\\\\?\\F:\\project\\test.php'
            },
            start: { line: 1, column: 1 }
          }
        }]
      });

      const diagnosticsByFile = parser.parseProject(jsonOutput, workspaceFolder);

      assert.strictEqual(diagnosticsByFile.size, 1);
      const filePaths = Array.from(diagnosticsByFile.keys());
      assert.strictEqual(filePaths[0].includes('\\\\?\\'), false);
    });
  });

  suite('Text Output Parsing', () => {
    test('Should parse text format with line and column', () => {
      const textOutput = 'test.php:10:5: error: Undefined variable';
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(textOutput, fileUri);

      assert.strictEqual(diagnostics.length, 1);
      assert.strictEqual(diagnostics[0].message, 'Undefined variable');
      assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(diagnostics[0].range.start.line, 9); // 0-indexed
      assert.strictEqual(diagnostics[0].range.start.character, 4); // 0-indexed
    });

    test('Should parse text format without column', () => {
      const textOutput = 'test.php:15: warning: Unused variable';
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(textOutput, fileUri);

      assert.strictEqual(diagnostics.length, 1);
      assert.strictEqual(diagnostics[0].message, 'Unused variable');
      assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Warning);
      assert.strictEqual(diagnostics[0].range.start.line, 14);
      assert.strictEqual(diagnostics[0].range.start.character, 0);
    });

    test('Should parse multiple text lines', () => {
      const textOutput = `test.php:10: error: Error 1
test.php:20: warning: Warning 1
test.php:30: info: Info 1`;
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(textOutput, fileUri);

      assert.strictEqual(diagnostics.length, 3);
      assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(diagnostics[1].severity, vscode.DiagnosticSeverity.Warning);
      assert.strictEqual(diagnostics[2].severity, vscode.DiagnosticSeverity.Information);
    });
  });

  suite('Project-wide Parsing', () => {
    test('Should parse project output and group by file', () => {
      const workspaceFolder = 'F:\\project';
      const jsonOutput = JSON.stringify([
        {
          level: 'Error',
          message: 'Error in file1',
          annotations: [{
            span: {
              file_id: {
                name: 'file1.php',
                path: 'F:\\project\\file1.php'
              },
              start: { line: 1, column: 1 }
            }
          }]
        },
        {
          level: 'Warning',
          message: 'Warning in file2',
          annotations: [{
            span: {
              file_id: {
                name: 'file2.php',
                path: 'F:\\project\\file2.php'
              },
              start: { line: 5, column: 10 }
            }
          }]
        },
        {
          level: 'Error',
          message: 'Another error in file1',
          annotations: [{
            span: {
              file_id: {
                name: 'file1.php',
                path: 'F:\\project\\file1.php'
              },
              start: { line: 10, column: 1 }
            }
          }]
        }
      ]);

      const diagnosticsByFile = parser.parseProject(jsonOutput, workspaceFolder);

      assert.strictEqual(diagnosticsByFile.size, 2);

      const file1Path = Array.from(diagnosticsByFile.keys()).find(p => p.includes('file1.php'));
      const file2Path = Array.from(diagnosticsByFile.keys()).find(p => p.includes('file2.php'));

      assert.ok(file1Path);
      assert.ok(file2Path);

      assert.strictEqual(diagnosticsByFile.get(file1Path!)?.length, 2);
      assert.strictEqual(diagnosticsByFile.get(file2Path!)?.length, 1);
    });

    test('Should handle relative paths in project mode', () => {
      const workspaceFolder = 'F:\\project';
      const textOutput = 'src/test.php:10: error: Test error';
      const diagnosticsByFile = parser.parseProject(textOutput, workspaceFolder);

      assert.strictEqual(diagnosticsByFile.size, 1);
      const filePaths = Array.from(diagnosticsByFile.keys());
      assert.strictEqual(filePaths[0].includes('F:\\project'), true);
      assert.strictEqual(filePaths[0].includes('src'), true);
    });
  });

  suite('Edge Cases', () => {
    test('Should handle empty output', () => {
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse('', fileUri);
      assert.strictEqual(diagnostics.length, 0);
    });

    test('Should handle invalid JSON', () => {
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse('{ invalid json', fileUri);
      assert.strictEqual(diagnostics.length, 0);
    });

    test('Should handle JSON without message field', () => {
      const jsonOutput = JSON.stringify({
        level: 'Error',
        code: 'test'
        // message field is missing
      });
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(jsonOutput, fileUri);
      assert.strictEqual(diagnostics.length, 0);
    });

    test('Should use fallback for old JSON format', () => {
      const jsonOutput = JSON.stringify({
        message: 'Old format message',
        level: 'Warning',
        line: 15,
        column: 10
        // No annotations field
      });
      const fileUri = vscode.Uri.file('F:\\project\\test.php');
      const diagnostics = parser.parse(jsonOutput, fileUri);

      assert.strictEqual(diagnostics.length, 1);
      assert.strictEqual(diagnostics[0].range.start.line, 14); // 0-indexed
      assert.strictEqual(diagnostics[0].range.start.character, 9); // 0-indexed
    });

    test('Should handle different severity levels', () => {
      const levels = [
        { input: 'Error', expected: vscode.DiagnosticSeverity.Error },
        { input: 'Warning', expected: vscode.DiagnosticSeverity.Warning },
        { input: 'Info', expected: vscode.DiagnosticSeverity.Information },
        { input: 'Hint', expected: vscode.DiagnosticSeverity.Hint },
        { input: 'Unknown', expected: vscode.DiagnosticSeverity.Error } // Default
      ];

      for (const level of levels) {
        const jsonOutput = JSON.stringify({
          level: level.input,
          message: 'Test message',
          annotations: [{
            span: {
              start: { line: 1, column: 1 },
              end: { line: 1, column: 2 }
            }
          }]
        });
        const fileUri = vscode.Uri.file('F:\\project\\test.php');
        const diagnostics = parser.parse(jsonOutput, fileUri);

        assert.strictEqual(diagnostics[0].severity, level.expected,
          `Level ${level.input} should map to ${level.expected}`);
      }
    });
  });
});
