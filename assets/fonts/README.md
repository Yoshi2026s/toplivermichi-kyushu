# 同梱日本語フォント

- `quest-mincho-800.woff2`: Shippori Mincho ExtraBold を元にした、本作の見出し用サブセット（Quest Mincho）。
- `quest-gothic-variable.woff2`: Noto Sans JP 可変フォントを元にした、本作の本文・操作用サブセット（Quest Gothic）。

両書体は SIL Open Font License 1.1。元の著作権とライセンス全文をそれぞれ `OFL-Shippori-Mincho.txt`、`OFL-Noto-Sans-JP.txt` に同梱する。変更したフォントの内部名は本作用の名前へ変更した。配布時にはライセンスファイルも保持する。

元データとハッシュ、収録コードポイントは `SOURCES.json` に記録。取得先は Google Fonts の公式リポジトリ。

- https://github.com/google/fonts/tree/main/ofl/shipporimincho
- https://github.com/google/fonts/tree/main/ofl/notosansjp

`src/` の文字とASCIIから必要なグリフを抽出し、fontToolsでWOFF2化する。通常のビルドは完成済みのWOFF2をHTMLへ埋め込むため、Pythonやフォント配信サーバーへの接続は不要。

再生成には `fonttools[woff]` を導入し、公式TTFとOFLを `display.ttf`、`body.ttf`、`display-OFL.txt`、`body-OFL.txt` の名前で任意の作業ディレクトリへ保存してから、`python scripts/subset-fonts.py --sources <ディレクトリ>` を実行する。収録外の文字、ユーザー入力の人名、絵文字は端末の日本語フォントへフォールバックする。
