---
name: code-style
description: TypeScript coding conventions, linter settings, and formatting rules for this project
type: reference
---

# コードスタイルガイド

## ツールチェーン

- **コンパイラ**: TypeScript (`strict: true`、`target: ES2020`、`module: commonjs`)
- **リンター/フォーマッター**: Biome (`pnpm run lint` / `pnpm run lint:fix`) — ESLint・Prettier は使用しない
- **チェックコマンド**: `pnpm exec tsc --noEmit` でエミットせず型チェックのみ実行

## TypeScript 厳格設定（tsconfig.json）

以下のフラグがすべて有効。コードを追加・修正する際は全項目をパスさせること。

| フラグ | 意味 |
|---|---|
| `strict` | strictNullChecks・noImplicitAny 等を一括有効化 |
| `noUnusedLocals` | 未使用ローカル変数をエラー扱い |
| `noUnusedParameters` | 未使用引数をエラー扱い |
| `noImplicitReturns` | すべてのコードパスで return が必要 |
| `noFallthroughCasesInSwitch` | switch の fall-through 禁止 |

## 命名規則

| 対象 | ケース | 例 |
|---|---|---|
| クラス・インタフェース・型エイリアス | PascalCase | `MagoRunner`, `MagoJsonIssue` |
| メソッド・変数・関数 | camelCase | `runLint`, `parseJsonIssue` |
| ファイル名 | camelCase（型ファイルも同様） | `magoRunner.ts`, `types.ts` |
| enum 値 | PascalCase | `"Primary"`, `"Secondary"` |

## インポートスタイル

```typescript
// Node.js 組み込みモジュールは必ず `node:` プロトコルを付ける
import * as child_process from "node:child_process";
import * as path from "node:path";

// 型のみインポートは `import type` を使う
import type { MagoCommand, SpawnResult } from "./types";

// 値＋型の混在インポートは通常の import
import { MagoOutputParser } from "./magoOutputParser";
```

## 基本フォーマット

- インデント: **タブ**（Biome デフォルト）
- 文字列: **ダブルクォート**（Biome が強制）
- セミコロン: **必須**
- 末尾カンマ: 複数行の引数・配列・オブジェクトには付ける

## ループと配列操作

`forEach` は使わず `for...of` を使う（Biome ルールで強制）。

```typescript
// ✅ 正しい
for (const item of items) { ... }

// ❌ 使用しない
items.forEach(item => { ... });
```

## 非 null アサーション

`!` (non-null assertion) はできる限り避ける。オプショナルチェーン `?.` か明示的な null チェックを使う。

```typescript
// ✅ 推奨
diagnosticsByFile.get(filePath)?.push(diagnostic);

// ❌ 避ける
diagnosticsByFile.get(filePath)!.push(diagnostic);
```

## 型定義の置き場

複数モジュールをまたぐ型はすべて `src/types.ts` に集約する。単一ファイル内でのみ使う型はそのファイルにローカル定義してよい。

## エラーハンドリング

`catch` ブロックの例外変数は `_e` ではなく省略形 `catch` を使うか、Biome が許容する形にする。ただし例外内容を使う場合は型付けする。

```typescript
// 内容を使わない場合
try { ... } catch { ... }

// 内容を使う場合
try { ... } catch (e: unknown) {
  if (e instanceof Error) { ... }
}
```
