# Testing Guide

このドキュメントでは、Mago VSX拡張機能のテスト方法について説明します。

## テストの種類

### 1. ユニットテスト

`src/test/suite/`ディレクトリには以下のテストファイルがあります：

- `magoOutputParser.test.ts` - MagoOutputParserクラスのテスト
- `magoRunner.test.ts` - MagoRunnerクラスのテスト

### 2. 統合テスト（VS Code環境）

VS Code拡張機能は`vscode`モジュールに依存するため、テストはVS Code環境で実行する必要があります。

## テストの実行方法

### VS Code Extension Testの実行

```bash
pnpm test
```

このコマンドは：
1. TypeScriptコードをコンパイル
2. VS Codeのテストバージョンをダウンロード（初回のみ）
3. VS Code環境でテストを実行

**注意**: Windows環境では、パスの問題で統合テストが失敗する場合があります。

### 手動テスト

拡張機能の動作を手動でテストする最も確実な方法：

1. **拡張機能をビルドしてインストール**:
   ```bash
   pnpm run install:vscode
   ```

2. **VS Codeを再起動**してから、PHPプロジェクトを開く

3. **拡張機能をテスト**:
   - PHPファイルを開く
   - ファイルを保存して、自動的にlint/analyzeが実行されることを確認
   - コマンドパレット（Ctrl+Shift+P）から以下のコマンドを実行：
     - `Mago: Lint Current File`
     - `Mago: Analyze Current File`
     - `Mago: Lint & Analyze Current File`
     - `Mago: Lint Project`
     - `Mago: Analyze Project`
     - `Mago: Lint & Analyze Project`
     - `Mago: Format Current File`
     - `Mago: Format Project`
     - `Mago: Format Check (CI)`
     - `Mago: Generate Lint Baseline`
     - `Mago: Generate Analyze Baseline`

4. **結果を確認**:
   - 問題ペイン（View > Problems）に診断結果が表示されることを確認
   - 出力チャンネル（View > Output > "Mago"）に生の出力が記録されることを確認

### F5デバッグモード

VS Code内で拡張機能を開発・テストする方法：

1. VS Codeでプロジェクトを開く
2. F5を押す（または「実行とデバッグ」パネルから「Run Extension」を選択）
3. 新しいVS Codeウィンドウが開き、拡張機能が読み込まれる
4. このウィンドウでPHPファイルを開いてテスト

## テストカバレッジ

### MagoOutputParser

- ✅ JSON出力のパース（annotations形式）
- ✅ JSON配列のパース
- ✅ issuesプロパティを持つJSONのパース
- ✅ Windows パス（`\\?\`プレフィックス）の正規化
- ✅ テキスト形式の出力パース
- ✅ プロジェクト全体の出力パース
- ✅ エラーハンドリング（空出力、無効なJSON、必須フィールドの欠如）
- ✅ 複数の重要度レベル（Error, Warning, Info, Hint）

### MagoRunner

- ✅ 基本的な機能（インスタンス作成、メソッドの存在確認）
- ✅ 設定の読み取り（executablePath, lintOnSave, analyzeOnSave, formatOnSave, baselines）
- ✅ DiagnosticCollectionの操作
- ✅ OutputChannelの操作
- ✅ エラーハンドリング（TOMLパースエラー、実行エラー）
- ✅ Baseline サポート（--baseline フラグの自動追加）
- ✅ 診断のマージ（lint + analyze の同時実行）
- ✅ フォーマットコマンド（fmt、fmt --check）
- ✅ ベースライン生成コマンド

## テストデータ

実際のmagoの出力例：

```json
{
  "level": "Error",
  "code": "malformed-docblock-comment",
  "message": "Failed to parse function-like docblock comment.",
  "notes": ["Parameter must have type followed by variable name"],
  "help": "Ensure type is followed by a valid parameter name (e.g., `$param`)",
  "annotations": [{
    "kind": "Primary",
    "span": {
      "file_id": {
        "name": "app\\framework\\AltoRouter.php",
        "path": "\\\\?\\F:\\project\\HovelAPI\\app\\framework\\AltoRouter.php"
      },
      "start": { "offset": 4801, "line": 142, "column": 1 },
      "end": { "offset": 4877, "line": 142, "column": 77 }
    }
  }]
}
```

## トラブルシューティング

### テストが失敗する場合

1. **コンパイルエラー**:
   ```bash
   pnpm run compile
   ```
   でエラーがないか確認

2. **VS Code拡張のテストが起動しない**:
   - `.vscode-test`ディレクトリを削除して再試行
   - 手動テスト（F5デバッグモード）を使用

3. **magoコマンドが見つからない**:
   - magoが正しくインストールされているか確認
   - VS Codeの設定で`mago.executablePath`に絶対パスを設定

4. **問題ペインに何も表示されない**:
   - 出力チャンネル（View > Output > "Mago"）で生の出力を確認
   - magoコマンドが正しく実行されているか確認

## CI/CD

継続的インテグレーション環境でのテスト実行は、ヘッドレスモードでVS Codeを起動する必要があります。

現在の GitHub Actions ワークフロー ([.github/workflows/test.yml](.github/workflows/test.yml)):

```yaml
- name: Setup Xvfb for headless testing
  run: |
    sudo apt-get update
    sudo apt-get install -y xvfb libgtk-3-0 libgbm1 libasound2

- name: Run tests
  uses: coactions/setup-xvfb@v1
  with:
    run: pnpm test
```

さらに、CI では以下のチェックも実行されます：
- `pnpm audit` - セキュリティ脆弱性のスキャン
- `pnpm outdated` - 古い依存関係の確認
- TypeScript コンパイル
- 型チェック (`tsc --noEmit`)
- VSIX パッケージのビルド

詳細は [.github/workflows/README.md](.github/workflows/README.md) を参照してください。

## テスト対象の主要機能

### 1. 診断機能
- [x] lint コマンドの実行と診断出力
- [x] analyze コマンドの実行と診断出力
- [x] lint + analyze の同時実行と診断のマージ
- [x] プロジェクト全体のスキャン
- [x] ベースラインによる診断のフィルタリング

### 2. フォーマット機能
- [x] 単一ファイルのフォーマット
- [x] プロジェクト全体のフォーマット
- [x] フォーマットチェック（CI 用）
- [x] formatOnSave 設定

### 3. ベースライン機能
- [x] ベースライン生成コマンド
- [x] ベースライン設定の読み込み
- [x] --baseline フラグの自動追加

### 4. エラーハンドリング
- [x] TOML パースエラーの検出と表示
- [x] mago 実行エラーの処理
- [x] JSON パースエラーの処理
- [x] 空の結果と無効な出力の区別

## 今後の改善

- [ ] モックを使用した完全なユニットテスト
- [ ] E2Eテストの自動化
- [ ] テストカバレッジレポートの生成
- [x] CI/CDパイプラインの統合（完了）
- [x] セキュリティ監査の自動化（完了）
