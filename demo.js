// YOU vs WHO — presentation demo data.
// A deterministic, fictional season frozen at "8강 진행 중" (2026-12-19 15:00 KST) so every screen has
// something to show. Nothing here is written to Firestore; real data, where it exists, still shows alongside.
// All athletes, boxes and posts are invented.

export const DEMO_SEASON = "2026-12";
export const DEMO_T0 = new Date(2026, 11, 19, 15, 0, 0);   // local time

// ---- seeded RNG so the demo looks identical on every device
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20261219);
const pick = (a) => a[Math.floor(R() * a.length)];

const FAM = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍", "문", "배", "백", "노"];
const MGIV = ["민준", "도윤", "지호", "현우", "준서", "건우", "우진", "선우", "서진", "민재", "태윤", "재원", "시우", "승현", "하준", "지훈", "은찬", "주원", "동현", "성민", "규민", "태호", "영재", "준혁", "상우", "한결", "다온", "로운", "이안", "윤호"];
const FGIV = ["서윤", "지우", "하은", "민서", "지민", "수아", "예린", "채원", "다은", "유진", "소윤", "지아", "서연", "하린", "예은", "수빈", "나연", "가은", "윤서", "연우", "다인", "세아", "은솔", "시은", "아린", "보민"];
const BOXES = ["블랙라인 박스", "아이언팩토리", "노스게이트 CF", "레드스톤 짐", "하이바 박스", "웨어하우스 07", "바벨클럽 서울", "그라운드제로 CF", "언더독 스테이션", "부산 오션블록", "대구 스틸하우스", "광주 코어랩"];

function makePeople(g, n) {
  const used = new Set(), out = [];
  while (out.length < n) {
    const nm = pick(FAM) + pick(g === "M" ? MGIV : FGIV);
    if (used.has(nm)) continue; used.add(nm);
    const ab = R();
    out.push({ id: `d_${g}${out.length + 1}`, name: nm, gender: g, box: pick(BOXES), _ab: ab, _r: 1400 + Math.round(ab * 380 + R() * 80) });
  }
  return out;
}
const MEN = makePeople("M", 52), WOMEN = makePeople("F", 40);

// ---- two qualifier weeks with 4-person pods
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function week(people, key) {
  // hidden ability so results are consistent across weeks, plus noise
  const rows = people.map((p) => {
    const perf = p._ab * 0.75 + R() * 0.25;
    if (key === "W1") { const reps = Math.round(150 + perf * 120); return { p, perf, score: `${Math.floor(reps / 30)}R + ${reps % 30} (${reps})`, sortKey: -reps }; }
    const capped = perf < 0.18; const t = Math.round(780 - perf * 300);
    return { p, perf, score: capped ? `CAP + ${Math.round((0.18 - perf) * 120) + 3}` : fmtTime(t), sortKey: capped ? 780 + (0.18 - perf) * 120 : t };
  }).sort((a, b) => a.sortKey - b.sortKey);
  const n = rows.length;
  rows.forEach((r, i) => { r.pct = 1 - i / (n - 1); });
  // pods by previous rating order (4 each): pod wins = beaten pod mates
  const byRating = [...rows].sort((a, b) => b.p._r - a.p._r);
  for (let i = 0; i < byRating.length; i += 4) {
    const pod = byRating.slice(i, i + 4);
    pod.forEach((r) => { r.podW = pod.filter((o) => o !== r && o.sortKey > r.sortKey).length; r.podL = pod.length - 1 - r.podW; r.upset = r.podW > 0 && pod.some((o) => o.sortKey > r.sortKey && o.p._r > r.p._r + 60); });
  }
  rows.forEach((r) => {
    r.qp = Math.round((r.podW / 3) * 50 + r.pct * 50);
    const dr = Math.round((r.podW - 1.5) * 14 + (r.upset ? 10 : 0));
    r.p._r += dr; r.dr = dr;
    r.p._up = (r.p._up || 0) + (r.upset ? 1 : 0);
    r.p._w = (r.p._w || 0) + r.podW; r.p._l = (r.p._l || 0) + r.podL;
    r.p._upScore = (r.p._upScore || 0) + (r.upset ? 40 + Math.round(R() * 40) : 0);
  });
  return rows.map((r) => ({ uid: r.p.id, name: r.p.name, gender: r.p.gender, score: r.score, sortKey: r.sortKey, podW: r.podW, podL: r.podL, pct: r.pct, qp: r.qp, dr: r.dr, upset: r.upset, flag: false }));
}
const RES = {};
for (const k of ["W1", "W2"]) RES[k] = { rows: [...week(MEN, k), ...week(WOMEN, k)] };

