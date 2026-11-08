// CHAPTER 5 "어둠에 잠긴 문" sheet engine. Needs cubound-iso.js loaded first (existing objects: brazier, ember, char).
(function () {
  const TW = 104, TH = 52, LV = 30, TK = 16, D = 34, CS = 60 / 104;
  // ---------- colour ----------
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const gam = c => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };
  const lab = h => { const r = lin(parseInt(h.slice(1, 3), 16)), g = lin(parseInt(h.slice(3, 5), 16)), b = lin(parseInt(h.slice(5, 7), 16));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]; };
  const hex = ([L, A, B]) => { const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
    return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(v => gam(v).toString(16).padStart(2, '0')).join(''); };
  const mix = (a, b, t) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const dE = (a, b) => { const x = lab(a), y = lab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const down = (h, k) => { const q = lab(h); q[0] -= k; return hex(q); };
  const tone = t => ({ t: mix(t, '#ffffff', 0.12), l: mix(t, '#000000', 0.24), r: mix(t, '#000000', 0.09) });

  // ---------- chapters (1단 seven values + game d) ----------
  const CH = {
    1: { name: '돌 위의 첫걸음', page: '#e9e7e2', base: '#f2f1ee', surface: '#f7f6f4', top: '#edebe6', alt: '#e7e5e0', left: '#c6c3bc', right: '#d9d6d0', d: 0.0246, ink: '#3A3936' },
    2: { name: '풀이 우거진 길', page: '#e2e6db', base: '#edf0e7', surface: '#f4f6ee', top: '#eaebe0', alt: '#e2e5da', left: '#bfc1b4', right: '#d2d4c8', d: 0.0258, ink: '#3A3936' },
    3: { name: '물이 차오르는 길', page: '#d9e7e8', base: '#e6f1f2', surface: '#edf7f8', top: '#dfedee', alt: '#d9e7e7', left: '#b3c3c4', right: '#c7d6d7', d: 0.0242, ink: '#3A3936' },
    4: { name: '불을 건너는 길', page: '#efe2d3', base: '#f7ede1', surface: '#fcf3e9', top: '#efe3d4', alt: '#e9dccf', left: '#c8b9a8', right: '#daccbc', d: 0.0262, ink: '#3A3936' },
    5: { name: '어둠에 잠긴 문', page: '#e9e5f0', base: '#f2eff8', surface: '#f7f5fc', top: '#ede9f4', alt: '#e7e3ee', left: '#c5c1cd', right: '#d8d4e0', ink: '#3A3936' }
  };
  // d for a new chapter: start at 1.5 × checker distance, grow 0.0005 until steps 1–5 neighbours (hex-rounded) reach 1.5 × checker, then × 0.8
  const dFor = c => { const k = dE(c.top, c.alt); let d = 1.5 * k;
    for (let i = 0; i < 400; i++) { let ok = true; for (let n = 1; n <= 4; n++) if (dE(down(c.top, (n - 1) * d), down(c.top, n * d)) < 1.5 * k - 1e-9) ok = false; if (ok) break; d += 0.0005; }
    return { checker: k, dSheet: d, d: d * 0.8 }; };
  // chroma variants of chapter 5 (same L, same hue 302°, chroma × k)
  const sat = (h, k) => { const q = lab(h); return hex([q[0], q[1] * k, q[2] * k]); };
  const chroma = h => { const q = lab(h); return Math.hypot(q[1], q[2]); };
  // chapter 5 = 1장 lightness, 2장 chroma × 1.3, hue 302° (확정)
  { const c = Object.assign({}, CH[5]); ['page', 'base', 'surface', 'top', 'alt', 'left', 'right'].forEach(key => c[key] = sat(CH[5][key], 1.3)); const r = dFor(c); c.d = Math.round(r.d * 10000) / 10000; c.dSheet = r.dSheet; c.checker = r.checker; CH[5] = c; CH['5b'] = c; }
  const D5 = { d: CH[5].d, dSheet: CH[5].dSheet, checker: CH[5].checker };
  const stepCache = {};
  // n = 1..8; 0 / 0.5 = lighter side (toward surface: 0단 top 30 %, sides 12 %)
  const step = (ch, n) => { const key = ch + ':' + n; if (stepCache[key]) return stepCache[key]; const c = CH[ch]; let s;
    if (n < 1) { const k = (1 - n) / 1; s = { top: mix(c.top, c.surface, 0.3 * k), alt: mix(c.alt, c.surface, 0.3 * k), left: mix(c.left, c.surface, 0.12 * k), right: mix(c.right, c.surface, 0.12 * k) }; }
    else { const m = Math.min(8, Math.round(n)), k = (m - 1) * c.d; s = { top: down(c.top, k), alt: down(c.alt, k), left: down(c.left, k), right: down(c.right, k) }; if (m % 2 === 0) { const t = s.top; s.top = s.alt; s.alt = t; } }
    return (stepCache[key] = s); };

  // ---------- chapter 5 element colours ----------
  const K5 = {
    cube: '#8FB3CC', box: '#E3CD8E',
    home: { rim: '#4A4845', in: '#2F2E2C' },                          // 집: game values (light violet floor needs no change)
    pit: '#A6A2B0',
    iron: '#4C5259',                                                   // 쇠막대 흑철: game value
    dark: '#000000',
    bone: { t: '#E7E0EE', l: '#A59CB4', r: '#C7BED3' }, jaw: { t: '#D3CAE0', l: '#958BA6', r: '#B4AAC4' }, sock: '#2A2135', glowEye: '#DCD0FF',
    rust: { t: '#8E2450', l: '#55162F', r: '#6F1C3E' },                 // 갈고리 끝에만
    chain: { a: '#6A7077', b: '#4C5259', l: '#3A3E44' },                // 4장 쇠막대 쇠색
    eyeStone: { t: '#6E6382', l: '#463D57', r: '#5A506C' }, ball: { t: '#EEE9F4', l: '#ABA3BA', r: '#CEC7DA' }, iris: '#6B55A8', pupil: '#1E1630',
    gaze: '#F4EFFF',
    shade: { t: '#43385C', l: '#2A2340', r: '#352C4C' }, shadeLit: { t: '#8D7CC6', l: '#5C4E91', r: '#7363AC' },
    violet: '#8E7CD6', imp: '#8A4D7C', impL: '#5F3155', impR: '#76406A'
  };

  // ---------- geometry ----------
  const r1 = v => Math.round(v * 10) / 10;
  const P = a => a.map(p => r1(p[0]) + ',' + r1(p[1])).join(' ');
  const sh = (d, f, o) => ({ d, f, o: o === undefined ? 1 : o });
  const pt = (cx, cy, u, v, z) => [cx + (u - v) * TW / 2, cy + (u + v) * TH / 2 - (z || 0)];
  const iso = (x, y, h) => [(x - y) * TW / 2, (x + y) * TH / 2 - h * LV];
  const box3 = (cx, cy, u0, u1, v0, v1, z, th, t, l, r, o) => {
    const A = pt(cx, cy, u0, v0, z), B = pt(cx, cy, u1, v0, z), C = pt(cx, cy, u1, v1, z), Dd = pt(cx, cy, u0, v1, z), dn = p => [p[0], p[1] + th];
    return [sh(P([Dd, C, dn(C), dn(Dd)]), l, o), sh(P([B, C, dn(C), dn(B)]), r, o), sh(P([A, B, C, Dd]), t, o)];
  };
  const cubeAt = (cx, cy, s, z, h, k, o) => box3(cx, cy, -s / 2, s / 2, -s / 2, s / 2, z + h, h, k.t, k.l, k.r, o);
  const quad = (cx, cy, u0, u1, v0, v1, z, f, o) => sh(P([pt(cx, cy, u0, v0, z), pt(cx, cy, u1, v0, z), pt(cx, cy, u1, v1, z), pt(cx, cy, u0, v1, z)]), f, o);
  const ell = (cx, cy, r, z, f, o, n, du, dv) => sh(P(Array.from({ length: n || 24 }, (_, i) => { const a = i / (n || 24) * Math.PI * 2; return pt(cx, cy, (du || 0) + r * Math.cos(a), (dv || 0) + r * Math.sin(a), z); })), f, o);
  // vertical quad on the left face (v = +a, u from u0..u1) or right face (u = +a, v from v0..v1)
  const faceL = (cx, cy, a, u0, u1, z0, z1, f, o) => sh(P([pt(cx, cy, u0, a, z0), pt(cx, cy, u1, a, z0), pt(cx, cy, u1, a, z1), pt(cx, cy, u0, a, z1)]), f, o);
  const faceR = (cx, cy, a, v0, v1, z0, z1, f, o) => sh(P([pt(cx, cy, a, v0, z0), pt(cx, cy, a, v1, z0), pt(cx, cy, a, v1, z1), pt(cx, cy, a, v0, z1)]), f, o);

  // ---------- objects (all coordinates in cell space; ctx collects lights + always-visible shapes) ----------
  // 해골: one cube-like head. 0.64칸 wide/deep, 28px tall (jaw 5 · cranium 19 · crown 3 + 1). face fills the left-front face (v = +A)
  const HA = 0.32;
  const bone = (X, Y, ax, h, z, a) => { const out = [], B = K5.jaw, w = 0.035, kn = 0.055;
    const bar = ax === 'u' ? box3(X, Y, -h + kn, h - kn, -w, w, z + 3.5, 3.5, B.t, B.l, B.r, a) : box3(X, Y, -w, w, -h + kn, h - kn, z + 3.5, 3.5, B.t, B.l, B.r, a);
    const knob = (s, o) => ax === 'u' ? box3(X, Y, s - kn, s + kn, o - kn, o + kn, z + 5, 5, B.t, B.l, B.r, a) : box3(X, Y, o - kn, o + kn, s - kn, s + kn, z + 5, 5, B.t, B.l, B.r, a);
    out.push(...knob(-h + kn, -0.04), ...knob(-h + kn, 0.04), ...bar, ...knob(h - kn, -0.04), ...knob(h - kn, 0.04));
    return out; };
  // 뼈다귀: bar 0.3칸 × 0.07 × 3.5px, two round knobs per end (0.12칸 × 6.5px), knob tops lighter
  const dogBone = (X, Y, ax, z, a) => { const out = [], B = K5.jaw, h = 0.15, w = 0.035, kr = 0.06, ko = 0.055, lt = mix(B.t, '#ffffff', 0.18);
    const bx = (u0, u1, v0, v1, top, hh, tc) => box3(X, Y, u0, u1, v0, v1, z + top, hh, tc || B.t, B.l, B.r, a);
    const knob = (s, o) => ax === 'u' ? bx(s - kr, s + kr, o - kr, o + kr, 6.5, 6.5, lt) : bx(o - kr, o + kr, s - kr, s + kr, 6.5, 6.5, lt);
    const ends = [-h + kr * 0.6, h - kr * 0.6];
    out.push(...knob(ends[0], -ko), ...knob(ends[0], ko));
    out.push(...(ax === 'u' ? bx(ends[0], ends[1], -w, w, 4, 3.5) : bx(-w, w, ends[0], ends[1], 4, 3.5)));
    out.push(...knob(ends[1], -ko), ...knob(ends[1], ko));
    return out; };
  const JW = 0.24;
  const jawPart = (X, Y, a, z0, jo) => { const J = K5.jaw, out = box3(X, Y, -JW, JW, HA - 0.42, HA - 0.02, z0 + 5.5 - jo, 5.5, J.t, J.l, J.r, a);
    [-0.16, -0.08, 0, 0.08, 0.16].forEach(u => out.push(faceL(X, Y, HA - 0.02, u - 0.018, u + 0.018, z0 + 0.8 - jo, z0 + 4.4 - jo, mix(J.l, '#000000', 0.24), a)));
    return out; };
  // cranium = face chunk (5–22px, eyes · nose) + crown chunk (22–27px) with two dog-bones lying flat in an X on top (27–29.5px)
  // crack: a vertical split through the right eye (upper face, 10–22px) — right piece sits 1.5px lower, the gap shows the cut face; a chip off the lower-left corner
  const CUT = () => mix(K5.bone.t, K5.bone.l, 0.35);
  const facePart = (X, Y, a, z0, hollow, crack) => {
    const out = [], B = K5.bone, A = HA, top = hollow ? CUT() : B.t, uc = 0.13, g = 0.012, dz = 1.5;
    const eyesN = [[-0.2, -0.065], [0.065, 0.2]];
    if (!crack) {
      out.push(...box3(X, Y, -A, A, -A, A, z0 + 22, 17, top, B.l, B.r, a));
      eyesN.forEach(([e0, e1]) => out.push(faceL(X, Y, A, e0, e1, z0 + 13.5, z0 + 22, K5.sock, a)));
    } else {
      out.push(...box3(X, Y, -A, A, -A, A, z0 + 10, 5, B.t, B.l, B.r, a));
      out.push(...box3(X, Y, -A, uc - g, -A, A, z0 + 22, 12, top, B.l, CUT(), a));
      out.push(...box3(X, Y, uc + g, A, -A, A, z0 + 22 - dz, 12, top, B.l, B.r, a));
      out.push(faceL(X, Y, A, -0.2, -0.065, z0 + 13.5, z0 + 22, K5.sock, a));
      out.push(faceL(X, Y, A, 0.065, uc - g, z0 + 13.5, z0 + 22, K5.sock, a), faceL(X, Y, A, uc + g, 0.2, z0 + 13.5 - dz, z0 + 22 - dz, K5.sock, a));
      out.push(faceL(X, Y, A, -A, -A + 0.09, z0 + 5, z0 + 9, CUT(), a), faceL(X, Y, A, -A, -A + 0.09, z0 + 5, z0 + 6, mix(CUT(), '#000000', 0.1), a));
    }
    out.push(faceL(X, Y, A, -0.035, 0.035, z0 + 9.5, z0 + 12.2, mix(B.l, '#000000', 0.38), a));
    const eyes = eyesN.map(([e0, e1]) => [e0, e1, z0 + 13.5, z0 + 22]);
    const dots = op => eyes.map(([e0, e1, h0, h1]) => { const m = (e0 + e1) / 2, hm = (h0 + h1) / 2; return faceL(X, Y, A, m - 0.03, m + 0.03, hm - 1.7, hm + 1.7, K5.glowEye, op); });
    return { out, dots, eyesOnly: () => eyes.map(([e0, e1, h0, h1]) => faceL(X, Y, A, e0, e1, h0, h1, K5.sock, 1)) };
  };
  // dog-bone lying flat on the crown: 0.5칸 · bar 0.07 × 1.8px · knobs 0.13칸 × 3px with a lighter round cap (0.08칸 × 0.6px), two per end
  const flatBone = (X, Y, ax, z, a) => { const out = [], B = K5.jaw, h = 0.25, w = 0.035, kr = 0.065, ko = 0.056, lt = mix(B.t, '#ffffff', 0.2), lt2 = mix(B.t, '#ffffff', 0.4);
    const bx = (u0, u1, v0, v1, top, hh, tc) => box3(X, Y, u0, u1, v0, v1, z + top, hh, tc || B.t, B.l, B.r, a);
    const knob = (s, o) => { const r = kr, c = kr * 0.6; return ax === 'u' ? [...bx(s - r, s + r, o - r, o + r, 3, 3, lt), ...bx(s - c, s + c, o - c, o + c, 3.6, 0.6, lt2)] : [...bx(o - r, o + r, s - r, s + r, 3, 3, lt), ...bx(o - c, o + c, s - c, s + c, 3.6, 0.6, lt2)]; };
    const e = [-h + kr * 0.6, h - kr * 0.6];
    out.push(...knob(e[0], -ko), ...knob(e[0], ko), ...(ax === 'u' ? bx(e[0], e[1], -w, w, 1.8, 1.8) : bx(-w, w, e[0], e[1], 1.8, 1.8)), ...knob(e[1], -ko), ...knob(e[1], ko));
    return out; };
  const crownPart = (X, Y, a, z0, bones) => { const B = K5.bone, A = HA, lt = (c, k) => mix(c, '#ffffff', k);
    const out = [...box3(X, Y, -A, A, -A, A, z0 + 24, 2, B.t, B.l, B.r, a),
      ...box3(X, Y, -A + 0.04, A - 0.04, -A + 0.04, A - 0.04, z0 + 26, 2, lt(B.t, 0.15), lt(B.l, 0.12), lt(B.r, 0.12), a)];
    if (bones) out.push(...flatBone(X, Y, 'u', z0 + 26, a));
    return out; };
  const head = (X, Y, a, o) => { o = o || {}; const jo = o.jaw || 0, out = jawPart(X, Y, a, 0, jo), F = facePart(X, Y, a, o.fz || 0);
    out.push(...F.out);
    if (jo > 0) out.push(faceL(X, Y, HA - 0.02, -JW, JW, 5.5 - jo, 5.5, K5.sock, a));
    const cp = pt(X, Y, o.cu || 0, o.cv || 0, 0); out.push(...crownPart(cp[0], cp[1], a, o.cz || 0, !o.noBones));
    return { out, C: F }; };
  // two halves split at u = uc (through the right eye). each half is one sheared prism: bottom fixed, top pushed outward by tilt (u shift grows with height)
  const splitHead = (X, Y, a, tilt) => {
    const out = [], B = K5.bone, J = K5.jaw, A = HA, uc = 0.13, g = 0.014, lt = (c, k) => mix(c, '#ffffff', k), ZT = 26;
    [-1, 1].forEach(side => {
      const s = z => side * tilt * z / ZT, Q = (u, v, z) => pt(X, Y, u + s(z), v, z), poly = (pts, f) => out.push(sh(P(pts.map(q => Q(...q))), f, a));
      const prism = (u0, u1, v0, v1, z0, z1, k, inner) => {
        poly([[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], k.l);
        poly([[u1, v0, z0], [u1, v1, z0], [u1, v1, z1], [u1, v0, z1]], inner ? CUT() : k.r);
        poly([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], k.t); };
      const U = (e, lo) => side < 0 ? [Math.max(-e, -9), uc - g] : [uc + g, e];
      const fl = (u0, u1, fv, h0, h1, f, lim) => { const x0 = Math.max(u0, lim[0]), x1 = Math.min(u1, lim[1]); if (x1 > x0) poly([[x0, fv, h0], [x1, fv, h0], [x1, fv, h1], [x0, fv, h1]], f); };
      const ju = U(JW), cu = U(A), tu = U(A - 0.04);
      if (ju[1] > ju[0]) { prism(ju[0], ju[1], A - 0.42, A - 0.02, 0, 5.5, J, side < 0); [-0.16, -0.08, 0, 0.08, 0.16].forEach(u => fl(u - 0.018, u + 0.018, A - 0.02, 0.8, 4.4, mix(J.l, '#000000', 0.24), ju)); }
      prism(cu[0], cu[1], -A, A, 5, 24, B, side < 0);
      fl(-0.2, -0.065, A, 13.5, 22, K5.sock, cu); fl(0.065, 0.2, A, 13.5, 22, K5.sock, cu); fl(-0.035, 0.035, A, 9.5, 12.2, mix(B.l, '#000000', 0.38), cu);
      prism(tu[0], tu[1], -A + 0.04, A - 0.04, 24, 26, { t: lt(B.t, 0.15), l: lt(B.l, 0.12), r: lt(B.r, 0.12) }, side < 0);
    });
    return out; };
  const skull = (cx, cy, o, ctx) => {
    const p = pt(cx, cy, o.u || 0, o.v || 0, o.z || 0), X = p[0], Y = p[1], a = o.o === undefined ? 1 : o.o, out = [];
    const shadow = (s, du, dv, k) => sh(P([pt(X, Y, (du || 0) - s, (dv || 0) - s), pt(X, Y, (du || 0) + s, (dv || 0) - s), pt(X, Y, (du || 0) + s, (dv || 0) + s), pt(X, Y, (du || 0) - s, (dv || 0) + s)]), '#000000', (k || 0.16) * a);
    if (o.st === 'crumble' || o.st === 'gather') {
      // one crack through the right eye splits the head into two pieces that lean outward into a V (stepped slices), cut face shows in the gap.
      // bones on top roll off to the floor; one small chip falls. gather = same, V half-closed
      // bone on top slides down to the skull's foot (front, inside the cell)
      const c = o.st === 'crumble', tilt = c ? 0.05 : 0.025, qb = pt(X, Y, 0.4, 0.08, 0);
      out.push(shadow(0.38, 0, 0, 0.14));
      out.push(...splitHead(X, Y, a, tilt));
      out.push(...flatBone(qb[0], qb[1], 'v', 0, a));
      return out;
    }
    if (o.st === 'stack') { out.push(shadow(0.36)); const qb = pt(X, Y, 0.4, 0.08, 0); out.push(...head(X, Y, a, { noBones: 1 }).out, ...flatBone(qb[0], qb[1], 'v', 0, a)); return out; }
    out.push(shadow(0.36));
    const H = head(X, Y, a, { jaw: o.jaw });
    out.push(...H.out);
    if (ctx && ctx.dark && o.mark) ctx.over.push(...head(X, Y, 0.2, { noBones: 1 }).out, ...flatBone(X, Y, 'u', 26, 0.45), ...H.C.eyesOnly(), ...H.C.dots(0.85));
    return out;
  };
  // 갈고리: low iron plate 0.8칸 × 1.5px (4장 쇠막대 흑철 #4C5259, tone()), one round hole for the chain, and ONE hook standing on a small cuff at the right corner
  // (outside a standing cube's silhouette). three silhouettes (hv): 'a' 둥근 막대 · 'b' 블록 굽이 · 'c' 초승달 날. single accent = dark red rust on the point.
  // 쇠: 4장 흑철 #4C5259의 밝기 그대로, 색만 hue 302°(5장 세계) · chroma 0.034 쪽으로 돌린 보랏빛 짙은 쇠
  const HI = (() => { const q = lab('#4C5259'), hr = 302 * Math.PI / 180, b = hex([q[0], 0.034 * Math.cos(hr), 0.034 * Math.sin(hr)]), k = tone(b); return { b, k, hi: mix(b, '#ffffff', 0.34), mid: mix(k.l, k.r, 0.5), hole: '#1C1922', rust: { t: '#8E2450', l: mix('#8E2450', '#000000', 0.4), r: mix('#8E2450', '#000000', 0.22), mid: mix('#8E2450', '#000000', 0.3) } }; })();
  let HV = 'a';
  const arcP = (x0, y0, R, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [x0 + R * Math.cos(t), y0 + R * Math.sin(t)]; });
  const ribbon = (cl, ws) => { const L = [], Rr = [];
    cl.forEach((q, i) => { const p0 = cl[Math.max(0, i - 1)], p1 = cl[Math.min(cl.length - 1, i + 1)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], m = Math.hypot(dx, dy) || 1, h = ws[i] / 2;
      L.push([q[0] - dy / m * h, q[1] + dx / m * h]); Rr.push([q[0] + dy / m * h, q[1] - dx / m * h]); });
    return (i0, i1) => L.slice(i0, i1 + 1).concat(Rr.slice(i0, i1 + 1).reverse()); };
  // profiles in px (X toward the curl, Y up from the cuff top). { polys: [{p, r}], dd: depth in cells, cuff: half size }
  const HPROF = {
    a: (() => { const cl = [[0, 0], [0, 6], ...arcP(7, 12, 7, 180, -40, 14), [11, 5.9], [9.5, 4.1], [8.1, 2.6]], n = cl.length, T0 = 8,
        ws = cl.map((_, i) => i <= T0 ? 6 : 6 - 5.7 * Math.pow((i - T0) / (n - 1 - T0), 1.15)), rb = ribbon(cl, ws), k = n - 5;
      return { polys: [{ p: rb(0, k) }, { p: rb(k, n - 1), r: 1 }], dd: 0.085, cuff: 0.055, name: '둥근 막대 + 날 끝' }; })(),
    b: { polys: [{ p: [[-2.75, 0], [2.75, 0], [2.75, 16], [-2.75, 16]] }, { p: [[0, 16], [12, 16], [12, 21.5], [0, 21.5]] }, { p: [[9, 8], [14.5, 8], [14.5, 18.5], [9, 18.5]] }, { p: [[6.5, 8], [14.5, 8], [14.5, 6.5], [8.5, 3.5]], r: 1 }], dd: 0.09, cuff: 0.055, name: '블록 굽이' },
    c: (() => { const cl = [[0, 0], [0, 4], ...arcP(8, 9, 8, 180, -40, 16), [10.6, 2.6]], n = cl.length, ws = cl.map((_, i) => 9 * (1 - i / (n - 1)) + 0.4), rb = ribbon(cl, ws), k = n - 5;
      return { polys: [{ p: rb(0, k) }, { p: rb(k, n - 1), r: 1 }], dd: 0.05, cuff: 0.06, name: '초승달 날' }; })()
  };
  const area = p => p.reduce((s2, q, i) => { const r = p[(i + 1) % p.length]; return s2 + q[0] * r[1] - r[0] * q[1]; }, 0);
  const clipA = (p, amax) => { const out = []; for (let i = 0; i < p.length; i++) { const A = p[i], B = p[(i + 1) % p.length], ia = A[0] <= amax, ib = B[0] <= amax;
      if (ia) out.push(A); if (ia !== ib) { const t = (amax - A[0]) / (B[0] - A[0]); out.push([amax, A[1] + (B[1] - A[1]) * t]); } } return out; };
  // render polygons lying in a vertical plane. M(a, h, side) -> screen; N(nx, ny) -> [nu, nv, nz]; front = {iron, rust} face colours
  const hookDraw = (polys, M, N, front, op, amax) => { const rims = [], fr = [];
    polys.forEach(({ p, r }) => { if (amax !== undefined) p = clipA(p, amax); if (p.length < 3) return; const cw = area(p) < 0;
      p.forEach((A, i) => { const B = p[(i + 1) % p.length], dx = B[0] - A[0], dy = B[1] - A[1], m = Math.hypot(dx, dy); if (m < 1e-6) return;
        if (amax !== undefined && Math.abs(A[0] - amax) < 1e-6 && Math.abs(B[0] - amax) < 1e-6) return;
        const nx = (cw ? -dy : dy) / m, ny = (cw ? dx : -dx) / m, [nu, nv, nz] = N(nx, ny); if (nu + nv + 1.2 * nz <= 0.02) return;
        const c = nz > 0.55 ? (r ? HI.rust.t : HI.hi) : nu >= nv ? (r ? HI.rust.r : HI.k.r) : (r ? HI.rust.l : HI.k.l);
        rims.push({ top: nz > 0.55, s: sh(P([M(A[0], A[1], 1), M(B[0], B[1], 1), M(B[0], B[1], -1), M(A[0], A[1], -1)]), c, op) }); });
      fr.push(sh(P(p.map(q => M(q[0], q[1], 1))), r ? front.rust : front.iron, op)); });
    return rims.filter(x => !x.top).map(x => x.s).concat(rims.filter(x => x.top).map(x => x.s), fr); };
  const HPOS = [0.33, -0.33];
  const standHook = (cx, cy, hv) => { const H = HPROF[hv] || HPROF.a, [u0, v0] = HPOS, c = H.cuff, zb = 5.5, q = H.dd * 0.354;
    const out = box3(cx, cy, u0 - c, u0 + c, v0 - c, v0 + c, zb, 4, HI.k.t, HI.k.l, HI.k.r);
    const M = (A, h, sd) => pt(cx, cy, u0 + A / 104 + sd * q, v0 - A / 104 + sd * q, zb + h), N = (nx, ny) => [nx * 0.707, -nx * 0.707, ny];
    return out.concat(hookDraw(H.polys, M, N, { iron: HI.mid, rust: HI.rust.mid }, 1)); };
  // in darkness the lit cell would show a thin pale floor ring around the plate: the plate fills the cell there
  const hookPlate = (cx, cy, o, ctx) => { const k = HI.k, out = [], c = (HPROF[o.hv || HV] || HPROF.a).cuff, e = ctx && ctx.dark ? 0.5 : 0.4;
    out.push(...box3(cx, cy, -e, e, -e, e, 1.5, 1.5, k.t, k.l, k.r));
    out.push(ell(cx, cy, 0.13, 1.55, HI.hole, 1, 24));
    if (o.out) { out.push(...box3(cx, cy, HPOS[0] - c, HPOS[0] + c, HPOS[1] - c, HPOS[1] + c, 5.5, 4, HI.k.t, HI.k.l, HI.k.r)); out.push(quad(cx, cy, HPOS[0] - c * 0.55, HPOS[0] + c * 0.55, HPOS[1] - c * 0.55, HPOS[1] + c * 0.55, 5.55, HI.hole)); }
    else out.push(...standHook(cx, cy, o.hv || HV));
    return out; };
  const mountHooks = () => [];
  const hook = (cx, cy, o, ctx) => hookPlate(cx, cy, o, ctx);
  // 사슬: one continuous band (like the 110 mooring rope), link feel from shading only — light top edge, alternating mid tone, dark lower edge
  const chain = (cx, cy, u0, v0, u1, v1, z, o) => {
    const out = [], a = o === undefined ? 1 : o, Ch = K5.chain, L = Math.hypot(u1 - u0, v1 - v0); if (L < 0.005) return out;
    const n = Math.max(1, Math.round(L / 0.11)), seg = (s0, s1, d0, d1, f) => { const A = pt(cx, cy, u0 + (u1 - u0) * s0, v0 + (v1 - v0) * s0, z), B = pt(cx, cy, u0 + (u1 - u0) * s1, v0 + (v1 - v0) * s1, z);
      out.push(sh(P([[A[0], A[1] + d0], [B[0], B[1] + d0], [B[0], B[1] + d1], [A[0], A[1] + d1]]), f, a)); };
    seg(0, 1, -1.8, 1.8, Ch.b);
    for (let i = 0; i < n; i++) seg(i / n, (i + 0.55) / n, -1.8, 0.4, i % 2 ? mix(Ch.a, Ch.b, 0.45) : Ch.a);
    seg(0, 1, 0.9, 1.8, Ch.l);
    return out;
  };
  // flying hook: the same cuff + silhouette in the vertical plane along d, × 1.05, leaning back 25° (pulled by the chain) so the point leads.
  // stuck: the point is cut 3px into the face it bites (fu) with a dark rust bite mark.
  const FLY = { k: 1.05, tilt: 25 * Math.PI / 180, bite: 3, zb: 9 };
  const flyPolys = hv => { const H = HPROF[hv] || HPROF.a, c = Math.cos(FLY.tilt), sn = Math.sin(FLY.tilt);
    return H.polys.map(({ p, r }) => ({ p: p.map(([x, y]) => [(x * c - y * sn) * FLY.k, (x * sn + y * c) * FLY.k]), r })); };
  const flyTip = hv => { let best = [-1e9, 0]; flyPolys(hv).forEach(({ p }) => p.forEach(q => { if (q[0] > best[0]) best = q; })); return best; };
  const hookReach = hv => (flyTip(hv || HV)[0] - FLY.bite) / 58;
  const jHook = (cx, cy, u, v, d, o, opt) => { opt = opt || {}; const hv = opt.hv || HV, H = HPROF[hv] || HPROF.a, a = o === undefined ? 1 : o, out = [], sg = d[0] || d[1], zb = opt.zb === undefined ? FLY.zb : opt.zb;
    const stuck = opt.stuck && opt.fu !== undefined, tp = flyTip(hv), amax = stuck ? tp[0] - FLY.bite : undefined;
    const q = H.dd / 2, M = d[0] ? (A, h, sd) => pt(cx, cy, u + sg * A / 58, v + sd * q, zb + h) : (A, h, sd) => pt(cx, cy, u + sd * q, v + sg * A / 58, zb + h);
    const N = d[0] ? (nx, ny) => [sg * nx, 0, ny] : (nx, ny) => [0, sg * nx, ny];
    const front = d[0] ? { iron: HI.k.l, rust: HI.rust.l } : { iron: HI.k.r, rust: HI.rust.r };
    out.push(...hookDraw(flyPolys(hv), M, N, front, a, amax));
    if (stuck) { const zz = zb + tp[1], dn = mix(HI.rust.l, '#000000', 0.35), fu = opt.fu;
      if (d[0]) out.push(faceR(cx, cy, fu, v - 0.06, v + 0.06, zz - 4, zz + 3, dn, a)); else out.push(faceL(cx, cy, fu, u - 0.06, u + 0.06, zz - 4, zz + 3, dn, a)); }
    return out; };
  const tip = (cx, cy, u, v, d, z, o, stuck, fu, hv) => jHook(cx, cy, u, v, d, o, { stuck, fu, hv });
  const EDGE = 0.45;
  const hopPath = d => { const w = [HPOS.slice()]; if (d[1] > 0) w.push([0.33, 0.33]); if (d[0] < 0) w.push([-0.33, -0.33]); w.push([d[0] * EDGE, d[1] * EDGE]); return w; };
  const hookMv = (cx, cy, o) => { const d = o.dir || [1, 0], t = Math.max(0, Math.min(1, o.tt === undefined ? 0.5 : o.tt)), w = hopPath(d);
    const segs = w.slice(1).map((q, i) => Math.hypot(q[0] - w[i][0], q[1] - w[i][1])), tot = segs.reduce((x, y) => x + y, 0); let r = t * tot, i = 0;
    while (i < segs.length - 1 && r > segs[i]) { r -= segs[i]; i++; } const f = segs[i] ? r / segs[i] : 0, u = w[i][0] + (w[i + 1][0] - w[i][0]) * f, v = w[i][1] + (w[i + 1][1] - w[i][1]) * f;
    return jHook(cx, cy, u, v, d, 1, { zb: 5.5 + 3.5 * t + 6 * Math.sin(Math.PI * t) }); };
  // 눈: low dark stone ring on the floor (this cell blocks like a wall) + one round eyeball floating half a level above it.
  // eyeball = three stacked blocks (0.4 / 0.55 / 0.4칸 · 3 / 11 / 3px) so the silhouette reads round; bone-white faces, one dark red iris.
  // front directions (+u, +v): iris on the facing side face. back directions (−u, −v): iris on the top, at the back edge (a crescent over the crown).
  // o.mid = [du, dv] diagonal while turning (240): iris slides across the top toward that corner. o.bob 0..2px. o.shut = lid down.
  // 눈: two parts. a low dark stone plate (0.7칸 × 3px) with one almond groove on top + a round bone eyeball (Ø 0.5칸) floating half a level above it.
  // faces only, no outlines. ball = three tone steps. iris sits on the ball surface toward the gaze: front directions full disc, back directions a half-moon over the top rim.
  const EY = { B: 0.25, H: 24, zb: 22, A: 0.35, h: 3, Rs: 0.25 * TW, zc: 44, gL: 0.25, iris: '#8E2450', irisOut: '#5A1530', irisIn: '#D0487A', pupil: '#160C14', glint: '#FBF4F8',
    st: { t: '#5E5272', l: '#342C42', r: '#453B56' }, shadow: '#1E1828' };
  EY.groove = mix(EY.iris, '#000000', 0.72);
  EY.plate = () => { const q = step(5, 3); return { t: q.top, l: q.left, r: q.right }; };
  const lens = (x0, y0, W, H, n) => { const p = [], N = n || 16; for (let i = 0; i <= N; i++) { const x = -W / 2 + W * i / N; p.push([x0 + x, y0 - H / 2 * Math.cos(Math.PI * x / W)]); }
    for (let i = N - 1; i > 0; i--) { const x = -W / 2 + W * i / N; p.push([x0 + x, y0 + H / 2 * Math.cos(Math.PI * x / W)]); } return p; };
  const clipC = (poly, cl) => { let out = poly; for (let i = 0; i < cl.length && out.length; i++) { const A = cl[i], B = cl[(i + 1) % cl.length], inp = out; out = [];
      const side = q => (B[0] - A[0]) * (q[1] - A[1]) - (B[1] - A[1]) * (q[0] - A[0]);
      for (let j = 0; j < inp.length; j++) { const P1 = inp[j], P2 = inp[(j + 1) % inp.length], s1 = side(P1), s2 = side(P2);
        if (s1 >= 0) out.push(P1); if ((s1 >= 0) !== (s2 >= 0)) { const t = s1 / (s1 - s2); out.push([P1[0] + (P2[0] - P1[0]) * t, P1[1] + (P2[1] - P1[1]) * t]); } } } return out; };
  const circ = (x0, y0, rx, ry, n) => Array.from({ length: n || 20 }, (_, i) => { const t = -i / (n || 20) * Math.PI * 2; return [x0 + rx * Math.cos(t), y0 + ry * Math.sin(t)]; });
  const scr = d => { const x = d[0] - d[1], y = (d[0] + d[1]) * 0.5, m = Math.hypot(x, y) || 1; return [x / m, y / m]; };
  const sArea = p => { let A = 0; for (let i = 0; i < p.length; i++) { const q = p[i], w = p[(i + 1) % p.length]; A += q[0] * w[1] - w[0] * q[1]; } return A; };
  const clipN = (poly, cl) => clipC(poly, sArea(cl) < 0 ? cl.slice().reverse() : cl);
  const rsq = (A, rc) => { const p = [], cs = [[A - rc, A - rc, 0], [-A + rc, A - rc, 90], [-A + rc, -A + rc, 180], [A - rc, -A + rc, 270]];
    cs.forEach(([u, v, a0]) => { for (let i = 0; i <= 5; i++) { const t = (a0 + 90 * i / 5) * Math.PI / 180; p.push([u + rc * Math.cos(t), v + rc * Math.sin(t)]); } }); return p; };
  const eye = (cx, cy, o, ctx) => {
    const S = EY.st, Bn = K5.bone, d = o.dir || [1, 0], out = [], op = o.o === undefined ? 1 : o.o, R2 = Math.SQRT1_2, A = EY.A;
    const put = (poly, f, a) => { if (poly.length > 2) out.push(sh(P(poly), f, a === undefined ? op : a)); };
    const PL = EY.plate(); out.push(...box3(cx, cy, -A, A, -A, A, EY.h, EY.h, PL.t, PL.l, PL.r, op));
    const T = (s_, t_) => pt(cx, cy, (s_ + t_) * R2, (-s_ + t_) * R2, EY.h);
    { const fs = rsq(EY.B * 0.85, EY.B * 0.25 * 0.85), fi = rsq(EY.B * 0.75, EY.B * 0.25 * 0.75); put(fs.map(([u, v]) => pt(cx, cy, u, v, EY.h)), '#000000', 0.07 * op); put(fi.map(([u, v]) => pt(cx, cy, u, v, EY.h)), '#000000', 0.12 * op); }
    // rounded dice block: half-side B, height H px, edge radius rc (cells) ≙ rz (px)
    const B = EY.B, H = EY.H, rc = B * 0.5, rz = H * 0.25, z0 = EY.zb + (o.bob || 0), z1 = z0 + H;
    const C = { t: Bn.t, l: Bn.l, r: Bn.r };
    const ins = z => { const k = z < z0 + rz ? (z0 + rz - z) / rz : z > z1 - rz ? (z - (z1 - rz)) / rz : 0; return rc * (1 - Math.sqrt(Math.max(0, 1 - k * k))); };
    const zs = [z0, z0 + rz * 0.35, z0 + rz * 0.7, z0 + rz, z1 - rz, z1 - rz * 0.7, z1 - rz * 0.35, z1];
    for (let j = 0; j < zs.length - 1; j++) { const za = zs[j], zb = zs[j + 1], zm = (za + zb) / 2, e = ins(zm), fp = rsq(B - e, Math.max(rc - e, 0.005)), up = zm > z1 - rz ? (zm - (z1 - rz)) / rz : 0;
      for (let i = 0; i < fp.length; i++) { const p0 = fp[i], p1 = fp[(i + 1) % fp.length], nu = p1[1] - p0[1], nv = -(p1[0] - p0[0]); if (nu + nv <= 1e-6) continue;
        const k = nv / (Math.abs(nu) + Math.abs(nv)), side = k < 0.35 ? C.r : k > 0.65 ? C.l : mix(C.r, C.l, 0.5), f = up > 0.6 ? mix(side, C.t, 0.5) : side;
        put([pt(cx, cy, p0[0], p0[1], zb), pt(cx, cy, p1[0], p1[1], zb), pt(cx, cy, p1[0], p1[1], za), pt(cx, cy, p0[0], p0[1], za)], f); } }
    put(rsq(B - rc * 0.55, rc * 0.5).map(([u, v]) => pt(cx, cy, u, v, z1)), C.t);
    // iris plane: front dirs on that side face, back dirs on the top toward that edge, turning (mid) on the top toward that corner
    const ri = B * 2 * 0.7 / 2, pz = H / (B * 2), zmid = (z0 + z1) / 2, dd = o.mid, n = 28;
    let disc, pl;
    if (!dd && d[0] + d[1] > 0) { pl = d[0] ? (a, b) => pt(cx, cy, B, a, zmid - b * pz) : (a, b) => pt(cx, cy, -a, B, zmid - b * pz); disc = d[0] ? (r, N) => Array.from({ length: N || n }, (_, i) => { const t = i / (N || n) * Math.PI * 2; return pt(cx, cy, B, r * Math.cos(t), zmid + r * pz * Math.sin(t)); })
                                              : (r, N) => Array.from({ length: N || n }, (_, i) => { const t = i / (N || n) * Math.PI * 2; return pt(cx, cy, r * Math.cos(t), B, zmid + r * pz * Math.sin(t)); }); }
    else { const q = dd || d, m = Math.hypot(q[0], q[1]) || 1, off = B - rc * 0.3 - ri * 0.9, cu = q[0] / m * off * (dd ? 1.2 : 1), cv = q[1] / m * off * (dd ? 1.2 : 1);
      pl = (a, b) => pt(cx, cy, cu + (a + b) * R2, cv + (-a + b) * R2, z1);
      disc = (r, N) => Array.from({ length: N || n }, (_, i) => { const t = i / (N || n) * Math.PI * 2; return pt(cx, cy, cu + r * Math.cos(t), cv + r * Math.sin(t), z1); }); }
    if (o.shut) { const cl_ = [], N = 14; for (let i = 0; i <= N; i++) { const x = -1 + 2 * i / N; cl_.push(pl(x * ri, ri * 0.28 * (1 - x * x))); }
      const th = x => 1.1 * Math.sqrt(1 - x * x) + 0.25; put(cl_.map((q, i) => [q[0], q[1] - th(-1 + 2 * i / N)]).concat(cl_.slice().reverse().map((q, i) => [q[0], q[1] + th(1 - 2 * i / N)])), EY.irisOut);
      if (o.slit) (ctx && ctx.dark ? ctx.over : out).push(sh(P(disc(ri * 0.4, 16)), K5.violet, 0.9)); return out; }
    const dimC = c => o.dim ? mix(c, Bn.t, 0.6) : c;
    put(disc(ri + 0.025), EY.iris, 0.16 * op);
    put(disc(ri), dimC(EY.irisOut)); put(disc(ri * 0.74), dimC(EY.iris)); put(disc(ri * 0.48, 20), dimC(EY.irisIn)); put(disc(ri * 0.26, 16), o.dim ? mix(EY.pupil, Bn.t, 0.5) : EY.pupil);
    const c0 = disc(0, 4)[0], gl = disc(ri * 0.62, 8)[5]; put(circ(c0[0] + (gl[0] - c0[0]) * 0.5 - 1, c0[1] + (gl[1] - c0[1]) * 0.5 - 1, 1.1, 1.1, 8), EY.glint, op * (o.dim ? 0.5 : 0.95));
    return out;
  };
  // 그림자 다리: one seamless slab of shadow across the pit (0.8칸 wide, 4px), no planks, no lines. exists only in the dark, so it's drawn as light on black:
  // translucent violet mass (top #8E7CD6 0.35 breathing 0.3–0.4 over 3s, sides one step darker), soft 0.1칸 rim, a faint glow (0.12) sinking into the pit.
  const BRV = { t: '#7A6EA8', s: mix('#7A6EA8', '#000000', 0.22), r: mix('#7A6EA8', '#000000', 0.11) };
  const bridge = (cx, cy, o, ctx) => {
    const dk = ctx && (ctx.dark || o.lit), fade = o.o === undefined ? 1 : o.o; if (!dk && o.o === undefined) return [];
    const dst = dk ? ctx.over : [], br = (o.br === undefined ? 0.26 : o.br) * (o.alt ? 0.15 / 0.26 : 1), W = 0.4, U = 0.56, zt = -1, th = 4, A = fade * (o.lit ? o.lit / 0.42 : 1);
    const jv = o.jv || [0, 0], ju = o.ju || [0, 0], V0 = jv[0] ? -0.5 : -W, V1 = jv[1] ? 0.5 : W, U0 = ju[0] ? -0.5 : -U, U1 = ju[1] ? 0.5 : U, rf = q => q * (o.br === undefined ? 0.26 : o.br) / 0.24 * A;
    [[-6, 0.08], [-12, 0.06], [-19, 0.04], [-27, 0.025]].forEach(([dz, q], i) => dst.push(quad(cx, cy, ju[0] ? -0.5 : -U + 0.04 * i, ju[1] ? 0.5 : U - 0.04 * i, jv[0] ? -0.5 : -W - 0.02, jv[1] ? 0.5 : W + 0.02, zt - th + dz, BRV.t, q * A)));
    if (!jv[1]) dst.push(faceL(cx, cy, W, U0, U1, zt - th, zt, BRV.s, 0.3 * A));
    if (!ju[1]) dst.push(faceR(cx, cy, U, V0, V1, zt - th, zt, BRV.r, 0.3 * A));
    [[0.1, 0.1], [0.05, 0.2]].forEach(([e, q]) => {
      if (!ju[0]) dst.push(quad(cx, cy, -U - e, -U, V0, V1, zt, BRV.t, rf(q))); if (!ju[1]) dst.push(quad(cx, cy, U, U + e, V0, V1, zt, BRV.t, rf(q)));
      if (!jv[0]) dst.push(quad(cx, cy, U0 - (ju[0] ? 0 : e), U1 + (ju[1] ? 0 : e), -W - e, -W, zt, BRV.t, rf(q))); if (!jv[1]) dst.push(quad(cx, cy, U0 - (ju[0] ? 0 : e), U1 + (ju[1] ? 0 : e), W, W + e, zt, BRV.t, rf(q))); });
    dst.push(quad(cx, cy, U0, U1, V0, V1, zt, BRV.t, br * A));
    // 마디: faint knot on each cell boundary along the span — a 1px darker line across the top + a small notch in the visible side face
    return dk ? [] : dst;
  };
  const home = (cx, cy) => [quad(cx, cy, -0.31, 0.31, -0.31, 0.31, 0, K5.home.rim), quad(cx, cy, -0.23, 0.23, -0.23, 0.23, -1, K5.home.in)];
  const sw = (cx, cy, pressed) => { const k = tone(K5.box); return box3(cx, cy, -0.33, 0.33, -0.33, 0.33, pressed ? 1 : 4, pressed ? 1 : 4, k.t, k.l, k.r); };
  // 분위기: 아주 작은 사람 꼴 (머리 · 몸 · 팔다리). ph = 달리기 자세 0..1, dir = 달리는 쪽 (+u)
  const person = (X, Y, k, ph, hornC) => { const out = [], s = Math.sin(ph * Math.PI * 2), L = 0.045 * s, w = 0.018;
    out.push(sh(P([pt(X, Y, -0.07, -0.05), pt(X, Y, 0.07, -0.05), pt(X, Y, 0.07, 0.05), pt(X, Y, -0.07, 0.05)]), '#000000', 0.16));
    // legs (swing along u)
    [[L, -0.022], [-L, 0.022]].forEach(([du, dv]) => out.push(...box3(X, Y, du - w, du + w, dv - w, dv + w, 4, 4, k.l, k.l, k.r)));
    // body
    out.push(...box3(X, Y, -0.032, 0.032, -0.03, 0.03, 9, 5, k.t, k.l, k.r));
    // arms (opposite swing)
    [[-L * 1.1, -0.05], [L * 1.1, 0.05]].forEach(([du, dv]) => out.push(...box3(X, Y, du - w, du + w, dv - w, dv + w, 8.5, 4, k.t, k.l, k.r)));
    // head
    out.push(...box3(X, Y, -0.045, 0.045, -0.045, 0.045, 14, 5, k.t, k.l, k.r));
    out.push(faceL(X, Y, 0.045, -0.025, -0.005, 10.5, 12, k.eye), faceL(X, Y, 0.045, 0.008, 0.028, 10.5, 12, k.eye));
    if (hornC) [[-0.03], [0.03]].forEach(([dv]) => out.push(...box3(X, Y, -0.012, 0.012, dv - 0.012, dv + 0.012, 16.5, 2.5, hornC, hornC, hornC)));
    return out; };
  const imp = (cx, cy, o) => { const p = pt(cx, cy, o.u || 0, o.v || 0, o.z || 0); return person(p[0], p[1], { t: K5.imp, l: K5.impL, r: K5.impR, eye: '#F1D9EA' }, o.ph || 0, mix(K5.imp, '#ffffff', 0.2)); };
  const mini = (cx, cy, o) => { const p = pt(cx, cy, o.u || 0, o.v || 0, o.z || 0); return person(p[0], p[1], { t: K5.bone.t, l: K5.bone.l, r: K5.bone.r, eye: K5.sock }, (o.ph || 0) + 0.5); };
  // existing game objects via cubound-iso (land shapes stripped, recoloured per fire palette)
  const FIREPAL = {
    orange: null,
    violet: { '#EE8A36': '#9C72E8', '#F6AE45': '#B793F5', '#FBDC7E': '#E2D3FF', '#F08C3A': '#9A6CEB', '#F8B04C': '#B48EF7', '#FCDD86': '#E4D6FF', '#C77A45': '#7D5AB8', '#D98E4E': '#9473D0', '#A3694A': '#6F578F', '#7C4F39': '#4E3D66', '#8F5C42': '#5E4A7A' },
    blue: { '#EE8A36': '#4E93E8', '#F6AE45': '#73B0F2', '#FBDC7E': '#CFE7FF', '#F08C3A': '#4A8EEA', '#F8B04C': '#6FAEF5', '#FCDD86': '#D3E9FF', '#C77A45': '#3F74B8', '#D98E4E': '#5A8DD0', '#A3694A': '#4E6A8F', '#7C4F39': '#384D66', '#8F5C42': '#435A7A' }
  };
  const ext = (cx, cy, spec, fl, pal) => {
    const I = window.CuboundIso; if (!I) return [];
    const def = { g: [[0]], floor: { a: fl.top, b: fl.top, l: fl.left, r: fl.right } };
    let cut = 3, baseSet = null;
    if (spec.pit) { def.g = [['p']]; cut = 0; baseSet = new Set(I.scene({ g: [['p']], floor: def.floor }).map(s => s.d + s.f)); }
    if (spec.cell) def.cells = { '0,0': spec.cell }; else def.objs = { '0,0': [spec.o] };
    const map = FIREPAL[pal || 'orange'];
    return I.scene(def).slice(cut).filter(s => !s.raw && s.txt === undefined && !(baseSet && baseSet.has(s.d + s.f))).map(s => ({ d: s.d.split(' ').map(q => { const [x, y] = q.split(',').map(Number); return r1(x + cx) + ',' + r1(y + cy); }).join(' '), f: map && map[(s.f || '').toUpperCase()] || s.f, o: s.o }));
  };
  const FIRECOL = { orange: '#F8B04C', violet: '#B48EF7', blue: '#6FAEF5' };

  // 까마귀: a seated crow stacked from small blocks like the skull (body, head, short beak, tail), black-violet, three face tones. ~0.3칸 long.
  // o: { u, v, d: [dx, dy] facing, tilt, hop (px), z (px, flight lift), flap (-1 up … 1 down), o } — lifted crows go to ctx.sky (drawn on top, clipped by the frame)
  const CRW = '#1C1723';
  const crow = (cx, cy, o, ctx) => {
    const d = o.d || [1, 0], dx = d[0], dy = d[1], U = o.u || 0, V = o.v || 0, z0 = (o.hop || 0) + (o.z || 0), al = o.o === undefined ? 1 : o.o, fly = o.z > 0 || o.flap !== undefined;
    const UV = (p, q) => [U + p * dx - q * dy, V + p * dy + q * dx];
    const map = (a0, a1, b0, b1) => { const pts = [UV(a0, b0), UV(a1, b1)]; return [Math.min(pts[0][0], pts[1][0]), Math.max(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][1], pts[1][1])]; };
    const seal = q => Object.assign(q, { st: true, sw: 0.8 });
    const tb = o.tilt ? 0.022 : 0, tz = o.tilt ? 1.5 : 0, parts = [];
    const add_ = (a0, a1, b0, b1, z, th) => { const [u0, u1, v0, v1] = map(a0, a1, b0, b1); parts.push({ u0, u1, v0, v1, z: z0 + z, th, k: u0 + u1 + v0 + v1 }); };
    const hz = tz + (o.caw ? 1.5 : 0);
    add_(-0.27, -0.06, -0.022, 0.022, 4.5, 2.5); add_(-0.27, -0.2, -0.032, 0.032, 4.7, 2);   // wedge tail
    add_(-0.13, -0.02, -0.036, 0.036, 4, 4.5);           // folded wing tips
    add_(-0.09, 0.05, -0.043, 0.043, 1, 10);             // slim body
    add_(0.02, 0.085, -0.037, 0.037, 2, 8);              // chest
    add_(-0.01, 0.09, -0.03 + tb / 2, 0.03 + tb / 2, 8, 5 + hz);   // neck
    add_(0.0, 0.11, -0.036 + tb, 0.036 + tb, 10 + hz, 7);          // head
    if (!o.caw) { add_(0.09, 0.17, -0.02 + tb, 0.02 + tb, 12 + hz, 3.5); add_(0.16, 0.19, -0.015 + tb, 0.015 + tb, 11 + hz, 3); }   // beak ~1/5, tip down
    else { add_(0.09, 0.19, -0.019 + tb, 0.019 + tb, 14 + hz, 2.2); add_(0.09, 0.165, -0.017 + tb, 0.017 + tb, 10.2 + hz, 2); }   // 까악: open
    parts.sort((p, q) => p.k - q.k || p.z - q.z);
    const body = parts.flatMap(p => box3(cx, cy, p.u0, p.u1, p.v0, p.v1, p.z, p.th, CRW, CRW, CRW, al).map(seal));
    const out = [], shO = o.z ? Math.max(0, 0.14 - o.z / 300) : 0.14;
    if (shO > 0.01) out.push(ell(cx, cy, 0.08, 0, '#000000', shO * al, 16, U, V));
    if (fly) { const p0 = pt(cx, cy, U, V, z0 + 8), sc = 0.36 * TW / 1.16;
      const g = { raw: '<g fill="' + CRW + '" opacity="' + al + '">' + crowBird(p0[0], p0[1], o.ang || 0, (o.sx || 1) < 0, sc, o.flap || 0) + '</g>' };
      if (ctx && ctx.sky) ctx.sky.push(g); else out.push(g); return out; }
    return out.concat(body);
  };
  const drawObj = (o, cx, cy, ctx, fl) => {
    switch (o.t) {
      case 'cube': { const p = pt(cx, cy, o.u || 0, o.v || 0); return (o.shadow ? [sh(P([pt(p[0], p[1], -0.3, -0.3), pt(p[0], p[1], 0.3, -0.3), pt(p[0], p[1], 0.3, 0.3), pt(p[0], p[1], -0.3, 0.3)]), '#000000', 0.2)] : []).concat(cubeAt(p[0], p[1], CS, o.z || 0, LV, tone(K5.cube), o.o)); }
      case 'box': { const p = pt(cx, cy, o.u || 0, o.v || 0); return (o.z ? [sh(P([pt(p[0], p[1], -0.3, -0.3, o.sz || 0), pt(p[0], p[1], 0.3, -0.3, o.sz || 0), pt(p[0], p[1], 0.3, 0.3, o.sz || 0), pt(p[0], p[1], -0.3, 0.3, o.sz || 0)]), '#000000', 0.25)] : []).concat(cubeAt(p[0], p[1], CS, o.z || 0, LV, tone(K5.box), o.o)); }
      case 'sw': return sw(cx, cy, o.pressed);
      case 'home': return o.old ? [quad(cx, cy, -0.31, 0.31, -0.31, 0.31, 0, '#4A4845'), quad(cx, cy, -0.23, 0.23, -0.23, 0.23, -1, '#2F2E2C')] : home(cx, cy);
      case 'skull': return skull(cx, cy, o, ctx);
      case 'hook': return hook(cx, cy, o, ctx);
      case 'chain': return chain(cx, cy, o.u0 || 0, o.v0 || 0, o.u1, o.v1, o.z === undefined ? 8 : o.z, o.o);
      case 'tip': return tip(cx, cy, o.u || 0, o.v || 0, o.dir || [1, 0], (o.z === undefined ? 8 : o.z), o.o, o.stuck, o.fu, o.hv);
      case 'hookF': return mountHooks(cx, cy, o, true);
      case 'hookMv': return hookMv(cx, cy, o);
      case 'eye': return eye(cx, cy, o, ctx);
      case 'bridge': return bridge(cx, cy, o, ctx);
      case 'imp': return imp(cx, cy, o);
      case 'mini': return mini(cx, cy, o);
      case 'crow': return crow(cx, cy, o, ctx);
      case 'iron': { const c = o.old ? '#4C5259' : K5.iron, k = tone(c); return box3(cx, cy, -0.42, 0.42, -0.1, 0.1, 9, 9, mix(c, '#ffffff', 0.3), k.l, k.r); }
      case 'ext': return ext(cx, cy, o, fl, ctx.pal);
      case 'gz': { const L = o.len || 1, sg = o.from || 0, k = o.o === undefined ? 1 : o.o / 0.2, A0 = -0.5 + sg, A1 = A0 + L, out = [];
        const segs = o.end === 'hi' ? [[A0, A1 - 0.22, 1], [A1 - 0.22, A1 - 0.12, 0.62], [A1 - 0.12, A1 - 0.04, 0.3]] : o.end === 'lo' ? [[A0 + 0.22, A1, 1], [A0 + 0.12, A0 + 0.22, 0.62], [A0 + 0.04, A0 + 0.12, 0.3]] : [[A0, A1, 1]];
        segs.forEach(([a0, a1, f]) => [0.225, 0.165, 0.105, 0.05].forEach(w => out.push(o.ax === 'x' ? quad(cx, cy, a0, a1, -w, w, 0.3, EY.irisOut, 0.038 * f * k) : quad(cx, cy, -w, w, a0, a1, 0.3, EY.irisOut, 0.038 * f * k)))); return out; }
      case 'tint': return [quad(cx, cy, -0.5, 0.5, -0.5, 0.5, 0.2, o.f, o.o)];
    }
    return [];
  };

  // 무너지는 칸 (game): intact = 1b 둘레 틈 (0.846, 3px in, 13px slab), step = four pieces 8px down 9px (one lifted 4), fall = 15px down 5px
  const CRS = { step: { top: '#c4bdab', left: '#a19a8b', right: '#b2ab9a', z: -8, th: 9 }, fall: { top: '#a9a08b', left: '#8a8372', right: '#9a9382', z: -15, th: 5 } };
  const crumble = (cx, cy, h, st, c) => {
    const out = [], sup = h * LV + TK - 16;
    if (sup > 0) out.push(...box3(cx, cy, -0.5, 0.5, -0.5, 0.5, -16, sup, c.left, c.left, c.right));
    if (!st || st === 'intact') { const a = -0.5 + 0.077, b = 0.5 - 0.077, z = -3;
      out.push(sh(P([pt(cx, cy, -0.5, -0.5), pt(cx, cy, 0.5, -0.5), pt(cx, cy, b, a, z), pt(cx, cy, a, a, z)]), c.left), sh(P([pt(cx, cy, -0.5, -0.5), pt(cx, cy, a, a, z), pt(cx, cy, a, b, z), pt(cx, cy, -0.5, 0.5)]), c.right));
      out.push(...box3(cx, cy, a, b, a, b, z, 13, c.top, c.left, c.right)); return out; }
    const S = CRS[st], k = 0.024, z = S.z;
    out.push(sh(P([pt(cx, cy, -0.5, -0.5), pt(cx, cy, 0.5, -0.5), pt(cx, cy, 0.5 - k, -0.5 + k, z), pt(cx, cy, -0.5 + k, -0.5 + k, z)]), c.left), sh(P([pt(cx, cy, -0.5, -0.5), pt(cx, cy, -0.5 + k, -0.5 + k, z), pt(cx, cy, -0.5 + k, 0.5 - k, z), pt(cx, cy, -0.5, 0.5)]), c.right));
    [[-0.476, -0.024, -0.476, -0.024, 0], [-0.476, -0.024, 0.024, 0.476, 0], [0.024, 0.476, -0.476, -0.024, st === 'step' ? 4 : 0], [0.024, 0.476, 0.024, 0.476, 0]].forEach(([a, b, d, e, l]) => out.push(...box3(cx, cy, a, b, d, e, z + l, S.th + l, S.top, S.left, S.right)));
    return out;
  };
  // ---------- board ----------
  // def: { ch, g: ['000', '0p0'] (digit = height, p = pit, . = none), objs: {'x,y': [..]}, dark: 0..1, lights: [[x,y,r,h?,col?]], perma: ['x,y'], permaEdge: ['x,y'], hint: ['x,y'], pal, flat }
  // 밝을 때 늘 어두운 땅 안: light board with the zone black + the same board fully dark (lights at the cube) clipped to the zone
  const zoneBoard = def => {
    const Z = def.zone, ZS = new Set(Z.cells), objs = def.objs || {}, lo = {}, base = Object.assign({}, def, { zone: null });
    Object.keys(objs).forEach(k => { if (!ZS.has(k)) lo[k] = objs[k]; });
    const lit = (Z.lights || []).map(([x, y]) => [x, y]), near = k => { const [x, y] = k.split(',').map(Number); return lit.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) <= 1); }, dobj = {};
    Object.keys(objs).forEach(k => { dobj[k] = ZS.has(k) && !near(k) ? objs[k].filter(o => o.t !== 'eye') : objs[k]; });
    const lb = board(Object.assign({}, base, { objs: lo, perma: Z.cells, permaEdge: [], hint: Z.hint || [], dark: 0, lights: [] }));
    const db = board(Object.assign({}, base, { objs: dobj, bg: null, dark: Z.dark, lights: Z.lights, perma: [], permaEdge: [], hint: [] }));
    const A = lb.vb.split(' ').map(Number), B = db.vb.split(' ').map(Number);
    const x0 = Math.min(A[0], B[0]), y0 = Math.min(A[1], B[1]), x1 = Math.max(A[0] + A[2], B[0] + B[2]), y1 = Math.max(A[1] + A[3], B[1] + B[3]);
    const g = def.g.map(r => r.split(''));
    const clip = Z.cells.map(k => { const [x, y] = k.split(',').map(Number), v = g[y][x], h = v === 'p' ? 0 : +v, p = iso(x, y, h), cx = p[0], cy = p[1], dn = v === 'p' ? 8 : h * LV + TK, up = 110;
      return '<polygon points="' + [[cx, cy - TH / 2 - up], [cx + TW / 2, cy - up], [cx + TW / 2, cy + dn], [cx, cy + TH / 2 + dn], [cx - TW / 2, cy + dn], [cx - TW / 2, cy - up]].map(q => r1(q[0]) + ',' + r1(q[1])).join(' ') + '"/>'; }).join('');
    const inner = b => b.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const vb = [x0, y0, x1 - x0, y1 - y0].map(r1).join(' ');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '"><defs><clipPath id="zc">' + clip + '</clipPath></defs>' + (def.bg ? '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="' + def.bg + '"/>' : '') + inner(lb) + '<g clip-path="url(#zc)">' + inner(db) + '</g>' + lb.edgeSvg + '</svg>';
    return { svg, w: x1 - x0, h: y1 - y0, vb };
  };
  // 까마귀 떼: 3–4 flying crows seen obliquely from the side (body, short neck, thick beak, wedge tail, curved wings growing out of the body).
  // one flat colour, no face split or lines; one group opacity so overlaps merge. a loose line along the flight path across the board, 2.5–3s, 0.5.
  const CROW = { f: '#1C1723', o: 0.5 };
  const CRB = 'M0.56,0.03 Q0.55,-0.02 0.5,-0.04 L0.4,-0.085 L0.36,-0.12 Q0.3,-0.135 0.24,-0.12 Q0.18,-0.1 0.13,-0.075 Q-0.05,-0.085 -0.3,-0.045 L-0.5,-0.075 Q-0.6,-0.04 -0.62,0.0 Q-0.6,0.04 -0.5,0.07 L-0.3,0.055 Q-0.02,0.12 0.17,0.065 Q0.25,0.05 0.32,0.04 L0.44,0.045 Q0.52,0.05 0.56,0.03 Z';
  const CRP = { near: { up: [-0.28, -0.88], mid: [-0.45, -0.2], dn: [-0.18, 0.6] }, far: { up: [-0.08, -0.78], mid: [-0.22, -0.34], dn: [-0.02, 0.05] } };
  const crowWing = (wh, p, r0, r1) => {
    const P_ = CRP[wh], lerp = (A, B, k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k], T = p < 0 ? lerp(P_.mid, P_.up, -p) : lerp(P_.mid, P_.dn, p);
    const mL = [(r0[0] + T[0]) / 2, (r0[1] + T[1]) / 2], mT = [(r1[0] + T[0]) / 2, (r1[1] + T[1]) / 2], dx = T[0] - r0[0], dy = T[1] - r0[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, sg = T[1] < 0 ? 1 : -1;
    const cL = [mL[0] + nx * 0.16 * sg + 0.05, mL[1] + ny * 0.16 * sg], cT = [mT[0] - nx * 0.05 * sg, mT[1] - ny * 0.05 * sg], f = v => r1v(v[0]) + ',' + r1v(v[1]);
    const bx = (r1[0] - T[0]) / L, by = (r1[1] - T[1]) / L, F1 = [T[0] + bx * 0.07 + nx * 0.03 * sg, T[1] + by * 0.07 + ny * 0.03 * sg], F2 = [T[0] + bx * 0.1 - nx * 0.005 * sg, T[1] + by * 0.1 - ny * 0.005 * sg], F3 = [T[0] + bx * 0.17 + nx * 0.02 * sg, T[1] + by * 0.17 + ny * 0.02 * sg];
    return 'M' + f(r0) + ' Q' + f(cL) + ' ' + f(T) + ' L' + f(F1) + ' L' + f(F2) + ' L' + f(F3) + ' Q' + f(cT) + ' ' + f(r1) + ' Z';
  };
  const r1v = v => Math.round(v * 1000) / 1000;
  const crowBird = (x, y, ang, fl, sc, p) => '<g transform="translate(' + r1(x) + ',' + r1(y) + ') rotate(' + r1(ang) + ') scale(' + r1v(fl ? -sc : sc) + ',' + r1v(sc) + ')">'
    + '<path d="' + crowWing('far', p, [0.16, -0.07], [-0.04, -0.06]) + '"/><path d="' + CRB + '"/><path d="' + crowWing('near', p, [0.12, -0.03], [-0.14, -0.02]) + '"/></g>';
  const crowSvg = (c, bx0, bx1, top, bot) => {
    const n = c.n || 4, dir = c.dir || 1, seed = c.seed || 0, t = c.t || 0, D = c.dur || 2.8, wk = 1 / (c.sc || 0.6);
    let q = Math.floor(seed * 9973) + 7; const rnd = () => (q = (q * 16807) % 2147483647) / 2147483647;
    const mg = 40 * wk, X0 = dir > 0 ? bx0 - mg : bx1 + mg, X1 = dir > 0 ? bx1 + mg : bx0 - mg, ym = (top + bot) / 2 + (c.y || 0), sl = c.drop === undefined ? (bot - top) * 0.45 : c.drop;
    const Y0 = ym - sl / 2, Y1 = ym + sl / 2, X = X0 + (X1 - X0) * t, Y = Y0 + (Y1 - Y0) * t, L = Math.hypot(X1 - X0, Y1 - Y0), ux = (X1 - X0) / L, uy = (Y1 - Y0) / L;
    const ang = dir > 0 ? Math.atan2(uy, ux) * 180 / Math.PI : Math.atan2(-uy, -ux) * 180 / Math.PI;
    const birds = []; let along = 0;
    for (let i = 0; i < n; i++) { if (i) along -= (34 + 16 * rnd()) * wk; const lat = i ? (rnd() - 0.5) * (16 + i * 8) * wk : 0, wob = Math.sin((t * 2 + i * 0.3 + seed) * Math.PI * 2) * 2.5 * wk;
      const w = (22 + 6 * rnd()) * wk, ph = c.pose !== undefined ? null : rnd();
      birds.push({ x: X + ux * along - uy * (lat + wob), y: Y + uy * along + ux * (lat + wob), s: w / 1.16, p: ph === null ? c.pose : Math.sin(((t * D / 0.4) + ph) * Math.PI * 2) }); }
    birds.sort((a_, b_) => a_.y - b_.y);
    return '<g opacity="' + CROW.o + '" fill="' + CROW.f + '">' + birds.map(B => crowBird(B.x, B.y, ang, dir < 0, B.s, B.p)).join('') + '</g>';
  };
  const board = def => {
    if (def.zone) return zoneBoard(def);
    const ch = def.ch || 5, g = def.g.map(r => r.split('')), out = [], ctx = { dark: def.dark > 0.5, over: [], sky: [], pal: def.pal };
    const V = (x, y) => (g[y] && g[y][x] !== undefined && g[y][x] !== '.') ? g[y][x] : null;
    // step per height: 1단 = most common plain height (lowest among ≥80 %), ≥10 % heights ranked; rest = blend
    const cnt = {}; let tot = 0;
    g.forEach((r, y) => r.forEach((v, x) => { if (/\d/.test(v)) { cnt[v] = (cnt[v] || 0) + 1; tot++; } }));
    const hs = Object.keys(cnt).map(Number).sort((a, b) => a - b), mx = Math.max(...hs.map(h => cnt[h]));
    const base = hs.find(h => cnt[h] >= mx * 0.8), big = hs.filter(h => cnt[h] >= tot * 0.1);
    const stepOf = h => { if (def.st && def.st[h] !== undefined) return def.st[h]; const i = big.indexOf(h), b = big.indexOf(base); if (i >= 0) return i >= b ? 1 + (i - b) : Math.max(0, 1 - (b - i) * 0.5);
      const lo = big.filter(x => x < h).pop(), hi = big.find(x => x > h); const s = q => stepOf(q); return lo === undefined ? s(hi) : hi === undefined ? s(lo) : (s(lo) + s(hi)) / 2; };
    const cells = []; g.forEach((r, y) => r.forEach((v, x) => { if (v !== '.') cells.push([x, y]); }));
    cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
    const RECS = [], silo = {}, PS = new Set(def.perma || []), HS = new Set(def.hint || []), ES = new Set(def.permaEdge || []);
    // darkening cover painted in cell order (after the cell's own objects) so objects on cells in front stay uncovered
    const EDGE = [], eo = () => def.dark ? (def.edgeD || 0.5) : (def.edgeO || 0.3), PG = def.permaGrow || 0;
    const nk = (x, y) => (x + 1) + ',' + y, isP = k => PS.has(k);
    const eLine = (cx, cy, u) => { return; const q = def.dark ? quad(cx, cy, u - 0.035, u, -0.5, 0.5, 0.2, K5.violet, eo()) : quad(cx, cy, u - 0.05, u, -0.5, 0.5, 0.2, '#B3A6EC', def.edgeO || 0.85); (def.dark ? ctx.over : out).push(q); EDGE.push(q); };
    // 늘 어두운 땅 = a membrane with no thickness of its own: top black, the board's side faces near-black (keep the slab's own shading)
    const shade = (key, cx, cy) => {
      const [x, y] = key.split(',').map(Number);
      if (def.dark > 0.5) return;
      if (PS.has(key)) { if (cx === undefined) out.push(Object.assign(sh(P(silo[key]), K5.dark, 1), { st: true, sw: 1.5 }));
        else { const R = RECS[RECS.length - 1], th = R.th, T = [[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]];
          const sk = def.dark ? 1 : 0.86, SS = { st: true, sw: 1.2 }; out.push(Object.assign(sh(P([T[3], T[2], [T[2][0], T[2][1] + th], [T[3][0], T[3][1] + th]]), mix(R.l, '#000000', sk)), SS), Object.assign(sh(P([T[2], T[1], [T[1][0], T[1][1] + th], [T[2][0], T[2][1] + th]]), mix(R.r, '#000000', sk)), SS), Object.assign(sh(P(T), K5.dark, 1), { st: true, sw: 1.5 })); } }
      if (PS.has(key) && cx !== undefined && !PS.has(nk(x, y)) && V(x + 1, y) !== null && !PG) eLine(cx, cy, 0.5);
    };
    // edge falloff drawn the way the cube light ring is: 1/8-cell tiles, colour mixed toward #000 (opaque), smoothstep steps. 6 tiles ≈ 0.75칸 → 0
    // same layers as the cube light ring's outer cell: 1/8-cell tiles, smoothstep per half cell (edge 0 → centre FAINT 0.25 → inner edge 0.525), normalised to 1 → 0
    const GN = 16, GT = 1 / 8, ssf = q => q * q * (3 - 2 * q), ringV = d => { const u = 0.5 - d, A = ssf(Math.min(1, Math.abs(u) * 2)); return u < 0 ? (1 - A) * 0.25 + A * 0.525 : (1 - A) * 0.25; }, fall = t => ringV(t) / 0.525;
    const spill = (key, cx, cy, th) => { if (def.dark > 0.5) return; const [x, y] = key.split(',').map(Number); if (PS.has(key)) return;
      let k = 0; for (let d = 1; d <= 3; d++) if (PS.has((x - d) + ',' + y)) { k = d; break; } if (!k) return;
      const R = RECS[RECS.length - 1], lo = k - 1, hi = k, lu = d => d - lo - 0.5, frontSide = V(x, y + 1) === null;
      const strip = (d0, d1, al) => { const a0 = Math.max(d0, lo), a1 = Math.min(d1, hi); if (a1 <= a0 + 1e-6 || al <= 0.003) return;
        out.push(Object.assign(sh(P([pt(cx, cy, lu(a0), -0.5), pt(cx, cy, lu(a1), -0.5), pt(cx, cy, lu(a1), 0.5), pt(cx, cy, lu(a0), 0.5)]), mix(R.t, '#000000', al)), { st: 1 }));
        if (frontSide) { const p0 = pt(cx, cy, lu(a0), 0.5), p1 = pt(cx, cy, lu(a1), 0.5); out.push(Object.assign(sh(P([p0, p1, [p1[0], p1[1] + th], [p0[0], p0[1] + th]]), mix(R.l, '#000000', al)), { st: 1 })); } };
      if (PG) strip(0, PG, 1);
      for (let i = 0; i < GN; i++) strip(PG + GT * i, PG + GT * (i + 1), 1 - ssf((i + 0.5) / GN));
      if (PG && k === 1) eLine(cx, cy, lu(PG) + 0.035); };
    cells.forEach(([x, y]) => {
      const v = g[y][x], key = x + ',' + y, objs = (def.objs || {})[key] || [];
      if (v === 'p') {
        const p = iso(x, y, 0), cx = p[0], cy = p[1], fl = step(ch, 1), c = { N: [cx, cy - TH / 2], E: [cx + TW / 2, cy], S: [cx, cy + TH / 2], W: [cx - TW / 2, cy] };
        const pa = out.length;
        const nw = V(x - 1, y), ne = V(x, y - 1), hN = /\d/.test(nw) ? +nw : 0, hE = /\d/.test(ne) ? +ne : 0;
        out.push(sh(P([c.N, c.E, c.S, c.W].map(q => [q[0], q[1] + D])), K5.pit));
        if (nw !== 'p') out.push(sh(P([[c.W[0], c.W[1] - hN * LV], [c.N[0], c.N[1] - hN * LV], [c.N[0], c.N[1] + D], [c.W[0], c.W[1] + D]]), step(ch, nw && /\d/.test(nw) ? stepOf(+nw) : 1).right));
        if (ne !== 'p') out.push(sh(P([[c.N[0], c.N[1] - hE * LV], [c.E[0], c.E[1] - hE * LV], [c.E[0], c.E[1] + D], [c.N[0], c.N[1] + D]]), step(ch, ne && /\d/.test(ne) ? stepOf(+ne) : 1).left));
        const hasBr = ctx.dark && objs.some(o => o.t === 'bridge');
        objs.slice().sort((p, q) => (q.t === 'bridge') - (p.t === 'bridge')).forEach(o => { if (hasBr && o.t !== 'bridge') { ctx.over.push(...drawObj(o, cx, cy, ctx, fl).map(q => o.t === 'cube' ? q : Object.assign({}, q, { f: mix(q.f, '#000000', 0.45) }))); return; } if (o.t === 'fill') { const k = tone(K5.box); out.push(...box3(cx, cy, -0.5, 0.5, -0.5, 0.5, 0, TK, k.t, k.l, k.r)); } else if (o.t === 'sunk') { out.push(...cubeAt(cx, cy + D - 2, CS * 1.25, 0, 4, tone(K5.box))); } else out.push(...drawObj(o, cx, cy, ctx, fl)); });
        silo[key] = [c.N, c.E, [c.E[0], c.E[1] + D], [c.S[0], c.S[1] + D], [c.W[0], c.W[1] + D], c.W];
        RECS.push({ x, y, a: pa, b: pa, c: out.length, land: false });
        shade(key);
        return;
      }
      const h = +v, p = iso(x, y, h), cx = p[0], cy = p[1], s = step(ch, stepOf(h)), par = (x + y) % 2;
      const th = h * LV + TK, t = par ? s.alt : s.top, cr = objs.find(o => o.t === 'crumble');
      const a0 = out.length;
      if (cr) out.push(...crumble(cx, cy, h, cr.st, { top: t, left: s.left, right: s.right }));
      else out.push(...box3(cx, cy, -0.5, 0.5, -0.5, 0.5, 0, th, t, s.left, s.right));
      const rec = { x, y, a: a0, b: out.length, land: !cr, cx, cy, th, t, l: s.left, r: s.right }; RECS.push(rec);
      silo[key] = [[cx, cy - TH / 2], [cx + TW / 2, cy], [cx + TW / 2, cy + th], [cx, cy + TH / 2 + th], [cx - TW / 2, cy + th], [cx - TW / 2, cy]];
      spill(key, cx, cy, th);
      objs.forEach(o => out.push(...drawObj(o, cx, cy, ctx, s)));
      objs.filter(o => o.t === 'hook').forEach(o => { const fr = mountHooks(cx, cy, o, true), ci = objs.findIndex(q => q.t === 'chain' || q.t === 'tip'); out.push(...fr); });
      rec.c = out.length;
      shade(key, cx, cy);
    });
    const LT = (def.lights || []).map(([x, y, r]) => ({ x, y, r: r * (1 + 0.03 * Math.sin((def.ph || 0) * 1.3)) }));
    if (def.dark && LT.length) {
      // two steps only: light cells (cube cell, or cube cell + ring 1 for the brazier-fired cube) = 1, the next ring = FAINT, beyond = 0
      const CORE = 1 - (def.core === undefined ? 0.2 : def.core), RING = 1 - (def.ring === undefined ? 0.45 : def.ring), FAINT = 1 - (def.faint === undefined ? 0.75 : def.faint);
      const B1 = 1 - 0.6, B2 = 1 - 0.9;
      const at = (x, y, lx, ly, big) => { const ring = Math.max(Math.abs(x - lx), Math.abs(y - ly)); return ring === 0 ? CORE : big ? (ring === 1 ? B1 : ring === 2 ? B2 : 0) : ring === 1 ? FAINT : 0; };
      const cv = (x, y) => { if (V(x, y) === null) return 0; let v = 0; LT.forEach(L => { const big = L.r >= 2.2, fx = Math.floor(L.x), fy = Math.floor(L.y), ax = L.x - fx, ay = L.y - fy;
        const w = at(x, y, fx, fy, big) * (1 - ax) * (1 - ay) + at(x, y, fx + 1, fy, big) * ax * (1 - ay) + at(x, y, fx, fy + 1, big) * (1 - ax) * ay + at(x, y, fx + 1, fy + 1, big) * ax * ay; v = Math.max(v, w); }); return v; };
      // edges / corners: lit side keeps its edge, dark side keeps its edge, faint–faint averages
      const ed = (...vs) => vs.some(q => q === 0) ? 0 : vs.reduce((a, b) => a + b, 0) / vs.length;
      const Fv = (x, y, u, v) => { const sx = u < 0 ? -1 : 1, sy = v < 0 ? -1 : 1, ss = q => q * q * (3 - 2 * q), A = ss(Math.min(1, Math.abs(u) * 2)), B = ss(Math.min(1, Math.abs(v) * 2)), c0 = cv(x, y); if (c0 >= CORE - 1e-6) return c0; const ex = ed(c0, cv(x + sx, y)), ey = ed(c0, cv(x, y + sy)), cc = ed(c0, cv(x + sx, y), cv(x, y + sy), cv(x + sx, y + sy));
        return (1 - A) * (1 - B) * c0 + A * (1 - B) * ex + (1 - A) * B * ey + A * B * cc; };
      const dk = val => def.dark * (1 - val);
      const tint = (s, val) => Object.assign({}, s, { f: mix(s.f, '#000000', dk(val)) });
      const res = out.slice(); const rebuilt = [];
      RECS.forEach(R => { const mid = Fv(R.x, R.y, 0, 0); const land = [];
        const nb = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => cv(R.x + dx, R.y + dy))), flat = nb[4] >= CORE - 1e-6 || nb.every(q => q === nb[4]);
        if (R.land && flat) { const k = def.dark * (1 - nb[4]); for (let kk = R.a; kk < R.b; kk++) land.push(Object.assign({}, res[kk], { f: mix(res[kk].f, '#000000', k) })); }
        else if (R.land) { const n = 8, q = 1 / n;
          { const c0 = cv(R.x, R.y), dl = def.dark * (1 - ed(c0, cv(R.x, R.y + 1)) * 0.5 - c0 * 0.5), dr = def.dark * (1 - ed(c0, cv(R.x + 1, R.y)) * 0.5 - c0 * 0.5), P0 = (u, v) => pt(R.cx, R.cy, u, v), dn = q => [q[0], q[1] + R.th];
            land.push(sh(P([P0(-0.5, 0.5), P0(0.5, 0.5), dn(P0(0.5, 0.5)), dn(P0(-0.5, 0.5))]), mix(R.l, '#000000', dl)));
            land.push(sh(P([P0(0.5, -0.5), P0(0.5, 0.5), dn(P0(0.5, 0.5)), dn(P0(0.5, -0.5))]), mix(R.r, '#000000', dr))); }
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const u0 = -0.5 + i * q, v0 = -0.5 + j * q;
            land.push(Object.assign(sh(P([pt(R.cx, R.cy, u0, v0), pt(R.cx, R.cy, u0 + q, v0), pt(R.cx, R.cy, u0 + q, v0 + q), pt(R.cx, R.cy, u0, v0 + q)]), mix(R.t, '#000000', dk(Fv(R.x, R.y, u0 + q / 2, v0 + q / 2)))), { st: 1 })); } }
        else for (let k = R.a; k < R.b; k++) land.push(tint(res[k], mid));
        const objs = []; for (let k = R.b; k < R.c; k++) objs.push(tint(res[k], mid));
        rebuilt.push({ a: R.a, c: R.c, sh: land.concat(objs) }); });
      rebuilt.sort((p, q) => q.a - p.a).forEach(B => out.splice(B.a, B.c - B.a, ...B.sh));
    }
    // fit
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    out.forEach(q => q.d.split(' ').forEach(t => { const [a, b] = t.split(',').map(Number); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }));
    const pad = def.pad === undefined ? 14 : def.pad; x0 -= pad; y0 -= pad + (def.padTop || 0); x1 += pad; y1 += pad;
    const vb = [x0, y0, x1 - x0, y1 - y0].map(r1).join(' ');
    const bgc = def.bg && def.dark ? mix(def.bg, '#000000', def.dark) : def.bg;
    let svg = bgc ? '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="' + bgc + '"/>' : '';
    const poly = q => q.raw ? q.raw : '<polygon points="' + q.d + '" fill="' + q.f + '"' + (q.st ? ' stroke="' + q.f + '" stroke-width="' + (q.sw || 0.7) + '" stroke-linejoin="round"' : '') + (q.o !== 1 ? ' opacity="' + q.o + '"' : '') + '/>';
    svg += out.map(poly).join('');
    if (def.crows && !def.dark) svg += crowSvg(def.crows, x0 + pad, x1 - pad, y0, y1);
    // darkness
    const W0 = x1 - x0, H0 = y1 - y0, defs = '';
    const rect = (f, o) => '<rect x="' + x0 + '" y="' + y0 + '" width="' + W0 + '" height="' + H0 + '" fill="' + f + '" opacity="' + o + '"/>';
    let dsvg = '';
    if (def.dark && !LT.length) dsvg += rect(K5.dark, def.dark);
    const over = ctx.over.map(poly).join('') + (def.over || []).map(poly).join('');
    const full = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '">' + defs + svg + ctx.sky.map(poly).join('') + dsvg + over + '</svg>';
    return { svg: full, w: x1 - x0, h: y1 - y0, vb, edgeSvg: EDGE.map(poly).join('') };
  };
  // frame for the sheet: desktop width k × px, phone = half
  const frame = (def, cap, k) => { const b = board(def), s = k || 0.62; return { cap: cap || '', bgi: 'url("data:image/svg+xml,' + encodeURIComponent(b.svg) + '")', ar: r1(b.w) + ' / ' + r1(b.h), w: Math.round(b.w * s) + 'px', wp: Math.round(b.w * s * 0.5) + 'px' }; };
  const raw = (svg, w, h, cap, k) => { const s = k || 1; return { cap: cap || '', bgi: 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">' + svg + '</svg>') + '")', ar: w + ' / ' + h, w: Math.round(w * s) + 'px', wp: Math.round(w * s * 0.5) + 'px' }; };

  window.CuboundC5 = { TW, TH, LV, TK, D, CS, CH, D5, chroma, step, K5, mix, tone, dE, board, frame, raw, iso, pt, FIRECOL, hookReach, HPROF, EY, get HIB() { return HI.b; }, setHV: v => { HV = v; }, getHV: () => HV };
})();
