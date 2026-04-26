# もちPDF 配布サイト

Vercel にデプロイする静的なランディングサイトです。`website/` の中身がそのまま `/` で配信されます。

## ディレクトリ構成

```
website/                  ← ランディングのソース(本ディレクトリ)
├── index.html            ← React + Babel-standalone を CDN から読み込むシェル
├── app.jsx               ← App エントリ
├── components.jsx        ← Header / Hero / Features / ... / Footer
├── i18n.jsx              ← ja / en の翻訳辞書
├── icons.jsx             ← インライン SVG アイコン
├── tweaks-panel.jsx      ← デザイン微調整パネル(本番では非表示)
├── assets/               ← ロゴ・マスコット
└── README.md             ← このファイル
```

ランディングは React 18 + `@babel/standalone` を CDN から読み込み、JSX をブラウザで実行する構成です。バンドラは不要なので、`website/` 配下を静的にそのまま配信できます。

## ローカル確認

ビルド不要なのでそのまま静的サーバで開けます。

```bash
python3 -m http.server 8080 --directory website
# → http://localhost:8080
```

## Vercel へのデプロイ

リポジトリのルートに `vercel.json` と `.vercelignore` を置いており、Tauri アプリ側のファイル(`src/`, `src-tauri/`, `package.json` 等)は配布対象から除外されています。Vercel に GitHub 連携で接続するだけで、`website/` の中身だけが配信されます。

1. <https://vercel.com/new> から `Ryoama/mochipdf` をインポート
2. **Framework Preset** は `Other`(`vercel.json` で `framework: null`)
3. **Build / Install Command** はそのまま(`vercel.json` で no-op に上書き済み)
4. **Output Directory** は `website`(`vercel.json` で指定済み)
5. Deploy

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
