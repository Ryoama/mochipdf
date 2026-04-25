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

リポジトリのルートに `vercel.json` を置いており、`outputDirectory` として `website/` を指定しています。Vercel に GitHub 連携で接続するだけで自動デプロイされます。

1. <https://vercel.com/new> から `Ryoama/mochipdf` をインポート
2. **Framework Preset** は `Other` を選択(`vercel.json` の設定が優先されます)
3. **Build Command** / **Install Command** は空欄で OK(静的配信)
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
