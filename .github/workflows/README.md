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
- Bun: 1.3.14

**実行内容**:

#### 1. 環境セットアップ
- リポジトリのチェックアウト
- Node.js 20.xのセットアップ
- Bun 1.3.14のセットアップ
- Bunキャッシュ（`bun.lock` ベース）
- 依存関係のインストール（`--frozen-lockfile`）

#### 2. セキュリティチェック
- **`bun audit`**: 脆弱性スキャン
  - `continue-on-error: true` で警告のみ（CIを止めない）
- **`bun outdated`**: 古い依存関係の確認

#### 3. ビルド検証
- TypeScriptコンパイル（`bun run compile`）
- 型チェック（`tsc --noEmit`）
- ビルド出力ファイルの存在確認:
  - `out/extension.js`
  - `out/magoRunner.js`
  - `out/magoOutputParser.js`
- VSIXパッケージのビルド（`bun run package`）

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

### Bunキャッシュ

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: 1.3.14

- uses: actions/cache@v6
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
    restore-keys: |
      ${{ runner.os }}-bun-
```

**動作**:
1. Bunのグローバルキャッシュディレクトリ（`~/.bun/install/cache`）をキャッシュ対象にする
2. `bun.lock`のハッシュ値をキャッシュキーに含める
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

### bun audit

`bun audit`は依存関係の既知の脆弱性をチェックします。

**continue-on-error: true**により、脆弱性が見つかってもCIは継続します。
ただし、ログに警告が表示されるため、定期的に確認して対応してください。

### bun outdated

古い依存関係を検出し、更新可能なパッケージを表示します。
`|| true`により、古いパッケージがあってもエラーにはなりません。

## トラブルシューティング

### セキュリティ監査で警告が出た場合

1. GitHub Actionsのログで詳細を確認
2. ローカルで`bun audit`を実行して詳細確認
3. 手動で依存関係を更新: `bun update [package]`

### ビルドが失敗する場合

1. **キャッシュの問題**:
   ```bash
   # ローカルでキャッシュをクリア
   rm -rf ~/.bun/install/cache
   ```
   GitHub Actionsのキャッシュも手動で削除可能（Settings > Actions > Caches）

2. **依存関係の問題**:
   - `bun.lock`が最新か確認
   - ローカルで`bun install`が成功するか確認

3. **TypeScriptエラー**:
   - ローカルで`bun run compile`を実行してエラーを確認

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
