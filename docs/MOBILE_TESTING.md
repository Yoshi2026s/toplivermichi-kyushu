# スマートフォン向けブラウザーエミュレーション

PC上のChromeで画面サイズ・端末倍率・モバイル表示・タッチ入力を再現する。Android OSのエミュレーターや物理端末ではない。iOS Safari、端末性能、実際のソフトウェアキーボード、セーフエリア、音声の聞こえ方は別途実機確認が必要。

## 起動

Node.js 24以降とChromeを使用する。初回は依存をロックファイルから導入する。

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build:check
npm run mobile
```

npmが使えないCodex内では、依存導入後に次のコマンドで起動できる。

```powershell
node scripts/mobile-preview.mjs
```

専用ブラウザーが開き、`http://127.0.0.1:4173/` にゲームを表示する。クリックをタップとして操作できる。ブラウザーを閉じるか、起動したターミナルでCtrl+Cを押して終了する。ポート使用中の場合は、起動中のプレビューを閉じるか `--port=4174` を付ける。ゲーム本体を更新した場合はビルド後にプレビューを再起動する。

```powershell
node scripts/mobile-preview.mjs --device=small
node scripts/mobile-preview.mjs --device=landscape
node scripts/mobile-preview.mjs --device=short
```

| プリセット | CSS画面サイズ | 主な用途 |
| --- | --- | --- |
| standard | 393 × 851 | 通常の縦持ち |
| small | 360 × 640 | 小画面の表示と操作 |
| landscape | 851 × 393 | 横持ちの低い画面 |
| short | 393 × 500 | キーボード表示時を想定した残り高さの近似 |

`short` は画面の高さを縮めるだけで、AndroidキーボードやIMEを再現しない。各プリセットは起動時の向きで固定するため、回転中の挙動は別途確認する。

テスト用セーブは `.task/mobile/profiles/<プリセット名>/` に保持する。普段のChromeや公開サイトのセーブには触れない。`.task/` はGit管理対象外。ローカルサーバーはループバック接続だけを受け付け、生成済みゲーム以外のプロジェクトファイルは配信しない。ゲーム音は検査ブラウザーの起動引数で消音する。

## 自動操作による確認

```powershell
npm run test:mobile
# npmが使えない場合
node scripts/test-mobile.mjs
```

4プリセットについてタイトル、新規設定、タップによる開始、会話、MAP、メニュー、設定変更、保存、ブラウザーを閉じて再起動した後の続行を検査する。横方向のはみ出し、タッチ入力の有効性、未処理のJavaScript例外も検査する。OSの動きを減らす設定を有効にして実行する。戦闘や全機能の実機相当テストは含まない。

各検査は新しい専用プロファイルを使う。結果は `.task/mobile/reports/latest.json`、画面画像と個別結果は同ディレクトリの `run-*` に保存する。失敗時もレポートと可能な範囲で画面画像を残し、終了コードを失敗にする。通常の `npm test` とは別コマンドで実行する。

Chromeを使わずPlaywright同梱のChromiumを導入する場合：

```powershell
npx playwright install chromium
$env:MOBILE_BROWSER='chromium'
npm run test:mobile
# 手動確認も同じブラウザーを使う
npm run mobile
```

Edgeを使う場合は `MOBILE_BROWSER` を `msedge` にする。

## 2026-10-31の確認結果

- Windows上のChromeで4プリセットすべての自動操作が成功。各プリセットで未処理のJavaScript例外は0件。設定を保存し、専用ブラウザーを閉じて再起動後に同じ名前・所持金・MAP・移動速度設定が復元されることを確認した。
- 生成物の一致検査と既存37件の回帰検査が成功。小画面のMAP画像も目視確認した。
- `standard` の手動確認用ウィンドウの起動と、ローカルURLからのゲーム配信を確認した。
- GitHub Actionsにも独立した `mobile` ジョブを追加。Chromiumを導入して同じ検査を実行し、結果JSONと画面画像を成果物に保存する。リモート未接続のためCI上の実行は未確認。

参考：[Playwrightの端末エミュレーション](https://playwright.dev/docs/emulation)、[専用プロファイルによるブラウザー起動](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)。
