# GlassTones

## 概要

『GlassTones: A Touch of Sound』は、曇ったガラスの向こうに隠された広告と音の世界を、指でなぞることで可視化し、音楽として響かせていく詩的なサウンドインタラクティブゲームです。

- プレイヤーは曇った画面に指やマウスで自由な線を描く
- **線を描いた部分の霧が除去され**、背後の広告が透けて見える（線自体が透明になるのではない）
- 反射する光球（ボール）はその線で跳ね返り、音を奏でる
- 時間と共に霧が再び覆い、音も消え、視界も閉ざされる

音、光、広告、そして指の軌跡が交錯する、時間と感覚の演奏体験。

## ゲーム仕様

### 基本ルール

| 項目 | 内容 |
| --- | --- |
| 対応デバイス | デスクトップ・モバイル両対応 |
| 描線 | プレイヤーが自由曲線を描ける。制限なし。 |
| 線の寿命 | 約6秒。描いた直後は透けて見え、徐々に曇って消える。 |
| 線の最大長 | 画面の約1/4程度まで（1本あたり） |
| 同時描線数 | 最大8本。古いものから順に消去される。 |
| ボールの動き | 無重力空間を直進し、線に当たると反射。 |
| ボール数 | 1個（宇宙船の中の水滴のようなデザイン） |
| ボール速度 | ゆっくりとした動き |
| 反射処理 | 曲線の法線ベクトルを使った物理に基づく反射処理。 |
| 閉じ込め | OK。プレイヤーが囲い込みしてもよい。 |

### ボール軌跡の視覚効果

| 項目 | 内容 |
| --- | --- |
| 軌跡の中心部 | かなりはっきりと背景広告が見える |
| 軌跡の周辺部 | ぼんやりと見える |
| 軌跡の尻尾 | 曇ったガラスに溶けていくように徐々にフェード |
| 背景透過 | ボールが通った軌跡で背景の広告が透けて見える |

### 音・スコア仕様

| 項目 | 内容 |
| --- | --- |
| 音色 | サイン波（Sine） |
| 音階 | **G Lydian**（B2〜D5）**※A2・D3は除外** |
| 基本ドローン | G2 と D3 の 2 つのドローンを継続再生（10s スローアタック） |
| ドローンアタック | 10秒かけてゆっくりとフェードイン |
| ドローンリリース | ゲームオーバー時に10秒かけてフェードアウト |
| ドローン音量 | 基準音量から**58%削減**（0.422倍に調整） |
| 線音のアタック | 約0.5秒（やや柔らかめ） |
| 線音のリリース | 約5秒（ノート長 12 秒固定） |
| 線音の音階 | 線の長さ→ **B2 (最長線) 〜 D5 (最短線)** にマッピング |
| **モバイル音階調整** | **モバイルでは音階変化を緩やか**に（短い線での高音出現を抑制） |
| 音再生 | 同じ線に何度当たっても鳴る（再生回数制限なし） |
| スコア | 線ごとに1回だけスコア加算（初回接触時のみ） |

### グラフィック・演出

- 背景：霧のかかったガラス面（冬の車窓のような質感）
- 広告：背景に広告画像（@027_01.jpg - 興銀リースの3Dイラスト広告）
- 描線：なぞった瞬間だけクリアに透けて美しく光る。徐々に曇る。
- ボール：白い彗星のような光球。宇宙船の中の水滴をイメージ。
- ボール軌跡：中心部は鮮明、周辺部はぼんやり、尻尾は徐々にフェード
- 音が鳴ると粒子が飛び散り、音の高さで色が変わる。

## 開発順序

1. 基本的な描線機能
2. ボールの動きと反射
3. 音の再生（ドローン + 線音）
4. 視覚効果（フェード、パーティクル等）
5. ボール軌跡の背景透過効果

## プロジェクト構成（Cursor）

GlassTones/
├── index.html         ← HTML構造とライブラリ読み込み
├── style.css          ← スタイル（背景・透明度・色味など）
├── sketch.js          ← p5.js: 描画、ボール移動、反射、フェード処理
├── sound.js           ← Tone.js: 音色生成、音量・時間制御
├── score.js           ← スコア管理（初回接触判定）
├── assets/
│   ├── ad.jpg         ← 広告画像（フォールバック用）
│   ├── 01.gif         ← 前の広告画像（日本の広告バナー集）
│   ├── designconcept_deliciousnobori_sample.jpg ← 前の広告画像（のぼり旗デザイン集）
│   ├── D9TlgDbUwAAjA-o.jpeg ← 前の広告画像（マクドナルドのボケ効果ハンバーガー）
│   ├── 012.png        ← 前の広告画像（日本の多様な広告バナーコラージュ）
│   └── 027_01.jpg     ← メイン広告画像（興銀リースの3Dイラスト広告）
├── README.md          ← ゲーム概要・仕様
└── LICENSE            ← 任意：配布ライセンス

## 使用ライブラリ

- p5.js — 描画とインタラクション制御
- Tone.js — サウンド生成と制御
- localStorage — ハイスコア記録（将来的に）

