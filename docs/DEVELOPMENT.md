# GlassTones 開発ガイド

## Git操作のベストプラクティス

### 標準的なコミット・プッシュ手順

**推奨方法（1コマンド）:**
```bash
git add . && git commit -m "コミットメッセージ" && git push
```

**特定ファイルのみの場合:**
```bash
git add ファイル名 && git commit -m "コミットメッセージ" && git push
```

### なぜこの方法を使うのか

1. **効率性**: 3つのコマンドを1つにまとめることで時間短縮
2. **安全性**: `&&` により前のコマンドが成功した場合のみ次を実行
3. **一貫性**: 常に同じ手順でミスを防止
4. **自動化**: 失敗時は自動的に停止

### コミットメッセージの例

```bash
# 機能追加
git add . && git commit -m "Add background fade-in effect" && git push

# バグ修正
git add . && git commit -m "Fix iPhone audio pop sound" && git push

# ファビコン更新
git add . && git commit -m "Update favicon from background texture" && git push
```

## 開発ワークフロー

### 1. ローカル開発
```bash
# ローカルサーバー起動
python -m http.server 8000
# ブラウザで http://localhost:8000 にアクセス
```

### 2. 変更をデプロイ
```bash
# 変更をコミット・プッシュ（Vercelが自動デプロイ）
git add . && git commit -m "変更内容の説明" && git push
```

### 3. 本番確認
- https://glasstones.vercel.app で動作確認

## プロジェクト構成

```
GlassTones/
├── index.html          # メインHTML
├── style.css           # スタイル
├── sketch.js           # p5.js メインロジック
├── sound.js            # Tone.js オーディオ
├── score.js            # スコア管理
├── assets/             # 画像・音声ファイル
├── favicon_*.png       # ファビコン各サイズ
├── favicon.ico         # ブラウザ用アイコン
└── docs/               # ドキュメント
```

## 技術仕様

- **フロントエンド**: HTML5, CSS3, JavaScript
- **ライブラリ**: p5.js (v1.7.0), Tone.js (v14.8.49)
- **デプロイ**: Vercel (静的サイト)
- **オーディオ**: リディアンスケール、32ボイスシンセプール
- **エフェクト**: コーラス + リバーブ

## トラブルシューティング

### Vercelデプロイエラー
- Framework Preset: `Other`
- Build Command: 空欄
- Output Directory: `.`

### モバイル音響問題
- iPhone: 4秒フェードイン + 200ms遅延
- Android: 標準3秒フェードイン 