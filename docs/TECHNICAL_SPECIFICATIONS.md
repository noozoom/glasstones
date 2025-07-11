# GlassTones - 技術仕様書 v2025.06.20

## 概要
GlassTonesは線を描くことで音を奏でるインタラクティブ音楽ゲームです。ボールが線に当たると音が鳴り、3次元音響空間での没入感のある体験を提供します。

## システム構成

### ファイル構成
```
GlassTones/
├── index.html              # メインHTMLファイル
├── sketch.js               # p5.js メインゲームロジック
├── sound_simple.js         # Web Audio API音響システム
├── score.js               # スコア管理システム
├── style.css              # スタイルシート（index.html内に統合）
├── assets/
│   └── rust_bg.jpg        # 背景画像（錆びた金属テクスチャ）
├── favicon_*.png          # 各種サイズのファビコン
└── docs/                  # ドキュメント
```

## 音響システム仕様

### 音階システム
**12音階マッピング（線の長さに対応）**
```javascript
const simpleScale = [
    1174.66, // D6 (最高音・短い線)
    1046.50, // C6
    880.00,  // A5 (スタート音)
    440.00,  // A4
    392.00,  // G4
    329.63,  // E4
    293.66,  // D4
    261.63,  // C4
    246.94,  // B3
    196.00,  // G3
    164.81,  // E3
    130.81,  // C3
    110.00,  // A2
    73.42    // D2 (最低音・長い線)
];
```

### 3次元音響空間

#### 水平軸（左右）: パンニング
- ボールの水平位置に応じてステレオパンニング
- 左端: -1.0（完全左）
- 中央: 0.0（センター）
- 右端: +1.0（完全右）

#### 垂直軸（上下）: ディレイエフェクト
**デスクトップ版**:
```javascript
const minDelay = 0.01;      // 10ms（上部）
const maxDelay = 0.4;       // 400ms（下部）
const delayMix = 0.08 + (verticalRatio * 0.32);     // 8%-40%
const feedbackAmount = 0.15 + (verticalRatio * 0.35); // 15%-50%
```

**モバイル版（軽量化）**:
```javascript
const minDelay = 0.008;     // 8ms（上部）
const maxDelay = 0.25;      // 250ms（下部）
const delayMix = 0.06 + (verticalRatio * 0.24);     // 6%-30%
const feedbackAmount = 0.1 + (verticalRatio * 0.3); // 10%-40%
```

#### コーラス周期変化
```javascript
// 上部: 1秒周期（1Hz）で速いシマー効果
// 下部: 5秒周期（0.2Hz）でゆっくりとした深いうねり
const minFreq = 1.0;   // 1 Hz（上部）
const maxFreq = 0.2;   // 0.2 Hz（下部）
const chorusFrequency = minFreq + (verticalRatio * (maxFreq - minFreq));
```

### エフェクトBUSオーディオ処理チェーン
```
音源 → ゲイン → 個別パンナー → エフェクトBUS → [ドライ + ディレイ + コーラス] → リバーブ → エフェクトBUSパンナー → マスター
```

**2重パンニングシステム**:
- **個別パンナー**: 各音が個別の位置でパンニング（音の発生位置）
- **エフェクトBUSパンナー**: エフェクト全体がボール位置でリアルタイムパンニング（空間の中心）

### ドローンシステム
- **D3メインドローン（146.83Hz）**: 中央固定、30秒スローアタック
- **A3サブドローン（220Hz）**: ボール位置パンニング、35秒スローアタック

### 音量制御システム
1. **連打減衰**: 1回目100% → 2回目50% → 3回目25% → 4回目12.5%
2. **高音減衰**: D2(100%) → D6(45%)の線形減衰
3. **線の古さ減衰**: 新しい線100% → 10秒経過50%
4. **3セントランダマイズ**: ±3セントの微細チューニング

### ポリフォニック管理
- **デスクトップ**: 32ボイス制限
- **モバイル**: 16ボイス制限
- **連打判定**: 30ms以内の同一周波数再生をブロック

## 視覚システム仕様

