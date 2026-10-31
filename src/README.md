# v5.34 編集元（全国編・共通機能統合）

- ui_action_safety.js: 会話・戦闘・施設の画面条件と古いボタンの検査、閲覧専用の表示、解説検索とページ送りの操作補助。

`src/` は2026年10月22日の `toplivermichi_kyushu_source.zip` から取得した編集元を更新したものです。公開用の `index.html` は `node scripts/build.mjs` で再生成します。

元ZIPの `build.sh` は当時の作業環境 `/home/claude/game` に固定されていたため、ここでは採用していません。版と検査状況は `VERSION.txt` と `docs/UPDATE_PROGRESS.md` を参照してください。


- ui_navigation.js: 依頼と行先の検索・距離・案内、移動予定と操作ヒント。セーブ形式を変えず実行中のみ保持。
