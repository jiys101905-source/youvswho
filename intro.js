/* YOU vs WHO — intro v4: one shot. The underdog, backlit, points at you;
   the white logo rises. ~6 s, autoplay, muted, no scroll. First visit only.
   Replay: YVWINTRO.play({force:true}). */
(function () {
  var KEY = "yvw_intro_seen_v4";
  var VID = { hi: "assets/point_1080.mp4?v=202611221125", lo: "assets/point_720.mp4?v=202611221125" };
  var LOGO_AT = 3.3, END_AT = 6.2;
  var css = "\
#yvi{position:fixed;inset:0;z-index:9999;background:#000;color:#fff;overflow:hidden}\
#yvi video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.2s ease,filter 1s ease}\
#yvi .bar{position:absolute;left:0;right:0;height:max(0px,calc((100vh - 100vw/2.39)/2));background:#000;z-index:3}\
#yvi .bar.t{top:0}#yvi .bar.b{bottom:0}\
#yvi .vig{position:absolute;inset:0;z-index:2;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.6) 100%)}\
#yvi .logo{position:absolute;inset:0;z-index:4;display:grid;place-items:center;pointer-events:none;opacity:0;transform:translateY(18px);transition:opacity .9s ease,transform 1.1s cubic-bezier(.2,.7,.2,1)}\
#yvi .logo.on{opacity:1;transform:none}\
#yvi .logo div{font-family:Anton,Impact,sans-serif;color:#fff;font-size:clamp(56px,13vw,200px);line-height:1;white-space:nowrap}\
#yvi .logo i{font-style:normal;font-family:Inter,system-ui,sans-serif;font-weight:500;font-size:.3em;letter-spacing:.08em;margin:0 .35em;vertical-align:.6em}\
#yvi .skip{position:absolute;top:max(16px,3vmin);right:max(16px,3vmin);z-index:7;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.45);color:#fff;border-radius:30px;padding:10px 18px;min-height:44px;font:500 13px Inter,system-ui,sans-serif;letter-spacing:.06em;cursor:pointer}\
";
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  var root, video, logo, timer, done = false, opts = {};
  function finish() {
    if (done || !root) return; done = true; clearInterval(timer);
    try { localStorage.setItem(KEY, "1"); } catch (e) { }
    root.style.transition = "opacity .7s"; root.style.opacity = 0;
    var r = root; root = null;
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); document.documentElement.style.overflow = ""; }, 720);
    if (opts.onEnter) opts.onEnter("enter");
  }
  function play(o) {
    opts = o || {}; if (root) return;
    var seen = false; try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { }
    if (seen && !opts.force) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches && !opts.force) return;
    done = false;
    if (!document.getElementById("yvi-css")) {
      var st = el("style"); st.id = "yvi-css"; st.textContent = css; document.head.appendChild(st);
      var lk = el("link"); lk.rel = "stylesheet"; lk.href = "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500&display=swap"; document.head.appendChild(lk);
    }
    root = el("div"); root.id = "yvi";
    video = el("video"); video.muted = true; video.playsInline = true; video.preload = "auto";
    video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
    var small = Math.min(screen.width, innerWidth) < 900 || (navigator.connection && navigator.connection.saveData);
    video.src = small ? VID.lo : VID.hi;
    root.appendChild(video); root.appendChild(el("div", "vig"));
    root.appendChild(el("div", "bar t")); root.appendChild(el("div", "bar b"));
    logo = el("div", "logo", "<div>YOU<i>vs</i>WHO</div>"); root.appendChild(logo);
    var skip = el("button", "skip", "SKIP"); skip.setAttribute("aria-label", "인트로 건너뛰기"); skip.onclick = finish; root.appendChild(skip);
    document.body.appendChild(root); document.documentElement.style.overflow = "hidden";
    var t0 = performance.now(), started = false;
    video.addEventListener("playing", function () { started = true; video.style.opacity = 1; t0 = performance.now(); }, { once: true });
    var p = video.play(); if (p && p.catch) p.catch(function () { });
    timer = setInterval(function () {
      var e = (performance.now() - t0) / 1000;
      if (!started && e > 3) { logo.classList.add("on"); if (e > 5) finish(); return; }   // video blocked or slow: show logo, then enter
      if (e > LOGO_AT) { logo.classList.add("on"); video.style.filter = "brightness(.5)"; }
      if (e > END_AT) finish();
    }, 100);
  }
  window.YVWINTRO = { play: play };
  if (!window.YVWINTRO_MANUAL) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { play(); }); else play();
  }
})();
