// Gatewright UI strings. English text is the key (falls back to itself); level text is in src/levels-i18n.js.
(function () {
  const zh = {}, ja = {};
  const add = (en, z, j) => { zh[en] = z; ja[en] = j; };
  [
    ["Level map", "關卡地圖", "レベルマップ"], ["Back to ting39's homepage", "回到 ting39 的首頁", "ting39 のホームへ戻る"],
    ["Sandbox: build anything", "沙盒：自由打造", "サンドボックス：何でも作れる"], ["Sandbox", "沙盒", "サンドボックス"],
    ["Controls (?)", "操作說明（?）", "操作方法（?）"], ["Help", "說明", "ヘルプ"], ["Sound on/off", "音效開關", "サウンドのオン／オフ"],
    ["Toggle sound", "切換音效", "サウンド切り替え"], ["Save, export, import", "存檔、匯出、匯入", "保存・書き出し・読み込み"], ["Menu", "選單", "メニュー"],
    ["Parts bin", "零件箱", "部品箱"], ["Circuit board. Drag parts from the bin, drag between pins to wire.", "電路板。從零件箱拖曳零件，在接腳之間拖曳來接線。", "回路ボード。部品箱から部品をドラッグし、ピン間をドラッグして配線します。"],
    ["Undo (Ctrl+Z)", "復原（Ctrl+Z）", "元に戻す（Ctrl+Z）"], ["Redo (Ctrl+Shift+Z)", "重做（Ctrl+Shift+Z）", "やり直す（Ctrl+Shift+Z）"],
    ["Zoom out", "縮小", "縮小"], ["Zoom in", "放大", "拡大"], ["Fit to screen (F)", "符合畫面（F）", "画面に合わせる（F）"],
    ["Tidy: auto-arrange everything by logic depth (L). Undo restores your layout.", "整理：依邏輯深度自動排列（L）。復原可以還原你的排列。", "整頓：論理の深さで自動配置（L）。元に戻すで配置を戻せます。"],
    ["Clock tick (Enter)", "時脈前進一拍（Enter）", "クロックを 1 拍進める（Enter）"], ["Tick", "時脈", "クロック"], ["Run the clock", "連續執行時脈", "クロックを走らせる"],
    ["Reset memory to 0", "把記憶體重設為 0", "メモリを 0 にリセット"], ["Show brief", "顯示說明", "説明を表示"], ["Brief", "說明", "説明"],
    ["Gatewright needs room", "Gatewright 需要空間", "Gatewright には広い画面が必要です"],
    ["This is a wiring game. It works best on a tablet or computer, where there's space to lay out chips.", "這是一款接線遊戲，在平板或電腦上玩最好，才有空間擺放晶片。", "これは配線ゲームです。チップを並べる余裕のあるタブレットやパソコンで遊ぶのがおすすめです。"],
    ["Try anyway", "還是試試看", "それでも試す"], ["← back to ting39's homepage", "← 回到 ting39 的首頁", "← ting39 のホームへ戻る"],
    // panel / map / win
    ["✓ solved", "✓ 已解開", "✓ クリア済み"], ["Build anything", "自由打造", "何でも作れる"], ["Run tests", "執行測試", "テストを実行"],
    ["Test ▶", "測試 ▶", "テスト ▶"], ["Clear", "清除", "クリア"], ["Remove everything except the pins", "移除接腳以外的所有東西", "ピン以外をすべて削除"],
    ["Level complete", "過關！", "レベルクリア"], ["You built a computer, and programmed it.", "你打造了一台電腦，還幫它寫了程式。", "あなたはコンピュータを作り、プログラムまで書きました。"],
    ["Free play: draw on your computer →", "自由遊玩：在你的電腦上畫畫 →", "フリープレイ：自分のコンピュータでお絵かき →"],
    ["Open the sandbox", "開啟沙盒", "サンドボックスを開く"], ["Stay here", "留在這裡", "ここにとどまる"], ["My chips", "我的晶片", "マイチップ"],
    ["One of your own chips.", "你自己做的晶片。", "自作のチップです。"],
    ["Drag onto the board, or click to drop it in the middle.", "拖到電路板上，或點一下放到中央。", "ボードにドラッグするか、クリックで中央に置きます。"],
    // toasts
    ["A chip needs at least one input and one output pin", "晶片至少需要一個輸入接腳和一個輸出接腳", "チップには入力ピンと出力ピンが少なくとも 1 つずつ必要です"],
    ["Name your chip (letters, digits, up to 10):", "幫你的晶片取名（英文字母、數字，最多 10 個字元）：", "チップの名前（英字と数字、10 文字まで）："],
    ["Use letters and digits, starting with a letter", "請用英文字母和數字，並以字母開頭", "英字で始まる英数字を使ってください"],
    ["A chip can't contain itself", "晶片不能包含自己", "チップは自分自身を含められません"],
    ["Passed, with a new personal best!", "通過，而且刷新個人紀錄！", "合格、自己ベスト更新！"], ["All tests pass ✓", "全部測試通過 ✓", "すべてのテストに合格 ✓"],
    ["All cases pass ✓", "全部案例通過 ✓", "すべてのケースに合格 ✓"],
    ["This is a whole-program check. Read the message above to see what went wrong.", "這是整支程式的檢查，請看上方訊息了解哪裡出錯。", "プログラム全体のチェックです。上のメッセージで原因を確認してください。"],
    ["Widths must be 1–16 numbers adding up to at most 16", "寬度必須是 1–16 的數字，加總不超過 16", "幅は 1〜16 の数で、合計 16 以下にしてください"],
    ["Another pin already has that name", "已經有其他接腳用了這個名稱", "その名前は別のピンが使っています"],
    ["Erase every solved level and design? This cannot be undone.", "要清除所有已解開的關卡和設計嗎？這無法復原。", "クリアしたレベルと設計をすべて消去しますか？元に戻せません。"],
    ["Replace your current progress with this save file?", "要用這個存檔取代目前的進度嗎？", "現在の進行状況をこのセーブファイルで置き換えますか？"],
    ["Progress imported", "已匯入進度", "進行状況を読み込みました"], ["Design imported", "已匯入設計", "設計を読み込みました"],
    ["Tidied. Ctrl+Z puts it back", "已整理。Ctrl+Z 可以還原", "整頓しました。Ctrl+Z で戻せます"], ["Copied", "已複製", "コピーしました"],
    ["Fix the assembly errors first", "請先修正組合語言錯誤", "まずアセンブリのエラーを直してください"],
    ["Stopped after 200,000 cycles", "執行 200,000 個週期後停止", "200,000 サイクルで停止しました"],
    ["❚❚ Pause", "❚❚ 暫停", "❚❚ 一時停止"], ["▶ Run", "▶ 執行", "▶ 実行"],
    ["Your computer needs one ROM and one RAM 256.", "你的電腦需要一個 ROM 和一個 RAM 256。", "コンピュータには ROM と RAM 256 が 1 つずつ必要です。"],
    ["Your computer design is missing its ROM or RAM.", "你的電腦設計缺少 ROM 或 RAM。", "コンピュータの設計に ROM か RAM がありません。"],
    ["Wrong output", "輸出錯誤", "出力が違います"], ["Your circuit never settles (it oscillates)", "你的電路一直無法穩定（在振盪）", "回路が安定しません（発振しています）"],
    ["Your circuit never settles", "你的電路一直無法穩定", "回路が安定しません"],
  ].forEach(([e, z, j]) => add(e, z, j));
  Object.assign(zh, {
    "tpl.levelOf": "{ch} · 第 {n} 關，共 {total} 關", "tpl.hint": "提示（{a}/{b}）", "tpl.next": "下一關：{t} →",
    "tpl.halted": "執行 {n} 個週期後停機", "tpl.disagree": "你的電腦在第 {n} 個週期和參考模型不一致",
    "tpl.saved": "{n} 已放進零件箱的「我的晶片」", "tpl.builtin": "{n} 已經是內建零件的名稱",
  });
  Object.assign(ja, {
    "tpl.levelOf": "{ch} · 全 {total} レベル中 {n}", "tpl.hint": "ヒント（{a}/{b}）", "tpl.next": "次へ：{t} →",
    "tpl.halted": "{n} サイクルで停止しました", "tpl.disagree": "サイクル {n} でコンピュータが参照モデルと食い違いました",
    "tpl.saved": "{n} を部品箱の「マイチップ」に入れました", "tpl.builtin": "{n} は組み込み部品の名前です",
  });
  const en = {
    "tpl.levelOf": "{ch} · Level {n} of {total}", "tpl.hint": "Hint ({a}/{b})", "tpl.next": "Next: {t} →",
    "tpl.halted": "Halted after {n} cycles", "tpl.disagree": "Your computer disagrees with the reference at cycle {n}",
    "tpl.saved": "{n} is in your bin under My chips", "tpl.builtin": "{n} is already a built-in part name",
  };
  I18N.add({ en, "zh-TW": zh, ja });
})();
