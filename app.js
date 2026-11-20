// YOU vs WHO — CrossFit 1v1 challenge platform
// Firebase Auth + Firestore (Spark plan). No server code: admin actions run in the admin's browser.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot, serverTimestamp, writeBatch, getCountFromServer, increment, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AIJudge } from "./aijudge.js";

const fb = initializeApp({
  apiKey: "AIzaSyCF7gkbqOkLVTYYMZKZjdK7fK6sSK4Ail0",
  authDomain: "youvswho-a4bcb.firebaseapp.com",
  projectId: "youvswho-a4bcb",
  storageBucket: "youvswho-a4bcb.firebasestorage.app",
  messagingSenderId: "763790070140",
  appId: "1:763790070140:web:3541db3214ec5aa8df94f9"
});
const auth = getAuth(fb);
const db = getFirestore(fb);

/* ---------------- constants (the agreed rules) ---------------- */
const RULE = {
  startRating: 1500, floor: 1000, placementWeeks: 3,
  K: 32, Kplace: 48, defenderCap: 30,
  ladderBase: 300, ladderStep: 100, champStreak: 3,
  qualifiers: 14, wildcards: 2, wildcardPct: 0.30,
  pro: 4900, viewer: 990, box: 50000, poolShare: 0.40, tax: 0.044,
  split: { "1": .45, "2": .20, "3": .09, "4": .06, QF: .03, R16: .01 },
  tierAt: 200, regionAt: 2000,
};
const STAGES = [
  { key: "W1", name: "WHO'S NEXT 1주차", kind: "qual", when: "1주차 · 온라인" },
  { key: "W2", name: "WHO'S NEXT 2주차", kind: "qual", when: "2주차 · 온라인" },
  { key: "R16", name: "16강", kind: "video", when: "3주차 · 영상" },
  { key: "QF", name: "8강", kind: "video", when: "4주차 · 영상" },
  { key: "FINAL", name: "THE FINAL", kind: "final", when: "다음 달 첫 주말 · 박스" },
];
const LEVEL = { W1: "Open 수준", W2: "Open 수준", R16: "쿼터파이널 수준", QF: "세미파이널 수준", FINAL: "게임즈 수준" };
const G = { M: "남자", F: "여자" };

/* ---------------- state ---------------- */
const S = { user: null, me: null, admin: false, season: null, seasonId: null, unsub: [] };

/* ---------------- helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const won = (n) => "₩" + Math.round(n || 0).toLocaleString("ko-KR");
const initial = (n) => esc((n || "?").trim().slice(0, 1).toUpperCase());
const pct = (x) => (x * 100).toFixed(0) + "%";
const monthId = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const toast = (m, ms = 2600) => { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms); };
const modal = (html, wide) => { const m = $("#modal"); m.innerHTML = `<div class="box ${wide ? "wide" : ""}">${html}</div>`; m.hidden = false; m.onclick = (e) => { if (e.target === m) closeModal(); }; return m; };
const closeModal = () => { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; };
window.closeModal = closeModal;
const fmtTime = (sec) => { sec = Math.round(sec); return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); };
const ytId = (u) => { const m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : null; };
const stageIdx = (k) => STAGES.findIndex((s) => s.key === k);
const needLogin = () => { if (S.user) return false; authModal("login"); return true; };
async function guard(fn) { try { return await fn(); } catch (e) { console.error(e); toast("오류: " + (e.code || e.message)); } }
function scoreText(sub, wod) {
  if (!sub || sub.sortKey == null) return "—";
  if (wod?.scoring === "time") return sub.capped ? `CAP+${sub.capReps}` : fmtTime(sub.timeSec);
  return sub.value + (wod?.unit ? " " + wod.unit : "");
}
function badgeFor(u) {
  let b = "";
  if (u?.defending) b += `<span class="tag">디펜딩 챔피언</span>`;
  if (u?.bot) b += `<span class="tag bot">데모</span>`;
  if ((u?.weeksPlayed || 0) < RULE.placementWeeks && !u?.bot) b += `<span class="tag bot">배치</span>`;
  return b;
}

/* ---------------- default season content ---------------- */
function defaultSeason(id) {
  const [y, m] = id.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const nextMonth = new Date(y, m, 1);
  let sat = new Date(nextMonth); while (sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);
  const ymd = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  const d = (n) => { const x = new Date(first); x.setDate(1 + n); return ymd(x); };
  return {
    id, title: `${y}년 ${m}월 시리즈`, current: "W1",
    status: { W1: "reg", W2: "wait", R16: "wait", QF: "wait", FINAL: "wait" },
    dates: { W1: d(0), W2: d(7), R16: d(14), QF: d(21), FINAL: ymd(sat) },
    wods: {
      W1: { title: "WHO'S NEXT 1", scoring: "time", cap: 12, desc: "3 Rounds for time\n15 Cal Row\n12 Toes-to-bar\n9 Power clean 60/40kg\n\nTime cap 12:00 · 캡에 걸리면 남은 렙 수만큼 초가 더해집니다.", move: "cj" },
      W2: { title: "WHO'S NEXT 2", scoring: "reps", unit: "reps", cap: 10, desc: "10분 AMRAP\n5 Pull-ups\n10 Push-ups\n15 Air squats\n\n총 렙 수로 기록합니다.", move: "generic" },
      R16: { title: "ROUND OF 16", scoring: "time", cap: 12, desc: "For time\n21-15-9\nThruster 43/29kg\nChest-to-bar pull-ups\n\nTime cap 12:00", move: "cj" },
      QF: { title: "QUARTERFINAL", scoring: "time", cap: 14, desc: "4 Rounds for time\n20 Cal Row\n10 Bar muscle-ups\n8 Clean & jerk 70/47kg\n\nTime cap 14:00", move: "cj" },
      FINAL: { title: "THE FINAL", scoring: "time", cap: 12, desc: "3 Rounds for time (1:1 lane)\n20 Cal Row\n5 Ring muscle-ups\nClean & Jerk 10/8/6 — 135/155/185 lb (95/105/125 lb)\n\nTime cap 12:00", move: "cj" },
    },
    final: { box: "개최 박스 모집 중", addr: "", time: "토 14:00", stream: "", sponsors: 0, note: "준결승 → 3·4위전 → 결승. 무료 라이브 중계." },
    bracket: {},
    createdAt: serverTimestamp(),
  };
}

/* ---------------- auth ---------------- */
function renderWho() {
  const w = $("#who");
  if (!S.user) { w.innerHTML = `<button class="btn sm ghost" id="bLogin">로그인</button><button class="btn sm red" id="bJoin">가입</button>`; $("#bLogin").onclick = () => authModal("login"); $("#bJoin").onclick = () => authModal("join"); return; }
  w.innerHTML = `${S.admin ? `<a class="pill red" href="#/admin">관리자</a>` : ""}<a href="#/me" class="av" style="width:34px;height:34px">${initial(S.me?.name)}</a>`;
}
function authModal(mode = "login") {
  const join = mode === "join";
  modal(`
  <h2>${join ? "선수 등록" : "로그인"}</h2>
  <p class="muted" style="margin:0 0 6px">${join ? "가입하면 레이팅 1500에서 배치 3주로 시작해요." : "이메일과 비밀번호로 로그인"}</p>
  <form id="af">
    <label>이메일</label><input name="email" type="email" required autocomplete="email">
    <label>비밀번호</label><input name="pw" type="password" minlength="6" required autocomplete="${join ? "new-password" : "current-password"}">
    ${join ? `
    <label>선수 이름 (닉네임)</label><input name="name" maxlength="20" required>
    <div class="grid g2"><div><label>성별 (단일 디비전)</label><select name="gender"><option value="M">남자</option><option value="F">여자</option></select></div>
    <div><label>소속 박스</label><input name="box" maxlength="30" placeholder="예) 크로스핏 ○○"></div></div>
    <label>휴대폰 번호 (본인 1계정 확인)</label><div class="row"><input name="phone" inputmode="tel" placeholder="010-0000-0000" required><button type="button" class="btn sm ghost" id="sendCode">인증</button></div>
    <div id="codeRow" hidden><label>인증번호</label><input name="code" inputmode="numeric" placeholder="6자리"><p class="dim" style="font-size:12px">데모: 실제 문자는 발송되지 않아요. 화면에 표시된 번호를 입력하세요.</p></div>
    <div style="margin-top:12px">
      <label class="check"><input type="checkbox" required> 이용약관 및 개인정보 처리에 동의합니다 (필수)</label>
      <label class="check"><input type="checkbox" required> 촬영 규정에 동의합니다 — 측면·전신·기구 모니터·오늘의 코드 노출, 판독 불가 렙은 선수 책임 (필수)</label>
      <label class="check"><input type="checkbox" required> 만 14세 이상입니다 (필수)</label>
      <label class="check"><input type="checkbox" name="mkt"> 대회·스폰서 소식 받기 (선택)</label>
    </div>` : ""}
    <button class="btn red block" style="margin-top:16px">${join ? "가입하고 시작하기" : "로그인"}</button>
  </form>
  <div class="row" style="margin-top:12px;justify-content:space-between">
    <a href="#" id="swap" class="muted">${join ? "이미 계정이 있어요" : "처음이에요 → 가입"}</a>
    ${join ? "" : `<a href="#" id="reset" class="dim">비밀번호 재설정</a>`}
  </div>`);
  $("#swap").onclick = (e) => { e.preventDefault(); authModal(join ? "login" : "join"); };
  let code = null;
  if (join) $("#sendCode").onclick = () => { code = String(Math.floor(100000 + Math.random() * 900000)); $("#codeRow").hidden = false; toast("데모 인증번호: " + code, 6000); };
  if (!join) $("#reset").onclick = async (e) => { e.preventDefault(); const em = $("#af").email.value; if (!em) return toast("이메일을 먼저 입력하세요"); await guard(() => sendPasswordResetEmail(auth, em)); toast("재설정 메일을 보냈어요"); };
  $("#af").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    await guard(async () => {
      if (join) {
        if (!code || f.code.value.trim() !== code) return toast("휴대폰 인증을 완료하세요");
        const phone = f.phone.value.replace(/\D/g, "");
        if (phone.length < 10) return toast("휴대폰 번호를 확인하세요");
        const cred = await createUserWithEmailAndPassword(auth, f.email.value, f.pw.value);
        const uid = cred.user.uid;
        const dup = await getDoc(doc(db, "phones", phone));
        if (dup.exists()) { await cred.user.delete(); return toast("이미 등록된 번호예요 (1인 1계정)"); }
        await setDoc(doc(db, "users", uid), { name: f.name.value.trim(), gender: f.gender.value, box: f.box.value.trim(), rating: RULE.startRating, weeksPlayed: 0, wins: 0, losses: 0, upsets: 0, upsetStreak: 0, pro: false, viewer: false, phoneVerified: true, marketing: !!f.mkt.checked, createdAt: serverTimestamp() });
        await setDoc(doc(db, "phones", phone), { uid });
        toast("환영해요, " + f.name.value.trim() + "!");
      } else {
        await signInWithEmailAndPassword(auth, f.email.value, f.pw.value);
        toast("로그인했어요");
      }
      closeModal();
      await loadMe(); renderWho(); route();
    });
  };
}

