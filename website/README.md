# もちPDF ランディングサイト

Vercel にデプロイする静的なランディングサイトです。アプリ本体(Tauri)の紹介と、GitHub リポ・最新リリース・ソース zip へのダウンロードリンクを提供します。

## ディレクトリ構成

```
website/
├── index.html      # ランディングページ
├── style.css       # スタイル(ブランドカラー)
├── assets/         # ロゴ・favicon
└── README.md       # このファイル
```

## ローカル確認

ビルド不要の純粋な静的サイトです。任意の静的サーバで確認できます。

```bash
# 例: Python の組み込みサーバで確認
python3 -m http.server 8080 --directory website
# → http://localhost:8080
```

## Vercel へのデプロイ

リポジトリのルートに `vercel.json` と `.vercelignore` を置いており、Tauri アプリ側のファイル(`src/`, `src-tauri/`, `package.json` 等)は配布対象から除外されています。Vercel に GitHub 連携で接続するだけで、この `website/` の中身だけが配信されます。

1. <https://vercel.com/new> から `Ryoama/mochipdf` をインポート
2. **Framework Preset** は `Other`(`vercel.json` で `framework: null` を指定済み)
3. **Build / Install Command** はそのまま(`vercel.json` で no-op に上書き済み)
4. **Output Directory** は `website`(`vercel.json` で指定済み)
5. Deploy

> ⚠️ Vercel に Vite アプリ(Tauri webview)をビルドさせないために、`.vercelignore` で `package.json` / `vite.config.js` / `src/` / `src-tauri/` などを除外しています。Vercel はこれらが見えないため Vite を自動検出せず、配布サイト(`website/`)だけがデプロイされます。

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
