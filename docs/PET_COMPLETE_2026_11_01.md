# ペット機能の拡張（2026-11-01）



全街の広場に肉球アイコンの控え室・ペットショップを設置。メニューから記録を閲覧し、控え室へ歩いて交流・用品購入・家族のお迎え・編成を行う。旅のお手伝いは街外でも利用可能。22種・10段階・88技・264用品の識別子、価格、保存キーは維持する。用品は種類別に表示し1個または5個ずつ購入でき、袋に入らない分は金庫へ送る。ごはん・遊ぶ・手入れ・休憩・練習・なでるに加え、用品不要の宝さがし・リズム遊び・くつろぎを3つから1日1回選ぶ。成長アルバムと直近30件の交流日記を保存する。日次はゲーム内の翌日で更新し、現実の日付や再起動では戻らない。

同行は異なる最大2匹。ターン開始時に各1回、有効な習得技を回復優先・補助優先で自動選択する。HP・MP回復、攻撃・防護・エールに加え、防御強化、すばやさ強化（そのターン回避率＋12ポイント・合計上限50%）、敵の攻撃25%低下、混乱、睡眠を種類ごとに割り当てる。混乱は次の行動を自分への最大HP8%の攻撃に置き換え、睡眠は次の行動を1回止める。行動妨害は同じ敵へ3ターン間隔とし、足止めとの重複を防ぐ。強化と攻撃低下は1ターン、混乱・睡眠は次の行動1回まで。戦闘中保存を復元しても処理済みターンの支援を重複発動しない。支援の技名・対象・効果は戦闘画面に表示する。

画像は既存の動物素材を使い、成長段階の数字・色枠・段階5の飾り・段階8の冠を表示。保存失敗時は金銭・用品・育成・日次を復元し、古いボタン・連打・閲覧専用状態からの変更を防ぐ。

## 20回の重点見直し・デバッグ

1. town-rooms-and-paths — 専用回帰検査で確認
2. room-only-interaction — 専用回帰検査で確認
3. species-food-and-supplies — 専用回帰検査で確認
4. five-item-purchase-and-double-tap — 専用回帰検査で確認
5. category-and-invalid-quantity — 専用回帰検査で確認
6. six-independent-care-records — 専用回帰検査で確認
7. three-activities-one-daily-use — 専用回帰検査で確認
8. no-effect-keeps-items-and-day — 専用回帰検査で確認
9. growth-album-and-bounded-journal — 専用回帰検査で確認
10. legacy-and-restart-preservation — 専用回帰検査で確認
11. two-distinct-run-snapshots — 専用回帰検査で確認
12. healing-before-actions-no-revival — 専用回帰検査で確認
13. mp-cap-and-priority — 専用回帰検査で確認
14. species-support-and-turn-ledger — 専用回帰検査で確認
15. defense-reduces-real-damage — 専用回帰検査で確認
16. speed-affects-real-evasion — 専用回帰検査で確認
17. enemy-attack-down-expires — 専用回帰検査で確認
18. sleep-one-action-and-resistance — 専用回帰検査で確認
19. confusion-self-hit-and-victory — 専用回帰検査で確認
20. failed-save-readonly-and-draft — 専用回帰検査で確認

検査記録は PET_TWENTY_VALIDATION_2026_11_01.json。test-pet-complete-ui.mjs は6サイズで購入・餌・交流・命名・お迎え・2匹編成・再読込後の復元・成長画像・戦闘支援を確認する。CIに追加。物理スマートフォンとOSキーボードは未確認。固定状態を用いるブラウザー模擬と、公開URLの通常プレイは区別する。