/* ---------------- data loaders ---------------- */
async function loadSeason() {
  const cfg = await getDoc(doc(db, "config", "app"));
  const id = cfg.exists() && cfg.data().currentSeason ? cfg.data().currentSeason : monthId();
  S.seasonId = id;
  const sd = await getDoc(doc(db, "seasons", id));
  S.season = sd.exists() ? sd.data() : { ...defaultSeason(id), _virtual: true };
}
async function loadMe() {
  if (!S.user) { S.me = null; S.admin = false; return; }
  const d = await getDoc(doc(db, "users", S.user.uid));
  S.me = d.exists() ? { id: d.id, ...d.data() } : null;
  const a = await getDoc(doc(db, "config", "admins"));
  S.admin = a.exists() && (a.data().uids || []).includes(S.user.uid);
  S.adminsExist = a.exists();
}
async function usersBy(gender) {
  const qs = await getDocs(query(collection(db, "users"), where("gender", "==", gender)));
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function poolNumbers() {
  const c = async (q) => (await getCountFromServer(q)).data().count;
  const [pro, viewer, boxes, users] = await Promise.all([
    c(query(collection(db, "users"), where("pro", "==", true))),
    c(query(collection(db, "users"), where("viewer", "==", true), where("pro", "==", false))),
    c(query(collection(db, "boxSubs"), where("active", "==", true))).catch(() => 0),
    c(collection(db, "users")),
  ]);
  let boost = 0;
  const bs = await getDocs(query(collection(db, "boosts"), where("season", "==", S.seasonId)));
  bs.forEach((d) => (boost += d.data().amount || 0));
  const sponsors = S.season?.final?.sponsors || 0;
  const revenue = pro * RULE.pro + viewer * RULE.viewer + boxes * RULE.box;
  const pool = revenue * RULE.poolShare + boost + sponsors;
  return { pro, viewer, boxes, users, boost, sponsors, revenue, pool };
}

/* ---------------- router ---------------- */
const routes = { "": home, home, wod, rank, bracket, community, me: mePage, admin: adminPage, u: athletePage, box: boxPage };
async function route() {
  S.unsub.forEach((f) => f()); S.unsub = [];
  const [r, arg] = location.hash.replace(/^#\/?/, "").split("/");
  document.querySelectorAll("[data-r]").forEach((a) => a.classList.toggle("on", a.dataset.r === (r || "home")));
  view.innerHTML = `<div class="empty">불러오는 중…</div>`;
  await guard(() => (routes[r] || home)(arg));
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

/* ---------------- HOME ---------------- */
async function home() {
  await loadMe();
  const s = S.season, cur = s.current, ci = stageIdx(cur);
  const P = await poolNumbers().catch(() => ({ pool: 0, users: 0, pro: 0, revenue: 0, boost: 0, sponsors: 0 }));
  const goal = Math.max(1000000, Math.ceil(P.pool / 1000000) * 1000000);
  view.innerHTML = `
  <section class="hero">
    <video class="poster" src="assets/hero.mp4" autoplay muted loop playsinline poster="assets/kf/A2_s.jpg"></video>
    <div class="in">
      <div class="kicker">${esc(s.title)} · ${esc(LEVEL[cur])}</div>
      <h1>UNDERDOGS<br>CHALLENGE <em>TOP DOGS</em></h1>
      <p>크로스핏만으로 겨루는 1대1. 2주 온라인 예선 WHO'S NEXT, 16강·8강 영상 본선, 그리고 다음 달 첫 주말 박스에서 열리는 THE FINAL.</p>
      <div class="row wrap">
        <a class="btn red" href="#/wod">${s.status[cur] === "reg" ? "이번 주 참가 신청" : "이번 주 WOD 보기"}</a>
        <button class="btn ghost" id="replay">▶ THE FINAL 인트로</button>
      </div>
    </div>
  </section>

  <div class="sec"><h2>이번 달 일정</h2><small>단계마다 난이도가 올라가요</small></div>
  <div class="stages">${STAGES.map((st, i) => `
    <div class="stage ${i === ci ? "now" : i < ci ? "done" : ""}">
      <span>${st.when}</span><b>${st.key === "W1" || st.key === "W2" ? "WHO'S NEXT" : st.key === "FINAL" ? "THE FINAL" : st.name}</b>
      <span>${st.key === "W1" ? "1주차" : st.key === "W2" ? "2주차" : ""} ${esc(LEVEL[st.key])}</span><br>
      <span class="mono dim">${esc(s.dates?.[st.key] || "")}</span>
    </div>`).join("")}
  </div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card">
      <h3>실시간 상금 미터 <span class="pill gold">수익 40% + 팬 부스트 + 스폰서</span></h3>
      <div class="big num">${won(P.pool)}</div>
      <div class="meter" style="margin:12px 0"><i style="width:${Math.min(100, (P.pool / goal) * 100)}%"></i></div>
      <div class="row muted" style="font-size:13px;justify-content:space-between"><span>선수 ${P.users}명 · Pro ${P.pro}명</span><span>다음 목표 ${won(goal)}</span></div>
      <hr>
      <div class="split">
        ${[["우승", "1"], ["준우승", "2"], ["3위", "3"], ["4위", "4"], ["8강 탈락 각", "QF"], ["16강 탈락 각", "R16"]].map(([l, k]) => `<div>${l}<b>${won((P.pool / 2) * RULE.split[k])}</b></div>`).join("")}
      </div>
      <p class="dim" style="font-size:12px;margin:10px 0 0">성별 디비전별로 상금의 절반씩. 지급 시 원천징수 약 4.4% 공제. 팬 부스트는 해당 선수 상금에 더해져요.</p>
    </div>
    <div class="card cta">
      <h3>다음은 누구?</h3>
      ${S.me ? myStatusCard() : `<div class="vs"><span class="y">YOU</span><span class="dim" style="font-size:18px">vs</span><span class="w">WHO</span></div>
      <p class="muted">레이팅이 비슷한 4명이 한 포드. 이기면 오르고, 위로 도전해서 이기면 업셋. 업셋이 쌓이면 챔피언에게 도전할 수 있어요.</p>
      <button class="btn red" id="ctaJoin">선수 등록</button>`}
    </div>
  </div>

  <div class="sec"><h2>어떻게 진행되나요</h2></div>
  <div class="grid g3">
    <div class="card"><h3>① 포드 & 도전</h3><p class="muted" style="line-height:1.7;margin:0">일요일에 접수 마감, 월요일에 레이팅순 4인 포드 편성. 주 1회 무료 도전으로 나보다 최대 300점 위 선수를 지목해요. 기록은 마감 전까지 비공개.</p></div>
    <div class="card"><h3>② 예선 포인트</h3><p class="muted" style="line-height:1.7;margin:0">포드 승률 + 전체 백분위 = 예선 포인트. 2주 합산 상위 14명과 업셋 와일드카드 2명이 16강에 올라요. 미제출은 3패 처리.</p></div>
    <div class="card"><h3>③ AI 심판 → 상대 검토 → 관리자</h3><p class="muted" style="line-height:1.7;margin:0">폰에서 17개 관절을 추적해 렙을 셉니다. 측면·전신·모니터·오늘의 코드가 보이게 찍고, YouTube 일부공개 링크로 제출해요.</p></div>
  </div>
  <p class="foot">YOU vs WHO는 대학 프로젝트로 설계된 서비스예요. 결제는 데모이며 실제 금액이 청구되지 않아요. 실제 돈을 거는 베팅은 없고, 포인트로만 하는 예측 리그를 운영해요.</p>`;
  $("#replay").onclick = () => window.YVWINTRO && window.YVWINTRO.play({ force: true });
  const cj = $("#ctaJoin"); if (cj) cj.onclick = () => authModal("join");
}
function myStatusCard() {
  const m = S.me, cur = S.season.current;
  return `<div class="row"><div class="av lg">${initial(m.name)}</div><div><b style="font-size:18px">${esc(m.name)}</b>${badgeFor(m)}<div class="muted">${G[m.gender]} · ${esc(m.box || "소속 없음")}</div></div></div>
  <div class="grid g3" style="margin-top:14px"><div class="stat"><b>${Math.round(m.rating)}</b><span>레이팅</span></div><div class="stat"><b>${m.wins || 0}-${m.losses || 0}</b><span>포드 전적</span></div><div class="stat"><b>${m.upsets || 0}</b><span>업셋</span></div></div>
  <a class="btn red block" style="margin-top:14px" href="#/wod">${esc(STAGES[stageIdx(cur)].name)} 바로가기</a>`;
}

/* ---------------- WOD (this week) ---------------- */
async function wod() {
  const s = S.season, cur = s.current, st = STAGES[stageIdx(cur)], w = s.wods[cur] || {}, status = s.status[cur];
  const stKey = S.seasonId + "_" + cur;
  let entry = null, pod = null, sub = null, ch = null, res = null;
  if (S.user) {
    entry = (await getDoc(doc(db, "entries", stKey + "_" + S.user.uid))).data() || null;
    sub = (await getDoc(doc(db, "subs", stKey + "_" + S.user.uid))).data() || null;
    ch = (await getDoc(doc(db, "challenges", stKey + "_" + S.user.uid))).data() || null;
    if (entry?.podId) { const p = await getDoc(doc(db, "pods", entry.podId)); pod = p.exists() ? { id: p.id, ...p.data() } : null; }
  }
  const rd = await getDoc(doc(db, "results", stKey)); res = rd.exists() ? rd.data() : null;
  const statusLabel = { reg: "참가 접수 중 (일요일 마감)", live: "진행 중 · 기록 제출 가능", closed: "마감 · 결과 공개", wait: "준비 중" }[status] || status;
  const code = dailyCode();
  view.innerHTML = `
  <div class="row wrap"><div><div class="kicker">${esc(s.title)} · ${esc(st.when)}</div><h1 class="disp" style="font-size:40px;margin-top:6px">${esc(w.title || st.name)}</h1></div><span class="sp"></span><span class="pill ${status === "live" ? "red" : status === "closed" ? "green" : ""}">${statusLabel}</span></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>WOD <span class="pill">${esc(LEVEL[cur])}</span></h3><pre class="mono" style="white-space:pre-wrap;font-size:15px;line-height:1.7;margin:0">${esc(w.desc || "")}</pre>
      <hr><div class="row wrap" style="font-size:13px"><span class="pill">기록: ${w.scoring === "time" ? "시간 (낮을수록 좋음)" : "렙/무게 (높을수록 좋음)"}</span><span class="pill">오늘의 코드 <b class="mono" style="color:var(--ink)">${code}</b></span></div>
      <p class="dim" style="font-size:12px;margin:10px 0 0">촬영 규정: 측면에서 전신이 보이게, 기구 모니터와 바·턱 높이가 화면에 들어오게, 시작 전 오늘의 코드를 종이에 써서 비춰 주세요. 판독할 수 없는 렙은 선수 페널티예요.</p>
    </div>
    <div class="card" id="act"></div>
  </div>
  <div id="podBox"></div>
  <div id="resBox"></div>`;
  const act = $("#act");
  // action panel
  if (st.kind === "final") {
    act.innerHTML = `<h3>THE FINAL · 오프라인</h3><p style="font-size:18px;font-weight:700;margin:0">${esc(s.final.box)}</p><p class="muted">${esc(s.dates.FINAL)} ${esc(s.final.time)} · ${esc(s.final.addr)}</p><p class="muted">${esc(s.final.note)}</p>${s.final.stream ? `<a class="btn red" target="_blank" rel="noopener" href="${esc(s.final.stream)}">무료 라이브 보기</a>` : `<span class="pill">라이브 링크는 결승 당일 공개</span>`}`;
  } else if (!S.user) {
    act.innerHTML = `<h3>참가하려면</h3><p class="muted">로그인하면 신청·포드·도전·기록 제출을 할 수 있어요. 둘러보기는 로그인 없이 가능해요.</p><button class="btn red" id="li">로그인 / 가입</button>`;
    $("#li").onclick = () => authModal("login");
  } else if (!S.me) {
    act.innerHTML = `<p class="muted">선수 프로필이 없어요. 다시 로그인해 주세요.</p>`;
  } else if (st.kind === "video") {
    const inB = (s.bracket?.[S.me.gender]?.[cur] || []).some((m) => m[0] === S.user.uid || m[1] === S.user.uid);
    act.innerHTML = inB ? submitPanel(w, sub, status, null) : `<h3>${esc(st.name)}</h3><p class="muted">이번 라운드 대진에 없어요. 본선 탭에서 경기를 볼 수 있어요.</p><a class="btn ghost" href="#/bracket">본선 대진표</a>`;
  } else if (status === "reg") {
    act.innerHTML = entry
      ? `<h3>신청 완료</h3><p class="muted">일요일 마감 후 월요일에 레이팅이 비슷한 4명으로 포드가 편성돼요.</p><p>현재 레이팅 <b class="num">${Math.round(S.me.rating)}</b></p><button class="btn ghost sm" id="cancel">신청 취소</button>`
      : `<h3>참가 신청</h3><p class="muted">예선은 무료예요. 16강부터는 선수 Pro 구독(${won(RULE.pro)}/월)이 필요해요.</p><button class="btn red block" id="enter">${esc(st.name)} 신청하기</button>`;
    const en = $("#enter"); if (en) en.onclick = () => guard(async () => { await setDoc(doc(db, "entries", stKey + "_" + S.user.uid), { uid: S.user.uid, stage: stKey, gender: S.me.gender, rating: S.me.rating, name: S.me.name, at: serverTimestamp() }); toast("신청 완료!"); route(); });
    const cn = $("#cancel"); if (cn) cn.onclick = () => guard(async () => { await deleteDoc(doc(db, "entries", stKey + "_" + S.user.uid)); toast("신청을 취소했어요"); route(); });
  } else if (status === "live") {
    act.innerHTML = entry ? submitPanel(w, sub, status, ch) : `<h3>이번 주 미신청</h3><p class="muted">접수가 마감됐어요. 다음 주차에 신청해 주세요.</p>`;
  } else {
    act.innerHTML = `<h3>마감</h3><p class="muted">결과가 아래에 공개돼요.</p>`;
  }
  wireSubmit(w, stKey, sub, ch, status);
  // pod
  if (pod) {
    const mates = await Promise.all(pod.members.map(async (u) => { const d = await getDoc(doc(db, "users", u)); return { id: u, ...(d.data() || {}) }; }));
    const rrow = (u) => res?.rows?.find((r) => r.uid === u.id);
    $("#podBox").innerHTML = `<div class="sec"><h2>내 포드 · ${esc(pod.label || pod.id.split("_").pop())}</h2><small>${status === "closed" ? "결과 공개" : "기록은 마감 전까지 비공개"}</small></div>
    <div class="pod">${mates.sort((a, b) => b.rating - a.rating).map((u) => { const r = rrow(u); return `<a class="pm" href="#/u/${u.id}"><div class="av">${initial(u.name)}</div><div class="sp"><b>${esc(u.name)}</b>${badgeFor(u)}<div class="dim" style="font-size:12px">${esc(u.box || "")}</div></div><span class="num">${Math.round(u.rating)}</span>${r ? `<span class="pill ${r.podW > r.podL ? "green" : ""}">${r.score} · ${r.podW}승 ${r.podL}패</span>` : u.id === S.user?.uid ? `<span class="pill blue">나</span>` : `<span class="pill">🔒</span>`}</a>`; }).join("")}</div>`;
  }
  if (res) renderResults(res, w);
}
function dailyCode() { const d = new Date(); const n = (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) * 7919 % 9000 + 1000; return "YW-" + n; }
function submitPanel(w, sub, status, ch) {
  const isQual = STAGES[stageIdx(S.season.current)].kind === "qual";
  const lock = status !== "live";
  return `<h3>기록 제출 ${sub ? `<span class="pill green">제출됨</span>` : ""}</h3>
  ${isQual ? `<div class="note" style="margin-bottom:10px">${ch ? `도전 선언: <b>${esc(ch.toName)}</b> (${Math.round(ch.toRating)}) — 이 선수보다 기록이 좋으면 업셋!` : `도전은 <b>기록 제출 전에</b> 선언해야 해요. 주 1회 무료.`} ${!ch && !sub ? `<button class="btn sm red" id="chBtn" style="margin-left:6px">도전 상대 고르기</button>` : ""}</div>` : ""}
  <form id="sf">
    ${w.scoring === "time" ? `<div class="grid g2"><div><label>완료 시간 (분:초)</label><input name="time" placeholder="08:41" pattern="\\d{1,2}:\\d{2}"></div><div><label>타임캡에 걸렸다면 남은 렙</label><input name="capReps" type="number" min="0" placeholder="비워두면 완주"></div></div>`
      : `<label>기록 (${esc(w.unit || "reps")})</label><input name="value" type="number" step="any" min="0" required>`}
    <label>영상 링크 (YouTube 일부공개)</label><input name="video" placeholder="https://youtu.be/..." required value="${esc(sub?.video || "")}">
    <div class="row wrap" style="margin-top:12px"><button type="button" class="btn ghost sm" id="judgeBtn">📱 AI 심판으로 렙 확인</button><span class="dim" style="font-size:12px" id="judgeRes">${sub?.ai ? `AI: ${sub.ai.reps}렙 · NO REP ${sub.ai.noReps}${sub.ai.unreadable ? " · 판독 불가 구간 있음" : ""}` : "폰에 저장된 영상으로 바로 판독해요 (서버 업로드 없음)"}</span></div>
    <button class="btn red block" style="margin-top:14px" ${lock ? "disabled" : ""}>${sub ? "기록 수정" : "기록 제출"}</button>
  </form>`;
}
function wireSubmit(w, stKey, sub, ch, status) {
  const f = $("#sf"); if (!f) return;
  let ai = sub?.ai || null;
  $("#judgeBtn").onclick = () => openJudge(w.move || "cj", (r) => { ai = r; $("#judgeRes").textContent = `AI: ${r.reps}렙 · NO REP ${r.noReps}${r.unreadable ? " · 판독 불가 구간 있음 (선수 페널티 대상)" : ""}`; });
  const chb = $("#chBtn"); if (chb) chb.onclick = () => challengeModal(stKey);
  f.onsubmit = (e) => {
    e.preventDefault();
    guard(async () => {
      const video = f.video.value.trim();
      if (!ytId(video)) return toast("YouTube 링크를 확인해 주세요");
      let data = { uid: S.user.uid, stage: stKey, gender: S.me.gender, video, ai, verdict: "pending", at: serverTimestamp() };
      if (w.scoring === "time") {
        const capR = f.capReps.value === "" ? null : Number(f.capReps.value);
        if (capR != null) { data.capped = true; data.capReps = capR; data.timeSec = (w.cap || 12) * 60; data.sortKey = (w.cap || 12) * 60 + capR; }
        else { const m = f.time.value.match(/^(\d{1,2}):(\d{2})$/); if (!m) return toast("시간을 08:41 형식으로 입력하세요"); data.capped = false; data.timeSec = +m[1] * 60 + +m[2]; data.sortKey = data.timeSec; if (data.timeSec > (w.cap || 99) * 60) return toast("타임캡을 넘었어요. 남은 렙으로 입력하세요"); }
      } else { data.value = Number(f.value.value); data.sortKey = -data.value; }
      await setDoc(doc(db, "subs", stKey + "_" + S.user.uid), data);
      toast("제출 완료! 마감 전까지 다른 선수에게 기록은 보이지 않아요.");
      route();
    });
  };
}
async function challengeModal(stKey) {
  const me = S.me, streak = me.upsetStreak || 0;
  const range = RULE.ladderBase + RULE.ladderStep * streak;
  const all = (await usersBy(me.gender)).filter((u) => u.id !== S.user.uid);
  const entered = new Set((await getDocs(query(collection(db, "entries"), where("stage", "==", stKey)))).docs.map((d) => d.data().uid));
  const top = all.sort((a, b) => b.rating - a.rating)[0];
  const champRight = streak >= RULE.champStreak;
  const ok = all.filter((u) => entered.has(u.id) && u.rating > me.rating && (u.rating - me.rating <= range || (champRight && (u.defending || u.id === top?.id))));
  modal(`<h2>도전 상대 고르기</h2><p class="muted">내 레이팅 ${Math.round(me.rating)} · 도전 범위 +${range}점${champRight ? " · <b style='color:var(--gold)'>챔피언 도전권 보유</b>" : ""}<br>업셋에 성공할 때마다 범위가 100점씩 넓어져요. 상대가 미제출이면 도전은 무효예요.</p>
  ${ok.length ? `<div class="pod">${ok.sort((a, b) => a.rating - b.rating).map((u) => `<button class="pm" style="text-align:left;cursor:pointer" data-u="${u.id}"><div class="av">${initial(u.name)}</div><div class="sp"><b>${esc(u.name)}</b>${badgeFor(u)}<div class="dim" style="font-size:12px">+${Math.round(u.rating - me.rating)}점 위</div></div><span class="num">${Math.round(u.rating)}</span></button>`).join("")}</div>` : `<div class="empty">지금 범위 안에 이번 주 참가한 상위 선수가 없어요.</div>`}
  <button class="btn ghost block" style="margin-top:12px" onclick="closeModal()">닫기</button>`);
  document.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => guard(async () => {
    const u = ok.find((x) => x.id === b.dataset.u);
    const sub = await getDoc(doc(db, "subs", stKey + "_" + S.user.uid));
    if (sub.exists()) return toast("기록 제출 후에는 도전할 수 없어요");
    await setDoc(doc(db, "challenges", stKey + "_" + S.user.uid), { from: S.user.uid, fromName: me.name, fromRating: me.rating, to: u.id, toName: u.name, toRating: u.rating, stage: stKey, gender: me.gender, status: "declared", at: serverTimestamp() });
    closeModal(); toast(u.name + "에게 도전장을 보냈어요!"); route();
  })));
}
function renderResults(res, w) {
  const box = $("#resBox");
  const rows = res.rows || [];
  const byG = { M: rows.filter((r) => r.gender === "M"), F: rows.filter((r) => r.gender === "F") };
  const tbl = (arr) => arr.length ? `<table><tr><th>#</th><th>선수</th><th>기록</th><th class="r">포드</th><th class="r">백분위</th><th class="r">예선P</th><th class="r">레이팅</th></tr>${arr.map((r, i) => `<tr class="${r.uid === S.user?.uid ? "me" : ""}"><td class="rk">${i + 1}</td><td><a href="#/u/${r.uid}">${esc(r.name)}</a>${r.upset ? ` <span class="pill red">UPSET</span>` : ""}${r.flag ? ` <span class="pill gold">검토</span>` : ""}</td><td class="mono">${esc(r.score)}</td><td class="r mono">${r.podW}-${r.podL}</td><td class="r mono">${pct(r.pct)}</td><td class="r mono">${r.qp.toFixed(1)}</td><td class="r mono">${r.dr >= 0 ? "+" : ""}${Math.round(r.dr)}</td></tr>`).join("")}</table>` : `<div class="empty">결과 없음</div>`;
  box.innerHTML = `<div class="sec"><h2>전체 결과</h2><small>영상은 상대 검토 후 관리자 확정</small></div><div class="grid g2"><div class="card"><h3>남자</h3>${tbl(byG.M)}</div><div class="card"><h3>여자</h3>${tbl(byG.F)}</div></div>`;
}

/* ---------------- AI judge modal ---------------- */
function openJudge(move, done) {
  modal(`<h2>AI 심판</h2><p class="muted" style="margin-top:0">영상은 이 기기에서만 분석돼요. 17개 관절을 추적해 렙과 NO REP을 셉니다.</p>
  <div class="row wrap"><select id="jm" style="width:auto"><option value="cj">클린 & 저크 / 오버헤드 락아웃</option><option value="mu">링·바 머슬업</option><option value="squat">스쿼트·월볼 (힙이 무릎 아래)</option><option value="generic">팔 오버헤드 (푸시업·풀업 대체)</option></select>
  <label class="btn ghost sm" style="margin:0">영상 선택<input type="file" id="jf" accept="video/*" hidden></label></div>
  <div class="judge" style="margin-top:12px"><canvas id="jc" width="640" height="360"></canvas><div class="hud" id="jh"><span class="pill">대기</span></div></div>
  <p class="dim" style="font-size:12px">AI 판독은 1차 기준이에요. 이후 상대 선수 검토 → 관리자 확정 순서로 결정돼요. 관절이 화면 밖이거나 가려진 구간은 '판독 불가'로 표시되고 그 렙은 인정되지 않아요.</p>
  <div class="row"><button class="btn ghost" onclick="closeModal()">닫기</button><span class="sp"></span><button class="btn red" id="jok" disabled>이 결과 사용</button></div>`, true);
  $("#jm").value = move;
  let result = null;
  $("#jf").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const j = new AIJudge($("#jc"), (h) => { $("#jh").innerHTML = h; });
    try { result = await j.run(file, $("#jm").value); $("#jok").disabled = false; }
    catch (err) { console.error(err); $("#jh").innerHTML = `<span class="pill red">모델 로드 실패: 네트워크를 확인하세요</span>`; }
  };
  $("#jok").onclick = () => { closeModal(); done(result); };
}

