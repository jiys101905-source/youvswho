// On-device AI judge: MoveNet (17 keypoints) via TensorFlow.js, loaded from CDN at runtime.
// Counts reps and NO REPs for a few CrossFit standards. The video never leaves the device.
const CDN = [
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.20.0/dist/tf-core.min.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.20.0/dist/tf-converter.min.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.20.0/dist/tf-backend-webgl.min.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
];
let loading = null;
function loadScripts() {
  if (loading) return loading;
  loading = CDN.reduce((p, src) => p.then(() => new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); })), Promise.resolve());
  return loading;
}
let detector = null;
async function getDetector() {
  await loadScripts();
  if (detector) return detector;
  await window.tf.setBackend("webgl"); await window.tf.ready();
  detector = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, { modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING });
  return detector;
}
const EDGES = [[5, 7], [7, 9], [6, 8], [8, 10], [5, 6], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 5], [0, 6]];
const ang = (a, b, c) => { const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y]; const d = Math.hypot(...v1) * Math.hypot(...v2) || 1; return Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))) * 180 / Math.PI; };

export class AIJudge {
  constructor(canvas, onHud) { this.c = canvas; this.ctx = canvas.getContext("2d"); this.hud = onHud; }
  setHud(reps, noReps, msg, warn) {
    this.hud(`<span class="pill red">AI JUDGE · 17 joints</span><span class="pill">REP <b class="mono" style="color:#fff">${reps}</b></span><span class="pill ${noReps ? "gold" : ""}">NO REP ${noReps}</span>${msg ? `<span class="pill ${warn ? "gold" : ""}">${msg}</span>` : ""}`);
  }
  async run(file, move) {
    this.hud(`<span class="pill">모델 불러오는 중…</span>`);
    const det = await getDetector();
    const v = document.createElement("video");
    v.src = URL.createObjectURL(file); v.muted = true; v.playsInline = true;
    await new Promise((r) => (v.onloadedmetadata = r));
    const W = 640, H = Math.round((640 * v.videoHeight) / v.videoWidth) || 360;
    this.c.width = W; this.c.height = H;
    let reps = 0, noReps = 0, phase = "down", frames = 0, blind = 0, lastMsg = "";
    const step = 1 / 12; // analyse at 12 fps
    for (let t = 0; t < v.duration; t += step) {
      v.currentTime = t; await new Promise((r) => (v.onseeked = r));
      this.ctx.drawImage(v, 0, 0, W, H);
      const poses = await det.estimatePoses(this.c);
      frames++;
      const kp = poses[0]?.keypoints;
      const vis = kp ? kp.filter((k) => k.score > 0.3).length : 0;
      if (!kp || vis < 11) { blind++; lastMsg = "판독 불가 프레임"; this.setHud(reps, noReps, lastMsg, true); continue; }
      // skeleton overlay
      const ctx = this.ctx; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,59,48,.9)"; ctx.fillStyle = "#fff";
      EDGES.forEach(([a, b]) => { if (kp[a].score > .3 && kp[b].score > .3) { ctx.beginPath(); ctx.moveTo(kp[a].x, kp[a].y); ctx.lineTo(kp[b].x, kp[b].y); ctx.stroke(); } });
      kp.forEach((k) => { if (k.score > .3) { ctx.beginPath(); ctx.arc(k.x, k.y, 4, 0, 7); ctx.fill(); } });
      const L = (i) => kp[i], side = kp[9].score + kp[7].score > kp[10].score + kp[8].score ? 0 : 1;
      const sh = L(5 + side), el = L(7 + side), wr = L(9 + side), hip = L(11 + side), kn = L(13 + side), an = L(15 + side), nose = L(0);
      const elbow = ang(sh, el, wr), knee = ang(hip, kn, an), hipA = ang(sh, hip, kn);
      if (move === "cj" || move === "generic") {
        const overhead = wr.y < nose.y - 0.05 * H;
        if (phase === "down" && overhead) {
          const locked = elbow > 160 && (move === "generic" || (knee > 160 && hipA > 160));
          if (locked) { reps++; lastMsg = "GOOD REP"; } else { noReps++; lastMsg = elbow <= 160 ? "NO REP · 팔 락아웃" : "NO REP · 무릎/힙 미신전"; }
          phase = "up";
        } else if (phase === "up" && wr.y > sh.y) phase = "down";
      } else if (move === "mu") {
        const top = sh.y < wr.y && elbow > 150, hang = wr.y < nose.y && elbow > 150;
        if (phase === "down" && top) { reps++; phase = "up"; lastMsg = "GOOD REP"; }
        else if (phase === "down" && sh.y < wr.y + 0.02 * H && elbow <= 150 && el.y > wr.y) { /* in dip */ }
        else if (phase === "up" && hang) phase = "down";
      } else if (move === "squat") {
        const below = hip.y > kn.y;
        if (phase === "down" && below) phase = "bottom";
        else if (phase === "bottom" && knee > 165 && hipA > 160) { reps++; phase = "down"; lastMsg = "GOOD REP"; }
        else if (phase === "down" && knee < 110 && !below) { /* shallow */ if (lastMsg !== "NO REP · 깊이 부족") { noReps++; lastMsg = "NO REP · 깊이 부족"; } }
      }
      this.setHud(reps, noReps, lastMsg, /NO REP/.test(lastMsg));
    }
    const unreadable = blind / Math.max(1, frames) > 0.2;
    this.setHud(reps, noReps, unreadable ? "판독 불가 구간 많음 → 선수 페널티 대상" : "판독 완료", unreadable);
    URL.revokeObjectURL(v.src);
    return { reps, noReps, unreadable, frames, model: "MoveNet Lightning" };
  }
}