## G Lydian スケール（B2-D5 / ※A2・D3 は除外）

- B2: 123.47 Hz
- C#3: 138.59 Hz
- E3: 164.81 Hz
- F#3: 185.00 Hz
- G3: 196.00 Hz
- A3: 220.00 Hz
- B3: 246.94 Hz
- C#4: 277.18 Hz
- D4: 293.66 Hz
- E4: 329.63 Hz
- F#4: 369.99 Hz
- G4: 392.00 Hz
- A4: 440.00 Hz
- B4: 493.88 Hz
- C#5: 554.37 Hz
- D5: 587.33 Hz

## 最近の変更内容

- **視覚効果の改善**:
  - 背景広告が見えるように、霧と透明度の効果を改善。
  - ボールとその軌跡を彗星のように見せるため、軌跡が徐々に消えるように調整。
  - 線の始点と終点が細くなるブラシのような効果を実装。
  - 線の中心を透明にし、エッジを少し不透明にして自然な見た目に。
  - PCとモバイルでの線の太さを調整し、一貫性を確保。

- **音量調整**:
  - G2とD3のドローンサウンドの音量を**58%削減**（0.422倍に調整）。

- **背景広告の更新**:
  - 最新の広告画像（027_01.jpg）に変更 - 興銀リースの3Dイラスト広告
  - 美しいターコイズブルーの背景に浮かぶ様々な3Dオブジェクト
  - 飛行機、船舶、自動車、風力発電機、ロボット、ノートPC等の立体的な配置
  - 「貸します解決。」のメッセージと共に、リース事業の多様性を視覚的に表現
  - 影付きの3Dレンダリングで奥行き感のある現代的なデザイン

## 重要な技術仕様と勘違いしやすい点

### 透明度の仕組み（重要）
**❌ 間違った理解**: 「線が透明になって背景が見える」
**✅ 正しい理解**: 「線を描いた部分の霧レイヤーが除去されて背景が見える」

- 実装上は`fogLayer`という白い半透明レイヤーが画面全体を覆っている
- 線を描くと、その部分の`fogLayer`が`erase()`で除去される
- ボールの軌跡も同様に`fogLayer`を除去して背景を露出させる
- 時間経過で`fogLayer`が再び上塗りされ、霧が戻る

### 音階マッピングの詳細
**使用スケール**: G Lydian から A2・D3を除外した16音
```
B2, C#3, E3, F#3, G3, A3, B3, C#4, D4, E4, F#4, G4, A4, B4, C#5, D5
```

**線の長さと音程の関係**:
- 画面対角線の50%を基準長とする
- **短い線ほど高音**（D5に近づく）
- **長い線ほど低音**（B2に近づく）
- 指数カーブ（0.6乗）で短線を強調

### モバイルでの音響調整（iPhone等での注意点）
**❌ 間違った理解**: 「モバイルでも同じ音階マッピング」
**✅ 正しい理解**: 「モバイルでは音階変化を意図的に緩やかに調整」

- モバイルでは`effectiveMax = maxLength * 0.8`（PC: 0.67）
- これにより短い線での高音出現を抑制
- 指の太さを考慮した音響体験の最適化

### ドローン音量の計算式
**最終音量 = 基準音量 × 0.66 × 0.8 × 0.8 = 基準音量 × 0.422**
- 第1段階: 66%に削減
- 第2段階: さらに80%に削減  
- 第3段階: さらに80%に削減
- **結果**: 元の42.2%（約58%削減）

### 線の視覚効果の詳細
- **線の太さ**: PC 26px、モバイル 16px
- **グロー効果**: メイン線の1.5倍の太さ
- **ブラシ効果**: 始点・終点で線幅が細くなる
- **透過処理**: 線の中心部は透明、エッジは半透明

## 音と透明度に関する説明

- **音の調整**:
  - ドローンサウンドの音量を大幅削減（58%削減）することで、他の音とのバランスを取り、より心地よい音響体験を提供。
  - モバイルデバイスでは音階マッピングを調整し、指の太さを考慮した音響体験を実現。
  - 音のフェードインとフェードアウトを活用し、ゲームの開始と終了時に自然な音の変化を実現。

- **透明度の効果**:
  - **霧レイヤーの除去方式**を採用し、線を描いた部分で背景広告が見えるように実装。
  - 線自体の透明度ではなく、**霧の除去**による背景露出が核心的な仕組み。
  - ボールの軌跡も同様の方式で背景を露出させ、動きの流れを強調。
  - 時間経過による霧の再生成で、描いた線が徐々に見えなくなる演出を実現。

## 現状バージョンのアップデート情報

- **視覚効果の改善**: 背景広告が見えるように、霧と透明度の効果を改善。
- **音量調整**: G2とD3のドローンサウンドの音量を58%削減。
- **背景広告の更新**: 最新の広告画像（027_01.jpg）に変更。
- **プレビュー層の改善**: 霧レイヤーに直接プレビューの透明度を適用し、二重霧効果を回避。
- **パフォーマンスの向上**: プレビューの変更は一時的で、`push()/pop()`を使用してレンダリング状態を分離。