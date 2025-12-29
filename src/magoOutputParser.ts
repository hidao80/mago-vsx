import * as vscode from 'vscode';
import * as path from 'path';

interface MagoIssue {
  file: string;
  line: number;
  column?: number;
  severity: string;
  message: string;
  code?: string;
  notes?: string[];
  help?: string;
}

export class MagoOutputParser {
  parse(output: string, fileUri: vscode.Uri): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    // まずJSON全体としてパース
    try {
      const jsonData = JSON.parse(output.trim());

      // 配列の場合
      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          const diagnostic = this.parseJsonIssue(item, fileUri);
          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
        }
        return diagnostics;
      }

      // オブジェクトでissuesプロパティを持つ場合
      if (jsonData.issues && Array.isArray(jsonData.issues)) {
        for (const item of jsonData.issues) {
          const diagnostic = this.parseJsonIssue(item, fileUri);
          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
        }
        return diagnostics;
      }

      // 単一オブジェクトの場合
      const diagnostic = this.parseJsonIssue(jsonData, fileUri);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
      return diagnostics;
    } catch (e) {
      // JSON形式でない場合は行ごとにパース
      const lines = output.split('\n');
      for (const line of lines) {
        const diagnostic = this.parseLine(line, fileUri);
        if (diagnostic) {
          diagnostics.push(diagnostic);
        }
      }
    }

    return diagnostics;
  }

  parseProject(output: string, workspaceFolder: string): Map<string, vscode.Diagnostic[]> {
    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    // まずJSON全体としてパース
    try {
      const jsonData = JSON.parse(output.trim());

      // 配列の場合
      const items = Array.isArray(jsonData) ? jsonData :
                    (jsonData.issues && Array.isArray(jsonData.issues)) ? jsonData.issues :
                    [jsonData];

      for (const item of items) {
        const issue = this.jsonToIssue(item, workspaceFolder);
        if (issue) {
          const filePath = issue.file;
          if (!diagnosticsByFile.has(filePath)) {
            diagnosticsByFile.set(filePath, []);
          }

          const diagnostic = this.issueToDiagnostic(issue);
          diagnosticsByFile.get(filePath)!.push(diagnostic);
        }
      }

      return diagnosticsByFile;
    } catch (e) {
      // JSON形式でない場合は行ごとにパース
      const lines = output.split('\n');
      for (const line of lines) {
        const issue = this.parseLineToIssue(line, workspaceFolder);
        if (issue) {
          const filePath = issue.file;
          if (!diagnosticsByFile.has(filePath)) {
            diagnosticsByFile.set(filePath, []);
          }

          const diagnostic = this.issueToDiagnostic(issue);
          diagnosticsByFile.get(filePath)!.push(diagnostic);
        }
      }
    }

    return diagnosticsByFile;
  }

  private parseLine(line: string, fileUri: vscode.Uri): vscode.Diagnostic | null {
    // magoの出力形式に応じてパース
    // 一般的な形式: filename:line:column: severity: message
    // または: filename:line: severity: message
    // JSON形式の場合も考慮

    // JSON形式をチェック
    if (line.trim().startsWith('{')) {
      try {
        const json = JSON.parse(line);
        return this.parseJsonIssue(json, fileUri);
      } catch (e) {
        // JSON形式でない場合は次の処理へ
      }
    }

    // テキスト形式のパース
    // 例: /path/to/file.php:10:5: error: Undefined variable
    const match = line.match(/^(.+?):(\d+)(?::(\d+))?:\s*(error|warning|info|hint):\s*(.+)$/);
    if (match) {
      const [, , lineStr, columnStr, severity, message] = match;
      const lineNum = parseInt(lineStr, 10) - 1; // VS Codeは0-indexed
      const column = columnStr ? parseInt(columnStr, 10) - 1 : 0;

      const range = new vscode.Range(lineNum, column, lineNum, column + 1);
      const diagnostic = new vscode.Diagnostic(
        range,
        message,
        this.severityToVSCode(severity)
      );
      diagnostic.source = 'mago';
      return diagnostic;
    }

    return null;
  }

  private parseLineToIssue(line: string, workspaceFolder: string): MagoIssue | null {
    // JSON形式をチェック
    if (line.trim().startsWith('{')) {
      try {
        const json = JSON.parse(line);
        return this.jsonToIssue(json, workspaceFolder);
      } catch (e) {
        // JSON形式でない場合は次の処理へ
      }
    }

    // テキスト形式のパース
    // Windows: C:\path\to\file.php:10:5: error: message
    // Unix: /path/to/file.php:10:5: error: message
    const match = line.match(/^(.+?):(\d+)(?::(\d+))?:\s*(error|warning|info|hint):\s*(.+)$/);
    if (match) {
      const [, file, lineStr, columnStr, severity, message] = match;
      const filePath = this.normalizeFilePath(file, workspaceFolder);

      return {
        file: filePath,
        line: parseInt(lineStr, 10) - 1,
        column: columnStr ? parseInt(columnStr, 10) - 1 : 0,
        severity,
        message
      };
    }

    return null;
  }

  private parseJsonIssue(json: any, fileUri: vscode.Uri): vscode.Diagnostic | null {
    // magoの形式: { level, code, message, annotations: [{ span: { start: { line }, end }, ... }] }
    if (!json.message) {
      return null;
    }

    // annotationsから位置情報を取得
    let lineNum = 0;
    let column = 0;
    let endLine = 0;
    let endColumn = 1;

    if (json.annotations && json.annotations.length > 0) {
      const primaryAnnotation = json.annotations.find((a: any) => a.kind === 'Primary') || json.annotations[0];
      if (primaryAnnotation && primaryAnnotation.span) {
        const start = primaryAnnotation.span.start;
        const end = primaryAnnotation.span.end;

        lineNum = (start?.line || 1) - 1; // VS Codeは0-indexed
        column = (start?.column || 1) - 1;
        endLine = (end?.line || start?.line || 1) - 1;
        endColumn = (end?.column || (start?.column || 1) + 1) - 1;
      }
    } else if (json.line !== undefined) {
      // フォールバック: 古い形式の場合
      lineNum = (json.line || 1) - 1;
      column = (json.column || 1) - 1;
      endLine = lineNum;
      endColumn = column + 1;
    }

    const range = new vscode.Range(lineNum, column, endLine, endColumn);

    // メインメッセージは1行のみ
    const diagnostic = new vscode.Diagnostic(
      range,
      json.message,
      this.magoLevelToVSCode(json.level || 'Error')
    );

    diagnostic.source = 'mago';
    if (json.code) {
      diagnostic.code = json.code;
    }

    // notesとhelpをRelatedInformationとして追加（折りたたみ可能）
    const relatedInfo: vscode.DiagnosticRelatedInformation[] = [];

    if (json.notes && json.notes.length > 0) {
      for (const note of json.notes) {
        relatedInfo.push(new vscode.DiagnosticRelatedInformation(
          new vscode.Location(fileUri, range),
          `Note: ${note}`
        ));
      }
    }

    if (json.help) {
      relatedInfo.push(new vscode.DiagnosticRelatedInformation(
        new vscode.Location(fileUri, range),
        `Help: ${json.help}`
      ));
    }

    if (relatedInfo.length > 0) {
      diagnostic.relatedInformation = relatedInfo;
    }

    return diagnostic;
  }

  private jsonToIssue(json: any, workspaceFolder: string): MagoIssue | null {
    if (!json.message) {
      return null;
    }

    // annotationsから位置情報を取得
    let filePath = '';
    let lineNum = 0;
    let column = 0;

    if (json.annotations && json.annotations.length > 0) {
      const primaryAnnotation = json.annotations.find((a: any) => a.kind === 'Primary') || json.annotations[0];
      if (primaryAnnotation && primaryAnnotation.span) {
        const fileId = primaryAnnotation.span.file_id;
        const start = primaryAnnotation.span.start;

        if (fileId && fileId.name) {
          // Windowsパス形式を正規化（\\?\ プレフィックスを除去）
          let rawPath = fileId.path || fileId.name;
          rawPath = rawPath.replace(/^\\\\\?\\/, ''); // \\?\ を除去
          filePath = this.normalizeFilePath(rawPath, workspaceFolder);
        }

        lineNum = (start?.line || 1) - 1;
        column = (start?.column || 1) - 1;
      }
    } else if (json.file) {
      // フォールバック: 古い形式の場合
      filePath = this.normalizeFilePath(json.file, workspaceFolder);
      lineNum = (json.line || 1) - 1;
      column = (json.column || 1) - 1;
    }

    if (!filePath) {
      return null;
    }

    return {
      file: filePath,
      line: lineNum,
      column,
      severity: json.level || 'Error',
      message: json.message,
      code: json.code,
      notes: json.notes,
      help: json.help
    };
  }

  private normalizeFilePath(file: string, workspaceFolder: string): string {
    // パスを正規化（バックスラッシュをスラッシュに統一）
    const normalizedFile = file.replace(/\\/g, '/');

    // 絶対パスかチェック
    // Windows: C:/... または /c/... (Git Bash形式)
    // Unix/macOS: /...
    const isAbsolute = path.isAbsolute(file) || /^[a-zA-Z]:/.test(normalizedFile);

    if (isAbsolute) {
      // 絶対パスの場合はそのまま使用（プラットフォームの形式に変換）
      return path.normalize(file);
    } else {
      // 相対パスの場合はworkspaceFolderと結合
      return path.normalize(path.join(workspaceFolder, normalizedFile));
    }
  }

  private issueToDiagnostic(issue: MagoIssue): vscode.Diagnostic {
    const range = new vscode.Range(
      issue.line,
      issue.column || 0,
      issue.line,
      (issue.column || 0) + 1
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      issue.message,
      this.severityToVSCode(issue.severity)
    );

    diagnostic.source = 'mago';
    if (issue.code) {
      diagnostic.code = issue.code;
    }

    // notesとhelpをRelatedInformationとして追加
    const relatedInfo: vscode.DiagnosticRelatedInformation[] = [];
    const fileUri = vscode.Uri.file(issue.file);

    if (issue.notes && issue.notes.length > 0) {
      for (const note of issue.notes) {
        relatedInfo.push(new vscode.DiagnosticRelatedInformation(
          new vscode.Location(fileUri, range),
          `Note: ${note}`
        ));
      }
    }

    if (issue.help) {
      relatedInfo.push(new vscode.DiagnosticRelatedInformation(
        new vscode.Location(fileUri, range),
        `Help: ${issue.help}`
      ));
    }

    if (relatedInfo.length > 0) {
      diagnostic.relatedInformation = relatedInfo;
    }

    return diagnostic;
  }

  private severityToVSCode(severity: string): vscode.DiagnosticSeverity {
    switch (severity.toLowerCase()) {
      case 'error':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      case 'hint':
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Error;
    }
  }

  private magoLevelToVSCode(level: string): vscode.DiagnosticSeverity {
    switch (level.toLowerCase()) {
      case 'error':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      case 'hint':
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Error;
    }
  }
}
