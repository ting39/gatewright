// Gatewright level text in Traditional Chinese (Taiwan) and Japanese.
// Same HTML structure as levels.js; anything missing falls back to English.
export const LEVEL_TR = {
  'zh-TW': {
    chapters: {
      logic: { title: 'I · 邏輯', blurb: '零件箱裡只有一種閘。把它變成很多種。' },
      arith: { title: 'II · 算術', blurb: '教電線學會數數。' },
      memory: { title: 'III · 記憶', blurb: '會記住東西的迴路。' },
      computer: { title: 'IV · 電腦', blurb: '把一切組合起來。' },
      programs: { title: 'V · 程式', blurb: '在你親手打造的機器上跑程式。' },
    },
    levels: {
      not: { title: '反相器', brief: `<p>歡迎來到鑄造廠。我們唯一的機器只會生產 <b>NAND</b> 閘：只有在<i>兩個</i>輸入都是 1 時，輸出才是 0。</p>
<p>做出一個<b>反相器</b>：<code>out</code> 是 <code>a</code> 的相反值。</p>
<p class="how">從零件箱把 NAND 拖到電路板上。從一個接腳拖到另一個接腳就能拉一條線。點輸入可以切換它的值，然後按<b>測試</b>。</p>`,
        hints: ['兩個輸入接在一起的 NAND，只會看到 00 或 11。', '把 a 接到 NAND 的兩個輸入。'] },
      and: { title: '兩者皆是', brief: `<p>你的反相器已經放進零件箱了。完成的晶片都會變成可以重複使用的零件。</p><p>做出 <b>AND</b>：只有當 <code>a</code> 和 <code>b</code> 都是 1 時，<code>out</code> 才是 1。</p>`,
        hints: ['NAND 就是「不是 AND」。', '把 NAND 的輸出反相。'] },
      or: { title: '其中之一', brief: `<p>做出 <b>OR</b>：當 <code>a</code>、<code>b</code> 或兩者都是 1 時，<code>out</code> 是 1。</p>`,
        hints: ['OR 什麼時候是 0？只有兩個輸入都是 0 時，也就是兩個反相後的輸入都是 1 時。', '把兩個反相後的輸入接到 NAND（笛摩根定律）。'] },
      xor: { title: '二選一', brief: `<p>做出 <b>XOR</b>（互斥或）：當兩個輸入<i>不同</i>時，<code>out</code> 是 1。</p><p>用你手上的閘就做得出來。最好的做法只用 4 個 NAND。</p>`,
        hints: ['XOR = (a OR b) AND NOT (a AND b)。', '4 個 NAND 的版本：n = NAND(a,b)；out = NAND(NAND(a,n), NAND(b,n))。'] },
      mux: { title: '切換器', brief: `<p><b>多工器</b>會從輸入中挑一個。<code>sel</code> 是 0 時，<code>out</code> 複製 <code>a</code>；是 1 時，複製 <code>b</code>。</p>`,
        hints: ['sel = 0 時讓 a 通過，sel = 1 時讓 b 通過，再把兩者合起來。', '(a AND NOT sel) OR (b AND sel)。用 4 個 NAND 就做得到。'] },
      demux: { title: '分配器', brief: `<p>切換器的反向版本。<b>解多工器</b>在 <code>sel</code> 是 0 時把 <code>in</code> 送到 <code>a</code>，是 1 時送到 <code>b</code>。另一個輸出保持 0。</p>`,
        hints: ['每個輸出都是一個 AND。', 'a = in AND NOT sel；b = in AND sel。'] },
      mux8: { title: '匯流排切換器', brief: `<p>粗線是<b>匯流排</b>，一次傳送 8 個位元。這裡的 <code>a</code>、<code>b</code> 和 <code>out</code> 都是位元組。</p>
<p>新技巧：<b>通道</b>。選取任何接腳都是單線的晶片，把通道數設成 8，就會得到 8 個並排的複本，逐位元處理整條匯流排。</p>
<p>新零件：<b>扇出</b>會把一條線複製到匯流排的 8 條線上。</p>`,
        hints: ['放一個 MUX，選取它，把通道數設成 8。', '有通道的 MUX 也需要 8 位元的 sel。把 1 位元的 sel 扇出到 8 條線。'] },
      half: { title: '半加器', brief: `<p>把兩個位元相加。0+0 = 0，0+1 = 1，1+1 = 二進位的 <b>10</b>，也就是和為 0、進位為 1。</p>`,
        hints: ['看看真值表裡「和」那一欄。那個閘你已經做過了。', 'sum = XOR，carry = AND。'] },
      full: { title: '全加器', brief: `<p>把<i>三個</i>位元相加：<code>a</code>、<code>b</code>，以及從右邊那一欄進位過來的 <code>c</code>。答案是 0 到 3，剛好放得進和與進位。</p>`,
        hints: ['先加兩個位元，再把第三個加到結果上。', '兩個半加器。只要其中一個有進位，進位就是 1。'] },
      add8: { title: '位元組加法器', brief: `<p>把兩個位元組相加，就像在紙上算加法：由右到左，一邊算一邊進位。</p>
<p>新零件：<b>分線</b>把匯流排拆成一條條線（輸出 0 = 第 0 位元，最低位）。<b>合線</b>把線再綁回匯流排。<b>常數</b>是固定的值。你可以在檢視器裡調整它們的寬度。</p>`,
        hints: ['把 a 和 b 拆成位元。串起 8 個全加器，每個的進位接到上一位。', '第 0 位元用 cin 當進位輸入。最後的進位輸出就是 cout。'] },
      addsub: { title: '加或減', brief: `<p><code>sub</code> 是 1 時，輸出 <code>a − b</code>；否則輸出 <code>a + b</code>。結果會在 256 處繞回：3 − 5 = 254。</p>
<p>訣竅是二補數：<code>−b</code> 等於 <code>(NOT b) + 1</code>。</p>`,
        hints: ['和 1 做 XOR 會翻轉位元，和 0 做 XOR 則保持不變。有通道的 XOR 可以只在 sub 是 1 時翻轉 b。', '把 b XOR fan(sub) 接進你的加法器，並讓 cin = sub。'] },
      zero: { title: '零偵測器', brief: `<p>當 <code>in</code> 的 8 個位元全是 0 時，輸出 1。CPU 會用它來決定何時跳躍。</p>`,
        hints: ['把所有位元 OR 起來，再反相。', 'OR 組成的樹（4、2、1）比一條長鏈的延遲更短。'] },
      mux4: { title: '四路切換器', brief: `<p>用 2 位元的 <code>sel</code> 從四個位元組中挑一個：0 → a、1 → b、2 → c、3 → d。</p>`,
        hints: ['用 sel 的第 0 位元在每一對裡挑，用第 1 位元在兩對之間挑。', '三個匯流排切換器組成一棵小樹。'] },
      alu: { title: 'ALU', brief: `<p>算術邏輯單元是 CPU 核心裡的計算機。<code>op</code> 決定它要算什麼：</p>
<table class="ops"><tr><td>0</td><td>x</td><td>4</td><td>x AND y</td></tr><tr><td>1</td><td>y</td><td>5</td><td>x OR y</td></tr><tr><td>2</td><td>x + y</td><td>6</td><td>x XOR y</td></tr><tr><td>3</td><td>x − y</td><td>7</td><td>x 左移 1 位</td></tr></table>
<p>「左移」會把每個位元往上移一位，所以第 7 位元會掉出去，第 0 位元變成 0。</p>`,
        hints: ['一次把八個答案都算出來，再用 op 選一個。', '移位只是接線：把 x 拆開，再往上錯一位接回去，最低位補 0。', '兩個四路切換器用 op 的第 0–1 位元挑選，再用 op 第 2 位元的匯流排切換器在兩者之間挑。sub = op 第 0 位元的加減法器同時涵蓋 2 和 3。'] },
      srlatch: { title: '設定與重設', brief: `<p>到目前為止，每個輸出都只取決於當下的輸入。是時候讓電路<b>記住</b>東西了。</p>
<p><code>set</code> 上的脈衝讓 <code>q</code> 變成 1，<code>reset</code> 上的脈衝讓它變成 0。兩者都是 0 時，<code>q</code> 保持原本的值。（兩者都是 1 不會被測試。）</p>
<p>這是第一次你可以接出迴圈：一個閘的輸出可以回接到前面的閘。</p>`,
        hints: ['把 q 回接到計算 q 的電路裡。', 'q = set OR (q AND NOT reset)。也可以用經典的一對交叉耦合 NAND，輸入先反相。'] },
      dlatch: { title: '資料鎖存器', brief: `<p>更乾淨的記憶方式。<code>en</code>（致能）是 1 時，<code>q</code> 跟著 <code>d</code> 變；<code>en</code> 掉到 0 時，<code>q</code> 保持最後的值。</p>`,
        hints: ['你的 SR 鎖存器會記住東西，你只需要想清楚何時設定、何時重設。', 'set = d AND en，reset = NOT d AND en。'] },
      dff: { title: '正反器', brief: `<p>鎖存器在 <code>en</code> 為高的整段時間都是透通的，這太久了。電腦需要只在某個精確瞬間改變的零件：時脈的<b>上升邊緣</b>。</p>
<p>做出一個<b>正反器</b>。當 <code>clk</code> 從 0 變成 1 時，<code>q</code> 取得 <code>d</code> 的值。其他任何時刻，不管 <code>d</code> 怎麼變，<code>q</code> 都保持不動。</p>
<p class="how">過了這關之後，時脈會自動幫你接好。按下<b>時脈</b>時，所有記憶零件會一起前進一拍。</p>`,
        hints: ['用兩個串在一起的鎖存器：一個主、一個從。', 'clk 是 0 時主鎖存器打開，clk 是 1 時從鎖存器打開，所以從鎖存器只會看到主鎖存器已經鎖住的值。'] },
      bit: { title: '一個位元', brief: `<p>你的正反器（現在叫 <b>DFF</b>，時脈已內建）每一拍都會複製輸入。真正的記憶單元應該只在被要求時才改變。</p>
<p>每一拍：如果 <code>load</code> 是 1，就存入 <code>in</code>；否則保留舊值。<code>out</code> 永遠是存著的值。</p>`,
        hints: ['DFF 每一拍都一定會存東西，你要決定存的是什麼。', '用 MUX 餵 DFF：舊值（它自己的輸出）或新值（in），由 load 選擇。'] },
      reg: { title: '暫存器', brief: `<p>八個一起載入的位元：<b>暫存器</b>。規則和「一個位元」一樣，只是換成整個位元組。</p>`,
        hints: ['通道也適用於記憶晶片。', '一個 8 通道的 BIT，再把 load 扇出到全部通道。'] },
      counter: { title: '計數器', brief: `<p>CPU 用<b>計數器</b>記住自己在程式裡的位置。每一拍，第一條成立的規則勝出：</p>
<ol><li><code>reset</code> → 0</li><li><code>load</code> → <code>in</code></li><li><code>inc</code> → out + 1（255 會繞回 0）</li><li>否則保持不變</li></ol>`,
        hints: ['從一個每拍都載入的暫存器開始，決定要餵什麼進去。', '串起幾個匯流排切換器：依 inc 選保持或 +1，再依 load 選那個或 in，再依 reset 選那個或 0。b = 1 的加法器負責 +1。'] },
      decoder: { title: '解碼器', brief: `<p>把 3 位元的數字變成 <b>one-hot</b> 位元組。<code>out</code> 只有一個位元是 1：第 <code>sel</code> 位元。例如 sel = 5 會得到 00100000。</p>`,
        hints: ['每個輸出位元都是三條線的 AND：每個 sel 位元本身或它的反相。', '或者：一棵 DEMUX 樹。用 sel 第 2、1、0 位元依序分配常數 1。'] },
      ram8: { title: 'RAM', brief: `<p>八個暫存器加上一個位址。<code>out</code> 永遠顯示第 <code>addr</code> 號暫存器。在 <code>load</code> = 1 的那一拍，<code>in</code> 只會寫進那一個暫存器。</p>
<p>完成的電腦會用 256 位元組這種記憶體。你做好 8 個之後，我們會幫你疊 32 組。</p>`,
        hints: ['寫入：解碼器選出一個暫存器，所以把它的輸出和 load 做 AND。', '讀取：兩個四路切換器加一個匯流排切換器，用 addr 的位元來選。'] },
      control: { title: '控制單元', brief: `<p>每道指令有 16 位元。低位元組是數字 <b>k</b>，高位元組 <code>ctl</code> 說明要拿它做什麼：</p>
<table class="bits"><tr><th>7</th><th>6</th><th>5 4 3</th><th>2</th><th>1</th><th>0</th></tr><tr><td>m</td><td>p</td><td>op</td><td>s</td><td>t</td><td>j</td></tr></table>
<p>把 m、p、s、t 直接傳出，分別成為 <code>ymem</code>、<code>pmode</code>、<code>store</code> 和 <code>setp</code>。</p>
<p>如果 <b>j</b> 是 0：<code>op</code> = op，<code>jump</code> = 0。<br>如果 <b>j</b> 是 1，這是一道跳躍指令。<code>op</code> 必須是 0（不動 A），三個 op 位元變成對累加器 <code>a</code>（視為有號數）的條件：第 5 位元 =「負數時跳」、第 4 位元 =「零時跳」、第 3 位元 =「正數時跳」。只要有任何啟用的條件成立，<code>jump</code> 就是 1。</p>`,
        hints: ['負數 = a 的第 7 位元。零 = 你的零偵測器。正數 = 兩者皆非。', 'jump = j AND ((op2 AND neg) OR (op1 AND zero) OR (op0 AND pos))。要在跳躍時讓 op 變 0，就把它和扇出後的 NOT j 做 AND。'] },
      cpu: { title: 'CPU', brief: `<p>重頭戲來了。你的 CPU 有三個暫存器：<b>A</b>（累加器）、<b>P</b>（指標），以及程式計數器 <b>PC</b>。</p>
<p>每一拍執行一道指令，<code>instr</code> = ROM[PC]。把它拆成 ctl 和 k，再把 ctl 餵給你的控制單元。然後：</p>
<ul><li><code>addr</code> = pmode ? P : k。記憶體會在 <code>data</code> 上回應。</li>
<li>Y = ymem ? data : k</li>
<li>每一拍 A ← ALU(op, A, Y)（op 0 會保留 A）</li>
<li><code>out</code> = A、<code>write</code> = store，讓記憶體能把 A 存到 addr</li>
<li>setp 時 P ← A</li>
<li>jump 時 PC ← k，否則 PC + 1。<code>reset</code> 把 PC 設為 0。</li></ul>`,
        hints: ['你需要兩個暫存器（A、P）、一個計數器（PC）、ALU、控制單元和兩個匯流排切換器。', 'PC 計數器：in = k、load = jump、inc = 1、reset = reset。A 每一拍都從 ALU 載入。', '上面清單裡的每個箭頭都是一條線或一個匯流排切換器。一行一行做。'] },
      computer: { title: '電腦', brief: `<p>最後一段接線。把你的 <b>CPU</b> 接到存放程式的 <b>ROM</b>，以及存放資料的 <b>RAM 256</b>。</p>
<ul><li>CPU.pc → ROM.addr，ROM.data → CPU.instr</li><li>CPU.addr → RAM.addr、CPU.out → RAM.in、CPU.write → RAM.load</li><li>RAM.out → CPU.data</li></ul>
<p>測試會在你的機器上跑一支真正的程式。</p>`,
        hints: ['七條線，再加上 reset 和 pc。', '如果測試能跑但數字不對，檢查有沒有把 RAM.in 和 RAM.addr 接反。'] },
      'p-sum': { title: '三角形數', brief: `<p>你的電腦能動了，現在它需要軟體。用 <b>G8 組合語言</b>寫程式，它就會在你親手接線的 CPU 上執行。</p>
<p>RAM[0] 存著 <b>n</b>。把 <b>1 + 2 + … + n</b>（mod 256）存到 RAM[1]，然後停機。</p>`,
        hints: ['要讓 n 減一：LDA n、SUB #1、STA n。', 'STA n 之後，跳回迴圈開頭。'] },
      'p-mul': { title: '乘法', brief: `<p>ALU 不會乘法，但你會。把 <b>RAM[0] × RAM[1]</b>（mod 256）存到 RAM[2]。</p><p>重複加法可以做到。移位相加（紙上直式乘法的方法）快得多，而你的分數會計算週期數。</p>`,
        hints: ['重複加法：把 x 加到 out 上 y 次，同時讓 y 倒數到 0。', '移位相加：從最低位開始，對 y 的每個位元，如果 (y AND bit) ≠ 0 就 out += x。然後把 x 和 bit 都加倍（SHL）。'] },
      'p-x': { title: '畫一個 X', brief: `<p>螢幕是 16×16 像素，對應到 RAM 0xE0–0xFF。每一列是兩個位元組，左半在前，每個位元組的最高位元是最左邊的像素。把 0x80 寫到 0xE0 會點亮左上角的像素。</p>
<p>畫出兩條對角線：一個橫跨整個螢幕的 <b>X</b>，然後停機。指令越少分數越好，迴圈勝過 32 次存入。</p>`,
        hints: ['在 RAM 裡放一個指標。LDA ptr 再 TAP，之後 STA [P] 就會寫到 ptr 指向的位置。', '第 0–7 列的左位元組每列往下移一個位元。SHL 是往上移，所以你可以從第 7 列（0x01）開始往上，或者用一串查表式的存入。', '第 r 列和第 15−r 列互為鏡像。一個迴圈就能同時填好兩列。'] },
      'p-free': { title: '自由遊玩', brief: `<p>沒有測試，也沒有分數。這是你的電腦：想跑什麼就跑什麼。</p>
<p>範例是一個畫畫板。按 <b>▶ 執行</b>，再用方向按鈕（或在編輯器沒有焦點時用鍵盤方向鍵）畫畫。<b>A</b>（或 Z）清除螢幕。</p>
<p>點子：一顆彈跳的像素、輸出埠上的計數器，或者有膽的話，在 16×16 上跑康威生命遊戲。</p>` },
    },
  },
  ja: {
    chapters: {
      logic: { title: 'I · 論理', blurb: '部品箱にはゲートが 1 種類だけ。それを何種類にも増やそう。' },
      arith: { title: 'II · 算術', blurb: '配線に数え方を教えよう。' },
      memory: { title: 'III · 記憶', blurb: '覚えるループ。' },
      computer: { title: 'IV · コンピュータ', blurb: 'すべてを組み合わせよう。' },
      programs: { title: 'V · プログラム', blurb: '自分で作ったマシンでコードを動かそう。' },
    },
    levels: {
      not: { title: 'インバータ', brief: `<p>鋳造所へようこそ。ここにある唯一の機械は <b>NAND</b> ゲートしか作れません。出力が 0 になるのは、入力が<i>両方</i> 1 のときだけです。</p>
<p><b>インバータ</b>を作りましょう。<code>out</code> は <code>a</code> の反対の値です。</p>
<p class="how">部品箱から NAND をボードにドラッグします。ピンからピンへドラッグすると配線できます。入力をクリックすると値が切り替わります。最後に<b>テスト</b>を押しましょう。</p>`,
        hints: ['2 つの入力をつないだ NAND には、00 か 11 しか入りません。', 'a を NAND の両方の入力につなぎましょう。'] },
      and: { title: '両方', brief: `<p>インバータは部品箱に入りました。完成したチップは再利用できる部品になります。</p><p><b>AND</b> を作りましょう。<code>out</code> が 1 になるのは、<code>a</code> と <code>b</code> が両方 1 のときだけです。</p>`,
        hints: ['NAND は「AND ではない」。', 'NAND の出力を反転しましょう。'] },
      or: { title: 'どちらか', brief: `<p><b>OR</b> を作りましょう。<code>a</code>、<code>b</code>、またはその両方が 1 のとき、<code>out</code> は 1 です。</p>`,
        hints: ['OR が 0 になるのはいつ？両方の入力が 0 のとき、つまり反転した入力が両方 1 のときだけです。', '反転した 2 つの入力を NAND に入れましょう（ド・モルガンの法則）。'] },
      xor: { title: 'どちらか一方', brief: `<p><b>XOR</b>（排他的論理和）を作りましょう。入力が<i>異なる</i>とき、<code>out</code> は 1 です。</p><p>手持ちのゲートで作れます。ベストな回路は NAND 4 個だけで作れます。</p>`,
        hints: ['XOR = (a OR b) AND NOT (a AND b)。', 'NAND 4 個版：n = NAND(a,b)、out = NAND(NAND(a,n), NAND(b,n))。'] },
      mux: { title: 'スイッチ', brief: `<p><b>マルチプレクサ</b>は入力のどれかを選びます。<code>sel</code> が 0 なら <code>out</code> は <code>a</code> を、1 なら <code>b</code> をコピーします。</p>`,
        hints: ['sel = 0 なら a を通し、sel = 1 なら b を通して、2 つを合わせましょう。', '(a AND NOT sel) OR (b AND sel)。NAND 4 個で作れます。'] },
      demux: { title: 'ルーター', brief: `<p>スイッチの逆です。<b>デマルチプレクサ</b>は <code>sel</code> が 0 なら <code>in</code> を <code>a</code> に、1 なら <code>b</code> に送ります。もう一方の出力は 0 のままです。</p>`,
        hints: ['どちらの出力も AND です。', 'a = in AND NOT sel、b = in AND sel。'] },
      mux8: { title: 'バススイッチ', brief: `<p>太い線は<b>バス</b>で、8 ビットを一度に運びます。ここでは <code>a</code>、<code>b</code>、<code>out</code> がバイトです。</p>
<p>新しい技：<b>レーン</b>。ピンがすべて 1 本線のチップを選び、レーン数を 8 にすると、8 つのコピーが横に並び、バス全体をビットごとに処理します。</p>
<p>新しい部品：<b>ファン</b>は 1 本の線をバスの 8 本すべてにコピーします。</p>`,
        hints: ['MUX を置いて選択し、レーン数を 8 にしましょう。', 'レーン付き MUX は 8 ビットの sel も必要です。1 ビットの sel を 8 本にファンアウトしましょう。'] },
      half: { title: '半加算器', brief: `<p>2 ビットを足します。0+0 = 0、0+1 = 1、1+1 = 2 進数の <b>10</b>、つまり和 0・桁上げ 1 です。</p>`,
        hints: ['真理値表の「和」の列を見てください。そのゲートはもう作りました。', 'sum = XOR、carry = AND。'] },
      full: { title: '全加算器', brief: `<p><i>3 つ</i>のビットを足します。<code>a</code>、<code>b</code>、そして右の桁からの桁上げ <code>c</code> です。答えは 0〜3 なので、和と桁上げに収まります。</p>`,
        hints: ['2 ビットを足し、その結果に 3 つ目を足しましょう。', '半加算器 2 つ。どちらかが桁上げしたら、桁上げは 1 です。'] },
      add8: { title: 'バイト加算器', brief: `<p>紙の上でやるのと同じように 2 バイトを足します。右から左へ、桁上げしながら。</p>
<p>新しい部品：<b>スプリット</b>はバスを 1 本ずつの線に分けます（出力 0 = ビット 0、最下位）。<b>ジョイン</b>は線をまたバスに束ねます。<b>定数</b>は固定値です。幅はインスペクタで変更できます。</p>`,
        hints: ['a と b をビットに分け、全加算器を 8 個つなぎ、それぞれの桁上げを 1 つ上の桁に送りましょう。', 'ビット 0 は cin を桁上げ入力にします。最後の桁上げ出力が cout です。'] },
      addsub: { title: '足し算か引き算', brief: `<p><code>sub</code> が 1 なら <code>a − b</code> を、そうでなければ <code>a + b</code> を出力します。結果は 256 で一周します：3 − 5 = 254。</p>
<p>コツは 2 の補数です。<code>−b</code> は <code>(NOT b) + 1</code> と同じです。</p>`,
        hints: ['1 と XOR するとビットが反転し、0 と XOR すると変わりません。レーン付き XOR なら sub が 1 のときだけ b を反転できます。', 'b XOR fan(sub) を加算器に入れ、cin = sub にしましょう。'] },
      zero: { title: 'ゼロ検出器', brief: `<p><code>in</code> の 8 ビットがすべて 0 のときだけ 1 を出力します。CPU はこれを使ってジャンプするかどうかを決めます。</p>`,
        hints: ['全ビットを OR して、反転しましょう。', 'OR のツリー（4 → 2 → 1）は、1 列につなぐより遅延が小さくなります。'] },
      mux4: { title: '4 方向スイッチ', brief: `<p>2 ビットの <code>sel</code> で 4 つのバイトから 1 つを選びます：0 → a、1 → b、2 → c、3 → d。</p>`,
        hints: ['sel のビット 0 で各ペアの中から選び、ビット 1 でペアどうしを選びましょう。', 'バススイッチ 3 つで小さなツリーを作りましょう。'] },
      alu: { title: 'ALU', brief: `<p>算術論理演算装置は CPU の中心にある計算機です。<code>op</code> で何を計算するかを選びます：</p>
<table class="ops"><tr><td>0</td><td>x</td><td>4</td><td>x AND y</td></tr><tr><td>1</td><td>y</td><td>5</td><td>x OR y</td></tr><tr><td>2</td><td>x + y</td><td>6</td><td>x XOR y</td></tr><tr><td>3</td><td>x − y</td><td>7</td><td>x を 1 ビット左シフト</td></tr></table>
<p>「左シフト」はすべてのビットを 1 つ上に動かすので、ビット 7 はこぼれ落ち、ビット 0 は 0 になります。</p>`,
        hints: ['8 つの答えを全部同時に計算して、op で 1 つを選びましょう。', 'シフトはただの配線です。x を分けて、1 つ上にずらして束ね直し、最下位に 0 を入れます。', 'op のビット 0–1 で選ぶ 4 方向スイッチを 2 つ、op のビット 2 でその間を選ぶバススイッチを 1 つ。sub = op ビット 0 の加減算器で 2 と 3 をまとめて扱えます。'] },
      srlatch: { title: 'セットとリセット', brief: `<p>これまでの出力はすべて、その瞬間の入力だけで決まっていました。そろそろ<b>覚える</b>ときです。</p>
<p><code>set</code> にパルスが来ると <code>q</code> は 1 に、<code>reset</code> にパルスが来ると 0 になります。両方 0 のとき、<code>q</code> は元の値を保ちます。（両方 1 はテストされません。）</p>
<p>初めてループを配線できます。ゲートの出力を前のゲートに戻してかまいません。</p>`,
        hints: ['q を、q を計算する回路に戻しましょう。', 'q = set OR (q AND NOT reset)。入力を反転した、たすき掛けの NAND ペアという定番の形でも作れます。'] },
      dlatch: { title: 'データラッチ', brief: `<p>もっときれいな記憶の仕方です。<code>en</code>（イネーブル）が 1 の間、<code>q</code> は <code>d</code> に従います。<code>en</code> が 0 に落ちると、<code>q</code> は最後の値を保ちます。</p>`,
        hints: ['SR ラッチは記憶できます。いつセットし、いつリセットするかを決めるだけです。', 'set = d AND en、reset = NOT d AND en。'] },
      dff: { title: 'フリップフロップ', brief: `<p>ラッチは <code>en</code> が High の間ずっと素通しで、それでは長すぎます。コンピュータには、ある一瞬だけ変化する部品が必要です。クロックの<b>立ち上がりエッジ</b>です。</p>
<p><b>フリップフロップ</b>を作りましょう。<code>clk</code> が 0 から 1 になった瞬間、<code>q</code> は <code>d</code> の値を取り込みます。それ以外の瞬間は、<code>d</code> がどう変わっても <code>q</code> は動きません。</p>
<p class="how">このレベルのあとは、クロックが自動で配線されます。<b>クロック</b>を押すと、すべての記憶部品がそろって 1 拍進みます。</p>`,
        hints: ['ラッチを 2 つ直列に並べましょう。リーダーとフォロワーです。', 'リーダーは clk が 0 の間、フォロワーは clk が 1 の間開いているので、フォロワーにはリーダーがロック済みの値しか見えません。'] },
      bit: { title: '1 ビット', brief: `<p>フリップフロップ（今は <b>DFF</b>、クロック内蔵）は毎拍、入力をコピーします。本物の記憶セルは、指示されたときだけ変わるべきです。</p>
<p>毎拍：<code>load</code> が 1 なら <code>in</code> を記憶し、そうでなければ古い値を保ちます。<code>out</code> は常に記憶している値です。</p>`,
        hints: ['DFF は毎拍必ず何かを記憶します。何を記憶させるかを選びましょう。', 'DFF に MUX から入力しましょう。古い値（自分の出力）か新しい値（in）を、load で選びます。'] },
      reg: { title: 'レジスタ', brief: `<p>8 ビットをまとめて読み込む<b>レジスタ</b>です。ルールは「1 ビット」と同じで、バイト全体に適用します。</p>`,
        hints: ['レーンは記憶チップにも使えます。', 'レーン数 8 の BIT と、全レーンにファンアウトした load。'] },
      counter: { title: 'カウンタ', brief: `<p>CPU は<b>カウンタ</b>でプログラムのどこにいるかを覚えています。毎拍、最初に当てはまるルールが優先されます：</p>
<ol><li><code>reset</code> → 0</li><li><code>load</code> → <code>in</code></li><li><code>inc</code> → out + 1（255 の次は 0）</li><li>それ以外は保持</li></ol>`,
        hints: ['毎拍読み込むレジスタから始めて、何を入れるかを選びましょう。', 'バススイッチを連ねます：inc で保持か +1、load でそれか in、reset でそれか 0。b = 1 の加算器が +1 を担当します。'] },
      decoder: { title: 'デコーダ', brief: `<p>3 ビットの数を <b>one-hot</b> のバイトに変えます。<code>out</code> はちょうど 1 ビットだけが 1 で、それは <code>sel</code> 番目のビットです。たとえば sel = 5 なら 00100000 です。</p>`,
        hints: ['各出力ビットは 3 本の線の AND です。sel の各ビットか、その反転を使います。', 'または DEMUX のツリー。定数 1 を sel のビット 2、1、0 の順に振り分けます。'] },
      ram8: { title: 'RAM', brief: `<p>8 つのレジスタとアドレスです。<code>out</code> には常に <code>addr</code> 番のレジスタが表示されます。<code>load</code> = 1 の拍では、<code>in</code> はそのレジスタにだけ書き込まれます。</p>
<p>完成したコンピュータはこれを 256 バイト使います。8 個作れたら、あとは 32 組積み重ねておきます。</p>`,
        hints: ['書き込み：デコーダがレジスタを 1 つ選ぶので、その出力と load を AND しましょう。', '読み出し：4 方向スイッチ 2 つとバススイッチ 1 つを、addr のビットで選びます。'] },
      control: { title: '制御ユニット', brief: `<p>命令は 16 ビットです。下位バイトは数値 <b>k</b>。上位バイト <code>ctl</code> は、それをどう使うかを表します：</p>
<table class="bits"><tr><th>7</th><th>6</th><th>5 4 3</th><th>2</th><th>1</th><th>0</th></tr><tr><td>m</td><td>p</td><td>op</td><td>s</td><td>t</td><td>j</td></tr></table>
<p>m、p、s、t はそのまま <code>ymem</code>、<code>pmode</code>、<code>store</code>、<code>setp</code> として出力します。</p>
<p><b>j</b> が 0 なら：<code>op</code> = op、<code>jump</code> = 0。<br><b>j</b> が 1 ならジャンプ命令です。<code>op</code> は 0（A はそのまま）にし、3 つの op ビットは、符号付きとして読んだアキュムレータ <code>a</code> に対する条件になります：ビット 5 =「負ならジャンプ」、ビット 4 =「ゼロなら」、ビット 3 =「正なら」。有効な条件のどれかが成り立てば <code>jump</code> は 1 です。</p>`,
        hints: ['負 = a のビット 7。ゼロ = ゼロ検出器。正 = どちらでもない。', 'jump = j AND ((op2 AND neg) OR (op1 AND zero) OR (op0 AND pos))。ジャンプ時に op を 0 にするには、ファンアウトした NOT j と AND します。'] },
      cpu: { title: 'CPU', brief: `<p>いよいよ本番です。CPU には 3 つのレジスタがあります：<b>A</b>（アキュムレータ）、<b>P</b>（ポインタ）、そしてプログラムカウンタ <b>PC</b>。</p>
<p>毎拍 1 命令を実行します。<code>instr</code> = ROM[PC]。それを ctl と k に分け、ctl を制御ユニットに入れます。そして：</p>
<ul><li><code>addr</code> = pmode ? P : k。メモリは <code>data</code> で答えます。</li>
<li>Y = ymem ? data : k</li>
<li>毎拍 A ← ALU(op, A, Y)（op 0 は A を保持）</li>
<li><code>out</code> = A、<code>write</code> = store で、メモリが A を addr に保存できるようにする</li>
<li>setp のとき P ← A</li>
<li>jump なら PC ← k、そうでなければ PC + 1。<code>reset</code> で PC を 0 にする。</li></ul>`,
        hints: ['必要なのはレジスタ 2 つ（A、P）、カウンタ 1 つ（PC）、ALU、制御ユニット、バススイッチ 2 つです。', 'PC カウンタ：in = k、load = jump、inc = 1、reset = reset。A は毎拍 ALU から読み込みます。', '上のリストの矢印はそれぞれ 1 本の線か 1 つのバススイッチです。1 行ずつ作りましょう。'] },
      computer: { title: 'コンピュータ', brief: `<p>最後の配線です。<b>CPU</b> を、プログラムを入れる <b>ROM</b> と、データを入れる <b>RAM 256</b> につなぎましょう。</p>
<ul><li>CPU.pc → ROM.addr、ROM.data → CPU.instr</li><li>CPU.addr → RAM.addr、CPU.out → RAM.in、CPU.write → RAM.load</li><li>RAM.out → CPU.data</li></ul>
<p>テストでは、あなたのマシンで本物のプログラムを動かします。</p>`,
        hints: ['線 7 本と、reset と pc。', 'テストは動くのに数字がおかしいなら、RAM.in と RAM.addr を逆につないでいないか確認しましょう。'] },
      'p-sum': { title: '三角数', brief: `<p>コンピュータが動いたので、次はソフトウェアです。<b>G8 アセンブリ</b>でプログラムを書けば、あなたが配線した CPU で動きます。</p>
<p>RAM[0] には <b>n</b> が入っています。<b>1 + 2 + … + n</b>（mod 256）を RAM[1] に保存して、停止しましょう。</p>`,
        hints: ['n を 1 減らすには：LDA n、SUB #1、STA n。', 'STA n のあと、ループの先頭へジャンプします。'] },
      'p-mul': { title: '掛け算', brief: `<p>ALU は掛け算ができませんが、あなたならできます。<b>RAM[0] × RAM[1]</b>（mod 256）を RAM[2] に保存しましょう。</p><p>足し算の繰り返しでも作れます。シフトと加算（筆算の掛け算の方法）のほうがずっと速く、スコアはサイクル数で決まります。</p>`,
        hints: ['足し算の繰り返し：y を 0 まで数え下げながら、x を out に y 回足します。', 'シフトと加算：最下位から y の各ビットについて、(y AND bit) ≠ 0 なら out += x。そして x と bit を 2 倍にします（SHL）。'] },
      'p-x': { title: 'X を描く', brief: `<p>画面は 16×16 ピクセルで、RAM の 0xE0–0xFF に対応しています。各行は 2 バイトで左半分が先、各バイトの最上位ビットが一番左のピクセルです。0xE0 に 0x80 を書くと左上のピクセルが点きます。</p>
<p>画面いっぱいに 2 本の対角線、つまり <b>X</b> を描いて停止しましょう。命令が少ないほど高得点で、ループは 32 回のストアに勝ります。</p>`,
        hints: ['RAM にポインタを置きましょう。LDA ptr のあと TAP すれば、STA [P] は ptr が指す場所に書き込みます。', '0–7 行目の左バイトは、1 行ごとに 1 ビットずつ下がります。SHL は上へのシフトなので、7 行目（0x01）から上に向かうか、ストアを並べた表引きを使いましょう。', 'r 行目と 15−r 行目は鏡像です。1 つのループで両方を埋められます。'] },
      'p-free': { title: 'フリープレイ', brief: `<p>テストもスコアもありません。あなたのコンピュータです。好きなものを動かしましょう。</p>
<p>デモはお絵かきボードです。<b>▶ 実行</b>を押し、矢印ボタン（エディタにフォーカスがないときはキーボードの矢印キー）で描きます。<b>A</b>（または Z）で画面を消します。</p>
<p>アイデア：跳ねるピクセル、出力ポートのカウンタ、勇気があれば 16×16 のライフゲーム。</p>` },
    },
  },
};
