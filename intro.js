/* YOU vs WHO — "THE FINAL" scroll-driven cinematic.
   Scroll drives a WOD clock 00:00 → finish, over real footage, with code-drawn
   whiteboard, lane HUD, AI judge overlay and an UPSET ending.
   First visit: full version. Later visits: ~3 s opening. Replay: YVWINTRO.play({force:true}). */
(function () {
  var KEY = "yvw_intro_seen_v2";
  var VID = { hi: "assets/intro_1080.mp4", lo: "assets/intro_720.mp4" };
  // video timeline (seconds)
  var T = { lanes: 0, go: 7.3, row: 7.3, jerk: 11.07, mu: 15.2, hands: 19.75, drop: 21.63, fall: 22.18, end: 24.58 };
  var FINISH_YOU = 707, FINISH_WHO = 712; // 11:47 vs 11:52
  // progress layout
  var P0 = 0.12, P1 = 0.86; // board until P0, footage P0..P1, result after P1
  // approximate joints for the jerk shot (normalised, from frame study) — t is seconds into the shot
  var JK = [
    [0.0, [[.525, .33], [.45, .39], [.596, .39], [.422, .30], [.624, .304], [.405, .21], [.639, .224], [.478, .66], [.568, .66], [.463, .84], [.596, .85], [.456, .98], [.621, .976]]],
    [0.7, [[.521, .37], [.451, .46], [.597, .46], [.395, .52], [.642, .52], [.40, .37], [.64, .37], [.474, .72], [.569, .72], [.462, .86], [.592, .88], [.462, .98], [.62, .97]]],
    [1.4, [[.523, .38], [.461, .47], [.585, .47], [.396, .49], [.65, .49], [.402, .39], [.641, .39], [.478, .73], [.568, .73], [.463, .88], [.596, .90], [.459, .984], [.607, .984]]],
    [2.1, [[.519, .28], [.451, .36], [.592, .36], [.395, .36], [.648, .36], [.40, .23], [.64, .236], [.468, .60], [.564, .60], [.468, .82], [.569, .82], [.462, .98], [.564, .98]]],
    [2.8, [[.529, .28], [.456, .36], [.602, .36], [.411, .36], [.661, .35], [.405, .236], [.65, .236], [.484, .60], [.568, .60], [.478, .83], [.568, .83], [.461, .98], [.557, .98]]],
    [3.5, [[.519, .28], [.451, .36], [.592, .36], [.391, .37], [.65, .37], [.398, .256], [.646, .256], [.468, .60], [.564, .60], [.468, .82], [.569, .82], [.462, .99], [.564, .99]]],
    [4.13, [[.523, .28], [.45, .37], [.596, .37], [.388, .38], [.658, .38], [.394, .236], [.643, .236], [.478, .61], [.568, .61], [.472, .84], [.562, .84], [.467, .99], [.557, .99]]]
  ];
  var BONES = [[1, 2], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [7, 8], [7, 9], [9, 11], [8, 10], [10, 12], [0, 1], [0, 2]];

  var css = "\
#yvi{position:fixed;inset:0;z-index:9999;background:#050506;color:#f3f1ec;font-family:'Noto Sans KR',system-ui,sans-serif;overflow:hidden}\
#yvi .stg{position:absolute;inset:0}\
#yvi video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s}\
#yvi canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\
#yvi .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(0,0,0,.6) 100%),linear-gradient(180deg,rgba(0,0,0,.55),transparent 18%,transparent 78%,rgba(0,0,0,.7))}\
#yvi .scr{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;z-index:5}\
#yvi .scr::-webkit-scrollbar{display:none}\
#yvi .sp{height:1500vh}\
#yvi .ui{position:absolute;inset:0;z-index:6;pointer-events:none}\
#yvi .ui .on{pointer-events:auto}\
#yvi .board{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#2a2d2c,#121414 70%,#070808);transition:opacity .25s}\
#yvi .board:before{content:'';position:absolute;inset:4vmin;border:1.2vmin solid #3a2a1c;border-radius:1vmin;box-shadow:inset 0 0 8vmin rgba(0,0,0,.7),0 0 0 .4vmin #23170e}\
#yvi .board .wb{position:relative;font-family:'Permanent Marker','Noto Sans KR',cursive;color:#eeeae0;text-align:left;width:min(84vw,980px);text-shadow:0 0 1px rgba(255,255,255,.5)}\
#yvi .wb .ln{white-space:nowrap;overflow:hidden;font-size:clamp(20px,3.6vmin,44px);line-height:1.35;clip-path:inset(0 100% 0 0);opacity:.95}\
#yvi .wb .ttl{font-size:clamp(46px,10vmin,120px);color:#ff4b3e;line-height:1}\
#yvi .wb .sub{font-family:'JetBrains Mono',monospace;font-size:clamp(12px,1.8vmin,18px);color:#b9b5aa;letter-spacing:3px;margin:1vmin 0 3vmin}\
#yvi .wb .y{color:#58aefc}#yvi .wb .r{color:#ff4b3e}\
#yvi .clock{position:absolute;top:3.2vmin;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-weight:700;text-align:center;opacity:0}\
#yvi .clock b{display:block;font-size:clamp(34px,7vmin,84px);letter-spacing:2px;color:#fff;text-shadow:0 0 24px rgba(255,59,48,.55)}\
#yvi .clock span{font-size:clamp(10px,1.4vmin,14px);color:#ff6a60;letter-spacing:4px}\
#yvi .lane{position:absolute;bottom:4.5vmin;width:min(40vw,440px);opacity:0;font-family:'JetBrains Mono',monospace}\
#yvi .lane.l1{left:4vmin}#yvi .lane.l2{right:4vmin;text-align:right}\
#yvi .lane .nm{font-family:Anton,Impact,sans-serif;font-size:clamp(22px,4.2vmin,46px);letter-spacing:1px;line-height:1}\
#yvi .lane.l1 .nm{color:#58aefc}#yvi .lane.l2 .nm{color:#ff4b3e}\
#yvi .lane .meta{font-size:clamp(10px,1.4vmin,13px);color:#cfcbc2;letter-spacing:2px;margin:.6vmin 0}\
#yvi .lane .bar{height:6px;background:rgba(255,255,255,.14);border-radius:3px;overflow:hidden}\
#yvi .lane .bar i{display:block;height:100%;width:0}\
#yvi .lane.l1 .bar i{background:#58aefc}#yvi .lane.l2 .bar i{background:#ff4b3e;margin-left:auto}\
#yvi .lane .mv{font-size:clamp(11px,1.6vmin,15px);margin-top:.6vmin;color:#fff}\
#yvi .cd{position:absolute;inset:0;display:grid;place-items:center;font-family:Anton,Impact,sans-serif;font-size:clamp(120px,34vmin,420px);color:#fff;opacity:0;text-shadow:0 0 60px rgba(255,59,48,.6)}\
#yvi .hud{position:absolute;font-family:'JetBrains Mono',monospace;font-size:clamp(10px,1.45vmin,14px);letter-spacing:1px;background:rgba(5,5,6,.62);border:1px solid rgba(255,255,255,.18);border-left:3px solid #ff3b30;padding:1vmin 1.4vmin;opacity:0;backdrop-filter:blur(6px);line-height:1.6}\
#yvi .hud b{color:#fff;font-size:1.25em}\
#yvi .hud .ok{color:#3ddc84}#yvi .hud .no{color:#ff3b30;font-weight:700}\
#yvi .big{position:absolute;inset:0;display:grid;place-items:center;text-align:center;opacity:0;pointer-events:none}\
#yvi .big h1{font-family:Anton,Impact,sans-serif;font-size:clamp(64px,17vmin,230px);margin:0;line-height:.9;letter-spacing:2px}\
#yvi .big p{font-family:'JetBrains Mono',monospace;letter-spacing:4px;color:#d9d5cc;margin:1.5vmin 0 0;font-size:clamp(11px,1.8vmin,18px)}\
#yvi .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88vw,720px);opacity:0;background:rgba(6,6,8,.78);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px);padding:3vmin 3.4vmin;border-radius:14px}\
#yvi .res h3{margin:0 0 2vmin;font-family:'JetBrains Mono',monospace;font-weight:500;font-size:clamp(11px,1.5vmin,14px);letter-spacing:4px;color:#ff6a60}\
#yvi .res .rw{display:flex;align-items:center;gap:2vmin;padding:1.6vmin 0;border-top:1px solid rgba(255,255,255,.1);font-size:clamp(14px,2.2vmin,22px)}\
#yvi .res .rw .p{font-family:Anton,Impact,sans-serif;font-size:1.6em;width:1.4em}\
#yvi .res .rw .t{margin-left:auto;font-family:'JetBrains Mono',monospace;font-weight:700}\
#yvi .res .rk{font-family:'JetBrains Mono',monospace;font-size:.7em;color:#9a98a3;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:0 .5em;margin-left:.6em}\
#yvi .ups{color:#ff3b30;text-shadow:0 0 80px rgba(255,59,48,.7)}\
#yvi .end{position:absolute;inset:0;display:grid;place-items:center;text-align:center;opacity:0;pointer-events:none}\
#yvi .end h2{font-family:Anton,Impact,sans-serif;font-size:clamp(54px,12vmin,150px);margin:0;line-height:1}\
#yvi .end .btns{display:flex;gap:12px;justify-content:center;margin-top:3vmin;flex-wrap:wrap}\
#yvi .btn{border:0;border-radius:12px;padding:14px 22px;font-weight:700;font-size:16px;cursor:pointer;font-family:inherit}\
#yvi .btn.red{background:#ff3b30;color:#fff}#yvi .btn.gh{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.25)}\
#yvi .skip{position:absolute;top:2.6vmin;right:2.6vmin;font-size:13px;padding:9px 14px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);color:#fff;cursor:pointer;z-index:9}\
#yvi .brand{position:absolute;top:3vmin;left:3vmin;font-family:Anton,Impact,sans-serif;font-size:clamp(16px,2.4vmin,24px);letter-spacing:1px;z-index:9}\
#yvi .brand b:first-child{color:#58aefc}#yvi .brand b:last-child{color:#ff3b30}#yvi .brand i{font-style:normal;color:#9a98a3;font-family:'JetBrains Mono',monospace;font-size:.6em;margin:0 .3em}\
#yvi .hint{position:absolute;bottom:3vmin;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:4px;color:#cfcbc2;text-align:center;transition:opacity .3s}\
#yvi .hint i{display:block;width:1px;height:34px;margin:8px auto 0;background:linear-gradient(#fff,transparent);animation:yvh 1.6s infinite}\
@keyframes yvh{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}\
#yvi .prog{position:absolute;left:0;bottom:0;height:3px;background:#ff3b30;z-index:9;width:0}\
#yvi .load{position:absolute;bottom:3vmin;right:3vmin;font-family:'JetBrains Mono',monospace;font-size:11px;color:#9a98a3;letter-spacing:2px;z-index:9}\
#yvi.short .scr,#yvi.short .hint{display:none}\
#yvi .flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}\
";

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ramp(x, a, b) { return clamp((x - a) / (b - a), 0, 1); }
  function win(x, a, b, f) { f = f || 0.25; return Math.min(ramp(x, a, a + f), 1 - ramp(x, b - f, b)); }
  function mmss(s) { s = Math.max(0, s); var m = Math.floor(s / 60), r = Math.floor(s % 60); return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r; }
  function ease(x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  var root, video, cv, ctx, scr, blobUrl, raf, cur = 0, target = 0, opts = {}, mode = "full", alive = false, srcReady = false, shortT0 = 0;
  var R = {};

  function build() {
    if (!document.getElementById("yvi-css")) { var st = el("style"); st.id = "yvi-css"; st.textContent = css; document.head.appendChild(st); var lk = el("link"); lk.rel = "stylesheet"; lk.href = "https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Anton&family=JetBrains+Mono:wght@500;700&display=swap"; document.head.appendChild(lk); }
    root = el("div"); root.id = "yvi";
    var stg = el("div", "stg");
    video = el("video"); video.muted = true; video.playsInline = true; video.preload = "auto"; video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
    cv = el("canvas"); ctx = cv.getContext("2d");
    stg.appendChild(video); stg.appendChild(cv); stg.appendChild(el("div", "vig"));
    R.board = el("div", "board", '<div class="wb">' +
      '<div class="ln ttl">THE FINAL</div><div class="ln sub">HEAT 1 · LANE 1 <span class="y">YOU</span> vs LANE 2 <span class="r">WHO</span></div>' +
      '<div class="ln">3 ROUNDS FOR TIME · CAP 12:00</div>' +
      '<div class="ln">20 CAL ROW</div>' +
      '<div class="ln">5 RING MUSCLE-UPS</div>' +
      '<div class="ln">CLEAN &amp; JERK 10 / 8 / 6</div>' +
      '<div class="ln">135 / 155 / 185 lb <span style="color:#9a988f">(95 / 105 / 125)</span></div></div>');
    stg.appendChild(R.board);
    R.flash = el("div", "flash"); stg.appendChild(R.flash);
    root.appendChild(stg);
    var ui = el("div", "ui");
    R.clock = el("div", "clock", "<span>THE FINAL · CAP 12:00</span><b>00:00</b>");
    R.l1 = el("div", "lane l1", '<div class="nm">LANE 1 · YOU</div><div class="meta">UNRANKED · 예선 와일드카드</div><div class="bar"><i></i></div><div class="mv">—</div>');
    R.l2 = el("div", "lane l2", '<div class="nm">WHO · LANE 2</div><div class="meta">#1 · 디펜딩 챔피언</div><div class="bar"><i></i></div><div class="mv">—</div>');
    R.cd = el("div", "cd", "3");
    R.hudRow = el("div", "hud", '<span>AI · MONITOR READ</span><br>LANE 1 <b class="c1">0</b>/20 CAL<br>LANE 2 <b class="c2">0</b>/20 CAL');
    R.hudRow.style.cssText = "left:4vmin;top:16vmin";
    R.hudJ = el("div", "hud", '<span>AI JUDGE · 17 JOINTS · LANE 2</span><br>C&amp;J 155 lb · <b class="jr">REP 7</b><br><span class="jv ok">GOOD REP</span>');
    R.hudJ.style.cssText = "right:4vmin;top:16vmin";
    R.hudMu = el("div", "hud", '<span>AI JUDGE · RING MUSCLE-UP</span><br>LANE 2 WHO · <b class="mr">REP 3</b>/5<br><span class="ok">LANE 1 YOU · 5/5 ✓ 라운드 3 진입</span>');
    R.hudMu.style.cssText = "left:4vmin;top:16vmin";
    R.big = el("div", "big", "<div><h1>LAST REP</h1><p>ROUND 3 · CLEAN &amp; JERK 185 lb · 6 / 6</p></div>");
    R.res = el("div", "res", '<h3>HEAT 1 · RESULT</h3>' +
      '<div class="rw"><span class="p" style="color:#58aefc">1</span><span>YOU<span class="rk">UNRANKED</span></span><span class="t">11:47</span></div>' +
      '<div class="rw" style="color:#a9a6ae"><span class="p">2</span><span>WHO<span class="rk">#1</span></span><span class="t">11:52</span></div>' +
      '<div class="rw" style="font-size:clamp(11px,1.5vmin,14px);color:#9a98a3"><span>NO REP 1 (LANE 2, C&amp;J 락아웃) · AI 판독 → 상대 검토 → 관리자 확정</span></div>');
    R.ups = el("div", "big", '<div><h1 class="ups">UPSET</h1><p>UNRANKED BEATS #1</p></div>');
    R.end = el("div", "end", '<div><div style="font-family:JetBrains Mono,monospace;letter-spacing:5px;color:#9a98a3;font-size:clamp(11px,1.6vmin,15px)">YOU vs WHO · CROSSFIT 1v1</div><h2>다음은 <span style="color:#ff3b30">누구?</span></h2><div class="btns on"><button class="btn red" data-go="join">도전하러 가기</button><button class="btn gh" data-go="enter">둘러보기</button></div></div>');
    [R.clock, R.l1, R.l2, R.cd, R.hudRow, R.hudJ, R.hudMu, R.big, R.res, R.ups, R.end].forEach(function (x) { ui.appendChild(x); });
    root.appendChild(ui);
    scr = el("div", "scr"); scr.appendChild(el("div", "sp")); root.appendChild(scr);
    R.brand = el("div", "brand", "<b>YOU</b><i>vs</i><b>WHO</b>"); root.appendChild(R.brand);
    R.skip = el("button", "skip", "건너뛰기 ›"); root.appendChild(R.skip);
    R.hint = el("div", "hint", "SCROLL<i></i>"); root.appendChild(R.hint);
    R.prog = el("div", "prog"); root.appendChild(R.prog);
    R.load = el("div", "load", ""); root.appendChild(R.load);
    R.skip.onclick = function () { finish("enter"); };
    R.end.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { finish(b.getAttribute("data-go")); }; });
    scr.addEventListener("scroll", function () { var m = scr.scrollHeight - scr.clientHeight; target = m > 0 ? scr.scrollTop / m : 0; }, { passive: true });
    window.addEventListener("resize", size);
    document.body.appendChild(root);
    document.documentElement.style.overflow = "hidden";
    size();
  }
  function size() { if (!cv) return; var d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }

  function loadVideo() {
    var lo = Math.min(screen.width, innerWidth) < 900 || (navigator.connection && (navigator.connection.saveData || /2g|3g/.test(navigator.connection.effectiveType || "")));
    var url = lo || mode === "short" ? VID.lo : VID.hi;
    video.src = url; // stream immediately
    video.addEventListener("loadeddata", function () { srcReady = true; video.style.opacity = 1; }, { once: true });
    // fetch whole file into memory for frame-accurate scrubbing
    if (!window.fetch || !window.ReadableStream || mode === "short") return;
    fetch(url).then(function (res) {
      var total = +res.headers.get("content-length") || 0, got = 0, chunks = [], rd = res.body.getReader();
      function pump() { return rd.read().then(function (r) { if (r.done) return; chunks.push(r.value); got += r.value.length; if (total && alive) R.load.textContent = "LOADING " + Math.round(got / total * 100) + "%"; return pump(); }); }
      return pump().then(function () {
        if (!alive) return;
        var t = video.currentTime; blobUrl = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
        video.src = blobUrl; video.addEventListener("loadeddata", function () { video.currentTime = t; video.style.opacity = 1; srcReady = true; }, { once: true });
        R.load.textContent = "";
      });
    }).catch(function () { R.load.textContent = ""; });
  }

  // progress → video time
  function vt(p) { return ramp(p, P0, P1) * T.end; }
  function seek(t) {
    if (!srcReady || !video.duration) return;
    t = clamp(t, 0, video.duration - 0.02);
    if (Math.abs(video.currentTime - t) > 0.008 && !video.seeking) { try { video.currentTime = t; } catch (e) { } }
  }

  function cover() { var W = innerWidth, H = innerHeight, s = Math.max(W / 1920, H / 1080); return { s: s, x: (W - 1920 * s) / 2, y: (H - 1080 * s) / 2 }; }
  function joints(t) {
    var i = 0; while (i < JK.length - 2 && t > JK[i + 1][0]) i++;
    var a = JK[i], b = JK[i + 1], f = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    return a[1].map(function (p, k) { return [p[0] + (b[1][k][0] - p[0]) * f, p[1] + (b[1][k][1] - p[1]) * f]; });
  }
  function drawSkeleton(t, alpha, bad) {
    var c = cover(), J = joints(t).map(function (p) { return [c.x + p[0] * 1920 * c.s, c.y + p[1] * 1080 * c.s]; });
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = "round";
    ctx.strokeStyle = bad ? "rgba(255,59,48,.95)" : "rgba(61,220,132,.9)"; ctx.lineWidth = Math.max(2, 3 * c.s * 1.4);
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12;
    BONES.forEach(function (b) { ctx.beginPath(); ctx.moveTo(J[b[0]][0], J[b[0]][1]); ctx.lineTo(J[b[1]][0], J[b[1]][1]); ctx.stroke(); });
    ctx.shadowBlur = 0; ctx.fillStyle = "#fff";
    J.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(3, 5 * c.s), 0, 7); ctx.fill(); });
    // lockout line through wrists
    var yW = (J[5][1] + J[6][1]) / 2;
    ctx.setLineDash([8, 8]); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(J[5][0] - 80 * c.s, yW); ctx.lineTo(J[6][0] + 80 * c.s, yW); ctx.stroke();
    // elbow angle readouts
    ctx.setLineDash([]); ctx.font = "600 " + Math.max(11, 15 * c.s * 1.4) + "px JetBrains Mono, monospace"; ctx.fillStyle = bad ? "#ff6a60" : "#3ddc84";
    var ang = bad ? Math.round(138 + 6 * Math.sin(t * 3)) : 176;
    ctx.fillText(ang + "°", J[3][0] - 70 * c.s, J[3][1]); ctx.fillText((ang - 2) + "°", J[4][0] + 18 * c.s, J[4][1]);
    ctx.restore();
  }
  function drawScan(cx, cy, w, h, a, label) {
    var c = cover(), x = c.x + cx * 1920 * c.s, y = c.y + cy * 1080 * c.s, W = w * 1920 * c.s, H = h * 1080 * c.s, k = Math.min(W, H) * .25;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "#ff3b30"; ctx.lineWidth = 2;
    [[x, y, 1, 1], [x + W, y, -1, 1], [x, y + H, 1, -1], [x + W, y + H, -1, -1]].forEach(function (q) { ctx.beginPath(); ctx.moveTo(q[0], q[1] + k * q[3]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] + k * q[2], q[1]); ctx.stroke(); });
    ctx.font = "600 12px JetBrains Mono, monospace"; ctx.fillStyle = "#fff"; ctx.fillText(label, x, y - 6);
    ctx.restore();
  }

  function laneState(clockS) {
    // movement script for both lanes (seconds of WOD clock)
    function at(s, plan) { for (var i = plan.length - 1; i >= 0; i--) if (s >= plan[i][0]) return plan[i]; return plan[0]; }
    var you = [[0, "R1 · ROW 20 CAL", 0], [150, "R1 · C&J 135 lb", .12], [230, "R1 · RING MU 5", .22], [260, "R2 · ROW 20 CAL", .33], [400, "R2 · C&J 155 lb", .45], [470, "R2 · RING MU 5", .56], [505, "R3 · ROW 20 CAL", .66], [610, "R3 · C&J 185 lb", .82], [707, "FINISH 11:47", 1]];
    var who = [[0, "R1 · ROW 20 CAL", 0], [140, "R1 · C&J 135 lb", .13], [215, "R1 · RING MU 5", .24], [245, "R2 · ROW 20 CAL", .35], [380, "R2 · C&J 155 lb", .48], [470, "R2 · NO REP +RE-DO", .58], [515, "R3 · ROW 20 CAL", .66], [615, "R3 · C&J 185 lb", .82], [712, "FINISH 11:52", 1]];
    function prog(plan) { var a = at(clockS, plan), i = plan.indexOf(a), b = plan[i + 1]; if (!b) return [a[1], 1]; return [a[1], a[2] + (b[2] - a[2]) * ramp(clockS, a[0], b[0])]; }
    return { you: prog(you), who: prog(who) };
  }

  function render(p) {
    var W = innerWidth, H = innerHeight; ctx.clearRect(0, 0, W, H);
    var t = vt(p); seek(t);
    R.prog.style.width = (p * 100) + "%";
    R.hint.style.opacity = p < 0.02 ? 1 : 0;
    // whiteboard
    var bo = 1 - ramp(p, P0 - 0.02, P0 + 0.005);
    R.board.style.opacity = bo; R.board.style.visibility = bo > 0 ? "visible" : "hidden";
    var lines = R.board.querySelectorAll(".ln");
    lines.forEach(function (ln, i) { var a = i < 2 ? 1 : ramp(p, 0.002 + (i - 2) * 0.016, 0.016 + (i - 2) * 0.016); ln.style.clipPath = "inset(0 " + (100 - a * 100) + "% 0 0)"; });
    R.board.querySelector(".wb").style.transform = "scale(" + (1 + ramp(p, 0.09, P0) * 0.25) + ")";
    // clock
    var clockS = t < T.go ? 0 : t >= T.drop ? FINISH_YOU : ((t - T.go) / (T.drop - T.go)) * FINISH_YOU;
    var co = win(p, P0 + 0.01, P1 + 0.02, 0.02);
    R.clock.style.opacity = co;
    R.clock.querySelector("b").textContent = mmss(clockS);
    R.clock.querySelector("b").style.color = t >= T.drop ? "#3ddc84" : "#fff";
    // lanes
    var lo = win(p, P0 + 0.015, P1, 0.02);
    R.l1.style.opacity = lo; R.l2.style.opacity = lo;
    var ls = laneState(clockS);
    R.l1.querySelector(".bar i").style.width = (ls.you[1] * 100) + "%"; R.l1.querySelector(".mv").textContent = t < T.go ? "READY" : ls.you[0];
    R.l2.querySelector(".bar i").style.width = (ls.who[1] * 100) + "%"; R.l2.querySelector(".mv").textContent = t < T.go ? "READY" : ls.who[0];
    // countdown 3-2-1-GO
    var cdTxt = "", cdA = 0;
    [[5.75, "3"], [6.25, "2"], [6.75, "1"], [7.25, "GO"]].forEach(function (c) { if (t >= c[0] && t < c[0] + 0.5) { cdTxt = c[1]; cdA = 1 - ramp(t, c[0] + 0.25, c[0] + 0.5); } });
    R.cd.textContent = cdTxt; R.cd.style.opacity = cdA; R.cd.style.color = cdTxt === "GO" ? "#ff3b30" : "#fff";
    R.cd.style.transform = "scale(" + (1.15 - 0.15 * cdA) + ")";
    // ROW: monitor read
    var rowA = win(t, T.row + 0.2, T.jerk, 0.3);
    R.hudRow.style.opacity = rowA;
    var calY = Math.min(20, Math.floor(ramp(t, T.row, T.jerk) * 19 + 1)), calW = Math.min(20, Math.floor(ramp(t, T.row, T.jerk) * 20 + 1));
    R.hudRow.querySelector(".c1").textContent = calY; R.hudRow.querySelector(".c2").textContent = calW;
    if (rowA > 0.01) { drawScan(.205, .30, .06, .085, rowA, "LANE 1 MONITOR"); drawScan(.70, .30, .06, .085, rowA, "LANE 2 MONITOR"); }
    // JERK: skeleton + verdict
    var jt = t - T.jerk, jA = win(t, T.jerk + 0.05, T.mu, 0.2);
    var bad = jt > 1.9;
    R.hudJ.style.opacity = jA;
    R.hudJ.querySelector(".jr").textContent = bad ? "REP 8" : "REP 7";
    var jv = R.hudJ.querySelector(".jv"); jv.className = "jv " + (bad ? "no" : "ok"); jv.textContent = bad ? "NO REP · 팔꿈치 락아웃 미완료" : jt < 0.6 ? "GOOD REP ✓ 락아웃 확인" : "다음 렙 준비…";
    R.hudJ.style.borderLeftColor = bad ? "#ff3b30" : "#3ddc84";
    if (jA > 0.01) drawSkeleton(clamp(jt, 0, 4.13), jA * 0.95, bad);
    // MUSCLE-UP
    var mA = win(t, T.mu + 0.3, T.hands, 0.3);
    R.hudMu.style.opacity = mA;
    R.hudMu.querySelector(".mr").textContent = "REP " + Math.min(5, 3 + Math.floor(ramp(t, T.mu + 1, T.hands - 0.4) * 2.99));
    // LAST REP
    var bA = win(t, T.hands + 0.1, T.drop, 0.25);
    R.big.style.opacity = bA;
    // drop flash
    var fl = win(t, T.drop - 0.05, T.drop + 0.45, 0.2) * 0.75; R.flash.style.opacity = fl;
    // result, upset, end
    var rA = win(p, P1 - 0.01, 0.935, 0.02);
    R.res.style.opacity = rA; R.res.style.transform = "translate(-50%," + (-50 + (1 - ramp(p, P1 - 0.01, P1 + 0.01)) * 8) + "%)";
    var uA = win(p, 0.925, 0.975, 0.015);
    R.ups.style.opacity = uA; R.ups.querySelector("h1").style.transform = "scale(" + (1.5 - 0.5 * ease(ramp(p, 0.925, 0.945))) + ")";
    var eA = ramp(p, 0.968, 0.99);
    R.end.style.opacity = eA; R.end.style.pointerEvents = eA > 0.5 ? "auto" : "none";
    video.style.filter = "brightness(" + (1 - 0.55 * Math.max(rA, uA, eA)) + ") saturate(" + (1 - 0.4 * eA) + ")";
  }

  function loop() {
    if (!alive) return;
    if (mode === "full") { cur += (target - cur) * 0.14; if (Math.abs(target - cur) < 0.0002) cur = target; render(cur); }
    else shortTick();
    raf = requestAnimationFrame(loop);
  }

  // short opening for return visits (~3 s): plays the jerk + last rep straight through
  function shortTick() {
    var e = (performance.now() - shortT0) / 1000;
    if (srcReady && video.paused && e < 2.9) { try { video.currentTime = T.jerk + 0.1; video.play(); } catch (x) { } }
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    R.board.style.opacity = 0; R.board.style.visibility = "hidden";
    R.ups.style.opacity = 0;
    R.end.style.opacity = win(e, 0.15, 3.1, 0.4); R.end.style.pointerEvents = "auto";
    R.end.querySelector("h2").innerHTML = 'THE <span style="color:#ff3b30">FINAL</span>';
    video.style.filter = "brightness(.55)";
    root.style.opacity = 1 - ramp(e, 2.9, 3.3);
    if (e > 3.3) finish("enter");
  }

  function finish(go) {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf);
    try { localStorage.setItem(KEY, "1"); } catch (e) { }
    root.style.transition = "opacity .45s"; root.style.opacity = 0;
    setTimeout(function () { if (root && root.parentNode) root.parentNode.removeChild(root); if (blobUrl) URL.revokeObjectURL(blobUrl); document.documentElement.style.overflow = ""; root = null; }, 480);
    if (go === "join") { location.hash = "#/wod"; setTimeout(function () { var b = document.getElementById("bJoin"); if (b) b.click(); }, 500); }
    if (opts.onEnter) opts.onEnter(go);
  }

  function play(o) {
    opts = o || {};
    if (root) return;
    var seen = false; try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { }
    mode = seen && !opts.force ? "short" : "full";
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches && !opts.force) mode = "short";
    build(); alive = true; cur = target = 0;
    if (mode === "short") { root.classList.add("short"); shortT0 = performance.now(); R.skip.textContent = "건너뛰기 ›"; }
    loadVideo();
    loop();
  }
  window.YVWINTRO = { play: play };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { play(); }); else play();
})();