// ---- standings (2-week total) and athlete profiles
function standings(people) {
  return people.map((p) => {
    const w1 = RES.W1.rows.find((r) => r.uid === p.id), w2 = RES.W2.rows.find((r) => r.uid === p.id);
    return { uid: p.id, name: p.name, gender: p.gender, season: DEMO_SEASON, qp: w1.qp + w2.qp, pctAvg: (w1.pct + w2.pct) / 2, upsetScore: p._upScore || 0, pro: true };
  }).sort((a, b) => b.qp - a.qp);
}
const ST = { M: standings(MEN), F: standings(WOMEN) };
// a few low finishers never subscribed (they would need Pro to advance)
for (const g of ["M", "F"]) ST[g].slice(-8).forEach((x, i) => { if (i % 2) x.pro = false; });

const ALL = [...MEN, ...WOMEN].map((p) => ({ id: p.id, name: p.name, gender: p.gender, box: p.box, rating: p._r, wins: p._w, losses: p._l, upsets: p._up, weeksPlayed: 6 + Math.floor(R() * 20), pro: true, demo: true }));

// ---- bracket: R16 decided (two upsets), QF in progress
const ORDER = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]];
const UPSETS = { M: [1, 2], F: [3] };   // match indexes where the lower seed won
const bracket = {}, names = {}, seeds = {};
for (const g of ["M", "F"]) {
  const top = ST[g].filter((x) => x.pro).slice(0, 14), topSet = new Set(top.map((x) => x.uid));
  const wc = ST[g].filter((x) => x.pro && !topSet.has(x.uid)).sort((a, b) => b.upsetScore - a.upsetScore).slice(0, 2);
  const field = [...top, ...wc];
  seeds[g] = {}; field.forEach((x, i) => { seeds[g][x.uid] = i + 1; names[x.uid] = x.name; });
  const r16 = ORDER.map(([a, b], i) => { const A = field[a].uid, B = field[b].uid; return [A, B, UPSETS[g].includes(i) ? B : A]; });
  const qf = []; for (let i = 0; i < 8; i += 2) qf.push([r16[i][2], r16[i + 1][2], null]);
  bracket[g] = { R16: r16, QF: qf };
}

