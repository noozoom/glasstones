# Splaylist デプロイメントガイド

このドキュメントでは、SplaylistをFly.ioにデプロイする手順を説明します。

## 前提条件

1. **Fly.io アカウント**: [https://fly.io/](https://fly.io/) でアカウントを作成
2. **Fly CLI インストール**: [インストールガイド](https://fly.io/docs/getting-started/installing-flyctl/)
3. **Spotify Developer App**: 本番用のRedirect URIが設定済み

## デプロイ手順

### 1. Fly.io CLI セットアップ

```bash
# Fly.io CLIをインストール（macOS）
brew install flyctl

# ログイン
flyctl auth login
```

### 2. Spotify Developer Dashboard 設定

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) にアクセス
2. 既存のアプリまたは新しいアプリを選択
3. **Settings** → **Redirect URIs** に以下を追加:
   ```
   https://splaylist.fly.dev/callback
   ```
4. **Client ID** と **Client Secret** をメモ

### 3. Fly.io アプリケーション作成

```bash
# プロジェクトディレクトリに移動
cd splaylist

# Fly.io アプリを作成（初回のみ）
flyctl apps create splaylist

# または既存のアプリを使用する場合
flyctl apps list
```

### 4. 環境変数設定

```bash
# Spotify API認証情報を設定
flyctl secrets set SPOTIPY_CLIENT_ID="your_spotify_client_id"
flyctl secrets set SPOTIPY_CLIENT_SECRET="your_spotify_client_secret"
flyctl secrets set SPOTIPY_REDIRECT_URI="https://splaylist.fly.dev/callback"
flyctl secrets set FLASK_SECRET_KEY="your_random_secret_key"

# 設定確認
flyctl secrets list
```

### 5. デプロイ実行

```bash
# アプリケーションをデプロイ
flyctl deploy

# デプロイ状況を確認
flyctl status

# ログを確認
flyctl logs
```

### 6. ドメイン設定（オプション）

```bash
# カスタムドメインを追加
flyctl certs add your-domain.com

# SSL証明書の状況確認
flyctl certs list
```

## 設定ファイル

### fly.toml

```toml
app = "splaylist"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[env]
  SPOTIPY_CLIENT_ID = "your_client_id"
  SPOTIPY_CLIENT_SECRET = "your_client_secret"
  SPOTIPY_REDIRECT_URI = "https://splaylist.fly.dev/callback"
  FLASK_SECRET_KEY = "your_secret_key"

[[services]]
  internal_port = 8888
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### Dockerfile

```dockerfile
FROM python:3.10

WORKDIR /app
COPY . /app

RUN pip install --upgrade pip && \
    pip install -r requirements.txt

EXPOSE 8888

CMD ["gunicorn", "-b", "0.0.0.0:8888", "app:app"]
```

## トラブルシューティング

### よくある問題

1. **デプロイエラー**
   ```bash
   # ログを確認
   flyctl logs
   
   # アプリの状態を確認
   flyctl status
   ```

2. **環境変数が反映されない**
   ```bash
   # 環境変数を再設定
   flyctl secrets set KEY="VALUE"
   
   # アプリを再起動
   flyctl apps restart splaylist
   ```

3. **SSL証明書の問題**
   ```bash
   # 証明書の状況確認
   flyctl certs list
   
   # 証明書を再作成
   flyctl certs add your-domain.com
   ```

### デバッグコマンド

```bash
# アプリのシェルにアクセス
flyctl ssh console

# リアルタイムログ監視
flyctl logs -f

# アプリの詳細情報
flyctl info

# マシンの状況確認
flyctl machine list
```

## セキュリティ

### 🔑 永続的ログイン機能について

**重要な仕様**: Splaylistは一度ログインすれば二度とログインが不要な設計です。

- **`.cache`ファイル**: Spotifyアクセストークンが保存される
- **自動復元**: アプリ起動時に`.cache`からトークンを自動読み込み
- **トークンリフレッシュ**: 期限切れ時に自動でトークンを更新
- **クロスブラウザ対応**: 異なるブラウザからでもログイン不要

**開発時の注意点**:
- ログイン画面をテストしたい場合は`.cache`ファイルを削除
- 本番環境では`.cache`ファイルの永続化を検討
- トークンの有効期限は通常1時間、リフレッシュトークンで自動延長

### 本番環境での注意点

1. **環境変数**: 機密情報は必ず `flyctl secrets` で設定
2. **HTTPS**: 本番環境では必ずHTTPSを使用
3. **ログ**: 機密情報がログに出力されないよう注意
4. **`.cache`ファイル**: 本番環境では永続ストレージの使用を検討

### 推奨設定

```bash
# デバッグモードを無効化
flyctl secrets set FLASK_ENV="production"
flyctl secrets set FLASK_DEBUG="False"

# セキュアなセッション設定
flyctl secrets set FLASK_SECRET_KEY="$(openssl rand -base64 32)"
```

## 更新とメンテナンス

### アプリケーション更新

```bash
# コードを更新後
git add .
git commit -m "Update application"

# デプロイ
flyctl deploy

# ロールバック（必要に応じて）
flyctl releases list
flyctl releases rollback <release_id>
```

### モニタリング

```bash
# アプリの状況監視
flyctl status

# メトリクス確認
flyctl metrics

# スケーリング（必要に応じて）
flyctl scale count 2
```

## 料金

- **Fly.io**: 基本的な使用は無料枠内
- **Spotify API**: 無料（レート制限あり）

詳細は [Fly.io Pricing](https://fly.io/docs/about/pricing/) を参照

## サポート

- **Fly.io**: [ドキュメント](https://fly.io/docs/) | [コミュニティ](https://community.fly.io/)
- **Spotify API**: [Web API Reference](https://developer.spotify.com/documentation/web-api/)

## 更新履歴

### v1.0.1 (2025-06-18) - ファビコン透過処理更新
- **🎨 ファビコン改善**: 緑の外側背景部分を透過処理
- **デザイン維持**: 中央の「|ー|ー|」デザインは保持
- **ブラウザ対応**: 全ブラウザタブで自然な表示
- **自動処理**: Pythonスクリプトによる一括透過処理
- **バックアップ**: 元ファイルの自動バックアップ機能

### v1.0.0 (2025-06-18) - 初回デプロイ
- **基本機能**: Spotify認証、プレイリスト変換、CSV出力
- **永続ログイン**: `.cache`ファイルによる自動認証
- **モバイル対応**: 長押しコピー、レスポンシブデザイン
- **本番環境**: Fly.io HTTPS対応デプロイ

---

**最終更新**: 2025年6月18日 