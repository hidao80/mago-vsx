---
name: security
description: Security constraints, known risks, and safe coding patterns for this VS Code extension
type: reference
---

# セキュリティガイド

## この拡張機能のセキュリティモデル

- **外部通信なし**: ネットワークリクエストを一切行わない。すべての処理はローカルで完結する。
- **データ永続化なし**: IndexedDB・localStorage・ファイル書き込みは行わない。診断結果は `vscode.DiagnosticCollection`（メモリ上）にのみ保持する。
- **ユーザー設定の実行可能ファイル**: `mago.executablePath` 設定値をそのまま `child_process.spawn` に渡す。設定はユーザー自身が行う前提のため、拡張機能側での検証は行っていない。

## child_process の安全な使用

### exec を使わず spawn を使う

```typescript
// ✅ 現在の実装（正しい）
child_process.spawn(magoPath, args, { cwd, shell: process.platform === "win32" });

// ❌ 使ってはいけない（シェルインジェクションの危険）
child_process.exec(`mago lint ${filePath}`);
```

`args` は常に文字列配列で渡す。テンプレートリテラルやコマンド文字列への結合でコマンドを構築しない。

### Windows での shell オプション

`shell: process.platform === "win32"` を使うのは Windows で `mago` を PATH 経由で見つけるためのみ。この場合、`args` の各要素はシェルに展開されるため、ユーザー入力を含むパスにはシェルメタ文字が混入しないよう注意する。現在はワークスペースのファイルパスのみを渡しているため問題ない。

## ファイルパスの取り扱い

Mago の JSON 出力には Windows 拡張パス形式（`\\?\C:\...`）が含まれることがある。`magoOutputParser.ts` はこのプレフィックスを除去して正規化している。

```typescript
// \\?\ プレフィックスの除去（magoOutputParser.ts:288）
rawPath = rawPath.replace(/^\\\\\?\\/, "");
```

パスを構築する際は `path.normalize` / `path.join` を使い、生文字列結合は行わない。

## 診断情報のマージとクリア

lint と analyze は同一の `DiagnosticCollection` に書き込む。両方を同時に実行する場合は先にクリアして重複を防ぐ。このクリア操作を忘れると古い診断が残存するため、新たに診断を表示するコマンドを追加する際は必ず以下のパターンに従う。

```typescript
// 両方実行する場合は最初にクリア
diagnosticCollection.delete(fileUri); // ファイル単位
// または
diagnosticCollection.clear();         // プロジェクト全体
```

## 依存関係の管理

`package.json` の `pnpm.overrides` で既知の脆弱性を持つ推移的依存関係を上書きしている。新たな依存関係を追加する前に `pnpm audit` を実行し、問題がないことを確認する。

現在のオーバーライド対象:
- `lodash` (Prototype Pollution)
- `undici` (セキュリティ修正)
- `diff` (ReDoS)
- `@isaacs/brace-expansion` (ReDoS)
- `qs` (Prototype Pollution)
- `markdown-it` (XSS)
- `ajv` (セキュリティ修正)
- `minimatch` (ReDoS)

## 追加すべきでないもの

以下を追加することは原則禁止。やむを得ない場合は理由をコミットメッセージに明記する。

| 禁止事項 | 理由 |
|---|---|
| `fetch` / `axios` 等による外部通信 | ユーザーの意図しないデータ送信リスク |
| `eval` / `new Function` | 任意コード実行リスク |
| `exec` によるシェルコマンド実行 | シェルインジェクションリスク |
| ファイルシステムへの書き込み（生成 baseline を除く） | ユーザーの許可なしのファイル変更 |
| シークレット・APIキーのハードコード | 情報漏洩リスク |