// ---- community
const ago = (min) => ({ seconds: Math.floor((DEMO_T0.getTime() - min * 60000) / 1000) });
const U = (id) => ALL.find((u) => u.id === id);
const seedOf = (g, id) => seeds[g][id];
const mUp1 = bracket.M.R16[1], mUp2 = bracket.M.R16[2], fUp = bracket.F.R16[3];          // the three upsets
const mChamp = U(ST.M[0].uid), fChamp = U(ST.F[1].uid);                                    // defending champions
const qfM = U(bracket.M.QF[3][1]), qfF = U(bracket.F.QF[0][1]);
const outF = U(ST.F[ST.F.length - 6].uid), outM = U(ST.M[ST.M.length - 10].uid);           // did not qualify
const FEED = [
  [qfM, "8강 오버헤드 스쿼트 61kg 15개씩 3라운드… 결국 어깨 버티기 싸움이네요. 내일 아침에 바로 찍습니다.", 18],
  [U(fUp[2]), `${seedOf("F", fUp[2])}번 시드로 올라가서 16강에서 ${seedOf("F", fUp[0])}번 시드 잡았어요!! 바 머슬업 마지막 라운드에서 안 끊긴 게 컸어요 🙌`, 42],
  [{ id: "fan1", name: "성수동 러너" }, "블랙라인 박스 결승 현장 관람 신청 언제 열리나요? 지난달엔 금방 마감됐던데", 66],
  [mChamp, "디펜딩 자리 지키러 갑니다. 8강 상대 기록 보니까 HSPU가 빠르던데 긴장되네요.", 95],
  [outF, "예선 2주차 파워 클린 48kg인데도 마지막 라운드에 손목 터지는 줄 ㅋㅋ 다음 달엔 꼭 16강 간다", 130],
  [{ id: "fan2", name: "아이언팩토리 코치" }, "우리 박스에서 이번 달 16강 진출자가 나왔습니다. 다들 고생 많았어요. 8강 영상도 같이 찍어 줄게요!", 175],
  [U(mUp2[2]), `${seedOf("M", mUp2[2])}번 시드였는데 16강에서 ${seedOf("M", mUp2[0])}번 시드 이겼습니다. 업셋 점수 쌓아서 다음 달엔 챔피언한테 도전해 볼게요`, 240],
  [qfF, "8강 박스 점프오버 남자 24인치, 여자 20인치 맞죠? 공지 다시 확인했어요", 300],
  [{ id: "fan3", name: "크로스핏 입문 3개월" }, "예선 1주차 처음 나가봤는데 포드에서 1승 했어요. 이런 대회 처음이라 재밌네요", 410],
  [outM, "AI 심판 렙 카운트 생각보다 정확하네요. 토투바 하나 안 쳐준 거 다시 보니까 진짜 발이 안 닿았음…", 520],
  [{ id: "fan5", name: "윤채원" }, "예측 리그 16강 7/8 맞췄다 ㅎㅎ 순위표 1등 찍음", 690],
  [fChamp, "여자부 디펜딩 챔피언으로 8강 갑니다. 이번 달 결승도 블랙라인에서 만나요!", 760],
  [U(mUp1[2]), `16강 ${seedOf("M", mUp1[0])}번 시드랑 1대1, 마지막 라운드에서 뒤집었습니다. 영상 다시 봐도 소름`, 880],
  [{ id: "fan4", name: "부산 오션블록" }, "부산에서도 결승 보러 올라갑니다. 라이브 중계도 해 주시나요?", 1020],
].map(([u, text, min], i) => ({ id: "dfeed" + i, uid: u.id, name: u.name, text, at: ago(min) }));
const PRED = ["윤채원", "성수동 러너", mChamp.name, "아이언팩토리 코치", qfF.name, "한로운", "부산 오션블록", outF.name, "김태호", "오세아", outM.name, "크로스핏 입문 3개월"].map((name, i) => ({ name, uid: "dp" + i, pts: [75, 70, 65, 65, 60, 55, 55, 50, 45, 40, 35, 30][i] }));
// champions are this month's top seeds by qualifier points, so mark them
mChamp.defending = true; fChamp.defending = true;

// ---- public API
export const DEMO = {
  season(base) {
    return {
      ...base, id: DEMO_SEASON, title: "2026년 12월 시리즈", current: "QF",
      status: { W1: "closed", W2: "closed", R16: "closed", QF: "live", FINAL: "wait" },
      bracket, bracketNames: names, bracketSeeds: seeds,
      final: { ...base.final, box: "블랙라인 박스 · 서울 성수", addr: "", sponsors: 1500000 },
      _demo: true,
    };
  },
  counts: { users: 312, pro: 96, viewer: 184, boxes: 8, boost: 412000 },
  users: (g) => ALL.filter((u) => u.gender === g),
  user: (id) => ALL.find((u) => u.id === id) || null,
  standings: (g) => ST[g],
  results: (k) => RES[k] || null,
  feed: FEED,
  predictions: PRED,
  boosts: (id) => (id.endsWith("1") ? 85000 : id.endsWith("3") ? 42000 : 12000),
};