### 背景フェードイン
```javascript
// p5.js完全制御によるスムーズフェードイン
function drawBackground() {
    if (backgroundImg && backgroundFading) {
        const currentTime = millis();
        const elapsed = currentTime - backgroundFadeStartTime;
        const fadeDuration = 2000; // 2秒
        
        if (elapsed < fadeDuration) {
            backgroundAlpha = map(elapsed, 0, fadeDuration, 0, 255);
        } else {
            backgroundAlpha = 255;
            backgroundFading = false;
        }
    }
    
    if (backgroundImg && backgroundAlpha > 0) {
        tint(255, backgroundAlpha);
        image(backgroundImg, 0, 0, width, height);
        noTint();
    }
}
```

### ゲーム要素
- **ボールサイズ**: デスクトップ32px / モバイル19px
- **線の太さ**: 23-23.5px（メイン）、35px（グロー）
- **最大線数**: 8本
- **線の寿命**: 10秒
- **最大点数**: 12個（六角形点）
- **点の寿命**: 15秒

### フォグエフェクト
- **初期不透明度**: 91%（232/255）
- **回復速度**: 
  - リップル: 20-25/フレーム（2フレーム間隔）
  - 線: 6-8/フレーム（4フレーム間隔）

## デバイス最適化

### モバイル検出
```javascript
const IS_MOBILE = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
```

### 設定差分
| 項目 | デスクトップ | モバイル |
|------|-------------|----------|
| ピクセル密度 | デフォルト | 1.0固定 |
| FPS | 45 | 30 |
| ポリフォニー | 32ボイス | 16ボイス |
| ディレイ時間 | 10-400ms | 8-250ms |
| リバーブ長 | 15秒 | 8秒 |
| ボールサイズ | 32px | 19px |
| フォグ不透明度 | 232 | 232 |

## 初期化シーケンス

### オーディオ初期化
1. **ページロード**: オーディオコンテキスト作成、音量0で待機
2. **STARTボタン押下**: ユーザーインタラクション取得
3. **20ms後**: スタート音再生
4. **20ms→70ms**: マスター音量高速フェードイン（6.32倍）
5. **100ms後**: ドローン開始

### 視覚初期化
1. **preload()**: 背景画像ロード
2. **setup()**: キャンバス作成、フォグレイヤー初期化
3. **ロード後1秒**: 背景フェードイン開始（2秒間）

## パフォーマンス最適化

### 軽量化措置
- **LUFS測定無効化**: iPhone性能向上のため完全無効
- **コンプレッサー削除**: リミッターのみで軽量化
- **FFTサイズ削減**: 2048 → 1024
- **更新頻度削減**: 50ms → 200ms間隔

### メモリ管理
- **ボイスプール**: 固定サイズ配列で管理
- **古い音の自動停止**: 制限数到達時に最古音を停止
- **リップル配列**: 寿命切れ要素の自動削除

## 技術的制約と対応

### Web Audio API制約
- **ユーザーインタラクション要件**: STARTボタンで解決
- **自動再生ポリシー**: 初期音量0で回避
- **モバイル性能制限**: デバイス別設定で対応

### ブラウザ互換性
- **Chrome/Safari/Firefox**: 完全対応
- **モバイルブラウザ**: iOS Safari/Android Chrome対応
- **フォールバック**: Web Audio API標準実装

## デプロイ仕様

### 静的サイト構成
- **ホスティング**: Vercel対応
- **CDN**: なし（全ファイル同梱）
- **キャッシュ**: ブラウザキャッシュのみ
- **HTTPS**: 必須（Web Audio API要件）

### ファイルサイズ
- **index.html**: 8.7KB
- **sketch.js**: 43KB
- **sound_simple.js**: 29KB
- **背景画像**: ~500KB
- **総サイズ**: ~600KB

## 今後の拡張予定

### 短期目標
- **追加エフェクト**: フィルター、ディストーション
- **音階拡張**: 24音階、微分音対応
- **録音機能**: 演奏の保存・共有

### 長期目標
- **VR/AR対応**: 3次元空間での演奏
- **AI作曲**: 自動和音生成
- **マルチプレイヤー**: 協奏機能

---

*更新日: 2025年6月20日*
*バージョン: v2025.06.20* 