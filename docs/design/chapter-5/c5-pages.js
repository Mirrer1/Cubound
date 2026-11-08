// CHAPTER 5 sheet pages. Each page returns { kicker, title, intro, picks, secs }.
(function () {
  const C = () => window.CuboundC5;
  const R = rows => (rows || []).map(([k, v, sw]) => ({ k, v: String(v), sw: sw || 'transparent', hasSw: !!sw }));
  const G = (title, note, frames, rows, rec) => ({ title, note: note || '', frames, rows: R(rows), hasRows: !!(rows && rows.length), rec: rec || '', hasRec: !!rec });
  const S = (id, title, note, groups) => ({ id, title, note: note || '', hasNote: !!note, groups });
  const add = (m, x, y, ...os) => { const k = x + ',' + y; (m[k] = m[k] || []).push(...os); return m; };
  const F = (def, cap, k) => C().frame(def, cap, k);
  const DK = 1, DK2 = 1, PRE = 0.22;
  // chain from the hook hole (under the cube's feet) along (dx, dy); hook tip at the end. the first segment goes in before the cube so the cube covers its start
  const chainTo = (m, hx, hy, dx, dy, L, o) => { let last = null; for (let i = 0; i <= Math.ceil(L) + 1; i++) { const s = i === 0 ? 0 : -0.5, e = Math.min(0.5, L - i); if (e <= s + 0.01) break;
      const seg = { t: 'chain', u0: dx ? s : 0, u1: dx ? e : 0, v0: dy ? s : 0, v1: dy ? e : 0, z: i === 0 ? 4 : 8, o }, key = (hx + dx * i) + ',' + (hy + dy * i);
      if (i === 0) { m[key] = m[key] || []; const hi = m[key].findIndex(q => q.t === 'hook'); m[key].splice(hi + 1, 0, seg); } else add(m, hx + dx * i, hy + dy * i, seg);
      last = [hx + dx * i, hy + dy * i, e]; }
    // the hook on the firing side leaves the plate. stuck = the end stops at a face (box / skull face inside the cell, or a wall at the cell edge)
    const hk = (m[hx + ',' + hy] || []).find(q => q.t === 'hook'); if (hk && L > 0) hk.out = [dx, dy];
    if (last) { const e = last[2], wall = Math.abs(L % 1 - 0.5) < 1e-6 && e >= 0.5 - 1e-6, stuck = e < 0 || wall, org = stuck ? e - C().hookReach() : e;
      add(m, last[0], last[1], { t: 'tip', u: dx ? org : 0, v: dy ? org : 0, dir: [dx, dy], z: 8, o, stuck, fu: e }); }
    return m; };
  const ext = (o, cell) => cell ? { t: 'ext', cell: o } : { t: 'ext', o };
  const isEye = (m, x, y) => (m[x + ',' + y] || []).some(q => q && q.t === 'eye');
  const gzRow = (m, y, x0, x1, o) => { const far = isEye(m, x1 + 1, y) ? x0 : x1, side = far === x0 && isEye(m, x1 + 1, y) ? 'lo' : 'hi'; for (let x = x0; x <= x1; x++) add(m, x, y, { t: 'gz', ax: 'x', o, end: x === far ? side : undefined }); return m; };
  const gzCol = (m, x, y0, y1, o) => { const far = isEye(m, x, y1 + 1) ? y0 : y1, side = far === y0 && isEye(m, x, y1 + 1) ? 'lo' : 'hi'; for (let y = y0; y <= y1; y++) add(m, x, y, { t: 'gz', ax: 'y', o, end: y === far ? side : undefined }); return m; };
  const sw = c => c;
  const mono = "IBM Plex Mono, ui-monospace, monospace", sans = "Jost, Helvetica, Arial, sans-serif";
  const PB = '#f2effa', PG = '#eae4f3';
  const chip = (x, y, w, label, val, on, warn) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="36" rx="18" fill="' + (on ? '#3A3936' : warn ? '#D9D1E5' : PG) + '"/>' +
    '<text x="' + (x + 16) + '" y="' + (y + 23) + '" font-family="' + mono + '" font-size="11" letter-spacing="2.4" fill="' + (on ? '#D9D6D0' : '#7A7771') + '">' + label + '</text>' +
    '<text x="' + (x + w - 16) + '" y="' + (y + 24) + '" text-anchor="end" font-family="' + sans + '" font-size="16" fill="' + (on ? '#F7F6F4' : '#3A3936') + '">' + val + '</text>';
  const hud = (moves, night, mode) => C().raw('<rect width="340" height="60" fill="' + PB + '"/>' + chip(20, 12, 140, 'MOVES', moves, false) + chip(172, 12, 148, 'NIGHT', night, mode === 'dark', mode === 'pre'), 340, 60, mode === 'dark' ? '어둠 · 남은 어둠 ' + night : mode === 'pre' ? '어둠 1수 전' : '밝음', 1);
  const inner = s => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  // phone screen: tile 52px (half of desktop), HUD on top is never covered by darkness
  const phone = (def, cap, mv, nt, mode) => {
    const b = C().board(Object.assign({ ch: 5 }, def, { bg: PB })), s = 0.5, bw = b.w * s, bh = b.h * s, W = 360, top = 62, H = Math.round(top + bh + 22), bx = Math.round((W - bw) / 2), by = top, dk = def.dark || 0;
    let v = '<rect width="' + W + '" height="' + H + '" fill="' + PB + '"/>' + (dk ? '<rect x="0" y="' + by + '" width="' + W + '" height="' + (H - by) + '" fill="#000" opacity="' + dk + '"/>' : '') + '<svg x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" viewBox="' + b.vb + '">' + inner(b.svg) + '</svg>';
    v += chip(14, 14, 150, 'MOVES', mv === undefined ? 12 : mv, false) + chip(176, 14, 170, 'NIGHT', nt === undefined ? 3 : nt, mode === 'dark', mode === 'pre');
    return C().raw(v, W, H, cap, 1);
  };
  const PH = (groups) => S('P', '폰', '칸 52px(데스크톱 104px의 절반), 실제 크기입니다. 위 NIGHT 칸은 어둠에도 덮이지 않습니다.', groups);

  const P = {};

  // ================= world-color =================
  P['world-color'] = () => {
    const c5 = C().CH['5b'], D5 = { d: c5.d, dSheet: c5.dSheet, checker: c5.checker }, st = n => C().step('5b', n), dE = C().dE;
    const o1 = add(add(add({}, 1, 2, { t: 'cube' }), 3, 1, { t: 'box' }), 3, 3, { t: 'home' });
    const ladder = { ch: '5b', g: ['01234567', '01234567'], bg: c5.base };
    const pair = { ch: '5b', g: ['000111', '000111', '000111'], bg: c5.base, objs: add({}, 1, 1, { t: 'cube' }) };
    const r12 = dE(st(1).top, st(2).alt) / D5.checker, r45 = dE(st(4).alt, st(5).top) / D5.checker;
    const cmp = [1, 2, 3, 4, '5b'].map(n => F({ ch: n, g: ['0001', '0011', '0011', '0000'], bg: C().CH[n].base, objs: add(add({}, 0, 2, { t: 'cube' }), 1, 1, { t: 'box' }) }, 'CHAPTER ' + (n === '5b' ? 5 : n) + ' · ' + C().CH[n].name, 0.5));
    const mini = (n, x, y, w) => { const b = C().board({ ch: n === 5 ? '5b' : n, g: ['000', '000', '000'], pad: 6 }); const h = w * b.h / b.w; return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" viewBox="' + b.vb + '">' + inner(b.svg) + '</svg>'; };
    // chapter select: n slots (made chapters drawn, later slots = faint blanks for the layout check only)
    const mock = (W, cols, pad, gap, maxW, cap, k, slots, wide) => {
      const cw = Math.min(maxW, W - pad * 2), ox = (W - cw) / 2, w = (cw - gap * (cols - 1)) / cols, ch = wide ? Math.max(84, w * 0.34) : w * 1.08, n = slots || 5, rows = Math.ceil(n / cols);
      const hy = pad * 0.9, top = hy + 48 + pad * 0.7, H = Math.round(top + rows * ch + (rows - 1) * gap + pad);
      let s = '<rect width="' + W + '" height="' + H + '" fill="' + c5.page + '"/>';
      const hw = Math.min(300, cw * 0.62);
      s += '<rect x="' + (ox + 6) + '" y="' + (hy - 6) + '" width="' + hw + '" height="48" rx="14" fill="' + c5.surface + '" opacity="0.6"/><rect x="' + ox + '" y="' + hy + '" width="' + hw + '" height="48" rx="14" fill="' + c5.surface + '"/>';
      s += '<text x="' + (ox + 18) + '" y="' + (hy + 20) + '" font-family="' + mono + '" font-size="10" letter-spacing="2.2" fill="#7A7771">CHAPTER 5</text><text x="' + (ox + 18) + '" y="' + (hy + 38) + '" font-family="' + sans + '" font-size="14" fill="#3A3936">어둠에 잠긴 문</text>';
      for (let i = 0; i < n; i++) {
        const cx = ox + (i % cols) * (w + gap), cy = top + Math.floor(i / cols) * (ch + gap), num = i + 1;
        if (num > 5) { s += '<rect x="' + cx + '" y="' + cy + '" width="' + w + '" height="' + ch + '" rx="12" fill="' + c5.surface + '" opacity="0.45"/>'; continue; }
        const c = C().CH[num];
        if (num === 5) s += '<rect x="' + (cx - 3) + '" y="' + (cy - 3) + '" width="' + (w + 6) + '" height="' + (ch + 6) + '" rx="15" fill="#8E7CD6"/>';
        s += '<rect x="' + cx + '" y="' + cy + '" width="' + w + '" height="' + ch + '" rx="12" fill="' + c.surface + '"/>';
        const fs = w < 120 ? 0.85 : 1;
        if (wide) { const bw = Math.min(ch * 1.5, w * 0.36); s += mini(num, cx + 10, cy + (ch - bw * 0.62) / 2, bw);
          s += '<text x="' + (cx + bw + 24) + '" y="' + (cy + ch / 2 - 4) + '" font-family="' + mono + '" font-size="10" letter-spacing="2" fill="#7A7771">CHAPTER ' + num + '</text><text x="' + (cx + bw + 24) + '" y="' + (cy + ch / 2 + 16) + '" font-family="' + sans + '" font-size="14" fill="#3A3936">' + c.name + '</text>'; }
        else { s += mini(num, cx + w * 0.12, cy + w * 0.1, w * 0.76);
          s += '<text x="' + (cx + 12) + '" y="' + (cy + ch - 30) + '" font-family="' + mono + '" font-size="' + 10 * fs + '" letter-spacing="2" fill="#7A7771">CHAPTER ' + num + '</text><text x="' + (cx + 12) + '" y="' + (cy + ch - 12) + '" font-family="' + sans + '" font-size="' + 13 * fs + '" fill="#3A3936">' + c.name + '</text>'; }
      }
      return C().raw(s, W, H, cap, k);
    };
    const set3 = (cols, wide, slots, pcols, pwide, tag) => [mock(1440, cols, 64, 20, 1100, tag + ' · 모니터 1440', 0.42, slots, wide), mock(1280, cols, 48, 16, 1040, tag + ' · 노트북 1280', 0.42, slots, wide), mock(390, pcols, 20, 12, 390, tag + ' · 폰 390', 0.62, slots, pwide)];
    const exObjs = () => { const m = {}; add(m, 0, 0, { t: 'box' }); add(m, 1, 0, { t: 'sw' }); add(m, 2, 0, { t: 'home' }); add(m, 3, 0, ext({ t: 'brazier' })); add(m, 0, 1, ext({ t: 'ember', on: true }, true)); add(m, 1, 1, ext({ t: 'charwall' }, true)); add(m, 2, 1, ext({ t: 'keg' })); add(m, 3, 1, { t: 'iron' }); add(m, 1, 2, { t: 'cube' }); add(m, 2, 2, { t: 'skull' }); return m; };
    const fireB = dark => { const m = {}; add(m, 0, 1, ext({ t: 'brazier' })); add(m, 2, 0, ext({ t: 'ember', on: true }, true)); add(m, 3, 2, ext({ t: 'charwall', st: 'burn' }, true)); add(m, 1, 2, { t: 'cube' });
      return F({ ch: '5b', g: ['0000', '0000', '0000'], bg: c5.base, objs: m, dark: dark ? DK : 0, lights: dark ? [[0, 1, 1.7, 0, 'orange'], [2, 0, 1.5, 0, 'orange'], [3, 2, 1.6, 0, 'orange'], [1, 2, 1.6]] : [] }, dark ? '어둠' : '밝음', 0.55); };
    const pitB = st => st ? { t: 'ext', pit: true, cell: Object.assign({ t: 'charbridge' }, st === 'cold' ? {} : { st }) } : null;
    const cvb = (stp, sts) => { const m = {}; ['intact', 'step', 'fall'].forEach((s, x) => add(m, x, 0, { t: 'crumble', st: s })); ['cold', 'burn', null].forEach((s, x) => { const o = pitB(s); if (o) add(m, x, 1, o); }); return F({ ch: '5b', g: ['000', 'ppp', '000'], bg: c5.base, objs: m, st: stp }, sts, 0.62); };
    const duo = (cs, bs, cap) => { const m = {}; add(m, 0, 0, { t: 'crumble', st: cs }); const o = pitB(bs); if (o) add(m, 1, 0, o); return F({ ch: '5b', g: ['0p', '00'], bg: c5.base, objs: m }, cap, 0.62); };
    return {
      kicker: 'WORLD-COLOR', title: '어둠에 잠긴 문 · 세계 색',
      intro: '5장은 1장과 같은 밝기에 색상만 보라(OKLCH 302°)로 옮기고, 채도는 2장의 1.3배(나)로 두었습니다. 4장 호박색(72°)과는 반대쪽이고, 붉은 용암색은 쓰지 않았습니다. 글자와 라벨은 1~4장 그대로입니다. 지옥의 어두움은 비틀기 어둠이 맡습니다. 바탕이 밝아서 어둠이 덮일 때의 차이가 큽니다.',
      picks: ['채도는 2장의 1.3배로 확정했습니다. 2장과 4장 사이 채도라 결이 맞습니다.', '불은 주황 그대로입니다(확정).', '밝은 보라 바닥에서는 집 구멍과 쇠막대도 게임 값 그대로 잘 보여, 색을 맞출 요소가 없습니다.', '장 고르기 8장 배치는 W6의 세 안을 비교해 골라 주세요.'],
      secs: [
        S('W1', '일곱 값', '', [G('5장 1단', 'd는 정한 방법 그대로 계산했습니다(바둑판 거리 × 1.5에서 키운 값 × 0.8).', [F({ ch: '5b', g: ['00000', '00000', '00000', '00000'], bg: c5.base, objs: o1 }, '1단 · base-bg 위', 0.62)],
          [['page-bg', c5.page, c5.page], ['base-bg', c5.base, c5.base], ['surface', c5.surface, c5.surface], ['floor-1 top', c5.top, c5.top], ['floor-1 top-alt', c5.alt, c5.alt], ['floor-1 left', c5.left, c5.left], ['floor-1 right', c5.right, c5.right], ['글자 · 라벨', '1~4장 그대로 #3A3936 / #7A7771', '#3A3936'], ['만든 법', '밝기 = 1장 같은 자리, 채도 = 2장 같은 자리 × 1.3, 색상 302°'], ['바둑판 거리 (OKLab)', D5.checker.toFixed(4)], ['d 시안 계산', D5.dSheet.toFixed(4)], ['d 게임 (× 0.8)', c5.d.toFixed(4)]])]),
        S('W2', '바닥 1~8단 토큰', '--color-floor-{n}-{top, top-alt, left, right}. 짝수 단은 바둑판 밝고 짙음이 뒤집혀 있습니다(표의 top이 이미 뒤집힌 값).', [G('1~8단 사다리', '', [F(ladder, '1단 → 8단', 0.6)], [1, 2, 3, 4, 5, 6, 7, 8].map(n => { const s = st(n); return ['floor-' + n, s.top + ' · ' + s.alt + ' · ' + s.left + ' · ' + s.right, s.top]; }))]),
        S('W3', '이웃 단이 갈리는지', '', [G('1단 · 2단 / 4단 · 5단', '맞닿은 칸의 윗면 차이가 바둑판 두 색 차이보다 큽니다.', [F(pair, '1단 · 2단', 0.5), F(Object.assign({}, pair, { st: { 0: 4, 1: 5 } }), '4단 · 5단', 0.5)],
          [['1단 ↔ 2단 윗면', '바둑판 차이의 ' + r12.toFixed(2) + '배'], ['4단 ↔ 5단 윗면', '바둑판 차이의 ' + r45.toFixed(2) + '배']])]),
        S('W4', '1~5장 나란히', '모두 게임 값으로 칠했습니다. 각 판 뒤는 그 장의 base-bg입니다.', [G('다섯 장', '', cmp, [])]),
        S('W5', '장 고르기에 5장 · 지금 5열', '헤더는 그대로이고 카드 격자만 장 카드로 바뀝니다. 바탕은 5장 page-bg이고, 각 카드는 제 장의 surface와 바닥으로 칠했습니다.', [G('지금 배치', '모니터와 노트북 5열, 폰 2열입니다.', set3(5, false, 5, 2, false, '5열'), [])]),
        S('W6', '8장까지 담는 배치', '6~8장 자리는 배치만 보려고 옅은 빈 카드로 그렸습니다(게임에는 만든 장만 나옵니다).', [
          G('가 · 5열 그대로', '다시 짜지 않습니다. 6장부터 둘째 줄이 생기고 8장에서 둘째 줄이 셋으로 끝납니다.', set3(5, false, 8, 2, false, '가'), [['열', '모니터 · 노트북 5 / 폰 2'], ['8장', '5 + 3 · 폰 2 × 4']]),
          G('나 · 4열 두 줄', '8장이 두 줄에 꼭 찹니다. 다만 5장까지는 4 + 1로 한 장이 혼자 남습니다.', set3(4, false, 8, 2, false, '나'), [['열', '모니터 · 노트북 4 / 폰 2'], ['8장', '4 + 4 · 폰 2 × 4']]),
          G('다 · 2열 넓은 카드', '모든 기기에서 2열이고 카드가 가로로 깁니다. 8장이 네 줄이 되어 모니터에서도 한 화면에 들어옵니다.', set3(2, true, 8, 2, false, '다'), [['열', '모든 기기 2 (폰은 보통 카드)'], ['카드 높이', '카드 폭의 0.34배 · 최소 84px']])]),
        S('W7', '기존 요소 · 보라 바닥 위', '모두 게임 값 그대로입니다. 밝은 보라 바닥에서는 집 구멍(#4A4845)과 쇠막대(#4C5259)도 잘 보여 맞출 것이 없습니다.', [
          G('게임 값 그대로', '', [F({ ch: '5b', g: ['0000', '0000', '0000'], bg: c5.base, objs: exObjs() }, '1단', 0.55), F({ ch: '5b', g: ['0000', '0000', '0000'], bg: c5.base, objs: exObjs(), st: { 0: 5 } }, '5단', 0.55)], [['집', '#4A4845 · #2F2E2C (게임 값)', '#4A4845'], ['쇠막대', '#4C5259 (게임 값)', '#4C5259']])]),
        S('W8', '무너지는 칸 · 숯 다리', '무너지는 칸은 둘레 틈 안의 바닥색 판, 숯 다리는 구덩이 위에 깐 짙은 장작입니다. 앞은 바닥 높이에서 3px 들어간 판이고 뒤는 구덩이 위라, 멈춘 화면에서도 갈립니다.', [
          G('나란히 · 세 단계씩', '윗줄: 무너지는 칸(멀쩡함 · 금 감 · 무너짐). 가운데 줄: 숯 다리(평소 · 불붙음 · 탄 뒤 구덩이).', [cvb(undefined, '1단'), cvb({ 0: 5 }, '5단')],
            [['무너지는 칸 멀쩡함', '0.846칸 · 3px 들어감 · 판 13px · 그 칸 바닥 색'], ['금 감', '네 조각 · 8px 내려앉음 · 9px · #c4bdab · #a19a8b · #b2ab9a', '#c4bdab'], ['무너짐', '15px 내려앉음 · 5px · #a9a08b · #8a8372 · #9a9382', '#a9a08b'], ['숯 다리', '4장 게임 값 (장작 두 판 · 불붙으면 숯불빛)', '#7A6D61']]),
          G('가장 헷갈리는 짝', '', [duo('intact', 'cold', '멀쩡함 · 평소'), duo('step', 'burn', '금 감 · 불붙음'), duo('fall', null, '무너짐 · 탄 뒤')], [])]),
        S('W9', '불 색 · 주황', '어둠에서 불은 둘레를 비추는 빛입니다(darkness 참고).', [G('주황 그대로', '보라 바닥과 색상이 반대라 어둠에서 가장 먼저 눈에 띕니다.', [fireB(false), fireB(true)], [['불빛', '#F8B04C · #FCDD86 · #F08C3A (게임 값)', '#F8B04C']], '확정')])
      ]
    };
  };

  // ================= darkness =================
  P['darkness'] = () => {
    const c5 = C().CH[5];
    const objs = () => { const m = {}; add(m, 0, 1, ext({ t: 'ember', on: true }, true)); add(m, 4, 2, ext({ t: 'charwall', st: 'burn' }, true)); add(m, 2, 1, { t: 'box' }); add(m, 1, 2, { t: 'cube' }); add(m, 3, 0, { t: 'skull', mark: 'both' }); return m; };
    const LV0 = { core: 0.2, ring: 0.45, faint: 0.75 };   // 확정: 빛 칸 0.2 · 옆 한 칸 0.75 · 그 너머 1.0 / 화로 큐브 둘레 8칸 0.45
    const L = [[1, 2, 1], [0, 1, 1], [4, 2, 1]];
    const D = (dark) => Object.assign({ ch: 5, g: ['00000', '00000', '00000', '00000'], objs: objs(), dark, lights: dark > 0 && dark !== PRE ? L : [] }, LV0);
    const B = (dark, cap) => F(Object.assign(D(dark), { bg: c5.base }), cap, 0.6);
    const fcD = dark => { const m = {}; add(m, 1, 1, ext({ t: 'brazier' })); add(m, 2, 2, ext({ t: 'fcube', n: 4, mode: 'under' })); add(m, 3, 1, { t: 'box' }); add(m, 0, 3, { t: 'box' });
      return Object.assign({ ch: 5, g: ['00000', '00000', '00000', '00000'], objs: m, dark, lights: dark ? [[2, 2, 2.6], [1, 1, 1]] : [] }, LV0); };
    const fc = dark => F(Object.assign(fcD(dark), { bg: c5.base }), dark ? '어둠 · 화로 불 붙은 큐브' : '밝음', 0.6);
    const LBD = o => { const m = {}; const du = o.du || 0, lu = o.lu === undefined ? du : o.lu;
      if (o.fc) { add(m, 1, 1, ext({ t: 'brazier' })); add(m, 2, 2, ext({ t: 'fcube', n: 4, mode: 'under' })); add(m, 4, 1, { t: 'box' }); }
      else if (o.fire) { add(m, 2, 2, ext({ t: 'charwall', st: 'burn' }, true)); add(m, 3, 1, { t: 'box' }); }
      else { add(m, 2 + Math.floor(du), 2, { t: 'cube', u: du - Math.floor(du) > 0 ? du - Math.floor(du) : 0 }); add(m, 4, 1, { t: 'box' }); add(m, 0, 3, { t: 'skull', mark: 'both' }); }
      if (o.fire) add(m, 4, 3, ext({ t: 'ember', on: true }, true));
      return { ch: 5, g: ['000000', '000000', '000000', '000000', '000000'], objs: m, dark: DK, core: 0.2, ring: 0.45, faint: 0.75, lights: o.fc ? [[2, 2, 2.6], [1, 1, 1]] : o.fire ? [[2, 2, 1], [4, 3, 1]] : [[2 + lu, 2, 1]] }; };
    const LB = (o, cap) => F(Object.assign(LBD(o), { bg: c5.base }), cap, 0.5);
    const strip = () => { let s = '<rect width="560" height="92" fill="' + PB + '"/>'; ['4', '3', '2', '1', '2', '1'].forEach((v, i) => { const d = i >= 4, x = 20 + i * 88;
      s += '<rect x="' + x + '" y="14" width="80" height="44" rx="10" fill="' + (d ? '#000000' : i === 3 ? '#D9D1E5' : PG) + '"/>';
      s += '<text x="' + (x + 40) + '" y="42" text-anchor="middle" font-family="' + sans + '" font-size="16" fill="' + (d ? '#F7F6F4' : '#3A3936') + '">' + v + '</text>';
      s += '<text x="' + (x + 40) + '" y="80" text-anchor="middle" font-family="' + mono + '" font-size="10" letter-spacing="1.6" fill="#7A7771">' + (d ? 'DARK' : 'MOVE ' + (i + 1)) + '</text>'; });
      return C().raw(s, 560, 92, '6수 한 바퀴 · 칸 안 숫자 = NIGHT 칸 값', 1); };
    return {
      kicker: 'DARKNESS', title: '비틀기 · 어둠',
      intro: '50판 내내 4수 밝고 2수 어둡습니다. 어둠은 판 위를 완전히 까맣게(#000, 1.0) 덮어 판의 꼴도 보이지 않습니다. 어둠 속에서 보이는 것은 정해 둔 것뿐입니다. 큐브 빛, 타는 숯과 켜진 불씨의 빛, 화로 불 붙은 큐브의 넓은 빛, 해골 자리(눈과 옅은 몸), 그림자 다리입니다. 눈(240 포함)은 어둠 속에서 보이지 않습니다. 빛은 색을 더하지 않고 어둠만 걷어 내며, 칸 단위로 번집니다(D4). 빛 칸은 어둠을 조금 남겨 은은하고, 바로 옆 한 칸만 겨우 보이며, 그 너머는 까맣습니다. 위 NIGHT 칸은 덮지 않습니다.',
      picks: ['어둠 1수 전 막 0.22는 밝은 보라 바탕에서 판 전체가 한 단 어두워진 것으로 또렷이 읽힙니다. NIGHT 칸도 한 단 짙어집니다.'],
      secs: [
        S('D1', '리듬과 라벨', '', [
          G('6수 한 바퀴', '4수째(어둠 1수 전)에 판이 살짝 어두워지고 NIGHT 칸이 한 단 짙어집니다.', [strip()], [['밝음', '4수'], ['어둠', '2수'], ['어둠 1수 전 판', '#000 0.22'], ['어둠 들어갈 때', '0.25초 · ease-in'], ['걷힐 때', '0.3초 · ease-out']]),
          G('NIGHT 칸', '밝을 때는 다음 어둠까지 남은 수, 어두울 때는 칸이 뒤집히고 남은 어둠 수를 셉니다.', [hud(12, 3, 'light'), hud(11, 1, 'pre'), hud(10, 2, 'dark')],
            [['라벨', 'NIGHT · IBM Plex Mono 11px · 자간 0.22em'], ['밝음 칸', PG + ' · 글자 #7A7771 / #3A3936', PG], ['1수 전 칸', '#D9D1E5', '#D9D1E5'], ['어둠 칸 (뒤집힘)', '#3A3936 · 글자 #D9D6D0 / #F7F6F4', '#3A3936']], '확정')]),
        S('D2', '장면', '', [
          G('밝음 → 어둠 1수 전 → 어둠', '', [B(0, '밝음'), B(PRE, '어둠 1수 전 · 0.22'), B(DK, '어둠 · 1.0')],
            [['막', '#000 · 어둠 1.0', '#000000'], ['큐브 빛', '빛 칸 0.2 안팎 · 옆 한 칸 0.75 · 그 너머 1.0 (D4)'], ['타는 숯 · 켜진 불씨', '큐브와 같은 꼴 · 색을 더하지 않음'], ['해골 자리', '눈 #DCD0FF + 몸 0.14', '#DCD0FF']]),
          G('화로 불 붙은 큐브', '불이 붙은 4수 동안만 빛이 보통 빛과 같은 칸 모양으로 둘레가 한 칸 더 옅게 번집니다.', [fc(0), fc(DK)], [['빛', '큐브 칸 0.2 · 옆 0.6 · 그 옆 0.9 (D4)'], ['화로', '큐브와 같은 크기']])]),
        S('D3', '다시 밝아지는 순간', '막이 0.3초에 걸쳐 걷히고, 칸 단위 빛도 막과 함께 사라집니다(칸마다 남는 어둠 × 막 세기). 처음이 빠르고 끝이 느립니다.', [G('0.3초', '', [B(DK, '0.00초 · 1.0'), B(0.45, '0.10초 · 0.45'), B(0.12, '0.20초 · 0.12'), B(0, '0.30초')], [['곡선', 'ease-out (0.2, 0.7, 0.3, 1)'], ['칸 빛', '빛 칸 0.2 · 옆 칸 0.75 · 그 너머 1.0에 막 세기를 곱함']])]),
        S('D4', '빛의 꼴 · 칸 단위 조명', '빛은 색을 더하지 않고 어둠을 걷어 냅니다. 빛 칸에도 어둠을 조금 남겨 하얗게 튀지 않습니다. 타는 숯과 불씨의 주황 불빛은 원래 게임 그림대로입니다.', [
          G('보통 빛', '', [LB({}, '큐브'), LB({ fire: true }, '타는 숯 · 불씨'), LB({ du: 0.5, lu: 0.35 }, '움직이는 중 0.06초')],
            [['빛 칸', '0.2'], ['바로 옆 한 칸 (대각 포함)', '0.75'], ['그 너머', '1.0'], ['섞음', '한 칸 8 × 8 · smoothstep. 빛 칸은 고르게, 옆 칸은 빛 칸 쪽 변이 두 칸 평균, 바깥 변 1.0'], ['따라감', '0.12초 이동 + 0.04초 늦음 · ease-out']], '확정'),
          G('화로 불 붙은 큐브 · 보통 빛과 나란히', '보통 빛과 같은 칸 모양(마름모)이고, 둘레만 한 칸 더 옅게 번집니다. 큐브 칸은 보통 빛과 같은 0.2입니다.', [LB({}, '보통 빛 큐브'), LB({ fc: true }, '화로 불 붙은 큐브')],
            [['큐브 칸', '0.2 (보통 빛과 같음)'], ['바로 옆 한 칸', '0.6 (보통 빛 0.75)'], ['그 옆 한 칸', '0.9'], ['그 너머', '1.0'], ['섞음', '보통 빛과 같음 (칸 모서리끼리)']], '확정')]),
        PH([G('빛 · 폰', '', [phone(LBD({}), '보통 빛 큐브', 14, 2, 'dark'), phone(LBD({ fc: true }), '화로 불 붙은 큐브', 14, 2, 'dark'), phone(LBD({ fire: true }), '숯 · 불씨', 14, 2, 'dark')], []),
            G('어둠 · 폰', '', [phone(D(0), '밝음', 12, 3, 'light'), phone(D(PRE), '어둠 1수 전', 13, 1, 'pre'), phone(D(DK), '어둠', 14, 2, 'dark'), phone(fcD(DK), '화로 불 붙은 큐브', 14, 2, 'dark')], [])])
      ]
    };
  };

  // ================= skull =================
  P['skull'] = () => {
    const c5 = C().CH[5], K = C().K5;
    const b = (g, objs, cap, ex) => F(Object.assign({ ch: 5, g, bg: c5.base, objs }, ex || {}), cap, 0.6);
    const row = (...items) => { const m = {}; items.forEach(([x, o]) => add(m, x, 0, o)); return m; };
    const darkB = (mark, sx, su, sz, cap) => { const m = {}; add(m, 3, 1, { t: 'cube' }); add(m, sx, 1, { t: 'skull', mark, u: su || 0, z: sz || 0 }); add(m, 1, 0, { t: 'box' }); return b(['00000', '00000', '00000'], m, cap, { dark: DK, lights: [[3, 1, 1.6]] , core: 0.2, faint: 0.75 }); };
    return {
      kicker: 'SKULL', title: '해골',
      intro: '큐브처럼 한 덩어리인 해골 머리이고, 정수리 위에 뼈다귀 하나가 비스듬히 눕혀 있습니다. 폭, 깊이, 높이가 거의 같고, 앞면 하나를 얼굴(큰 눈구멍 둘, 작은 코, 이 줄)로 채웠습니다. 코와 이는 면을 조금 짙게 칠한 작은 칸이고 선은 쓰지 않았습니다. 상자, 화약통, 화로와 같은 블록 쌓기 결입니다.',
      picks: [],
      secs: [
        S('S1', '꼴', '큐브처럼 한 덩어리인 머리입니다. 폭, 깊이, 높이가 거의 같고, 왼쪽 앞면 하나를 얼굴로 채웠습니다. 위쪽 절반에 큰 눈구멍 둘, 그 아래 작은 코, 맨 아래 한 단 좁은 턱에 이 줄입니다. 정수리는 한 단 좁게 쌓아 둥글게 보입니다.', [
          G('평소', '', [b(['000', '000', '000'], add({}, 1, 1, { t: 'skull' }), '1단'), b(['000', '000', '000'], add({}, 1, 1, { t: 'skull' }), '5단', { st: { 0: 5 } })],
            [['머리통', '0.64 × 0.64칸 × 19px', K.bone.t], ['머리통 옆면', K.bone.l + ' · ' + K.bone.r, K.bone.l], ['정수리', '0.56칸 × 2px (15% 밝게)'], ['턱', '0.48 × 0.4칸 × 5.5px (한 단 좁게) · ' + K.jaw.t, K.jaw.t], ['눈구멍', '0.135칸 × 8.5px 둘 (세로로 김) · 사이 0.13칸 (콧등 폭) · ' + K.sock, K.sock], ['코', '0.07칸 × 2.7px · 옆면 38% 짙게'], ['이', '0.036칸 × 3.6px 다섯 · 턱 옆면 24% 짙게'], ['전체', '폭 0.64칸 · 높이 29.6px (뼈 포함, 한 층 30px보다 조금 낮음)'], ['바닥 그림자', '#000 0.16 · 0.72칸'], ['머리 위 뼈다귀', '하나를 정수리 윗면에 비스듬히 눕힘 (끝이 윗면 안) · 0.5칸 · 막대 0.07칸 × 1.8px · 양 끝 혹 둘씩 0.13칸 × 3px + 둥근 윗머리 0.08칸 × 0.6px (20% · 40% 밝게) · ' + K.jaw.t, K.jaw.t]], '확정'),
          G('큐브 · 상자 옆', '', [b(['0000'], row([0, { t: 'cube' }], [1, { t: 'box' }], [2, { t: 'skull' }], [3, ext({ t: 'keg' })]), '큐브 · 상자 · 해골 · 화약통')], []),
          G('어둠 속 자리', '눈구멍 가운데 작은 빛 점 하나씩 켭니다. 모양은 밝을 때 그대로, 머리는 0.2, 머리 위 뼈다귀는 0.45로 또렷하게 보입니다.', [b(['000', '000', '000'], add(add({}, 1, 1, { t: 'skull', mark: 'both' }), 2, 2, { t: 'cube' }), '어둠', { dark: DK, lights: [[2, 2, 1]] , core: 0.2, faint: 0.75 })],
            [['빛 점', '0.06칸 × 3.4px · ' + K.glowEye + ' 0.85', K.glowEye], ['눈구멍', K.sock + ' 그대로', K.sock], ['머리', '뼈색 0.12']])]),
        S('S2', '밀림', '', [G('와르르 → 다시 맞춤', '무너지는 순간 오른쪽 눈구멍을 세로로 지나는 금 하나를 따라 머리가 두 덩이로 갈라져 꼭대기가 2.5px쯤 V자로 벌어집니다. 벌어진 틈에는 조금 짙은 뼈색의 잘린 면이 보입니다. 머리 위 뼈다귀는 해골 오른쪽 발치로 미끄러져 내려옵니다. 모든 일이 해골 칸 안에서 끝납니다. 두 덩이가 다음 칸으로 모이며 붙고 금이 사라진 뒤, 뼈가 다시 위에 얹히고 2px 튀었다 앉습니다.', [
          b(['0000'], row([0, { t: 'cube' }], [1, { t: 'skull' }]), '0.00초'), b(['0000'], row([0, { t: 'cube', u: 0.3 }], [1, { t: 'skull', st: 'crumble' }]), '0.08초 · 와르르'),
          b(['0000'], row([1, { t: 'cube', u: -0.2 }], [1, { t: 'skull', st: 'gather', u: 0.55 }]), '0.18초 · 모이며 감'), b(['0000'], row([1, { t: 'cube' }], [2, { t: 'skull', st: 'stack' }]), '0.25초 · 두 덩이 붙음, 뼈는 아직 발치'), b(['0000'], row([1, { t: 'cube' }], [2, { t: 'skull' }]), '0.32초 · 다시 맞춤')],
          [['무너짐', '0.08초 · 금 하나 (오른쪽 눈구멍 세로) · 두 덩이 꼭대기 0.05칸 ≈ 2.5px씩 바깥으로 기욺 · 틈에 잘린 면 (뼈색 35% 짙게) · 뼈다귀 오른쪽 발치로 (칸 안)'], ['모이며 이동', '0.1초 · V가 반쯤 닫히며 (0.025칸) 다음 칸으로 · 뼈다귀 발치에 함께'], ['다시 맞춤', '0.14초 · 두 덩이가 붙고 금 사라짐 → 뼈 얹힘 · 2px 튀었다 앉음'], ['합계', '0.32초 (상자 밀기와 같은 길이)']])]),
        S('S3', '막힘', '', [G('제자리 와르르', '뒤가 높은 칸이라 안 밀립니다. 같은 흐름으로 제자리에서 무너졌다가 다시 쌓이고, 큐브는 제자리입니다.', [
          b(['0001'], row([1, { t: 'cube' }], [2, { t: 'skull' }]), '0.00초'), b(['0001'], row([1, { t: 'cube', u: 0.12 }], [2, { t: 'skull', st: 'crumble' }]), '0.08초'), b(['0001'], row([1, { t: 'cube' }], [2, { t: 'skull', st: 'gather' }]), '0.18초'), b(['0001'], row([1, { t: 'cube' }], [2, { t: 'skull', st: 'stack' }]), '0.25초'), b(['0001'], row([1, { t: 'cube' }], [2, { t: 'skull' }]), '0.32초')],
          [['무너짐', '0.08초'], ['모임', '0.1초 · 제자리'], ['다시 맞춤', '0.14초 · 두 덩이 붙음 → 뼈 얹힘 · 2px 튀었다 앉음'], ['합계', '0.32초 (밀림과 같은 흐름)'], ['큐브', '0.12칸 밀었다 돌아옴']])]),
        S('S4', '어둠에 걷기', '어둠 한 수에 한 칸, 큐브 곁으로 콩 뛰어 옵니다. 큐브 바로 옆에서 멈춥니다.', [G('한 칸 걸음', '', [darkB('both', 0, 0, 0, '어둠 1수 시작'), darkB('both', 0, 0.5, 4, '0.1초 · 걷는 중'), darkB('both', 1, 0, 0, '어둠 1수 끝'), darkB('both', 2, 0, 0, '어둠 2수 끝 · 옆에서 멈춤')],
          [['한 칸', '0.2초 · 4px 콩 뜀'], ['방향', '큐브 쪽 가까운 길, 큐브 옆 칸에서 멈춤']]),
          G('한 층 오름', '큐브처럼 한 층을 오릅니다. 평지 걸음과 같은 콩 뜀이고, 윗면보다 5px 높이 떴다 앉습니다.', [
            b(['00011', '00011', '00011'], add(add({}, 4, 1, { t: 'cube' }), 2, 1, { t: 'skull', mark: 'both' }), '0.00초', { dark: DK, lights: [[4, 1, 1]], core: 0.2, faint: 0.75 }),
            b(['00011', '00011', '00011'], add(add({}, 4, 1, { t: 'cube' }), 3, 1, { t: 'skull', mark: 'both', u: -0.5, z: 5 }), '0.12초 · 윗면 위 5px', { dark: DK, lights: [[4, 1, 1]], core: 0.2, faint: 0.75 }),
            b(['00011', '00011', '00011'], add(add({}, 4, 1, { t: 'cube' }), 3, 1, { t: 'skull', mark: 'both' }), '0.24초 · 앉음', { dark: DK, lights: [[4, 1, 1]], core: 0.2, faint: 0.75 })],
            [['오름', '0.24초 · 한 층 30px + 5px 뜀 · 앉을 때 1px 눌렸다 폄']]),
          G('한 층 내려감', '내려갈 때는 윗면에서 4px 떴다가 아래 칸으로 내려앉습니다.', [
            b(['11100', '11100', '11100'], add(add({}, 4, 1, { t: 'cube' }), 2, 1, { t: 'skull', mark: 'both' }), '0.00초', { dark: DK, lights: [[4, 1, 1]], core: 0.2, faint: 0.75 }),
            b(['11100', '11100', '11100'], add(add({}, 4, 1, { t: 'cube' }), 3, 1, { t: 'skull', mark: 'both', u: -0.5, z: 34 }), '0.08초 · 4px 뜸', { dark: DK, lights: [[4, 1, 1]], core: 0.2, faint: 0.75 }),
            b(['11100', '11100', '11100'], add(add({}, 4, 1, { t: 'cube' }), 3, 1, { t: 'skull', mark: 'both' }), '0.20초 · 앉음', { dark: DK, lights: [[4, 1, 1]], core: 0.2, faint: 0.75 })],
            [['내려감', '0.2초 · 4px 뜬 뒤 30px 내려앉음 · 앉을 때 1px 눌렸다 폄']])]),
        S('S6', '스위치 위', '', [G('누름', '해골이 올라서면 스위치가 눌립니다(1px). 큐브는 해골 위에 못 오릅니다.', [b(['000', '000', '000'], add(add({}, 1, 1, { t: 'sw', pressed: true }, { t: 'skull', z: 1 }), 2, 2, { t: 'cube' }), '밝음'), b(['000', '000', '000'], add(add({}, 1, 1, { t: 'sw', pressed: true }, { t: 'skull', z: 1, mark: 'both' }), 2, 2, { t: 'cube' }), '어둠', { dark: DK, lights: [[2, 2, 1.6]] , core: 0.2, faint: 0.75 })], [])]),
        S('S7', '요소 연출 · 턱 딱딱', '밝을 때 가끔 해골 하나가 제자리에서 턱을 두 번 여닫습니다. 4.35초마다 하나씩 분위기 연출(까마귀)과 번갈아 나고, 어둠에는 나지 않습니다.', [G('0.3초', '', [
          b(['000'], add({}, 1, 0, { t: 'skull' }), '0.000초'), b(['000'], add({}, 1, 0, { t: 'skull', jaw: 3.5 }), '0.075초 · 벌림'), b(['000'], add({}, 1, 0, { t: 'skull', z: 1 }), '0.150초 · 딱 (1px 튐)'), b(['000'], add({}, 1, 0, { t: 'skull', jaw: 3.5 }), '0.225초 · 벌림'), b(['000'], add({}, 1, 0, { t: 'skull', z: 1 }), '0.300초 · 딱 (1px 튐)')],
          [['벌림', '턱 3.5px 내려감 · 틈은 눈구멍 색 ' + K.sock, K.sock], ['닫힘', '닫힐 때마다 머리 1px 튀었다 앉음'], ['한 번', '0.15초 (벌림 0.075 + 닫힘 0.075)'], ['합계', '0.3초 · 두 번'], ['간격', '4.35초마다 하나 · 분위기 연출과 번갈아 · 밝을 때만']])]),
        PH([G('해골 · 폰', '', [phone({ g: ['000', '000', '000'], objs: add(add({}, 1, 1, { t: 'skull', mark: 'both' }), 2, 2, { t: 'cube' }), dark: DK, lights: [[2, 2, 1]], core: 0.2, faint: 0.75 }, '어둠 속', 14, 1, 'dark'), phone({ g: ['0000'], objs: row([0, { t: 'cube' }], [1, { t: 'box' }], [2, { t: 'skull' }]) }, '평소'), phone({ g: ['0000'], objs: row([0, { t: 'cube', u: 0.3 }], [1, { t: 'skull', st: 'crumble' }]) }, '0.08초 · 와르르'), phone({ g: ['0000'], objs: row([1, { t: 'cube', u: -0.2 }], [1, { t: 'skull', st: 'gather', u: 0.55 }]) }, '0.18초 · 모임'), phone({ g: ['00000', '00000', '00000'], objs: add(add({}, 3, 1, { t: 'cube' }), 2, 1, { t: 'skull', mark: 'both' }), dark: DK, lights: [[3, 1, 1.6]] }, '어둠 · 옆에서 멈춤', 14, 1, 'dark')], [])])
      ]
    };
  };

  // ================= hook =================
  P['hook'] = () => {
    const c5 = C().CH[5], K = C().K5;
    const g2 = ['0000000', '0000000'];
    // all hook scenes are mirrored in x so the chain travels toward the camera and the hook strikes a visible (+u) face; chain + tip go after the target in its cell
    const mir = (g, m) => { const Wd = g[0].length, g2 = g.map(r => r.split('').reverse().join('')), m2 = {};
      Object.entries(m || {}).forEach(([k, list]) => { const [x, y] = k.split(',').map(Number), nk = (Wd - 1 - x) + ',' + y;
        const L2 = list.map(o => { const q = Object.assign({}, o); if (o.u !== undefined) q.u = -o.u; if (o.t === 'chain') { q.u0 = -(o.u1 || 0); q.u1 = -(o.u0 || 0); } if (o.dir) q.dir = [-o.dir[0], o.dir[1]]; if (o.t === 'tip' && o.fu !== undefined) q.fu = -o.fu; if (o.out) q.out = [-o.out[0], o.out[1]]; return q; });
        const isC = o => o.t === 'chain' || o.t === 'tip';
        m2[nk] = list.some(o => o.t === 'hook') ? L2 : L2.filter(o => !isC(o)).concat(L2.filter(isC)); });
      return [g2, ord(m2)]; };
    // in the hook cell: the hook (hopping or at the edge) goes before the cube when it is on the back side (−u / −v), after it on the front side
    const ord = m => { Object.keys(m).forEach(k => { const L = m[k]; if (!L.some(o => o.t === 'hook')) return; const mv = L.filter(o => (o.t === 'tip' || o.t === 'hookMv') && o.dir), rest = L.filter(o => mv.indexOf(o) < 0);
        const back = mv.filter(o => o.dir[0] < 0 || o.dir[1] < 0), front = mv.filter(o => back.indexOf(o) < 0), hi = rest.findIndex(o => o.t === 'hook'), ci = rest.findIndex((o, i) => i > hi && o.t !== 'chain');
        const at = ci < 0 ? rest.length : ci; m[k] = rest.slice(0, at).concat(back, rest.slice(at), front); }); return m; };
    const b = (g, m, cap, ex) => { const [g2, m2] = mir(g, m); return F(Object.assign({ ch: 5, g: g2, bg: c5.base, objs: m2 }, ex || {}), cap, 0.55); };
    const phM = (d, ...r) => { const [g2, m2] = mir(d.g, d.objs); return phone(Object.assign({}, d, { g: g2, objs: m2 }), ...r); };
    // hop frame: hook lifted off the cuff on its way to the firing edge (pre-mirror dir [1,0])
    const Hm = (t, extra) => { const m = {}; add(m, 1, 0, { t: 'hook', out: [1, 0] }, { t: 'cube' }, { t: 'hookMv', dir: [1, 0], tt: t }); (extra || []).forEach(([x, o]) => add(m, x, 0, o)); return m; };
    const E = 0.45;
    // four directions, unmirrored 5 × 5, hook + cube at the centre
    const D4 = [[[1, 0], '오른쪽 아래'], [[0, 1], '왼쪽 아래'], [[-1, 0], '왼쪽 위'], [[0, -1], '오른쪽 위']];
    const g5 = ['00000', '00000', '00000', '00000', '00000'];
    const dirF = (d, ph) => { const m = {}; add(m, 2, 2, { t: 'hook' }, { t: 'cube' });
      if (ph === 'hop') { m['2,2'][0].out = d; m['2,2'].push({ t: 'hookMv', dir: d, tt: 0.5 }); }
      else chainTo(m, 2, 2, d[0], d[1], ph === 'edge' ? E : 1.9);
      return F({ ch: 5, g: g5, bg: c5.base, objs: ord(m) }, '', 0.5); };
    const H = (L, extra, hx) => { const m = {}; hx = hx || 1; add(m, hx, 0, { t: 'hook' }, { t: 'cube' }); if (L > 0) chainTo(m, hx, 0, 1, 0, L); (extra || []).forEach(([x, o]) => add(m, x, 0, o)); return m; };
    return {
      kicker: 'HOOK', title: '갈고리',
      intro: '큐브가 올라설 수 있는 낮은 쇠판에 가운데 구멍 하나, 오른쪽 모서리 받침에 갈고리 하나가 서 있습니다. 큐브와 겹치지 않는 자리입니다. 갈고리는 고른 굵기로 크게 휘다가 굽이 꼭대기부터 끝까지 날처럼 가늘어지고, 끝만 검붉습니다. 쇠는 4장 쇠막대 흑철의 밝기에 5장 보랏빛을 입혔습니다. 쏠 때는 받침에서 빠져 쏘는 쪽 칸 변 가운데로 톡 옮겨 간 뒤(0.04초) 칸 줄을 따라 일직선으로 날아가 상자나 해골 면에 끝이 박힙니다. 돌아올 때는 거꾸로 칸 변에서 받침으로 다시 꽂힙니다.',
      picks: ['230은 사슬이 줄의 상자를 모두 꿰어 지나가는 그림 하나로 갈립니다. 첫 상자에서 멈추는 보통 갈고리와 정지 화면에서도 다릅니다.'],
      secs: [
        S('H1', '평소', '', [G('생김새', '', [b(['000', '000', '000'], add({}, 1, 1, { t: 'hook' }), '1단'), b(['000', '000', '000'], add(add({}, 1, 1, { t: 'hook' }), 1, 1, { t: 'cube' }), '큐브가 올라선 칸'), b(['000', '000', '000'], add(add({}, 1, 1, { t: 'hook' }), 0, 1, { t: 'cube' }), '큐브 옆'), b(['000', '000', '000'], add({}, 1, 1, { t: 'hook' }), '5단', { st: { 0: 5 } })],
          [['쇠', '4장 흑철 #4C5259의 OKLab 밝기 그대로 · hue 302° · chroma 0.034 → ' + C().HIB + ' · tone() 규칙 (쇠판 · 받침 · 갈고리)', C().HIB], ['쇠판', '0.8칸 × 1.5px'], ['구멍', '지름 0.26칸 · #1C1922', '#1C1922'], ['받침', '오른쪽 모서리 (0.33, −0.33) · 0.11칸 × 4px · 갈고리가 빠지면 짙은 구멍이 보임'], ['갈고리', '굵기 6px로 크게 휨 (반지름 7px · 220°) → 굽이 꼭대기부터 끝까지 0.3px로 가늘어짐 · 전체 높이 약 28px'], ['끝', '마지막 다섯 마디만 검붉음 · 앞면 #682922 / 테 #9A4436', '#9A4436']])]),
        S('H1b', '쏠 때 · 네 방향', '받침에서 빠져 쏘는 쪽 칸 변 가운데로 옮겨 간 뒤 그 줄을 따라 날아갑니다. 큐브를 돌아가는 길은 판 테두리를 따르고, 가운데에서 6px 떠오릅니다. 돌아올 때는 같은 길을 거꾸로 밟아 받침에 꽂힙니다.', D4.map(([d, nm]) => G(nm, '', [dirF(d, 'hop'), dirF(d, 'edge'), dirF(d, 'fly')].map((f, i) => Object.assign(f, { cap: ['0.02초 · 빠짐', '0.04초 · 칸 변', '날아감'][i] })), []))
          .concat([G('', '', [], [['옮겨 감', '0.04초 · 받침 → 쏘는 쪽 칸 변 가운데 (자루가 판 가장자리 바로 밖 0.45칸, 끝은 이웃 칸으로 조금 나감 · 뒤쪽 두 방향도 큐브 뒤로 다 숨지 않음)'], ['길', '오른쪽 위 · 오른쪽 아래: 바로 · 왼쪽 아래: 앞 모서리 거쳐 · 왼쪽 위: 뒤 모서리 거쳐'], ['돌아옴', '같은 길을 거꾸로 0.04초 · 받침에 꽂힘'], ['시간', '기존 뻗음 · 끌림 · 앉음 앞뒤로 0.04초씩 더함']])])),
        S('H2', '사슬 뻗음 · 끌려옴', '', [G('상자 끌기', '큐브가 오른쪽 아래에서 들어와 왼쪽 위 줄을 씁니다. 갈고리가 보이는 면에 박히도록 사슬이 화면 안쪽으로 뻗는 쪽으로 그렸습니다.', [
          b(g2, H(0, [[5, { t: 'box' }]]), '0.00초 · 들어옴'), b(g2, Hm(0.5, [[5, { t: 'box' }]]), '+0.02초 · 빠짐'), b(g2, H(E, [[5, { t: 'box' }]]), '+0.04초 · 칸 변'), b(g2, H(2, [[5, { t: 'box' }]]), '0.06초 · 뻗음'), b(g2, H(3.71, [[5, { t: 'box' }]]), '0.12초 · 걸림'),
          b(g2, H(2.2, [[4, { t: 'box', u: -0.5, z: 8 }]]), '0.24초 · 끌려옴'), b(g2, H(E, [[2, { t: 'box' }]]), '0.36초 · 앉음'), b(g2, Hm(0.5, [[2, { t: 'box' }]]), '+0.02초 · 받침으로'), b(g2, H(0, [[2, { t: 'box' }]]), '+0.04초 · 꽂힘')],
          [['사슬', '한 줄 · 두께 3.6px · 높이 8px (구멍에서 4px로 나옴) · 같은 쇠 ' + K.chain.a + ' / ' + K.chain.b + ' 가 0.11칸마다 번갈아 · 아랫단 ' + K.chain.l + ' · 녹 없음', K.chain.a], ['날아가는 갈고리', '받침은 판에 남고 갈고리만 · 같은 꼴 × 1.05 · 사슬 방향 세로면 · 뒤로 25° 기울어 끝이 앞장섬 · 자루 밑에 사슬', C().HIB], ['박힘', '끝이 면에 3px 들어가 잘려 보이고, 그 자리에 짙은 녹 자국 0.12칸 × 7px · 박힌 채 끌려옴', '#3E1814'], ['사슬 색', K.chain.a + ' · ' + K.chain.b + ' · ' + K.chain.l, K.chain.b], ['뻗음', '칸당 0.03초 (6칸 0.18초)'], ['끌림', '칸당 0.06초 · 8px 떠서 옴 · 바닥 그림자 #000 0.25'], ['앉음', '0.06초']])]),
        S('H3', '구덩이', '', [
          G('구덩이 넘기', '중간 구덩이는 떠서 넘습니다. 그림자가 구덩이 바닥에 떨어집니다.', [b(['000p00', '000000'], (() => { const m = {}; add(m, 1, 0, { t: 'hook' }, { t: 'cube' }); chainTo(m, 1, 0, 1, 0, 2.2); add(m, 3, 0, { t: 'box', u: 0.2, z: 10, sz: -34 }); return m; })(), '넘는 중'), b(['000p00', '000000'], H(0, [[2, { t: 'box' }]]), '앉음')], []),
          G('도착 칸이 구덩이', '고리 바로 앞이 구덩이면 거기 빠져 메웁니다.', [b(['00p000', '000000'], (() => { const m = {}; add(m, 1, 0, { t: 'hook' }, { t: 'cube' }); chainTo(m, 1, 0, 1, 0, 1.4); add(m, 2, 0, { t: 'box', u: 0.4, z: 8 }); return m; })(), '끌려옴'), b(['00p000', '000000'], (() => { const m = {}; add(m, 1, 0, { t: 'hook' }, { t: 'cube' }); add(m, 2, 0, { t: 'box', z: -16 }); return m; })(), '빠짐 0.1초'), b(['00p000', '000000'], (() => { const m = {}; add(m, 1, 0, { t: 'hook' }, { t: 'cube' }); add(m, 2, 0, { t: 'fill' }); return m; })(), '메움')], [['빠짐', '0.1초 · 상자 메움은 게임 값']])]),
        S('H4', '벽에 박힘', '', [G('사슬만 돌아옴', '벽이나 높은 칸에 맞으면 갈고리가 잠깐 박혔다가 빠지며, 사슬이 그대로 감겨 돌아옵니다. 아무것도 움직이지 않습니다.', [b(['0000100', '0000000'], H(2.5), '0.10초 · 박힘'), b(['0000100', '0000000'], H(2.35), '0.14초 · 튕김'), b(['0000100', '0000000'], H(1.4), '0.24초 · 돌아옴'), b(['0000100', '0000000'], H(E), '0.30초 · 칸 변'), b(['0000100', '0000000'], Hm(0.5), '+0.02초 · 받침으로'), b(['0000100', '0000000'], H(0), '+0.04초 · 꽂힘')], [['박힘 뒤 멈춤', '0.04초'], ['돌아옴', '칸당 0.04초']])]),
        S('H5', '해골도 끌려옴', '', [G('해골', '날아오는 동안은 몸을 유지하고, 앉을 때 와르르 했다 맞춰집니다.', [b(g2, H(2.75, [[4, { t: 'skull' }]]), '걸림'), b(g2, H(1.5, [[3, { t: 'skull', u: -0.3, z: 8 }]]), '끌려옴'), b(g2, H(0, [[2, { t: 'skull', st: 'crumble' }]]), '앉으며 와르르'), b(g2, H(0, [[2, { t: 'skull' }]]), '다시 맞춤')], [['앉은 뒤', '해골 막힘과 같은 0.22초']])]),
        S('H6', '230 · 꿰뚫는 갈고리', '사슬 하나가 6칸 안 줄의 상자를 모두 꿰고, 끝의 갈고리가 맨 끝 상자에 박힙니다. 한꺼번에 끌어와 고리 앞에 한 줄로 붙입니다.', [G('여러 개 꿰기', '', [
          b(['00000000', '00000000'], H(4.71, [[3, { t: 'box' }], [5, { t: 'box' }], [6, { t: 'box' }]]), '꿰기 · 갈고리는 맨 끝 상자에'),
          b(['00000000', '00000000'], H(4.6, [[2, { t: 'box', u: 0.4, z: 8 }], [4, { t: 'box', u: 0.1, z: 8 }], [5, { t: 'box', u: -0.1, z: 8 }]]), '끌려옴'),
          b(['00000000', '00000000'], H(E, [[2, { t: 'box' }], [3, { t: 'box' }], [4, { t: 'box' }]]), '한 줄로 붙음'), b(['00000000', '00000000'], H(0, [[2, { t: 'box' }], [3, { t: 'box' }], [4, { t: 'box' }]]), '+0.04초 · 꽂힘')],
          [['꿰기', '6칸 끝까지 뻗음 0.18초 · 상자 사이도 사슬이 이어짐'], ['끌림', '모두 함께 · 가장 먼 상자 기준 칸당 0.06초'], ['도착', '고리 앞부터 빈틈 없이']])]),
        (() => { const Lt = { dark: DK, lights: [[5, 2, 1]], core: 0.2, faint: 0.75 }, gD = ['00000000', '00000000', '00000000', '00000000', '00000000'], Y = m => { const o = {}; Object.entries(m).forEach(([k, L]) => { const [x, y] = k.split(',').map(Number); o[(x + 1) + ',' + (y + 2)] = L; }); return o; };
          return S('H7', '어둠에 쓰기', '규칙과 시간은 같고 보이는 것만 다릅니다. 큐브 빛(빛 칸 0.2 · 옆 한 칸 0.75 · 그 너머 1.0) 안에서 갈고리가 빠져 칸 변으로 옮겨 가고, 사슬은 까만 곳으로 뻗어 사라집니다. 걸린 상자는 보이지 않다가 옆 칸에 들어오며 드러납니다.', [G('데스크톱', '', [
            b(gD, Y(H(0, [[5, { t: 'box' }]])), '0.00초 · 어둠', Lt), b(gD, Y(Hm(0.5, [[5, { t: 'box' }]])), '+0.02초 · 빠짐', Lt), b(gD, Y(H(E, [[5, { t: 'box' }]])), '+0.04초 · 칸 변', Lt),
            b(gD, Y(H(2, [[5, { t: 'box' }]])), '0.06초 · 까만 곳으로 뻗음', Lt), b(gD, Y(H(3.71, [[5, { t: 'box' }]])), '0.12초 · 걸림 (안 보임)', Lt),
            b(gD, Y(H(2.2, [[4, { t: 'box', u: -0.5, z: 8 }]])), '0.24초 · 끌려옴', Lt), b(gD, Y(H(1.1, [[2, { t: 'box', u: 0.4, z: 8 }]])), '0.30초 · 옆 칸에 들어옴', Lt),
            b(gD, Y(H(E, [[2, { t: 'box' }]])), '0.36초 · 앉음', Lt), b(gD, Y(H(0, [[2, { t: 'box' }]])), '+0.04초 · 꽂힘', Lt)],
            [['보임', '빛 칸: 큐브 · 쇠판 · 받침 · 옮겨 가는 갈고리 · 사슬 첫 칸 / 옆 칸 0.75: 사슬과 갈고리가 흐려지며 들어감 · 끌려온 상자가 드러남 / 그 너머: 사슬 · 갈고리 · 상자 모두 안 보임'], ['더하지 않음', '사슬이나 갈고리 끝에 따로 빛을 켜지 않음']]),
            G('폰', '', [phM({ g: gD, objs: Y(H(2, [[5, { t: 'box' }]])), dark: DK, lights: [[5, 2, 1]], core: 0.2, faint: 0.75 }, '뻗음', 12, 2, 'dark'), phM({ g: gD, objs: Y(H(1.1, [[2, { t: 'box', u: 0.4, z: 8 }]])), dark: DK, lights: [[5, 2, 1]], core: 0.2, faint: 0.75 }, '끌려옴 · 옆 칸', 12, 2, 'dark')], [])]); })(),
        PH([G('갈고리 · 폰', '', [phM({ g: ['000', '000', '000'], objs: add({}, 1, 1, { t: 'hook' }) }, '빈 칸'), phM({ g: ['000', '000', '000'], objs: add(add({}, 1, 1, { t: 'hook' }), 1, 1, { t: 'cube' }) }, '큐브가 올라선 칸'), phM({ g: g2, objs: H(E, [[5, { t: 'box' }]]) }, '칸 변'), phM({ g: g2, objs: H(2, [[5, { t: 'box' }]]) }, '날아감'), phM({ g: g2, objs: H(3.71, [[5, { t: 'box' }]]) }, '사슬 걸림'), phM({ g: g2, objs: H(2.2, [[4, { t: 'box', u: -0.5, z: 8 }]]) }, '끌려옴'), phM({ g: ['00000000', '00000000'], objs: H(4.71, [[3, { t: 'box' }], [5, { t: 'box' }], [6, { t: 'box' }]]) }, '230 꿰기')], [])])
      ]
    };
  };

  // ================= eye =================
  P['eye'] = () => {
    const c5 = C().CH[5], K = C().K5, EY = C().EY;
    const g = ['00000', '00000', '00000'];
    const b = (gg, m, cap, ex) => F(Object.assign({ ch: 5, g: gg, bg: c5.base, objs: m }, ex || {}), cap, 0.58);
    const E = (x1, extra, eo) => { const m = {}; add(m, 0, 1, Object.assign({ t: 'eye', dir: [1, 0] }, eo || {})); if (x1 >= 1) gzRow(m, 1, 1, x1); (extra || []).forEach(([x, y, o]) => add(m, x, y, o)); return m; };
    // dark scenes: one empty row above and below so the cube light (0.2 · 0.75 · 1.0) never reaches the board edge
    const gP = ['0000000', '0000000', '0000000', '0000000', '0000000'], Y1 = m => { const o = {}; Object.entries(m).forEach(([k, L]) => { const [x, y] = k.split(',').map(Number); o[(x + 1) + ',' + (y + 1)] = L; }); return o; };
    const g5 = ['00000', '00000', '00000', '00000', '00000'];
    const D4 = [[[1, 0], '오른쪽 아래', m => gzRow(m, 2, 3, 4)], [[0, 1], '왼쪽 아래', m => gzCol(m, 2, 3, 4)], [[-1, 0], '왼쪽 위', m => gzRow(m, 2, 0, 1)], [[0, -1], '오른쪽 위', m => gzCol(m, 2, 0, 1)]];
    const dirE = ([d, nm, gz], eo) => { const m = {}; add(m, 2, 2, Object.assign({ t: 'eye', dir: d }, eo || {})); gz(m); return m; };
    const MID = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    return {
      kicker: 'EYE', title: '눈',
      intro: '두 부분입니다. 칸 가운데 낮은 보라 돌판과, 그 위 반 층 높이에 뜬 해골과 같은 결의 둥근 주사위 블록 눈알입니다. 홍채는 세 단으로 타오르는 동심원입니다. 선과 광택 없이 단색 면으로만 칠합니다. 홍채는 블록 면에서 보는 쪽에 붙고(앞쪽은 그쪽 옆면, 뒤쪽은 윗면 가장자리), 바닥 시선 줄이 방향을 함께 알려 줍니다. 눈알만 천천히 오르내리고 돌판과 그림자는 그대로입니다.',
      picks: ['240은 어둠 1수 전에 다음 쪽 첫 칸에 아주 옅은 자국이 생깁니다. 어둠 속에서는 다른 눈처럼 보이지 않고(큐브 바로 옆 칸이면 희미하게만), 어둠 2수째에 안 보이는 채로 돕니다. 밝아지면 새 방향 시선 줄이 켜집니다.'],
      secs: [
        S('E1', '평소', '', [
          G('네 방향', '', D4.map(dd => b(g5, dirE(dd), dd[1] + '를 봄')),
            [['돌판', '칸 가운데 0.7칸 × 3px · 바닥 3단 색 (바닥과 비슷한 밝기 · 세 면 밝기로 두께만 보임) · 윗면 ' + EY.plate().t + ' · 왼쪽 ' + EY.plate().l + ' · 오른쪽 ' + EY.plate().r, EY.plate().t], ['그림자', '눈알 바닥면을 바닥에 눕힌 모서리 둥근 마름모 · 2:1 · 눈알 바닥면의 0.8 · #000 0.18 · 가장자리 0.07 한 겹으로 살짝 흐림 · 오르내려도 그대로', '#000000'], ['눈알', '모서리를 둥글린 주사위 블록 · 0.5칸 × 0.5칸 × 24px · 모서리 반지름 한 변의 1/4 · 돌판 위로 틈을 두고 뜸(블록 바닥 22px · 돌판 윗면 3px) · 선·광택 없음 · 윗면 ' + K.bone.t + ' · 왼쪽 ' + K.bone.l + ' · 오른쪽 ' + K.bone.r + ' (해골과 같음)', K.bone.t], ['홍채', EY.iris + ' · 세 단 동심원 (바깥 ' + EY.irisOut + ' · 가운데 ' + EY.iris + ' · 동공 둘레 ' + EY.irisIn + ') · 지름 = 한 변의 0.7 · 면 위에 납작하게 · 앞쪽 두 방향은 그쪽 옆면 가운데, 뒤쪽 두 방향은 윗면의 그쪽 가장자리에 눕혀', EY.iris], ['번짐', '홍채 둘레 ' + EY.iris + ' 0.16 · 눈알 밖으로 2px 안', EY.iris], ['동공', '작은 둥근 점 · 홍채의 0.26 · ' + EY.pupil, EY.pupil], ['반짝임', '아주 작은 점 하나 · 2.2px · ' + EY.glint + ' · 앞쪽 방향만', EY.glint], ['시선 표시', '눈 칸 가장자리부터 끝 칸 가장자리까지 끊김 없는 부드러운 빛 띠 · 폭 0.45칸 · ' + EY.irisOut + ' 가운데 0.14 (0.038 네 겹, 양옆으로 갈수록 투명) · 바닥에 드리운 옅은 그늘 · 멀어져도 같은 진하기 · 끝나는 칸에서 0.22칸 동안 짧게 흐려짐 · 바닥 칸 줄·무늬가 비침 · 어둠에는 꺼짐', EY.irisOut]]),
          G('포인트 색 · 5장 전체', '지옥 요소마다 한 군데에만 씁니다. 넓은 면에는 쓰지 않습니다.', [], [['눈 · 홍채 바깥', EY.irisOut, EY.irisOut], ['눈 · 홍채 가운데', EY.iris, EY.iris], ['눈 · 홍채 동공 둘레', EY.irisIn, EY.irisIn], ['갈고리', '칼끝 · ' + EY.iris + ' 그대로', EY.iris], ['해골', '없음']]),
          G('떠 있음', '눈알만 천천히 2px 오르내립니다. 돌판과 그림자는 그대로입니다.', [b(g, E(4), '0.0초 · 아래'), b(g, E(4, [], { bob: 2 }), '1.2초 · 위')], [['오르내림', '2px · 한 번 2.4초 · 사인 곡선']]),
          G('큐브 옆 · 5단', '', [b(g, E(4, [[1, 2, { t: 'cube' }]]), '큐브 옆'), b(['0000'], (() => { const m = {}; add(m, 0, 0, { t: 'box' }); add(m, 1, 0, { t: 'skull' }); add(m, 2, 0, { t: 'eye', dir: [0, 1] }); add(m, 3, 0, { t: 'cube' }); return m; })(), '상자·해골·눈'), b(g, E(4), '5단', { st: { 0: 5 } })], [])]),
        S('E2', '가림과 끝', '', [
          G('상자로 가림', '', [b(g, E(2, [[3, 1, { t: 'box' }]]), '상자')], []),
          G('해골로 가림', '', [b(g, E(2, [[3, 1, { t: 'skull' }]]), '해골')], []),
          G('층이 바뀌어 끝남', '같은 층만 봅니다. 높아지는 곳, 낮아지는 곳 모두 그 앞 칸에서 끝납니다.', [b(['00000', '00011', '00000'], E(2), '높아짐'), b(['11111', '11100', '11111'], E(2), '낮아짐')], [])]),
        S('E3', '막힘', '밝을 때는 시선 줄 칸이 벽처럼 막힙니다.', [G('들어가려다 막힘', '', [b(g, E(4, [[2, 2, { t: 'cube' }]]), '0.00초'), b(g, E(4, [[2, 2, { t: 'cube', v: -0.12 }], [2, 1, { t: 'tint', f: EY.iris, o: 0.2 }]]), '0.08초 · 부딪힘'), b(g, E(4, [[2, 2, { t: 'cube' }]]), '0.18초')],
          [['부딪힘', '0.12칸 나갔다 돌아옴 · 0.18초'], ['시선 줄 칸', EY.iris + ' 0.2로 칸 전체가 한 번 밝아짐', EY.iris]])]),
        S('E4', '어둠과 물러남', '', [
          G('어둠에 감음', '블록은 그대로 두고 홍채 자리에 감은 눈꺼풀 금 하나만 남기고 시선 줄이 꺼져 지나갈 수 있습니다.', [b(g, E(0, [[2, 1, { t: 'cube' }]], { shut: true }), '밝을 때 감은 꼴 (참고)'), b(gP, Y1(E(0, [[2, 1, { t: 'cube' }]], { shut: true })), '어둠', { dark: DK, lights: [[3, 2, 1]], core: 0.2, faint: 0.75 }), b(gP, Y1(E(0, [[1, 1, { t: 'cube' }]], { shut: true })), '어둠 · 눈 옆 칸', { dark: DK, lights: [[2, 2, 1]], core: 0.2, faint: 0.75 })],
            [['감은 눈', '평소 블록·돌판·그림자 그대로 · 홍채 자리는 면 색 · 가운데 가로 금 하나 ' + EY.irisOut + ' · 홍채 지름 폭 · 아래로 살짝 휜 곡선 · 뒤쪽 방향은 윗면 홍채 자리에 · 시선 줄 꺼짐', EY.irisOut], ['빛', 'D4 · 0.2 / 0.75 / 1.0']]),
          G('밝아질 때 물러남', '줄 안의 큐브는 줄에 들어오기 전 칸으로 물러납니다.', [b(gP, Y1(E(0, [[2, 1, { t: 'cube' }]], { shut: true })), '어둠 끝', { dark: DK, lights: [[3, 2, 1]], core: 0.2, faint: 0.75 }), b(gP, Y1((() => { const m = E(4); add(m, 2, 1, { t: 'cube', o: 0.3 }); add(m, 2, 2, { t: 'cube', v: -0.35 }); return m; })()), '0.15초', { dark: 0.35 }), b(gP, Y1(E(4, [[2, 2, { t: 'cube' }]])), '0.30초')],
            [['물러남', '0.15초 · 눈 뜸과 함께'], ['시선 줄 켜짐', '0.3초 · 막 걷힘과 함께']])]),
        S('E5', '240 · 도는 눈', '어둠이 끝날 때마다 시계 방향으로 한 번 돕니다.', [
          G('다음 쪽 알림 → 돌기', '', [
            b(['00000', '00000', '00000', '00000'], E(4), '밝음'),
            b(['00000', '00000', '00000', '00000'], (() => { const m = E(4); add(m, 0, 2, { t: 'gz', ax: 'y', o: 0.1, len: 0.6 }); return m; })(), '어둠 1수 전 · 다음 쪽 자국', { dark: PRE }),
            b(['00000', '00000', '00000', '00000'], E(0, [], { shut: true, dir: [1, 0] }), '어둠 1 · 눈 안 보임', { dark: DK, padTop: 18 }),
            b(['00000', '00000', '00000', '00000'], E(0, [], { shut: true, dir: [0, 1] }), '어둠 2 · 안 보이는 채로 돎', { dark: DK, padTop: 18 }),
            b(['00000', '00000', '00000', '00000'], (() => { const m = {}; add(m, 0, 1, { t: 'eye', dir: [0, 1] }); gzCol(m, 0, 2, 3); return m; })(), '밝아짐')],
            [['다음 쪽 자국', '첫 칸 0.6칸 · 시선 표시 색 0.07'], ['돌기', '어둠 2수째에 0.3초'], ['어둠 속', '눈은 안 보임 · 큐브 바로 옆 칸이면 희미하게만'], ['밝아짐', '새 방향 시선 줄이 켜짐']]),
          G('눈동자가 미끄러짐 · 한 바퀴', '눈을 뜬 채 돌 때(큐브 빛 안이거나 밝을 때 보이는 경우) 홍채는 블록 면을 따라(넘어가는 중에는 윗면 모서리 쪽) 다음 쪽으로 미끄러집니다. 시선 줄은 다 돈 뒤 켜집니다.', D4.flatMap((dd, i) => [b(g5, dirE(dd), dd[1]), b(g5, (() => { const m = {}; add(m, 2, 2, { t: 'eye', dir: dd[0], mid: MID[i] }); return m; })(), '0.15초 · 넘어가는 중')]),
            [['미끄러짐', '0.3초 · 지금 쪽 끝 → 두 쪽 사이 → 다음 쪽 끝 · 뒤쪽은 윗면 가장자리']])]),
        PH([G('눈 · 폰', '', [phone({ g, objs: E(4) }, '시선 줄'), phone({ g: g5, objs: dirE(D4[2]) }, '뒤쪽을 봄'), phone({ g, objs: E(2, [[3, 1, { t: 'box' }]]) }, '상자로 가림'), phone({ g, objs: E(4, [[2, 2, { t: 'cube', v: -0.12 }], [2, 1, { t: 'tint', f: EY.iris, o: 0.2 }]]) }, '막힘'), phone({ g: gP, objs: Y1(E(0, [[1, 1, { t: 'cube' }]], { shut: true })), dark: DK, lights: [[2, 2, 1]], core: 0.2, faint: 0.75 }, '어둠 · 감음', 14, 2, 'dark'), phone({ g: ['00000', '00000', '00000', '00000'], objs: (() => { const m = E(4); add(m, 0, 2, { t: 'gz', ax: 'y', o: 0.1, len: 0.6 }); return m; })(), dark: PRE }, '240 · 어둠 1수 전 자국', 14, 1, 'pre')], [])])
      ]
    };
  };

  // ================= boss =================
  P['boss'] = () => {
    const c5 = C().CH[5], K = C().K5;
    const b = (gg, m, cap, ex) => F(Object.assign({ ch: 5, g: gg, bg: c5.base, objs: m }, ex || {}), cap, 0.58);
    const gb = ['00p00', '00p00', '00000'];
    const br = (m, o) => { add(m, 2, 0, Object.assign({ t: 'bridge', jv: [0, 1] }, o || {})); add(m, 2, 1, Object.assign({ t: 'bridge', jv: [1, 0], alt: 1 }, o || {})); return m; };
    const g4 = ['00000', '00000', '00000', '00000'];
    const span = n => { const g = ['0' + 'p'.repeat(n) + '00', '0'.repeat(n + 3)], m = {}; for (let i = 0; i < n; i++) add(m, 1 + i, 0, { t: 'bridge', ju: [i ? 1 : 0, i < n - 1 ? 1 : 0], alt: i % 2 }); add(m, 0, 0, { t: 'cube' }); return [g, m]; };
    const home = (docked, mark) => { const m = {}; add(m, 2, 2, { t: 'home' }); add(m, 4, 3, { t: 'cube' }); const pos = [[0, 0], [4, 0], [0, 3]], dock = [[2, 1], [3, 2], [1, 2]]; pos.forEach((p, i) => { const q = i < docked ? dock[i] : p; add(m, q[0], q[1], { t: 'skull', mark }); }); return m; };
    const g6 = ['000000', '000000', '000000', '000000'];
    const gz5 = ['000000', '000000', '000000', 'p00000'];
    const inZone = () => { const m = {}; add(m, 1, 2, { t: 'cube' }); add(m, 1, 0, { t: 'skull', mark: 'both' }); add(m, 0, 0, { t: 'eye', shut: true, dir: [1, 0] }); add(m, 0, 3, { t: 'bridge' }); add(m, 4, 1, { t: 'skull' }); return m; };
    const ZN = () => ({ cells: col([0, 1]), edge: col([1]), hint: col([2]), dark: DK, lights: [[1, 2, 1.6]] });
    const col = (xs) => { const a = []; xs.forEach(x => [0, 1, 2, 3].forEach(y => a.push(x + ',' + y))); return a; };
    return {
      kicker: 'BOSS', title: '보스 판 · 210 · 220 · 250',
      intro: '그림자 다리는 어둠에만 생기는 그림자로 된 다리입니다. 구덩이 양 끝을 잇는 끊김 없는 반투명 회보라 덩어리 하나에 윗면 밝기가 칸마다 번갈아 칸이 세어지고, 판자·줄·선은 없습니다. 아래 구덩이 쪽으로 같은 색 번짐이 흐려지며 내려갑니다. 5장의 "어둠에서만 보이는 것"은 보라 계열(#8E7CD6)로 해골 눈에 썼습니다. 눈의 시선 줄은 밝을 때만 보이는 옅은 자주빛 그늘이라 갈립니다.',
      picks: ['250: 늘 어두운 땅은 밝을 때도 칸 무늬 없는 한 덩어리 어둠 막입니다. 경계는 완전히 까만 곳이 끝나는 자리이고, 바깥으로 큐브 빛 고리와 같은 층진 결로 번집니다. 어둠에서는 판 전체가 까매 경계 표시가 없습니다.'],
      secs: [
        S('B1', '210 · 그림자 다리', '구덩이 위에 어둠 2수 동안만 생기는 그림자 다리입니다. 밝을 때는 없으니 밝을 때 색은 정하지 않고, 사라지는 0.3초 동안 옅어지기만 합니다.', [
          G('상자', '어둠에 다리 위로 밀어 둔 상자는 밝아질 때 떨어져 구덩이를 메웁니다.', [b(gb, add({}, 1, 1, { t: 'cube' }), '밝음'), b(gb, br(add(add({}, 1, 1, { t: 'cube' }), 0, 0, { t: 'box' })), '어둠', { dark: DK, lights: [[1, 1, 1.6]] }),
            b(gb, br(add(add({}, 1, 1, { t: 'cube' }), 2, 1, { t: 'box', z: -1 }), {}), '어둠 · 다리 위 상자', { dark: DK, lights: [[1, 1, 1.6]] }), b(gb, br(add({}, 1, 1, { t: 'cube' }), { br: 0.22 }), '일렁임 · 0.22', { dark: DK, lights: [[1, 1, 1.6]] }), b(gb, br(add({}, 1, 1, { t: 'cube' }), { br: 0.3 }), '일렁임 · 0.3 (1.5초)', { dark: DK, lights: [[1, 1, 1.6]] }),
            b(gb, add(add(br({}, { o: 0.5 }), 1, 1, { t: 'cube' }), 2, 1, { t: 'box', z: -12 }), '밝아짐 0.15초', { dark: 0.45 }), b(gb, add(add({}, 1, 1, { t: 'cube' }), 2, 1, { t: 'fill' }), '0.30초 · 메움')],
            [['꼴', '구덩이 양 끝 바닥을 잇는 판 하나 · 폭 0.8칸 · 4px · 판자·틈·선 없음 · 나란한 다리끼리는 한 덩어리로 이어짐'], ['색', '회보라 #7A6EA8 · 큐브 빛 다음으로 보이게 채도를 낮춤', '#7A6EA8'], ['윗면', '#7A6EA8 0.26 / 0.15 번갈아 · 가장자리 0.1칸을 두 겹으로 흐림', '#7A6EA8'], ['옆면', '한 단 짙게 · 0.3', '#5F5683'], ['칸 구분', '바닥 체크처럼 윗면 밝기를 칸마다 번갈아 · 0.26 / 0.15 · 선·홈·칸막이·기둥 없음'], ['아래 번짐', '#7A6EA8 0.08 → 0.06 → 0.04 → 0.025 · 구덩이 쪽으로 27px까지 흐려지며 내려감', '#7A6EA8'], ['일렁임', '윗면 밝기만 0.22 ~ 0.3 (번갈은 칸은 0.13 ~ 0.17) · 3초에 한 번 · 모양 그대로'], ['위에 선 것', '큐브·상자 아래로 다리가 비쳐 보임'], ['밝을 때', '없음 · 색 정하지 않음'], ['생김', '어둠 들어갈 때 0.25초 페이드'], ['사라짐', '0.3초 · 막이 걷히는 박자와 같음 (ease-out)'], ['위 상자', '같은 0.3초 동안 떨어져 끝에 메움']], '5장 기준'),
          G('칸 세기', '판은 끊김 없는 하나이고, 윗면 밝기가 칸마다 번갈아(0.26 / 0.15) 칸 수가 세어집니다.', [b(span(1)[0], span(1)[1], '1칸', { dark: DK, lights: [[0, 0, 1.6]] }), b(span(2)[0], span(2)[1], '2칸', { dark: DK, lights: [[0, 0, 1.6]] }), b(span(3)[0], span(3)[1], '3칸', { dark: DK, lights: [[0, 0, 1.6]] })], []),
          G('큐브', '밝아질 때 다리 위 큐브는 다리에 오르기 전 칸으로 돌아갑니다.', [b(gb, br(add({}, 2, 0, { t: 'cube', z: -1 })), '어둠 · 다리 위', { dark: DK, lights: [[2, 0, 1.6]] }), b(gb, add(add(br({}, { o: 0.5 }), 2, 0, { t: 'cube', o: 0.3, z: -1 }), 1, 0, { t: 'cube', u: 0.5 }), '밝아짐 0.15초', { dark: 0.45 }), b(gb, add({}, 1, 0, { t: 'cube' }), '0.30초')], [['돌아감', '0.3초 · 막 걷힘과 같은 박자']])]),
        S('B2', '220 · 집으로 가는 해골', '어둠마다 해골이 큐브 대신 집 쪽으로 걸어와 집 옆에 붙습니다. 집 옆이 하나씩 막힙니다.', [G('세 번의 어둠 뒤', '', [b(g4, home(0), '처음'), b(g4, home(1), '어둠 1번 뒤'), b(g4, home(2), '어둠 2번 뒤'), b(g4, home(3), '어둠 3번 뒤 · 한 쪽만 남음'), b(g4, home(2, 'both'), '어둠 속 (눈 + 옅은 몸)', { dark: DK, lights: [[4, 3, 1.6]] })], [['해골', 'skull 그대로'], ['어둠 속 해골', '머리 0.2 · 위 뼈다귀 0.45 · 보라 눈 점 그대로'], ['붙는 자리', '집 옆 네 칸 중 해골에서 가까운 칸']])]),
        S('B3', '250 · 번지는 밤', '판 한쪽 끝에 늘 어두운 땅이 한 덩어리 어둠 막으로 깔려 있고, 어둠이 올 때마다 한 줄씩 스며 나갑니다.', [G('비교 · 같은 어둠', '큐브 빛 고리 바깥 칸과 늘 어두운 땅 가장자리가 같은 1/8칸 층으로 옅어집니다.', [b(g6, add({}, 3, 2, { t: 'cube' }), '어둠 · 큐브 빛 고리', { dark: DK, lights: [[3, 2, 1.6]] }), b(g6, add({}, 3, 2, { t: 'cube' }), '250 밝음 · 늘 어두운 땅', { perma: col([0]), hint: col([1]) })], []),G('늘 어두운 땅 · 지금 어두운 땅', '', [
          b(g6, add({}, 3, 2, { t: 'cube' }), '밝음', { perma: col([0]), permaEdge: col([0]), hint: col([1]) }),
          b(g6, add({}, 3, 2, { t: 'cube' }), '어둠', { dark: DK, lights: [[3, 2, 1.6]], perma: col([0]), permaEdge: col([0]) }),
          b(g6, add({}, 3, 2, { t: 'cube' }), '어둠 들어감 0.12초 · 스며 나감', { dark: 0.45, perma: col([0]), permaGrow: 0.5 }),
          b(g6, add({}, 3, 2, { t: 'cube' }), '다음 밝음 · 한 줄 넓어짐', { perma: col([0, 1]), permaEdge: col([1]), hint: col([2]) }),
          b(gz5, inZone(), '밝음 · 큐브가 늘 어두운 땅 안', { zone: ZN() })],
          [['늘 어두운 땅', '#000 1.0 · 두께 없는 막 · 바닥 윗면은 까맣게, 판 옆면은 옆면 명암을 0.86 짙게 남김 · 밝을 때도', '#000000'], ['경계', '보라 줄 없음 · 줄 경계까지 #000 1.0, 완전히 까만 곳이 끝나는 자리가 경계 · 어둠일 때는 판 전체가 까매 경계 표시 없음'], ['가장자리', '큐브 빛 고리와 같은 1/8칸 층 · 열여섯 개 · 경계 바깥으로 두 칸에 걸쳐 경계를 따라 곧은 층으로 1 → 0 · 처음은 천천히, 끝은 부드럽게 사라짐 (smoothstep) · 경계는 줄 경계에 정확히 · 윗면과 앞 옆면 모두 · 큐브 빛 자체는 그대로'], ['넓어짐', '어둠 들어갈 때 0.25초 · 부드러운 가장자리째 한 줄만큼 스며 나감'], ['땅 안의 큐브', '밝을 때도 땅 안은 어둠 그대로 · 큐브는 자기 빛 D4 0.2 / 0.75 / 1.0 · 판 나머지는 밝음'], ['땅 안의 해골', '눈(보라 점)과 옅은 몸 · 큐브 쪽으로 걸어옴'], ['땅 안의 구덩이', '그림자 다리가 늘 떠 있음 · 옅은 보라 빛'], ['땅 안의 눈', '안 보임 · 시선 줄 없음']])]),
        PH([G('보스 · 폰', '', [phone({ g: span(1)[0], objs: span(1)[1], dark: DK, lights: [[0, 0, 1.6]] }, '210 · 1칸 다리', 14, 2, 'dark'), phone({ g: span(2)[0], objs: span(2)[1], dark: DK, lights: [[0, 0, 1.6]] }, '210 · 2칸 다리', 14, 2, 'dark'), phone({ g: span(3)[0], objs: span(3)[1], dark: DK, lights: [[0, 0, 1.6]] }, '210 · 3칸 다리', 14, 2, 'dark'), phone({ g: gb, objs: br(add({}, 1, 1, { t: 'cube' })), dark: DK, lights: [[1, 1, 1.6]] }, '210 · 어둠 다리', 14, 2, 'dark'), phone({ g: gb, objs: br(add({}, 2, 0, { t: 'cube', z: -1 })), dark: DK, lights: [[2, 0, 1.6]] }, '210 · 다리 위', 14, 2, 'dark'), phone({ g: g4, objs: home(2, 'both'), dark: DK, lights: [[4, 3, 1.6]] }, '220 · 어둠 속 해골', 14, 2, 'dark'), phone({ g: g6, objs: add({}, 3, 2, { t: 'cube' }), perma: col([0]), permaEdge: col([0]), hint: col([1]) }, '250 · 밝음', 12, 2, 'light'), phone({ g: g6, objs: add({}, 3, 2, { t: 'cube' }), dark: DK, lights: [[3, 2, 1.6]], perma: col([0]), permaEdge: col([0]) }, '250 · 어둠', 14, 2, 'dark'), phone({ g: g6, objs: add({}, 3, 2, { t: 'cube' }), dark: DK, lights: [[3, 2, 1.6]], perma: col([0]), permaGrow: 0.5 }, '250 · 스며 나감', 14, 2, 'dark'), phone({ g: gz5, objs: inZone(), zone: ZN() }, '250 · 밝음 · 땅 안의 큐브', 12, 2, 'light')], [])])
      ]
    };
  };

  // ================= ambient =================
  P['ambient'] = () => {
    const c5 = C().CH[5], GR = ['00000', '00000', '00000'];
    const flock = (st, cube) => { const m = {}; add(m, cube[0], cube[1], { t: 'cube' }); add(m, 0, 0, { t: 'skull' }); st.forEach(([x, y, o]) => add(m, x, y, Object.assign({ t: 'crow' }, o))); return m; };
    const SIT = [[3, 1, { u: -0.05, v: 0.12, d: [0, 1] }], [4, 1, { u: 0.02, v: 0.04, d: [-1, 0] }]];
    const pose = ex => SIT.map(([x, y, o], n) => [x, y, Object.assign({}, o, ex(n))]);
    const AWAY = { du: 1.8, dv: -0.5, sx: 1, ang: -24 }, FREE = { du: -0.4, dv: 1.6, sx: -1, ang: 24 };
    const up = (n, t, W) => { const q = Math.max(0, t - n * 0.05); if (q <= 0) return {}; return { z: 6 + q * 260, flap: Math.sin((q / 0.4) * Math.PI * 2 + n * 1.3), sx: W.sx, ang: W.ang, u: (SIT[n][2].u || 0) + q * W.du, v: (SIT[n][2].v || 0) + q * W.dv }; };
    const fly = (t, W) => SIT.map(([x, y, o], n) => [x, y, Object.assign({}, o, up(n, t, W))]);
    const b = (m, cap) => F({ ch: 5, g: GR, bg: c5.base, objs: m, pad: 12, padTop: 10 }, cap, 0.6);
    const zoom = (o, cap) => F({ ch: 5, g: ['0'], bg: c5.base, objs: add({}, 0, 0, Object.assign({ t: 'crow', d: [1, 0] }, o)), pad: 10, padTop: 4 }, cap, 2.2);
    return {
      kicker: 'AMBIENT', title: '분위기 연출 · 까마귀',
      intro: '판의 붙은 빈 바닥 칸 한두 개에 까마귀 2마리가 내려앉아 있다가 날아갑니다. 앉은 새는 부리·머리·목·몸·꼬리가 틈 없이 이어진 한 색 실루엣이고, 날 때는 옆에서 비스듬히 본 꼴로 몸에서 이어진 휜 날개를 퍼덕입니다.',
      picks: [],
      secs: [
        S('A1', '앉은 새', '', [G('확대', '', [zoom({}, '앉음'), zoom({ caw: 1 }, '까악'), zoom({ tilt: 1 }, '갸웃')], [])]),
        S('A2', '장면', '', [G('앉음 → 날아감', '', [
            b(flock(SIT, [0, 2]), '앉음 · 서로 다른 쪽'),
            b(flock(pose(n => n === 1 ? { caw: 1 } : {}), [0, 2]), '까악'),
            b(flock(pose(n => n === 0 ? { tilt: 1 } : {}), [0, 2]), '갸웃'),
            b(flock(fly(0.14, FREE), [0, 2]), '3초 머문 뒤 · 스스로 (위쪽 아무 쪽)'),
            b(flock(fly(0.14, AWAY), [2, 1]), '큐브 옆 칸 · 바로 날아오름'),
            b(flock(fly(0.36, AWAY), [2, 1]), '큐브 반대쪽으로 올라감'),
            b(flock(fly(0.62, AWAY), [2, 1]), '빠져나감')],
          [['앉은 새', '한 색 #1C1723 실루엣 · 부리·머리·목·몸·꼬리가 틈 없이 하나로 · 가는 몸 · 살짝 부푼 가슴 · 쐐기 꼬리 · 몸길이 1/5쯤의 굵은 부리, 끝이 살짝 아래로 · 눈 없음 · 면 나눔·선 없음', '#1C1723'], ['그림자', '#000 0.14 · 떠오르면 옅어짐'], ['앉아 있는 동안', '갸웃(머리 옆으로 0.022칸, 1.5px 위)과 까악(고개를 1.5px 들며 부리를 벌렸다 닫음, 0.3초)을 번갈아'], ['나는 새', '옆에서 비스듬히 본 꼴 · 몸에서 이어진 휜 날개, 끝 깃 셋으로 살짝 갈라짐 · 올림 ↔ 펼침 ↔ 내림 · 한 번 0.4초 · 정면 대칭·직각 십자·가는 선 V자 안 씀'], ['날아감', '3초 머문 뒤 스스로, 또는 큐브가 옆 칸에 오면 바로 · 한 마리 먼저, 다른 한 마리 0.05초 뒤 · 큐브 반대쪽으로(큐브가 멀면 화면 위쪽 아무 쪽) 비스듬히 올라 0.8초에 화면 밖'], ['무리', '2마리 · 붙은 빈 바닥 칸 한두 개 · 서로 다른 쪽을 봄'], ['자리 고르기', '2장 나비와 같은 방식 · 5장 판의 빈 바닥 칸'], ['차례', '4.35초마다 해골 턱과 번갈아'], ['어둠', '나지 않음'], ['움직임 줄이기', '그리지 않음']])]),
        PH([G('분위기 · 폰', '', [phone({ g: GR, objs: flock(SIT, [0, 2]) }, '앉음'), phone({ g: GR, objs: flock(fly(0.36, AWAY), [2, 1]) }, '날아오름'), phone({ g: GR, objs: flock(fly(0.62, AWAY), [2, 1]) }, '빠져나감')], [])])
      ]
    };
  };

  window.C5Pages = P;
})();
