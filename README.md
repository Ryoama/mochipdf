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
- Windows (MSI): `src-tauri/target/release/bundle/msi/MochiPDF_<ver>_x64_en-US.msi`
- Windows (NSIS): `src-tauri/target/release/bundle/nsis/MochiPDF_<ver>_x64-setup.exe`
- Windows (ポータブル): `src-tauri/target/release/MochiPDF.exe`

開発モード:

```bash
npm run tauri:dev
```

## Windows 版

Windows 版は Tauri 2 の MSVC ターゲットでビルドします。Mac から `.msi` / `.exe` を直接生成することはできないため、以下のいずれかの方法で生成してください。

### A. ローカル(Windows マシン)でビルド

前提:

- Node.js 20+
- Rust(`rustup` から `stable-x86_64-pc-windows-msvc`)
- Microsoft C++ Build Tools(Visual Studio Installer の「C++ によるデスクトップ開発」)
- WebView2 Runtime(Windows 11 はプリインストール済み)

```powershell
npm install
npm run tauri:build -- --target x86_64-pc-windows-msvc --bundles msi nsis
```

ビルド後、上記のパスに `.msi`(MSI インストーラ) / `.exe`(NSIS インストーラ) / `MochiPDF.exe`(ポータブル) が生成されます。インストール不要で使いたい場合はポータブル `.exe` をコピーして配布してください。

### B. GitHub Actions(`windows-latest`)で自動ビルド

`.github/workflows/windows-build.yml` を含めており、`main` への push、`v*` タグの push、PR、手動 dispatch のいずれでも Windows ビルドが走ります。生成された MSI / NSIS / ポータブル `.exe` は GitHub Actions の Artifacts からダウンロードできます。`v*` タグを push した場合はドラフトリリースに自動添付されます。

### Windows 固有の挙動

- `.pdf` ファイルを「もちPDF で開く」できるよう、MSI/NSIS インストール時にファイル関連付けを登録します。
- NSIS インストーラはユーザー単位インストール(管理者権限不要)です。インストール時に英語/日本語を選択できます。
- MSI は en-US と ja-JP を同梱しています。
- WebView2 ランタイムは **fixedRuntime モード**で同梱しています。インストール環境に WebView2 が無くても初回起動でダウンロードされず、追加セットアップ不要で動作します。

### Windows ポータブル版(セットアップ不要)

`MochiPDF_<ver>_x64-portable.zip` を解凍して `MochiPDF.exe` をダブルクリックすれば動きます。**インストーラの実行も WebView2 のインストールも不要**です。フォルダごと USB メモリ等にコピーすれば任意の Windows マシンで動作します(zip 内に WebView2 Fixed Runtime を同梱しているため、サイズは ~180MB になります)。

ローカルでこの portable zip を作るには、`src-tauri/Microsoft.WebView2.FixedVersionRuntime.<ver>.x64/` に WebView2 Fixed Runtime を配置してから `tauri build` してください。WebView2 Fixed Runtime は [Microsoft の WebView2 ページ](https://developer.microsoft.com/microsoft-edge/webview2/) または [westinyang/WebView2RuntimeArchive](https://github.com/westinyang/WebView2RuntimeArchive/releases) から取得できます。CI ではバージョン `133.0.3065.92` を使用しています。

## ランディングサイト(Vercel)

`website/` 配下にプロモーションサイト一式があり、ルートの `vercel.json` で `outputDirectory: "website"` に設定済みです。Vercel に GitHub 連携でインポートするだけで自動デプロイされます。詳しくは [`website/README.md`](./website/README.md) を参照。

サイトには以下のダウンロード導線を用意しています:

- 最新リリース(MSI / NSIS / ポータブル zip): <https://github.com/Ryoama/mochipdf/releases/latest>
- ソース zip: <https://github.com/Ryoama/mochipdf/archive/refs/heads/main.zip>
- GitHub リポ: <https://github.com/Ryoama/mochipdf>

## ブランドカラー

| 役割 | 色 |
| --- | --- |
| メインイエロー | `#FFD766` |
| アクセントイエロー | `#FFB800` |
| もちホワイト | `#FFF7E6` |
| ソフトベージュ | `#F6EFE3` |
| チャコール | `#333333` |
