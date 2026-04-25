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

生成物:

- Mac: `src-tauri/target/release/bundle/macos/MochiPDF.app`
- Windows: `src-tauri/target/release/bundle/msi/MochiPDF_<ver>_x64_en-US.msi`

開発モード:

```bash
npm run tauri:dev
```

## ブランドカラー

| 役割 | 色 |
| --- | --- |
| メインイエロー | `#FFD766` |
| アクセントイエロー | `#FFB800` |
| もちホワイト | `#FFF7E6` |
| ソフトベージュ | `#F6EFE3` |
| チャコール | `#333333` |
