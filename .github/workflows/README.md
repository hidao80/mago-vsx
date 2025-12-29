# GitHub Actions Workflows

このディレクトリには、Mago VSX拡張機能のCI/CDワークフローが含まれています。

## ワークフロー

### CI (`test.yml`)

**トリガー**:
- `master`, `main`, `develop` ブランチへのpush/PR
- 手動実行（`workflow_dispatch`）

**目的**: ビルド、テスト、品質チェック、セキュリティ監査を一括実行

**環境**:
- OS: `ubuntu-latest`
- Node.js: 20.x
- pnpm: 9.0.0

**実行内容**:

#### 1. 環境セットアップ
- リポジトリのチェックアウト
- Node.js 20.xのセットアップ
- pnpm 9.0.0のセットアップ
- pnpmストアのキャッシュ（`pnpm-lock.yaml` ベース）
- 依存関係のインストール（`--frozen-lockfile`）

#### 2. セキュリティチェック
- **`pnpm audit`**: 脆弱性スキャン（moderate以上の脆弱性を検出）
  - `continue-on-error: true` で警告のみ（CIを止めない）
- **`pnpm outdated`**: 古い依存関係の確認

#### 3. ビルド検証
- TypeScriptコンパイル（`pnpm run compile`）
- 型チェック（`tsc --noEmit`）
- ビルド出力ファイルの存在確認:
  - `out/extension.js`
  - `out/magoRunner.js`
  - `out/magoOutputParser.js`
- VSIXパッケージのビルド（`pnpm run package`）

#### 4. テスト
- Xvfbと必要なライブラリのインストール:
  - `xvfb`: X Virtual Framebuffer（ヘッドレスGUI）
  - `libgtk-3-0`: GTK+ 3.0ライブラリ
  - `libgbm1`: Generic Buffer Management
  - `libasound2`: ALSA sound library
- ヘッドレス環境でのテスト実行（`coactions/setup-xvfb`）

#### 5. アーティファクト
- **VSIXパッケージ**: 7日間保持
- **テスト結果**: 3日間保持（常にアップロード）

## キャッシュの仕組み

### pnpmストアキャッシュ

```yaml
- name: Get pnpm store directory
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

**動作**:
1. `pnpm store path`でストアディレクトリのパスを取得
2. `pnpm-lock.yaml`のハッシュ値をキャッシュキーに含める
3. ロックファイルが同じなら既存のキャッシュを使用
4. ロックファイルが変更されたら新しいキャッシュを作成

**メリット**:
- 依存関係のインストール時間が大幅に短縮
- GitHub Actionsの実行時間とコストを削減
- ネットワーク帯域の節約

### キャッシュの有効期限

GitHub Actionsのキャッシュ:
- 7日間アクセスされない場合は自動削除
- リポジトリあたり10GBまで保存可能
- 制限を超えると古いキャッシュから削除

## アーティファクトの保持期間

- **VSIXパッケージ**: 7日間
- **テスト結果**: 3日間（常にアップロード）

## 手動実行

1. GitHubリポジトリの「Actions」タブを開く
2. 「CI」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. ブランチを選択して実行

## セキュリティチェックの詳細

### pnpm audit

`pnpm audit --audit-level moderate`は以下をチェック:
- **moderate**: 中程度の脆弱性
- **high**: 高い脆弱性
- **critical**: 致命的な脆弱性

**continue-on-error: true**により、脆弱性が見つかってもCIは継続します。
ただし、ログに警告が表示されるため、定期的に確認して対応してください。

### pnpm outdated

古い依存関係を検出し、更新可能なパッケージを表示します。
`|| true`により、古いパッケージがあってもエラーにはなりません。

## トラブルシューティング

### セキュリティ監査で警告が出た場合

1. GitHub Actionsのログで詳細を確認
2. ローカルで`pnpm audit`を実行して詳細確認
3. `pnpm audit --fix`で自動修正を試行
4. 手動で依存関係を更新: `pnpm update [package]`

### ビルドが失敗する場合

1. **キャッシュの問題**:
   ```bash
   # ローカルでキャッシュをクリア
   pnpm store prune
   ```
   GitHub Actionsのキャッシュも手動で削除可能（Settings > Actions > Caches）

2. **依存関係の問題**:
   - `pnpm-lock.yaml`が最新か確認
   - ローカルで`pnpm install`が成功するか確認

3. **TypeScriptエラー**:
   - ローカルで`pnpm run compile`を実行してエラーを確認

### テストが失敗する場合

1. **Xvfb関連のエラー**:
   - ライブラリのインストールステップを確認
   - `coactions/setup-xvfb`のバージョンを確認

2. **VS Codeのダウンロードエラー**:
   - ネットワークタイムアウトの可能性
   - ワークフローを再実行

## ベストプラクティス

1. **ブランチ戦略**:
   - `master`/`main`: 本番リリース
   - `develop`: 開発ブランチ
   - `feature/*`: 機能開発

2. **PRのマージ前**:
   - すべてのCIチェックが成功していることを確認
   - セキュリティ警告がないか確認
   - コードレビューを実施

3. **定期的なメンテナンス**:
   - 週次/月次でセキュリティ監査結果を確認
   - 古い依存関係を定期的に更新
   - VSIXパッケージのビルドが成功していることを確認
