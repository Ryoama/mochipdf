# もち PDF

かわいい PDF ビューア&エディタ。Windows/Mac 両対応の Tauri ネイティブアプリ。インストール不要のポータブル実行ファイルとして配布できます。

## 機能

- **閲覧** — 単ページ表示、ズーム、ページ送り、しおり・付箋パネル
- **ページ編集(タイルグリッド)** — ドラッグ&ドロップで並べ替え、選択ページの一括削除・回転・抽出
- **挿入** — 別PDF / 空白ページ / 画像(PNG/JPEG)
- **分割** — Nページごと / しおり単位 / ファイルサイズごと
- **結合** — 複数 PDF をドラッグ&ドロップで順序指定
- **しおり** — 追加・編集・削除(PDF アウトラインとして書き戻し)
- **付箋** — ページ任意位置にクリック配置、ドラッグで移動、本文が常時表示

## 技術スタック

- **Tauri 2** — ネイティブ実行ファイル(Mac ~4MB / Win も軽量)
- **pdf.js** — PDF 描画(サムネ・単ページレンダリング)
- **pdf-lib** — PDF 編集(ページ操作・アウトライン書き込み)
- **Vite + Vanilla JS** — フロントエンドビルド

## ビルド方法

前提: Node.js と Rust ツールチェーン(`cargo`) が必要

```bash
npm install
npm run tauri:build
```

開発モード:

```bash
npm run tauri:dev
```

配布バイナリは GitHub Actions で自動生成しています(下記)。CI からは **インストーラは生成せず、Windows ポータブル zip / macOS Universal `.dmg` のみ**を出力します。

## 配布物(GitHub Actions)

| OS | ファイル名(固定) | 中身 |
| --- | --- | --- |
| Windows | `MochiPDF-windows-portable.zip` | 解凍して `MochiPDF.exe` をダブルクリックで起動。WebView2 はシステムにインストール済みのものを利用(未インストール環境では初回起動時に Microsoft からブートストラッパが自動取得されます)。zip は数 MB |
| macOS | `MochiPDF-mac.dmg` | Apple Silicon (M シリーズ) 用。マウントして `MochiPDF.app` を Applications にドラッグ。Intel Mac では Rosetta 2 経由で動作 |

ファイル名にはバージョン番号を入れていないため、ランディングサイトから `https://github.com/Ryoama/mochipdf/releases/download/latest/<ファイル名>` で常に最新版を直リンクできます(`main` への push ごとに `latest` プレリリースが上書きされる仕組みです — 詳細は下記 CI セクション)。

### Windows ビルド(`.github/workflows/windows-build.yml`)

`windows-latest` で `tauri build --no-bundle` を回し、出力された `MochiPDF.exe` を `MochiPDF-windows-portable.zip` にまとめます。`main` への push ごとに `latest` タグのプレリリースを上書きし、`v*` タグ push 時は対応するバージョン付きリリースに添付します。

WebView2 ランタイムは zip に同梱せず、`tauri.conf.json` の `webviewInstallMode: downloadBootstrapper` でユーザー環境のものを利用します(Windows 11 と最新の Windows 10 はプリインストール済み)。これにより zip サイズを ~180MB から数 MB に削減しています。

ローカルで同等のものを作るには `npm run tauri:build -- --target x86_64-pc-windows-msvc --no-bundle` を実行し、生成された `MochiPDF.exe` を zip 化してください。

### macOS ビルド(`.github/workflows/macos-build.yml`)

`macos-latest` で `tauri build --target aarch64-apple-darwin` を回し、Apple Silicon 用 `.dmg` を `MochiPDF-mac.dmg` として固定名で出力します。`main` への push ごとに `latest` タグのプレリリースを上書きし、`v*` タグ push 時は対応するバージョン付きリリースに添付します。

> ⚠️ 現状 CI ではコード署名 / Notarization を行っていません。初回起動時に Gatekeeper の警告が出る場合は、`MochiPDF.app` を右クリック → 「開く」を選択してください。
> ⚠️ Intel Mac は Rosetta 2 経由で動作します。ネイティブ Intel ビルドが必要なら `-target x86_64-apple-darwin` を追加で回す jobs を組んでください。

## ランディングサイト(Vercel)

`website/` 配下にプロモーションサイト一式があり、ルートの `vercel.json` で `outputDirectory: "website"` に設定済みです。Vercel に GitHub 連携でインポートするだけで自動デプロイされます。詳しくは [`website/README.md`](./website/README.md) を参照。

サイトのボタンを押すと、以下が直接ダウンロードされます:

- Windows: `https://github.com/Ryoama/mochipdf/releases/download/latest/MochiPDF-windows-portable.zip`
- macOS: `https://github.com/Ryoama/mochipdf/releases/download/latest/MochiPDF-mac.dmg`
- ソース: `https://github.com/Ryoama/mochipdf/archive/refs/heads/main.zip`

## ブランドカラー

| 役割 | 色 |
| --- | --- |
| メインイエロー | `#FFD766` |
| アクセントイエロー | `#FFB800` |
| もちホワイト | `#FFF7E6` |
| ソフトベージュ | `#F6EFE3` |
| チャコール | `#333333` |