/* ---------------- RANK ---------------- */
async function rank(arg) {
  const g = arg === "F" ? "F" : (arg === "M" ? "M" : S.me?.gender || "M");
  const users = (await usersBy(g)).sort((a, b) => b.rating - a.rating);
  const stq = await getDocs(query(collection(db, "standings"), where("season", "==", S.seasonId), where("gender", "==", g)));
  const st = stq.docs.map((d) => d.data()).sort((a, b) => b.qp - a.qp);
  const field = st.length;
  const top14 = new Set(st.slice(0, RULE.qualifiers).map((x) => x.uid));
  const wc = st.filter((x) => !top14.has(x.uid) && x.pctAvg >= 1 - RULE.wildcardPct).sort((a, b) => b.upsetScore - a.upsetScore).slice(0, RULE.wildcards);
  const wcs = new Set(wc.map((x) => x.uid));
  view.innerHTML = `
  <div class="row wrap"><h1 class="disp" style="font-size:38px">랭킹</h1><span class="sp"></span><div class="seg"><button class="${g === "M" ? "on" : ""}" onclick="location.hash='#/rank/M'">남자</button><button class="${g === "F" ? "on" : ""}" onclick="location.hash='#/rank/F'">여자</button></div></div>
  <p class="muted">숫자는 두 개뿐이에요. <b>레이팅</b>은 통산 실력(매칭에만 사용), <b>예선 포인트</b>는 이번 시리즈 16강 진출 기준. 시상대는 대진 결과로만 정해져요.</p>
  <div class="grid g2">
    <div class="card"><h3>예선 포인트 · ${esc(S.season.title)} <span class="pill">${field}명</span></h3>
      ${st.length ? `<table><tr><th>#</th><th>선수</th><th class="r">예선P</th><th class="r">업셋점수</th><th></th></tr>${st.map((x, i) => `<tr class="${x.uid === S.user?.uid ? "me" : ""}"><td class="rk">${i + 1}</td><td><a href="#/u/${x.uid}">${esc(x.name)}</a></td><td class="r mono">${x.qp.toFixed(1)}</td><td class="r mono">${Math.round(x.upsetScore || 0)}</td><td class="r">${!x.pro && (top14.has(x.uid) || wcs.has(x.uid)) ? `<span class="pill">Pro 필요</span>` : top14.has(x.uid) ? `<span class="pill green">진출권</span>` : wcs.has(x.uid) ? `<span class="pill gold">와일드카드</span>` : ""}</td></tr>`).join("")}</table>` : `<div class="empty">아직 마감된 예선 주차가 없어요.</div>`}
      <p class="dim" style="font-size:12px">상위 ${RULE.qualifiers}명 + 와일드카드 ${RULE.wildcards}명(업셋 점수 합계 최상위, 전체 상위 ${RULE.wildcardPct * 100}% 이내). 16강은 선수 Pro 구독자만 출전.</p>
    </div>
    <div class="card"><h3>레이팅 (통산)</h3>
      ${users.length ? `<table><tr><th>#</th><th>선수</th><th>박스</th><th class="r">레이팅</th></tr>${users.slice(0, 100).map((u, i) => `<tr class="${u.id === S.user?.uid ? "me" : ""}"><td class="rk">${i + 1}</td><td><a href="#/u/${u.id}">${esc(u.name)}</a>${badgeFor(u)}</td><td class="dim">${esc(u.box || "")}</td><td class="r mono">${Math.round(u.rating)}</td></tr>`).join("")}</table>` : `<div class="empty">아직 선수가 없어요.</div>`}
    </div>
  </div>`;
}

/* ---------------- BRACKET ---------------- */
async function bracket(arg) {
  const g = arg === "F" ? "F" : (arg === "M" ? "M" : S.me?.gender || "M");
  const b = S.season.bracket?.[g] || {};
  const names = S.season.bracketNames || {};
  const seeds = S.season.bracketSeeds?.[g] || {};
  const nm = (u) => (u ? `<span class="seed">${seeds[u] || ""}</span>${esc(names[u] || "—")}` : `<span class="dim">미정</span>`);
  const mt = (m) => `<div class="mt"><div class="${m[2] ? (m[2] === m[0] ? "w" : "l") : ""}"><span>${nm(m[0])}</span></div><div class="${m[2] ? (m[2] === m[1] ? "w" : "l") : ""}"><span>${nm(m[1])}</span></div></div>`;
  const col = (k, n, label) => `<div class="col"><h4>${label}</h4>${(b[k] || Array.from({ length: n }, () => [null, null, null])).map(mt).join("")}</div>`;
  const preds = S.user ? (await getDoc(doc(db, "predictions", S.seasonId + "_" + S.user.uid))).data() || { picks: {} } : { picks: {} };
  view.innerHTML = `
  <div class="row wrap"><h1 class="disp" style="font-size:38px">본선</h1><span class="sp"></span><div class="seg"><button class="${g === "M" ? "on" : ""}" onclick="location.hash='#/bracket/M'">남자</button><button class="${g === "F" ? "on" : ""}" onclick="location.hash='#/bracket/F'">여자</button></div></div>
  <p class="muted">16강·8강은 영상, 4강부터는 다음 달 첫 주말 개최 박스에서 오프라인으로. 결승 진출자가 못 오면 8강 탈락자 중 예선 포인트 최상위가 대체 출전해요.</p>
  <div class="card" style="overflow-x:auto"><div class="bk">${col("R16", 8, "16강 · 영상")}${col("QF", 4, "8강 · 영상")}${col("SF", 2, "4강 · 박스")}<div class="col"><h4>결승 · 3·4위전</h4>${(b.F || [[null, null, null]]).map(mt).join("")}${(b.P3 || [[null, null, null]]).map(mt).join("")}</div></div></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>THE FINAL</h3><p style="font-size:20px;font-weight:900;margin:0">${esc(S.season.final.box)}</p><p class="muted">${esc(S.season.dates.FINAL)} ${esc(S.season.final.time)} ${esc(S.season.final.addr || "")}</p><p class="muted">${esc(S.season.final.note)}</p>${S.season.final.stream ? `<a class="btn red" href="${esc(S.season.final.stream)}" target="_blank" rel="noopener">무료 라이브</a>` : ""}</div>
    <div class="card"><h3>예측 리그 <span class="pill gold">포인트 전용 · 스폰서 경품</span></h3><p class="muted" style="margin-top:0">경기마다 이길 선수를 고르세요. 맞히면 10점, 낮은 시드가 이기는 업셋을 맞히면 +5점. 실제 돈은 걸지 않아요.</p><div id="predBox"></div></div>
  </div>`;
  // predictions on open matches
  const open = [];
  ["R16", "QF", "SF", "F", "P3"].forEach((k) => (b[k] || []).forEach((m, i) => { if (m[0] && m[1] && !m[2]) open.push({ k, i, m }); }));
  const pb = $("#predBox");
  pb.innerHTML = open.length ? open.slice(0, 8).map(({ k, i, m }) => { const key = `${g}_${k}_${i}`; const p = preds.picks?.[key]; return `<div class="row" style="margin:8px 0"><span class="pill">${k}</span>${[m[0], m[1]].map((u) => `<button class="btn sm ${p === u ? "red" : "ghost"}" data-pk="${key}" data-u="${u}">${esc(names[u])}</button>`).join("<span class='dim'>vs</span>")}</div>`; }).join("") : `<div class="empty">지금 예측할 경기가 없어요.</div>`;
  pb.querySelectorAll("[data-pk]").forEach((bt) => (bt.onclick = () => { if (needLogin()) return; guard(async () => { await setDoc(doc(db, "predictions", S.seasonId + "_" + S.user.uid), { uid: S.user.uid, name: S.me?.name || "", season: S.seasonId, picks: { ...(preds.picks || {}), [bt.dataset.pk]: bt.dataset.u } }, { merge: true }); toast("예측 저장!"); route(); }); }));
}

/* ---------------- COMMUNITY ---------------- */
async function community() {
  view.innerHTML = `
  <h1 class="disp" style="font-size:38px">커뮤니티</h1>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>피드</h3>
      ${S.user ? `<form id="pf"><textarea name="t" rows="3" maxlength="500" placeholder="이번 주 WOD 후기, 도전 선언, 박스 소식…" required></textarea><div class="row" style="margin-top:8px"><span class="dim" style="font-size:12px">욕설·비방은 관리자가 삭제해요</span><span class="sp"></span><button class="btn red sm">올리기</button></div></form>` : `<p class="muted">로그인하면 글을 쓸 수 있어요.</p>`}
      <div id="feed"></div></div>
    <div class="card"><h3>예측 리그 순위</h3><div id="plb"></div></div>
  </div>`;
  const pf = $("#pf");
  if (pf) pf.onsubmit = (e) => { e.preventDefault(); guard(async () => { await addDoc(collection(db, "feed"), { uid: S.user.uid, name: S.me?.name || "선수", text: pf.t.value.trim().slice(0, 500), at: serverTimestamp() }); pf.reset(); }); };
  S.unsub.push(onSnapshot(query(collection(db, "feed"), orderBy("at", "desc"), limit(50)), (qs) => {
    $("#feed").innerHTML = qs.empty ? `<div class="empty">첫 글을 남겨 보세요.</div>` : qs.docs.map((d) => { const p = d.data(); return `<div class="post"><div class="meta"><a href="#/u/${p.uid}"><b style="color:var(--ink)">${esc(p.name)}</b></a> · ${p.at ? new Date(p.at.seconds * 1000).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "방금"} ${p.uid === S.user?.uid || S.admin ? `<a href="#" data-del="${d.id}" class="dim">삭제</a>` : ""}</div><p>${esc(p.text)}</p></div>`; }).join("");
    document.querySelectorAll("[data-del]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); guard(() => deleteDoc(doc(db, "feed", a.dataset.del))); }));
  }));
  // prediction leaderboard
  const ps = await getDocs(query(collection(db, "predictions"), where("season", "==", S.seasonId)));
  const scores = ps.docs.map((d) => { const p = d.data(); return { name: p.name, uid: p.uid, pts: predPoints(p.picks || {}) }; }).sort((a, b) => b.pts - a.pts);
  $("#plb").innerHTML = scores.length ? `<table>${scores.slice(0, 20).map((s, i) => `<tr><td class="rk">${i + 1}</td><td>${esc(s.name)}</td><td class="r mono">${s.pts}점</td></tr>`).join("")}</table>` : `<div class="empty">아직 예측이 없어요.</div>`;
}
function predPoints(picks) {
  let pts = 0; const B = S.season.bracket || {}, seeds = S.season.bracketSeeds || {};
  Object.entries(picks).forEach(([key, u]) => { const [g, k, i] = key.split("_"); const m = B[g]?.[k]?.[+i]; if (m && m[2] && m[2] === u) { pts += 10; const sd = seeds[g] || {}; const other = m[0] === u ? m[1] : m[0]; if ((sd[u] || 99) > (sd[other] || 99)) pts += 5; } });
  return pts;
}

/* ---------------- ME ---------------- */
async function mePage() {
  if (!S.user) { view.innerHTML = `<div class="card"><h3>내 정보</h3><p class="muted">로그인하면 레이팅·구독·기록을 관리할 수 있어요.</p><div class="row"><button class="btn red" id="a1">로그인</button><button class="btn ghost" id="a2">가입</button></div><hr><button class="btn ghost" id="rp">▶ 인트로 다시 보기</button></div>`; $("#a1").onclick = () => authModal("login"); $("#a2").onclick = () => authModal("join"); $("#rp").onclick = () => window.YVWINTRO?.play({ force: true }); return; }
  await loadMe(); renderWho();
  const m = S.me || {};
  if (!S.me && S.user) { view.innerHTML = `<div class="card"><p class="muted">프로필을 불러오지 못했어요.</p><button class="btn ghost" id="lo">로그아웃</button></div>`; $("#lo").onclick = () => signOut(auth); return; }
  const boosts = await getDocs(query(collection(db, "boosts"), where("to", "==", S.user.uid)));
  let bsum = 0; boosts.forEach((d) => (bsum += d.data().amount || 0));
  view.innerHTML = `
  <div class="card"><div class="row wrap"><div class="av lg">${initial(m.name)}</div><div><h2 style="font-size:24px">${esc(m.name)}${badgeFor(m)}</h2><div class="muted">${G[m.gender]} · ${esc(m.box || "소속 없음")} · ${esc(S.user.email)}</div></div><span class="sp"></span><a class="btn ghost sm" href="#/u/${S.user.uid}">공개 프로필</a></div>
  <div class="grid g4" style="margin-top:16px"><div class="stat"><b>${Math.round(m.rating)}</b><span>레이팅 ${(m.weeksPlayed || 0) < RULE.placementWeeks ? "(배치 중)" : ""}</span></div><div class="stat"><b>${m.wins || 0}-${m.losses || 0}</b><span>포드 전적</span></div><div class="stat"><b>${m.upsets || 0}</b><span>업셋 (연속 ${m.upsetStreak || 0})</span></div><div class="stat"><b>${won(bsum)}</b><span>받은 팬 부스트</span></div></div></div>

  <div class="sec"><h2>구독</h2><small>데모 결제 · 실제 청구 없음</small></div>
  <div class="grid g3">
    <div class="card"><h3>선수 Pro <span class="pill ${m.pro ? "green" : ""}">${m.pro ? "구독 중" : "미구독"}</span></h3><div class="big num" style="font-size:32px">${won(RULE.pro)}<small class="muted" style="font-size:14px">/월</small></div><p class="muted" style="font-size:14px;line-height:1.6">16강 이상 본선 출전 자격 · 관전 패스 포함 · 본선 참가비 없음</p><button class="btn ${m.pro ? "ghost" : "red"} block" data-sub="pro">${m.pro ? "구독 해지" : "Pro 시작하기"}</button></div>
    <div class="card"><h3>관전 패스 <span class="pill ${m.viewer || m.pro ? "green" : ""}">${m.pro ? "Pro 포함" : m.viewer ? "구독 중" : "미구독"}</span></h3><div class="big num" style="font-size:32px">${won(RULE.viewer)}<small class="muted" style="font-size:14px">/월</small></div><p class="muted" style="font-size:14px;line-height:1.6">AI 판독 리플레이 · 다시보기 · 광고 제거. 결승 라이브는 누구나 무료.</p><button class="btn ghost block" data-sub="viewer" ${m.pro ? "disabled" : ""}>${m.viewer ? "해지" : "관전 패스 시작"}</button></div>
    <div class="card"><h3>박스 대시보드</h3><div class="big num" style="font-size:32px">${won(RULE.box)}<small class="muted" style="font-size:14px">/월</small></div><p class="muted" style="font-size:14px;line-height:1.6">소속 회원 레이팅·기록 관리, 결승 개최 신청 우선권.</p><a class="btn ghost block" href="#/box/${encodeURIComponent(m.box || "")}">대시보드 열기</a></div>
  </div>

  <div class="sec"><h2>프로필 수정</h2></div>
  <form class="card" id="pfm"><div class="grid g2"><div><label>선수 이름</label><input name="name" value="${esc(m.name)}" maxlength="20"></div><div><label>소속 박스</label><input name="box" value="${esc(m.box || "")}" maxlength="30"></div></div><button class="btn ghost" style="margin-top:12px">저장</button></form>

  <div class="row wrap" style="margin-top:18px"><button class="btn ghost" id="rp">▶ 인트로 다시 보기</button>${!S.adminsExist ? `<button class="btn ghost" id="claim">관리자 등록 (최초 1회)</button>` : ""}<span class="sp"></span><button class="btn ghost" id="lo">로그아웃</button></div>`;
  $("#lo").onclick = () => signOut(auth);
  $("#rp").onclick = () => window.YVWINTRO?.play({ force: true });
  const cl = $("#claim"); if (cl) cl.onclick = () => guard(async () => { await setDoc(doc(db, "config", "admins"), { uids: [S.user.uid], at: serverTimestamp() }); toast("관리자로 등록됐어요"); await loadMe(); renderWho(); route(); });
  $("#pfm").onsubmit = (e) => { e.preventDefault(); guard(async () => { await updateDoc(doc(db, "users", S.user.uid), { name: e.target.name.value.trim(), box: e.target.box.value.trim() }); await loadMe(); toast("저장했어요"); route(); }); };
  document.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => payModal(b.dataset.sub)));
}
function payModal(kind) {
  const m = S.me, on = kind === "pro" ? m.pro : m.viewer;
  if (on) return guard(async () => { await updateDoc(doc(db, "users", S.user.uid), { [kind]: false }); await loadMe(); toast("해지했어요"); route(); });
  const price = kind === "pro" ? RULE.pro : RULE.viewer;
  modal(`<h2>${kind === "pro" ? "선수 Pro" : "관전 패스"} 구독</h2><p class="muted">월 ${won(price)} · 언제든 해지</p><div class="note">데모 결제예요. 카드 정보를 받지 않고, 실제로 청구되지 않아요. 실제 운영에서는 PG사 정기결제로 연결돼요.</div><button class="btn red block" style="margin-top:14px" id="pay">데모 결제 완료</button><button class="btn ghost block" style="margin-top:8px" onclick="closeModal()">취소</button>`);
  $("#pay").onclick = () => guard(async () => { await updateDoc(doc(db, "users", S.user.uid), { [kind]: true, [kind + "Since"]: serverTimestamp() }); closeModal(); await loadMe(); toast("구독 시작! 상금 미터에 반영돼요."); route(); });
}

/* ---------------- ATHLETE PAGE ---------------- */
async function athletePage(uid) {
  const d = await getDoc(doc(db, "users", uid)); if (!d.exists()) { view.innerHTML = `<div class="empty">선수를 찾을 수 없어요.</div>`; return; }
  const u = d.data();
  const bs = await getDocs(query(collection(db, "boosts"), where("to", "==", uid)));
  let sum = 0; bs.forEach((x) => (sum += x.data().amount || 0));
  view.innerHTML = `<div class="card"><div class="row wrap"><div class="av lg">${initial(u.name)}</div><div><h2 style="font-size:26px">${esc(u.name)}${badgeFor(u)}</h2><div class="muted">${G[u.gender]} · ${esc(u.box || "소속 없음")}</div></div></div>
  <div class="grid g4" style="margin-top:16px"><div class="stat"><b>${Math.round(u.rating)}</b><span>레이팅</span></div><div class="stat"><b>${u.wins || 0}-${u.losses || 0}</b><span>포드 전적</span></div><div class="stat"><b>${u.upsets || 0}</b><span>업셋</span></div><div class="stat"><b>${won(sum)}</b><span>팬 부스트 누적</span></div></div></div>
  <div class="card cta" style="margin-top:14px"><h3>팬 부스트</h3><p class="muted" style="margin-top:0">응원하는 선수의 상금에 직접 더해져요 (데모 결제).</p><div class="row wrap">${[1000, 5000, 10000].map((a) => `<button class="btn ghost" data-b="${a}">${won(a)}</button>`).join("")}</div></div>`;
  document.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { if (needLogin()) return; guard(async () => { await addDoc(collection(db, "boosts"), { to: uid, toName: u.name, from: S.user.uid, amount: Number(b.dataset.b), season: S.seasonId, at: serverTimestamp() }); toast("부스트 완료! " + won(+b.dataset.b)); route(); }); }));
}

/* ---------------- BOX DASHBOARD ---------------- */
async function boxPage(name) {
  name = decodeURIComponent(name || S.me?.box || "");
  const members = name ? (await getDocs(query(collection(db, "users"), where("box", "==", name)))).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.rating - a.rating) : [];
  view.innerHTML = `<div class="row wrap"><h1 class="disp" style="font-size:36px">박스 대시보드</h1><span class="sp"></span><span class="pill">${won(RULE.box)}/월 · 데모</span></div>
  <form class="row" id="bf" style="margin:14px 0"><input name="b" value="${esc(name)}" placeholder="박스 이름"><button class="btn ghost">보기</button></form>
  ${name ? `<div class="grid g3"><div class="card stat"><b>${members.length}</b><span>등록 회원</span></div><div class="card stat"><b>${members.length ? Math.round(members.reduce((a, b) => a + b.rating, 0) / members.length) : "-"}</b><span>평균 레이팅</span></div><div class="card stat"><b>${members.reduce((a, b) => a + (b.upsets || 0), 0)}</b><span>회원 업셋 합계</span></div></div>
  <div class="card" style="margin-top:14px"><h3>${esc(name)} 회원</h3>${members.length ? `<table><tr><th>선수</th><th>성별</th><th class="r">레이팅</th><th class="r">전적</th></tr>${members.map((u) => `<tr><td><a href="#/u/${u.id}">${esc(u.name)}</a>${badgeFor(u)}</td><td>${G[u.gender]}</td><td class="r mono">${Math.round(u.rating)}</td><td class="r mono">${u.wins || 0}-${u.losses || 0}</td></tr>`).join("")}</table>` : `<div class="empty">이 이름으로 등록한 회원이 없어요.</div>`}</div>
  <div class="card" style="margin-top:14px"><h3>결승 개최 신청</h3><p class="muted">레인 2개 이상, 로잉 머신 2대, 링, 컬러 범퍼 플레이트를 갖춘 박스면 신청할 수 있어요.</p><button class="btn red" id="host">이 박스로 개최 신청</button></div>` : `<div class="empty">박스 이름을 입력하세요.</div>`}`;
  $("#bf").onsubmit = (e) => { e.preventDefault(); location.hash = "#/box/" + encodeURIComponent(e.target.b.value.trim()); };
  const h = $("#host"); if (h) h.onclick = () => { if (needLogin()) return; guard(async () => { await addDoc(collection(db, "hostApps"), { box: name, uid: S.user.uid, season: S.seasonId, at: serverTimestamp() }); toast("개최 신청을 보냈어요"); }); };
}

/* ======================================================================
   ADMIN
   ====================================================================== */
async function adminPage() {
  if (!S.admin) { view.innerHTML = `<div class="empty">관리자만 볼 수 있어요.</div>`; return; }
  const s = S.season, cur = s.current;
  const stKey = S.seasonId + "_" + cur;
  const [ents, subs, chs, reviews] = await Promise.all([
    getDocs(query(collection(db, "entries"), where("stage", "==", stKey))),
    getDocs(query(collection(db, "subs"), where("stage", "==", stKey))),
    getDocs(query(collection(db, "challenges"), where("stage", "==", stKey))),
    getDocs(query(collection(db, "reviews"), where("stage", "==", stKey))),
  ]);
  view.innerHTML = `
  <div class="row wrap"><h1 class="disp" style="font-size:36px">관리자</h1><span class="sp"></span><span class="pill red">${esc(s.title)} · ${esc(cur)} · ${esc(s.status[cur])}</span></div>
  ${s._virtual ? `<div class="note" style="margin-top:12px">이번 달 시즌 문서가 아직 없어요. <button class="btn sm red" id="mkSeason">${esc(S.seasonId)} 시즌 만들기</button></div>` : ""}
  <div class="grid g4" style="margin-top:14px"><div class="card stat"><b>${ents.size}</b><span>이번 단계 신청</span></div><div class="card stat"><b>${subs.size}</b><span>제출</span></div><div class="card stat"><b>${chs.size}</b><span>도전 선언</span></div><div class="card stat"><b>${reviews.size}</b><span>이의 제기</span></div></div>

  <div class="sec"><h2>단계 진행</h2><small>Cloud Functions 없이 이 버튼으로 처리해요</small></div>
  <div class="card"><div class="row wrap">
    <button class="btn ghost" id="aPods" ${STAGES[stageIdx(cur)].kind !== "qual" ? "disabled" : ""}>① 접수 마감 & 포드 편성 (월)</button>
    <button class="btn red" id="aClose">② 주차 마감 처리</button>
    <button class="btn ghost" id="aNext">③ 다음 단계로</button>
  </div><p class="dim" style="font-size:12px;margin-bottom:0">② 예선: 포드 승률·백분위·예선 포인트·레이팅(Elo, 배치 K=48, 방어자 감점 상한 ${RULE.defenderCap}, 하한 ${RULE.floor})·도전 결과·이상치 플래그를 계산하고 결과를 공개해요. 16강/8강: 대진별 기록 비교로 승자를 정해요.</p></div>

  <div class="sec"><h2>본선 · 결승</h2></div>
  <div class="card"><div class="row wrap"><button class="btn ghost" id="aR16">16강 대진 확정 (상위 14 + 와일드카드 2)</button><button class="btn ghost" id="aFinal">결승 결과 입력</button><button class="btn ghost" id="aSubst">결승 대체 선수</button><button class="btn ghost" id="aFinalInfo">결승 정보 수정</button></div></div>

  <div class="sec"><h2>판독 큐</h2><small>AI → 상대 검토 → 관리자</small></div>
  <div class="card" id="queue"></div>

  <div class="sec"><h2>규모 시뮬레이션</h2></div>
  <div class="card"><label>참가자 수</label><input type="range" id="simN" min="16" max="5000" value="120"><div id="simOut"></div></div>

  <div class="sec"><h2>데모 데이터</h2></div>
  <div class="card"><p class="muted" style="margin-top:0">발표용 가상 선수(데모 태그)를 만들어 포드·결과·대진을 시연해요. 실제 선수 데이터에는 영향이 없어요.</p><div class="row wrap"><button class="btn ghost" id="seed">가상 선수 24명 만들기 + 이번 단계 신청</button><button class="btn ghost" id="seedSubs">가상 선수 기록 제출</button><button class="btn ghost" id="wipe">가상 선수 삭제</button></div></div>`;
  const mk = $("#mkSeason"); if (mk) mk.onclick = () => guard(async () => { const d = defaultSeason(S.seasonId); await setDoc(doc(db, "seasons", S.seasonId), d); await setDoc(doc(db, "config", "app"), { currentSeason: S.seasonId }, { merge: true }); await loadSeason(); toast("시즌 생성"); route(); });
  $("#aPods").onclick = () => guard(() => formPods(stKey));
  $("#aClose").onclick = () => guard(() => (STAGES[stageIdx(cur)].kind === "qual" ? closeQualifier(stKey) : closeVideoRound(cur, stKey)));
  $("#aNext").onclick = () => guard(nextStage);
  $("#aR16").onclick = () => guard(buildR16);
  $("#aFinal").onclick = () => guard(finalResultModal);
  $("#aSubst").onclick = () => guard(substituteModal);
  $("#aFinalInfo").onclick = () => guard(finalInfoModal);
  $("#seed").onclick = () => guard(() => seedDemo(stKey));
  $("#seedSubs").onclick = () => guard(() => seedSubs(stKey));
  $("#wipe").onclick = () => guard(wipeDemo);
  // queue
  const q = subs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.verdict === "pending" || x.flag || reviews.docs.some((r) => r.data().target === x.uid));
  $("#queue").innerHTML = q.length ? `<table><tr><th>선수</th><th>기록</th><th>AI</th><th>영상</th><th></th></tr>${q.map((x) => `<tr><td>${esc(x.uid.slice(0, 6))}</td><td class="mono">${esc(scoreText(x, s.wods[cur]))}</td><td class="mono">${x.ai ? `${x.ai.reps}렙/NR ${x.ai.noReps}${x.ai.unreadable ? "/판독불가" : ""}` : "-"}</td><td>${ytId(x.video) ? `<a target="_blank" rel="noopener" href="https://youtu.be/${ytId(x.video)}">보기</a>` : "-"}</td><td class="r"><button class="btn sm ghost" data-v="ok" data-id="${x.id}">인정</button> <button class="btn sm ghost" data-v="penalty" data-id="${x.id}">페널티</button> <button class="btn sm ghost" data-v="dq" data-id="${x.id}">실격</button></td></tr>`).join("")}</table>` : `<div class="empty">판독 대기 없음</div>`;
  document.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => guard(async () => {
    const id = b.dataset.id, v = b.dataset.v, upd = { verdict: v };
    const sd = (await getDoc(doc(db, "subs", id))).data();
    if (v === "penalty") { upd.sortKey = (sd.sortKey || 0) + (s.wods[cur].scoring === "time" ? 10 : 5); upd.penalty = true; }
    await updateDoc(doc(db, "subs", id), upd); toast("판정: " + v); route();
  })));
  const sim = () => { const n = +$("#simN").value; $("#simOut").innerHTML = simulate(n); };
  $("#simN").oninput = sim; sim();
}
function simulate(n) {
  const tiers = n > RULE.regionAt ? 0 : n > RULE.tierAt ? Math.ceil(n / RULE.tierAt) : 1;
  const regions = n > RULE.regionAt ? Math.ceil(n / 1000) : 0;
  const pods = Math.floor(n / 4);
  const pro = Math.round(n * 0.35), viewer = Math.round(n * 0.8);
  const revenue = pro * RULE.pro + viewer * RULE.viewer + Math.ceil(n / 40) * RULE.box;
  const pool = revenue * RULE.poolShare;
  return `<div class="grid g4" style="margin-top:12px"><div class="stat"><b>${n.toLocaleString()}</b><span>참가자</span></div><div class="stat"><b>${pods.toLocaleString()}</b><span>4인 포드/주</span></div><div class="stat"><b>${regions ? regions + "개 지역" : tiers + "개 티어"}</b><span>${regions ? "지역 예선 → 전국 결승" : tiers > 1 ? "티어별 16강" : "단일 16강"}</span></div><div class="stat"><b>${won(pool)}</b><span>예상 상금 (Pro 35%·관전 80% 가정)</span></div></div>
  <p class="muted" style="font-size:13px;margin-bottom:0">${n <= RULE.tierAt ? "200명 이하: 전체 1개 16강." : n <= RULE.regionAt ? `200명 초과: 레이팅 티어 ${tiers}개로 나누고 티어마다 16강을 따로 운영해요.` : `2,000명 초과: 지역 ${regions}개 예선 → 지역 우승자들이 전국 결승.`} 포드 수는 참가자에 비례해 늘어나고, 결승은 언제나 4명의 오프라인 경기예요.</p>`;
}
async function formPods(stKey) {
  const s = S.season;
  const ents = (await getDocs(query(collection(db, "entries"), where("stage", "==", stKey)))).docs.map((d) => d.data());
  const batch = writeBatch(db);
  let made = 0;
  for (const g of ["M", "F"]) {
    const list = await Promise.all(ents.filter((e) => e.gender === g).map(async (e) => { const u = (await getDoc(doc(db, "users", e.uid))).data() || {}; return { uid: e.uid, rating: u.rating ?? 1500, last: u.lastPodMates || [] }; }));
    list.sort((a, b) => b.rating - a.rating);
    const sizes = podSizes(list.length);
    const pods = []; let i = 0; sizes.forEach((sz) => { pods.push(list.slice(i, i + sz)); i += sz; });
    // avoid rematch: swap a member with the same slot in the next pod if two were podmates last week
    for (let p = 0; p < pods.length - 1; p++) for (let a = 0; a < pods[p].length; a++) {
      const x = pods[p][a];
      if (pods[p].some((y) => y !== x && x.last.includes(y.uid))) { const b = Math.min(a, pods[p + 1].length - 1); [pods[p][a], pods[p + 1][b]] = [pods[p + 1][b], pods[p][a]]; }
    }
    pods.forEach((pd, k) => {
      const id = `${stKey}_${g}_${String(k + 1).padStart(2, "0")}`;
      batch.set(doc(db, "pods", id), { stage: stKey, gender: g, label: `${G[g]} ${k + 1}포드`, members: pd.map((x) => x.uid), avg: pd.reduce((a, b) => a + b.rating, 0) / pd.length });
      pd.forEach((x) => { batch.update(doc(db, "entries", stKey + "_" + x.uid), { podId: id }); batch.update(doc(db, "users", x.uid), { lastPodMates: pd.map((y) => y.uid).filter((u) => u !== x.uid) }); });
      made++;
    });
  }
  const st = { ...s.status, [s.current]: "live" };
  batch.update(doc(db, "seasons", S.seasonId), { status: st });
  await batch.commit(); await loadSeason();
  toast(`포드 ${made}개 편성 · 기록 제출 시작`); route();
}
function podSizes(n) {
  if (n <= 0) return []; if (n <= 5) return [n];
  const q = Math.floor(n / 4), r = n % 4, out = Array(q).fill(4);
  if (r === 1) out[out.length - 1] = 5;
  else if (r === 2) { out[out.length - 1] = 3; out.push(3); }
  else if (r === 3) out.push(3);
  return out;
}
const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
async function closeQualifier(stKey) {
  const s = S.season, wodx = s.wods[s.current];
  const pods = (await getDocs(query(collection(db, "pods"), where("stage", "==", stKey)))).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!pods.length) return toast("포드가 없어요. 먼저 편성하세요.");
  const subs = {}; (await getDocs(query(collection(db, "subs"), where("stage", "==", stKey)))).forEach((d) => { const x = d.data(); if (x.verdict !== "dq") subs[x.uid] = x; });
  const chs = (await getDocs(query(collection(db, "challenges"), where("stage", "==", stKey)))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const users = {}; await Promise.all(pods.flatMap((p) => p.members).map(async (u) => { users[u] = (await getDoc(doc(db, "users", u))).data() || {}; }));
  const dR = {}, podW = {}, podL = {}; Object.keys(users).forEach((u) => { dR[u] = 0; podW[u] = 0; podL[u] = 0; });
  const K = (u) => ((users[u].weeksPlayed || 0) < RULE.placementWeeks ? RULE.Kplace : RULE.K);
  // pod round robin
  for (const p of pods) for (let i = 0; i < p.members.length; i++) for (let j = i + 1; j < p.members.length; j++) {
    const a = p.members[i], b = p.members[j], sa = subs[a]?.sortKey, sb = subs[b]?.sortKey;
    let res; // 1 a wins, 0 b wins, .5 tie
    if (sa == null && sb == null) { podL[a]++; podL[b]++; dR[a] -= K(a) * 0.5; dR[b] -= K(b) * 0.5; continue; }
    if (sa == null) res = 0; else if (sb == null) res = 1; else res = sa < sb ? 1 : sa > sb ? 0 : 0.5;
    if (res === 1) { podW[a]++; podL[b]++; } else if (res === 0) { podW[b]++; podL[a]++; }
    const ea = expected(users[a].rating, users[b].rating);
    dR[a] += K(a) * (res - ea); dR[b] += K(b) * ((1 - res) - (1 - ea));
  }
  // whole-field percentile by gender
  const pctOf = {};
  for (const g of ["M", "F"]) {
    const field = Object.keys(users).filter((u) => users[u].gender === g);
    const ranked = field.filter((u) => subs[u]).sort((a, b) => subs[a].sortKey - subs[b].sortKey);
    const n = field.length;
    ranked.forEach((u, i) => (pctOf[u] = n > 1 ? 1 - i / (n - 1) : 1));
    field.forEach((u) => { if (pctOf[u] == null) pctOf[u] = 0; });
  }
  // anomalies: score far above field (z-score) or huge rating jump
  const flags = new Set();
  for (const g of ["M", "F"]) {
    const ks = Object.keys(subs).filter((u) => users[u]?.gender === g).map((u) => subs[u].sortKey);
    if (ks.length >= 5) { const m = ks.reduce((a, b) => a + b, 0) / ks.length, sd = Math.sqrt(ks.reduce((a, b) => a + (b - m) ** 2, 0) / ks.length) || 1; Object.keys(subs).forEach((u) => { if (users[u]?.gender === g && (m - subs[u].sortKey) / sd > 2.5) flags.add(u); }); }
  }
  // challenges
  const upsetGain = {}, defLoss = {};
  const chRes = [];
  for (const c of chs) {
    const a = subs[c.from], b = subs[c.to];
    let status;
    if (!b) status = "void"; else if (!a) status = "failed"; else status = a.sortKey < b.sortKey ? "upset" : "failed";
    if (status === "upset") {
      const ea = expected(users[c.from]?.rating ?? c.fromRating, users[c.to]?.rating ?? c.toRating);
      const gain = RULE.K * (1 - ea);
      dR[c.from] = (dR[c.from] || 0) + gain;
      defLoss[c.to] = (defLoss[c.to] || 0) + gain;
      upsetGain[c.from] = (c.toRating - c.fromRating);
    }
    chRes.push({ id: c.id, status, from: c.from });
  }
  // defender loss batched & capped
  Object.entries(defLoss).forEach(([u, l]) => { dR[u] = (dR[u] || 0) - Math.min(l, RULE.defenderCap); });
  // write
  const batch = writeBatch(db);
  const rows = [];
  for (const u of Object.keys(users)) {
    const n = podW[u] + podL[u];
    const winRate = n ? podW[u] / n : 0;
    const qp = winRate * 60 + pctOf[u] * 40;
    const newR = Math.max(RULE.floor, (users[u].rating ?? 1500) + dR[u]);
    const up = upsetGain[u] != null;
    batch.update(doc(db, "users", u), { rating: newR, wins: increment(podW[u]), losses: increment(podL[u]), weeksPlayed: increment(1), upsets: increment(up ? 1 : 0), upsetStreak: up ? increment(1) : 0 });
    const stRef = doc(db, "standings", S.seasonId + "_" + u);
    const prev = (await getDoc(stRef)).data() || { qp: 0, upsetScore: 0, pctSum: 0, weeks: 0 };
    const weeks = prev.weeks + 1;
    batch.set(stRef, { uid: u, name: users[u].name, gender: users[u].gender, season: S.seasonId, qp: prev.qp + qp, upsetScore: (prev.upsetScore || 0) + (up ? upsetGain[u] : 0), pctSum: prev.pctSum + pctOf[u], pctAvg: (prev.pctSum + pctOf[u]) / weeks, weeks, pro: !!users[u].pro });
    if (flags.has(u) && subs[u]) batch.update(doc(db, "subs", stKey + "_" + u), { flag: true, verdict: "pending" });
    rows.push({ uid: u, name: users[u].name, gender: users[u].gender, score: subs[u] ? scoreText(subs[u], wodx) : "미제출", sortKey: subs[u]?.sortKey ?? 1e9, podW: podW[u], podL: podL[u], pct: pctOf[u], qp, dr: newR - (users[u].rating ?? 1500), upset: up, flag: flags.has(u), video: subs[u]?.video || "" });
  }
  chRes.forEach((c) => batch.update(doc(db, "challenges", c.id), { status: c.status }));
  rows.sort((a, b) => a.sortKey - b.sortKey);
  batch.set(doc(db, "results", stKey), { stage: stKey, rows, at: serverTimestamp() });
  batch.update(doc(db, "seasons", S.seasonId), { status: { ...s.status, [s.current]: "closed" } });
  await batch.commit(); await loadSeason();
  toast(`마감 완료 · ${rows.length}명 결과 공개${flags.size ? " · 이상치 " + flags.size + "건 검토 큐" : ""}`); route();
}
async function nextStage() {
  const s = S.season, i = stageIdx(s.current);
  if (i >= STAGES.length - 1) return toast("마지막 단계예요");
  const nk = STAGES[i + 1].key;
  await updateDoc(doc(db, "seasons", S.seasonId), { current: nk, status: { ...s.status, [nk]: STAGES[i + 1].kind === "qual" ? "reg" : "live" } });
  await loadSeason(); toast(STAGES[i + 1].name + " 시작"); route();
}
async function buildR16() {
  const s = S.season, bracketX = { ...(s.bracket || {}) }, names = { ...(s.bracketNames || {}) }, seeds = { ...(s.bracketSeeds || {}) };
  for (const g of ["M", "F"]) {
    const st = (await getDocs(query(collection(db, "standings"), where("season", "==", S.seasonId), where("gender", "==", g)))).docs.map((d) => d.data());
    const proOK = st.filter((x) => x.pro).sort((a, b) => b.qp - a.qp);
    const top = proOK.slice(0, RULE.qualifiers);
    const topSet = new Set(top.map((x) => x.uid));
    const wc = proOK.filter((x) => !topSet.has(x.uid) && x.pctAvg >= 1 - RULE.wildcardPct).sort((a, b) => b.upsetScore - a.upsetScore).slice(0, RULE.wildcards);
    const field = [...top, ...wc];
    while (field.length < 16) field.push(null);
    seeds[g] = {}; field.forEach((x, i) => { if (x) { seeds[g][x.uid] = i + 1; names[x.uid] = x.name; } });
    const order = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]];
    bracketX[g] = { R16: order.map(([a, b]) => [field[a]?.uid || null, field[b]?.uid || null, field[b] ? null : field[a]?.uid || null]) };
  }
  await updateDoc(doc(db, "seasons", S.seasonId), { bracket: bracketX, bracketNames: names, bracketSeeds: seeds });
  await loadSeason(); toast("16강 대진 확정 (Pro 구독자만)"); location.hash = "#/bracket";
}
async function closeVideoRound(cur, stKey) {
  const s = S.season, B = JSON.parse(JSON.stringify(s.bracket || {}));
  const subs = {}; (await getDocs(query(collection(db, "subs"), where("stage", "==", stKey)))).forEach((d) => { const x = d.data(); if (x.verdict !== "dq") subs[x.uid] = x; });
  const nextK = cur === "R16" ? "QF" : "SF";
  for (const g of ["M", "F"]) {
    const ms = B[g]?.[cur] || []; if (!ms.length) continue;
    ms.forEach((m) => { if (m[2]) return; const a = subs[m[0]]?.sortKey, b = subs[m[1]]?.sortKey; m[2] = a == null && b == null ? m[0] : a == null ? m[1] : b == null ? m[0] : a <= b ? m[0] : m[1]; });
    const nx = []; for (let i = 0; i < ms.length; i += 2) nx.push([ms[i][2], ms[i + 1]?.[2] || null, null]);
    B[g][nextK] = nx;
  }
  await updateDoc(doc(db, "seasons", S.seasonId), { bracket: B, status: { ...s.status, [cur]: "closed" } });
  await loadSeason(); toast(`${cur} 마감 → ${nextK} 대진 생성`); location.hash = "#/bracket";
}
async function finalResultModal() {
  const s = S.season, names = s.bracketNames || {};
  const body = ["M", "F"].map((g) => { const sf = s.bracket?.[g]?.SF || []; if (!sf.length) return `<p class="muted">${G[g]}: 4강 대진 없음</p>`; return `<h3 style="margin-top:12px">${G[g]}</h3>${sf.map((m, i) => `<label>4강 ${i + 1}</label><select data-g="${g}" data-k="SF" data-i="${i}"><option value="">승자 선택</option>${[m[0], m[1]].filter(Boolean).map((u) => `<option value="${u}" ${m[2] === u ? "selected" : ""}>${esc(names[u])}</option>`).join("")}</select>`).join("")}`; }).join("");
  modal(`<h2>THE FINAL 결과</h2><p class="muted">4강 승자를 고르면 결승·3·4위전이 생기고, 다시 열어 우승자를 고르면 시상과 디펜딩 챔피언 태그가 적용돼요.</p>${body}<div id="fx"></div><button class="btn red block" style="margin-top:14px" id="fsave">저장</button>`, true);
  const fx = $("#fx");
  fx.innerHTML = ["M", "F"].map((g) => { const f = s.bracket?.[g]?.F?.[0], p = s.bracket?.[g]?.P3?.[0]; if (!f) return ""; return `<h3 style="margin-top:12px">${G[g]} 결승 / 3·4위전</h3><select data-g="${g}" data-k="F" data-i="0"><option value="">우승자</option>${[f[0], f[1]].filter(Boolean).map((u) => `<option value="${u}" ${f[2] === u ? "selected" : ""}>${esc(names[u])}</option>`).join("")}</select><select style="margin-top:8px" data-g="${g}" data-k="P3" data-i="0"><option value="">3위</option>${[p?.[0], p?.[1]].filter(Boolean).map((u) => `<option value="${u}" ${p?.[2] === u ? "selected" : ""}>${esc(names[u])}</option>`).join("")}</select>`; }).join("");
  $("#fsave").onclick = () => guard(async () => {
    const B = JSON.parse(JSON.stringify(s.bracket));
    document.querySelectorAll("#modal select[data-g]").forEach((sel) => { if (sel.value) B[sel.dataset.g][sel.dataset.k][+sel.dataset.i][2] = sel.value; });
    const batch = writeBatch(db);
    for (const g of ["M", "F"]) {
      const sf = B[g]?.SF; if (!sf || sf.length < 2) continue;
      if (sf[0][2] && sf[1][2] && !B[g].F) { B[g].F = [[sf[0][2], sf[1][2], null]]; B[g].P3 = [[sf[0][2] === sf[0][0] ? sf[0][1] : sf[0][0], sf[1][2] === sf[1][0] ? sf[1][1] : sf[1][0], null]]; }
      const champ = B[g].F?.[0]?.[2];
      if (champ) { const prev = (await getDocs(query(collection(db, "users"), where("defending", "==", true), where("gender", "==", g)))); prev.forEach((d) => batch.update(d.ref, { defending: false })); batch.update(doc(db, "users", champ), { defending: true }); }
    }
    batch.update(doc(db, "seasons", S.seasonId), { bracket: B });
    await batch.commit(); closeModal(); await loadSeason(); toast("결승 결과 저장"); route();
  });
}
async function substituteModal() {
  const s = S.season, names = s.bracketNames || {};
  modal(`<h2>결승 대체 선수</h2><p class="muted">불참하는 4강 진출자를 고르면, 같은 디비전 8강 탈락자 중 예선 포인트 최상위가 들어가요.</p>${["M", "F"].map((g) => `<label>${G[g]}</label><select data-g="${g}"><option value="">없음</option>${(s.bracket?.[g]?.SF || []).flatMap((m) => [m[0], m[1]]).filter(Boolean).map((u) => `<option value="${u}">${esc(names[u])}</option>`).join("")}</select>`).join("")}<button class="btn red block" style="margin-top:14px" id="sb">대체 적용</button>`);
  $("#sb").onclick = () => guard(async () => {
    const B = JSON.parse(JSON.stringify(s.bracket));
    for (const sel of document.querySelectorAll("#modal select[data-g]")) {
      if (!sel.value) continue; const g = sel.dataset.g;
      const losers = (B[g].QF || []).map((m) => (m[2] === m[0] ? m[1] : m[0])).filter(Boolean);
      const st = await Promise.all(losers.map(async (u) => ({ u, qp: ((await getDoc(doc(db, "standings", S.seasonId + "_" + u))).data() || {}).qp || 0 })));
      st.sort((a, b) => b.qp - a.qp); const sub = st[0]?.u; if (!sub) continue;
      B[g].SF = B[g].SF.map((m) => m.map((x) => (x === sel.value ? sub : x)));
    }
    await updateDoc(doc(db, "seasons", S.seasonId), { bracket: B }); closeModal(); await loadSeason(); toast("대체 선수 적용"); route();
  });
}
async function finalInfoModal() {
  const f = S.season.final;
  modal(`<h2>결승 정보</h2><form id="fi"><label>개최 박스</label><input name="box" value="${esc(f.box)}"><label>주소</label><input name="addr" value="${esc(f.addr)}"><label>시간</label><input name="time" value="${esc(f.time)}"><label>무료 라이브 링크</label><input name="stream" value="${esc(f.stream)}"><label>스폰서 상금 (원)</label><input name="sponsors" type="number" value="${f.sponsors || 0}"><label>안내</label><input name="note" value="${esc(f.note)}"><button class="btn red block" style="margin-top:14px">저장</button></form>`);
  $("#fi").onsubmit = (e) => { e.preventDefault(); const x = e.target; guard(async () => { await updateDoc(doc(db, "seasons", S.seasonId), { final: { box: x.box.value, addr: x.addr.value, time: x.time.value, stream: x.stream.value, sponsors: Number(x.sponsors.value) || 0, note: x.note.value } }); closeModal(); await loadSeason(); toast("저장"); route(); }); };
}
/* demo data */
const DEMO_NAMES = ["김도윤", "이서준", "박하준", "최민준", "정우진", "강지호", "조현우", "윤시우", "장도현", "임건우", "한준서", "오태윤", "서지안", "신유찬", "권예준", "황지훈", "김서연", "이하은", "박지유", "최수아", "정다인", "강서윤", "조하린", "윤지민"];
async function seedDemo(stKey) {
  const batch = writeBatch(db);
  DEMO_NAMES.forEach((n, i) => {
    const uid = "demo_" + String(i + 1).padStart(2, "0"), g = i < 16 ? "M" : "F";
    const rating = Math.round(1350 + Math.random() * 400);
    batch.set(doc(db, "users", uid), { name: n, gender: g, box: ["크로스핏 한강", "크로스핏 성수", "크로스핏 판교", "크로스핏 해운대"][i % 4], rating, weeksPlayed: 3, wins: 0, losses: 0, upsets: 0, upsetStreak: 0, pro: Math.random() < 0.85, viewer: false, bot: true, createdAt: serverTimestamp() });
    batch.set(doc(db, "entries", stKey + "_" + uid), { uid, stage: stKey, gender: g, rating, name: n, at: serverTimestamp() });
  });
  await batch.commit(); toast("가상 선수 24명 생성 · 이번 단계 신청 완료"); route();
}
async function seedSubs(stKey) {
  const s = S.season, w = s.wods[s.current];
  const ents = (await getDocs(query(collection(db, "entries"), where("stage", "==", stKey)))).docs.map((d) => d.data()).filter((e) => e.uid.startsWith("demo_"));
  const batch = writeBatch(db);
  for (const e of ents) {
    if (Math.random() < 0.08) continue; // some don't submit → 3 losses
    const skill = (e.rating - 1300) / 500 + (Math.random() - 0.5) * 0.6;
    let d;
    if (w.scoring === "time") { const t = Math.round((w.cap || 12) * 60 * (0.95 - skill * 0.35)); d = t >= (w.cap || 12) * 60 ? { capped: true, capReps: Math.round(Math.random() * 20), timeSec: (w.cap || 12) * 60 } : { capped: false, timeSec: t }; d.sortKey = d.capped ? d.timeSec + d.capReps : d.timeSec; }
    else { const v = Math.round(180 + skill * 140); d = { value: v, sortKey: -v }; }
    batch.set(doc(db, "subs", stKey + "_" + e.uid), { uid: e.uid, stage: stKey, gender: e.gender, video: "https://youtu.be/dQw4w9WgXcQ", ai: { reps: 0, noReps: 0, unreadable: false }, verdict: "ok", at: serverTimestamp(), ...d });
  }
  // a couple of demo challenges
  const sorted = ents.filter((e) => e.gender === "M").sort((a, b) => a.rating - b.rating);
  if (sorted.length > 6) [[0, 3], [2, 6]].forEach(([a, b]) => { const A = sorted[a], Bx = sorted[b]; if (Bx.rating - A.rating <= RULE.ladderBase) batch.set(doc(db, "challenges", stKey + "_" + A.uid), { from: A.uid, fromName: A.name, fromRating: A.rating, to: Bx.uid, toName: Bx.name, toRating: Bx.rating, stage: stKey, gender: "M", status: "declared", at: serverTimestamp() }); });
  await batch.commit(); toast("가상 기록 제출 완료"); route();
}
async function wipeDemo() {
  const qs = await getDocs(query(collection(db, "users"), where("bot", "==", true)));
  const batch = writeBatch(db); qs.forEach((d) => batch.delete(d.ref)); await batch.commit(); toast(`가상 선수 ${qs.size}명 삭제`); route();
}

/* ---------------- boot ---------------- */
onAuthStateChanged(auth, async (u) => {
  S.user = u;
  await guard(async () => { await loadSeason(); await loadMe(); });
  renderWho();
  route();
});
