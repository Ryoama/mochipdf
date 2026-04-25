# もちPDF 配布サイト

Vercel にデプロイする配布サイトです。次の 2 つを 1 つの静的サイトとして配信します。

| パス | 内容 |
| --- | --- |
| `/` | ランディングページ(機能紹介 / 実際の画面プレビュー / ダウンロード導線) |
| `/app/` | 実際のアプリ画面(ブラウザで動くライブデモ) |

## ディレクトリ構成

```
website/                  ← ランディングのソース(本ディレクトリ)
├── index.html            ← React + Babel-standalone を CDN から読み込むシェル
├── app.jsx               ← App エントリ
├── components.jsx        ← Header / Hero / LivePreview / Features / ... / Footer
├── i18n.jsx              ← ja / en の翻訳辞書
├── icons.jsx             ← インライン SVG アイコン
├── tweaks-panel.jsx      ← デザイン微調整パネル(本番では非表示)
├── assets/               ← ロゴ・マスコット
└── README.md             ← このファイル

scripts/build-site.mjs    ← Vite ビルド成果物 (dist/) と website/ を _site/ に合体
src/                      ← Tauri webview のソース(Vite root)
_site/                    ← ビルド成果物(Vercel 配信元、git 管理外)
```

ランディングは React 18 + `@babel/standalone` を CDN から読み込み、JSX をブラウザで実行する構成です。バンドラは不要なので、`website/` 配下は静的にそのまま配信されます。

## ローカル確認

```bash
npm install
npm run build:site
# → _site/ に書き出される

# 任意の静的サーバで確認
python3 -m http.server 8080 --directory _site
# → http://localhost:8080  (ランディング)
# → http://localhost:8080/app/  (実アプリ)
```

## Vercel へのデプロイ

リポジトリのルートに `vercel.json` を置いており、以下の流れで自動デプロイされます。

1. `npm ci || npm install` で依存をインストール
2. `npm run build:site` で `vite build` → `_site/` に landing と `/app/` を合体
3. `_site/` を静的配信

接続手順:

1. <https://vercel.com/new> から `Ryoama/mochipdf` をインポート
2. **Framework Preset** は `Other`(`vercel.json` で `framework: null`)
3. その他はデフォルトのまま Deploy

> 💡 ライブデモはブラウザで動作するため、ファイル選択ダイアログとダウンロード経由で操作します。フォルダへの一括保存などデスクトップ専用機能は無効化されます。

CLI から手動デプロイする場合:

```bash
npm i -g vercel
vercel --prod
```

## ダウンロードリンクの仕組み

- **最新リリース** — `https://github.com/Ryoama/mochipdf/releases/latest` に遷移
- **ソース zip** — `https://github.com/Ryoama/mochipdf/archive/refs/heads/main.zip` で main ブランチのスナップショットを直接ダウンロード
- **GitHub リポ** — `https://github.com/Ryoama/mochipdf`

リリース zip(`MochiPDF_<ver>_x64-portable.zip` 等)はバージョンがファイル名に含まれるため、リリースページ経由で配布しています。
