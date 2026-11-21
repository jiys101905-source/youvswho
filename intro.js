/* YOU vs WHO — "THE FINAL" scroll-driven cinematic (v3).
   Pure film: no HUD. White logo dissolves into the underdog's entrance,
   black & white until the workout starts, then colour. Ends on a high five
   and the white logo again. First visit: full. Later: ~3 s opening.
   Replay: YVWINTRO.play({force:true}). */
(function () {
  var KEY = "yvw_intro_seen_v3";
  var VID = { hi: "assets/intro2_1080.mp4?v=202611211914", lo: "assets/intro2_720.mp4?v=202611211914" };
  var DUR = 38.8;            // seconds of footage
  var COLOR_AT = 5.0;        // workout starts (assault bike) -> colour blooms in
  var P_LOGO_OUT = [0.03, 0.11];  // logo dissolves while footage fades up
  var P_FILM = [0.07, 0.93];      // scroll range mapped onto footage
  var P_LOGO_IN = [0.90, 0.97];   // logo returns over the high five

  var css = "\
#yvi{position:fixed;inset:0;z-index:9999;background:#000;color:#fff;overflow:hidden;font-family:'Noto Sans KR',system-ui,sans-serif}\
#yvi video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0}\
#yvi .bar{position:absolute;left:0;right:0;height:max(0px,calc((100vh - 100vw/2.39)/2));background:#000;z-index:3;pointer-events:none}\
#yvi .bar.t{top:0}#yvi .bar.b{bottom:0}\
#yvi .grain{position:absolute;inset:-50%;z-index:2;pointer-events:none;opacity:.10;background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\");animation:yvg .5s steps(4) infinite}\
@keyframes yvg{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}100%{transform:translate(0,0)}}\
#yvi .vig{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.55) 100%)}\
#yvi .logo{position:absolute;inset:0;z-index:4;display:grid;place-items:center;pointer-events:none}\
#yvi .logo div{font-family:Anton,Impact,sans-serif;color:#fff;font-size:clamp(56px,13vw,200px);letter-spacing:.02em;line-height:1;white-space:nowrap;text-shadow:0 0 40px rgba(0,0,0,.35)}\
#yvi .logo i{font-style:normal;font-family:'Noto Sans KR',sans-serif;font-weight:300;font-size:.32em;letter-spacing:.08em;margin:0 .35em;vertical-align:.55em;opacity:.85}\
#yvi .scr{position:absolute;inset:0;z-index:5;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}\
#yvi .scr::-webkit-scrollbar{display:none}\
#yvi .sp{height:1600vh}\
#yvi .skip{position:absolute;top:max(16px,3vmin);right:max(16px,3vmin);z-index:7;background:none;border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:999px;padding:8px 16px;font-size:13px;letter-spacing:.06em;cursor:pointer;font-family:inherit}\
#yvi .hint{position:absolute;bottom:max(18px,4vmin);left:50%;transform:translateX(-50%);z-index:7;font-size:11px;letter-spacing:.4em;color:rgba(255,255,255,.75);text-align:center;transition:opacity .4s;pointer-events:none}\
#yvi .hint i{display:block;width:1px;height:36px;margin:10px auto 0;background:linear-gradient(#fff,transparent);animation:yvh 1.8s infinite}\
@keyframes yvh{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}\
#yvi .enter{position:absolute;left:50%;bottom:max(28px,9vh);transform:translateX(-50%);z-index:7;background:none;border:0;color:#fff;font-size:14px;letter-spacing:.3em;cursor:pointer;opacity:0;pointer-events:none;font-family:inherit;padding:12px 18px}\
#yvi .enter:after{content:'';display:block;height:1px;background:#fff;margin-top:8px;transform-origin:left;transform:scaleX(.4);transition:transform .3s}\
#yvi .enter:hover:after{transform:scaleX(1)}\
#yvi .load{position:absolute;left:max(16px,3vmin);bottom:max(16px,3vmin);z-index:7;font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.5)}\
";

  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ramp(x, a, b) { return clamp((x - a) / (b - a), 0, 1); }
  function ease(x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  var root, video, scr, R = {}, cur = 0, target = 0, raf, alive = false, ready = false, blobUrl, mode = "full", t0 = 0, opts = {};

  function build() {
    if (!document.getElementById("yvi-css")) {
      var st = el("style"); st.id = "yvi-css"; st.textContent = css; document.head.appendChild(st);
      var lk = el("link"); lk.rel = "stylesheet"; lk.href = "https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+KR:wght@300;400&display=swap"; document.head.appendChild(lk);
    }
    root = el("div"); root.id = "yvi";
    video = el("video"); video.muted = true; video.playsInline = true; video.preload = "auto";
    video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
    root.appendChild(video);
    root.appendChild(el("div", "vig"));
    root.appendChild(el("div", "grain"));
    root.appendChild(el("div", "bar t")); root.appendChild(el("div", "bar b"));
    R.logo = el("div", "logo", "<div>YOU<i>vs</i>WHO</div>"); root.appendChild(R.logo);
    scr = el("div", "scr"); scr.appendChild(el("div", "sp")); root.appendChild(scr);
    R.skip = el("button", "skip", "SKIP"); root.appendChild(R.skip);
    R.hint = el("div", "hint", "SCROLL<i></i>"); root.appendChild(R.hint);
    R.enter = el("button", "enter", "ENTER"); root.appendChild(R.enter);
    R.load = el("div", "load", ""); root.appendChild(R.load);
    R.skip.onclick = function () { finish("enter"); };
    R.enter.onclick = function () { finish("enter"); };
    scr.addEventListener("scroll", function () { var m = scr.scrollHeight - scr.clientHeight; target = m > 0 ? scr.scrollTop / m : 0; }, { passive: true });
    document.body.appendChild(root);
    document.documentElement.style.overflow = "hidden";
  }

  function load() {
    var small = Math.min(screen.width, innerWidth) < 900 || mode === "short" ||
      (navigator.connection && (navigator.connection.saveData || /2g|3g/.test(navigator.connection.effectiveType || "")));
    var url = small ? VID.lo : VID.hi;
    video.src = url;
    video.addEventListener("loadeddata", function () { ready = true; }, { once: true });
    if (mode === "short" || !window.fetch || !window.ReadableStream) return;
    // whole file in memory = frame-accurate scrubbing
    fetch(url).then(function (res) {
      var total = +res.headers.get("content-length") || 0, got = 0, parts = [], rd = res.body.getReader();
      function pump() { return rd.read().then(function (r) { if (r.done) return; parts.push(r.value); got += r.value.length; if (total && alive) R.load.textContent = Math.round(got / total * 100) + "%"; return pump(); }); }
      return pump().then(function () {
        if (!alive) return;
        var t = video.currentTime; blobUrl = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
        video.src = blobUrl;
        video.addEventListener("loadeddata", function () { video.currentTime = t; ready = true; R.load.textContent = ""; }, { once: true });
      });
    }).catch(function () { R.load.textContent = ""; });
  }

  function seek(t) {
    if (!ready || !video.duration) return;
    t = clamp(t, 0, video.duration - 0.02);
    if (Math.abs(video.currentTime - t) > 0.008 && !video.seeking) { try { video.currentTime = t; } catch (e) { } }
  }

  function render(p) {
    var t = ramp(p, P_FILM[0], P_FILM[1]) * DUR;
    seek(t);
    // logo out (dissolve + slight push) while the footage fades up — overlapping, no cut
    var lo = 1 - ease(ramp(p, P_LOGO_OUT[0], P_LOGO_OUT[1]));
    var li = ease(ramp(p, P_LOGO_IN[0], P_LOGO_IN[1]));
    R.logo.style.opacity = Math.max(lo, li);
    R.logo.firstChild.style.transform = "scale(" + (p < 0.5 ? 1 + 0.06 * (1 - lo) : 1.04 - 0.04 * li) + ")";
    var filmA = ease(ramp(p, P_LOGO_OUT[0] + 0.02, P_LOGO_OUT[1] + 0.01));
    video.style.opacity = filmA;
    // black & white entrance -> colour blooms in when the workout starts
    var col = ease(ramp(t, COLOR_AT - 0.2, COLOR_AT + 0.9));
    video.style.filter = "grayscale(" + (1 - col) + ") contrast(" + (1.12 - 0.06 * col) + ") brightness(" + (1 - li * 0.55) + ")";
    R.hint.style.opacity = p < 0.015 ? 1 : 0;
    var eA = ramp(p, 0.95, 0.99);
    R.enter.style.opacity = eA; R.enter.style.pointerEvents = eA > 0.5 ? "auto" : "none";
  }

  function short() {
    var e = (performance.now() - t0) / 1000;
    if (ready && video.paused && e > 0.6 && e < 2.6) { try { video.currentTime = 23.0; video.play(); } catch (x) { } }
    var lo = 1 - ease(ramp(e, 0.7, 1.6));
    R.logo.style.opacity = Math.max(lo, ease(ramp(e, 2.2, 2.8)));
    video.style.opacity = ease(ramp(e, 0.8, 1.5)) * (1 - ramp(e, 2.4, 2.9));
    video.style.filter = "contrast(1.06)";
    root.style.opacity = 1 - ramp(e, 3.0, 3.4);
    if (e > 3.4) finish("enter");
  }

  function loop() {
    if (!alive) return;
    if (mode === "full") { cur += (target - cur) * 0.12; if (Math.abs(target - cur) < 0.0002) cur = target; render(cur); }
    else short();
    raf = requestAnimationFrame(loop);
  }

  function finish(go) {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf);
    try { localStorage.setItem(KEY, "1"); } catch (e) { }
    root.style.transition = "opacity .6s"; root.style.opacity = 0;
    var r = root;
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); if (blobUrl) URL.revokeObjectURL(blobUrl); document.documentElement.style.overflow = ""; }, 650);
    root = null;
    if (opts.onEnter) opts.onEnter(go);
  }

  function play(o) {
    opts = o || {};
    if (root) return;
    var seen = false; try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { }
    mode = seen && !opts.force ? "short" : "full";
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches && !opts.force) mode = "short";
    build(); alive = true; cur = target = 0; t0 = performance.now();
    if (mode === "short") { scr.style.display = "none"; R.hint.style.display = "none"; }
    load(); loop();
  }
  window.YVWINTRO = { play: play };
  if (!window.YVWINTRO_MANUAL) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { play(); }); else play();
  }
})();
