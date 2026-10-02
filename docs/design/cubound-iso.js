// Shared isometric renderer for Cubound object sheets (CHAPTER 2 forest, CHAPTER 3 water).
(function () {
  const TW = 104, TH = 52, LV = 30, TK = 16, CS = 60 / 104, D = 34;
  const C = {
    bg: '#E5E7DE', panel: '#EFF1EA', a: '#F5F7F0', b: '#ECEEE6',
    blue: '#8FB3CC', yellow: '#E3CD8E', hole: '#4A4845', holeIn: '#2F2E2C',
    pitFloor: '#A6A89B',
    mud: '#A8A690', mudWall: '#8C8A76', mudLump: '#B6B49F', mudCollar: '#BFBDA8',
    capT: '#D9B8A6', capL: '#AE8B79', capR: '#C6A28F',
    stemT: '#F1EDE2', stemL: '#CFC9B9', stemR: '#E2DCCD',
    vineT: '#D3CDB4', vineL: '#A8A18A', vineR: '#BFB9A1',
    vineHT: '#C9C1A4', vineHL: '#9E9680', vineHR: '#B5AD96',
    vStemT: '#8E7A5C', stemSL: '#6F5F47', stemSR: '#7F6D52',
    leaf: '#7E9160', leafH: '#6F8253', bud: '#B59E7A', budL: '#8E7A5C', budR: '#A08A69',
    sprout: '#BFCB9F',
    soil: '#DCD9C9', soilL: '#B7B4A5', soilR: '#CBC8B8',
    sapStem: '#A8915E', sapLeaf: '#BDBF74',
    seedLandT: '#EDE4C8', seedLandL: '#C5BB9E', seedLandR: '#D9D0B3',
    railC: '#CFCBC3', railNext: '#F0EDE6', tramT: '#FCFBF8', tramL: '#DFDBD3', tramR: '#F3F1EB', skirt: '#C9C5BD'
  };
  const mix = (h, t, a) => {
    const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    const A = p(h), B = p(t);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * a).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const n = v => Math.round(v * 10) / 10;
  const P = pts => pts.map(p => n(p[0]) + ',' + n(p[1])).join(' ');
  const sh = (d, f, o) => ({ d, f, o: o === undefined ? 1 : o });
  const side = t => ({ l: mix(t, '#000000', 0.2), r: mix(t, '#000000', 0.1) });
  const tone = t => ({ t: mix(t, '#FFFFFF', 0.12), l: mix(t, '#000000', 0.24), r: mix(t, '#000000', 0.09) });
  const pt = (cx, cy, u, v, z) => [cx + (u - v) * TW / 2, cy + (u + v) * TH / 2 - (z || 0)];
  const corners = (cx, cy, s) => {
    const hw = TW / 2 * s, hh = TH / 2 * s;
    return { N: [cx, cy - hh], E: [cx + hw, cy], S: [cx, cy + hh], W: [cx - hw, cy] };
  };
  const prism = (cx, cy, s, th, t, l, r, o) => {
    const c = corners(cx, cy, s);
    return [
      sh(P([c.W, c.S, [c.S[0], c.S[1] + th], [c.W[0], c.W[1] + th]]), l, o),
      sh(P([c.S, c.E, [c.E[0], c.E[1] + th], [c.S[0], c.S[1] + th]]), r, o),
      sh(P([c.N, c.E, c.S, c.W]), t, o)
    ];
  };
  const plate = (cx, cy, s, f, o) => { const c = corners(cx, cy, s); return sh(P([c.N, c.E, c.S, c.W]), f, o); };
  const block = (cx, cy, s, z, h, t, l, r, o) => prism(cx, cy - z - h, s, h, t, l, r, o);
  const box3 = (cx, cy, u0, u1, v0, v1, z, th, t, l, r, o) => {
    const A = pt(cx, cy, u0, v0, z), B = pt(cx, cy, u1, v0, z), Cc = pt(cx, cy, u1, v1, z), Dd = pt(cx, cy, u0, v1, z);
    const dn = p => [p[0], p[1] + th];
    return [sh(P([B, Cc, dn(Cc), dn(B)]), r, o), sh(P([Dd, Cc, dn(Cc), dn(Dd)]), l, o), sh(P([A, B, Cc, Dd]), t, o)];
  };
  const cube = (cx, cy, color, h, o, z) => { const k = tone(color); return block(cx, cy, CS, z || 0, h === undefined ? LV : h, k.t, k.l, k.r, o); };
  const iso = (x, y, lvl) => [(x - y) * TW / 2, (x + y) * TH / 2 - lvl * LV];
  let FL = null, FB = 0, WT = null, ROPES = {};
  // FB = base level of the field (negative when riverbeds go below level 0)
  const land = (cx, cy, h, par, top) => {
    const th = (h - FB) * LV + TK;
    if (FL && !top) return prism(cx, cy, 1, th, par ? FL.b : FL.a, FL.l, FL.r);
    const t = top || (par ? C.b : C.a), s = side(t); return prism(cx, cy, 1, th, t, s.l, s.r);
  };
  const wallDown = (a, b, top, bot, f) => sh(P([[a[0], a[1] - top], [b[0], b[1] - top], [b[0], b[1] + bot], [a[0], a[1] + bot]]), f);

  const pit = (cx, cy, o) => {
    const c = corners(cx, cy, 1), s = FL ? { l: FL.l, r: FL.r } : side(C.a), out = [];
    if (o.nw !== 'p') out.push(wallDown(c.W, c.N, (typeof o.nw === 'number' ? o.nw : 0) * LV, D, s.r));
    if (o.ne !== 'p') out.push(wallDown(c.N, c.E, (typeof o.ne === 'number' ? o.ne : 0) * LV, D, s.l));
    out.push(plate(cx, cy + D, 1, C.pitFloor));
    if (o.fl) out.push(wallDown(c.W, c.S, 0, D, s.l));
    if (o.fr) out.push(wallDown(c.S, c.E, 0, D, s.r));
    return out;
  };

  const hole = (cx, cy) => [plate(cx, cy, 0.62, C.hole), plate(cx, cy + 2, 0.46, C.holeIn)];
  // box as in the current game: one plain yellow cube (top, left, right only)
  const box = (cx, cy, z) => cube(cx, cy, C.yellow, LV, 1, z);

  const swamp = (cx, cy, h, par, st) => {
    const out = land(cx, cy, h, par), s = 0.8, k = 5, c = corners(cx, cy, s);
    if (st === 'filled') {
      out.push(plate(cx, cy, s, tone(C.yellow).t));
      out.push(plate(cx, cy, s * 0.52, mix(C.yellow, '#000000', 0.13)));
      return out;
    }
    out.push(wallDown(c.W, c.N, 0, k, C.mudWall));
    out.push(wallDown(c.N, c.E, 0, k, mix(C.mudWall, '#000000', 0.1)));
    out.push(plate(cx, cy + k, s, C.mud));
    if (st === 'empty') {
      [[-0.2, 0.14], [0.17, -0.12], [0.06, 0.22]].forEach(q => {
        const p = pt(cx, cy + k, q[0], q[1]);
        out.push(...block(p[0], p[1], 0.09, 0, 2.5, C.mudLump, mix(C.mudLump, '#000000', 0.18), mix(C.mudLump, '#000000', 0.08)));
      });
    } else {
      const sink = st === 'half' ? 6 : 13;
      out.push(plate(cx, cy + k, st === 'half' ? 0.66 : 0.72, C.mudCollar));
      out.push(...cube(cx, cy + k, C.blue, LV - sink));
    }
    return out;
  };

  const MUSH = {
    idle: { st: 14, cs: 0.48, ct: 6, d: 3 }, pressed: { st: 9, cs: 0.54, ct: 5, d: 2 }, spring: { st: 18, cs: 0.44, ct: 6, d: 3 },
    occupied: { st: 2, cs: 0.66, ct: 3, d: 0 },
    wilting: { st: 8, cs: 0.5, ct: 4, d: 2, w: 0.5 },
    withered: { st: 3, cs: 0.56, ct: 3, d: 2, w: 1 }
  };
  const wither = w => ({
    t: mix(C.capT, C.stemL, 0.9 * w), l: mix(C.capL, mix(C.stemL, '#000000', 0.12), 0.9 * w), r: mix(C.capR, C.stemL, 0.9 * w),
    s: mix(C.stemT, C.stemL, 0.5 * w)
  });
  const mushroom = (cx, cy, st) => {
    const S = MUSH[st] || MUSH.idle, out = [], k = wither(S.w || 0);
    out.push(plate(cx, cy, 0.4, mix(C.a, '#000000', 0.08)));
    out.push(...block(cx, cy, 0.2, 0, S.st, k.s, C.stemL, C.stemR));
    const c = S.du ? pt(cx, cy, S.du, -S.du) : [cx, cy], z = S.st - (S.dz || 0);
    out.push(...block(c[0], c[1], S.cs, z, S.ct, k.t, k.l, k.r));
    if (S.d) out.push(...block(c[0], c[1], S.cs * 0.6, z + S.ct, S.d, mix(k.t, '#FFFFFF', 0.12), k.l, k.r));
    return { shapes: out, top: z + S.ct + S.d };
  };

  // leaf: flat kite on the top plane. base (u,v), direction (du,dv) in tile units
  const leaf = (cx, cy, u, v, du, dv, z, f, wd) => {
    const L = Math.hypot(du, dv) || 1, w = wd || 0.1, nu = -dv / L * w, nv = du / L * w;
    const q = [[u, v], [u + du * 0.45 + nu, v + dv * 0.45 + nv], [u + du, v + dv], [u + du * 0.45 - nu, v + dv * 0.45 - nv]];
    return sh(P(q.map(p => pt(cx, cy, p[0], p[1], z))), f);
  };
  const SW = 0.045, SZ = 2;
  const stemSeg = (cx, cy, dir, half, z) => {
    // half: 'in' = entry edge → centre, 'out' = centre → exit edge
    const a = half === 'in' ? -0.5 : -SW, b = half === 'in' ? SW : 0.5;
    return dir === 'x'
      ? box3(cx, cy, a, b, -SW, SW, z, SZ, C.vStemT, C.stemSL, C.stemSR)
      : box3(cx, cy, -SW, SW, a, b, z, SZ, C.vStemT, C.stemSL, C.stemSR);
  };
  // four small leaves per cell, alternating sides; (a = along stem, b = across)
  const LEAVES = { in: [[-0.34, 1], [-0.08, -1]], out: [[0.26, 1]] };
  const leafFor = (cx, cy, dir, half, z, f) => LEAVES[half].map(([a, s]) => dir === 'x'
    ? leaf(cx, cy, a, s * SW, 0.1, s * 0.22, z, f, 0.1)
    : leaf(cx, cy, s * SW, a, s * 0.22, 0.1, z, f, 0.1));
  const nodeAt = (cx, cy, dir, a) => {
    const w = 0.035, h = SW + 0.025, top = mix(C.vStemT, '#000000', 0.18);
    return dir === 'x'
      ? box3(cx, cy, a - w, a + w, -h, h, SZ + 1, SZ + 1, top, C.stemSL, C.stemSR)
      : box3(cx, cy, -h, h, a - w, a + w, SZ + 1, SZ + 1, top, C.stemSL, C.stemSR);
  };
  const sproutAt = (cx, cy, h, big) => {
    const out = [], s = 0.04;
    out.push(...box3(cx, cy, -0.09, 0.09, -0.09, 0.09, 2, 2, C.sprout, mix(C.sprout, '#000000', 0.18), mix(C.sprout, '#000000', 0.08)));
    out.push(...box3(cx, cy, -s, s, -s, s, h, h - 2, C.vStemT, C.stemSL, C.stemSR));
    const k = big ? 0.24 : 0.22;
    out.push(leaf(cx, cy, 0, 0, k, -k * 0.35, h, C.sprout, 0.11));
    out.push(leaf(cx, cy, 0, 0, -k * 0.35, k, h, C.sprout, 0.11));
    return out;
  };
  const vineCell = (cx, cy, cd) => {
    const out = [], dIn = cd.dir || 'x', dOut = cd.turn || dIn;
    if (cd.st === 'grown') {
      const H = cd.hard, lf = H ? C.leafH : C.leaf, z = SZ;
      out.push(...prism(cx, cy, 1, TK, H ? C.vineHT : C.vineT, H ? C.vineHL : C.vineL, H ? C.vineHR : C.vineR));
      out.push(...leafFor(cx, cy, dIn, 'in', 0.5, lf));
      if (!cd.knot) out.push(...leafFor(cx, cy, dOut, 'out', 0.5, lf));
      else out.push(leafFor(cx, cy, dOut, 'out', 0.5, lf)[0]);
      out.push(...stemSeg(cx, cy, dIn, 'in', z));
      out.push(...nodeAt(cx, cy, dIn, -0.26));
      if (cd.knot) {
        const b = dOut === 'x' ? [0.12, 0.42, -0.13, 0.13] : [-0.13, 0.13, 0.12, 0.42];
        out.push(...stemSeg(cx, cy, dOut, 'out', z).slice(0, 0));
        out.push(...box3(cx, cy, dOut === 'x' ? -SW : -SW, dOut === 'x' ? 0.14 : SW, dOut === 'x' ? -SW : -SW, dOut === 'x' ? SW : 0.14, z, SZ, C.vStemT, C.stemSL, C.stemSR));
        out.push(...box3(cx, cy, b[0], b[1], b[2], b[3], 8, 8, C.bud, C.budL, C.budR));
      } else {
        out.push(...stemSeg(cx, cy, dOut, 'out', z));
        out.push(...nodeAt(cx, cy, dOut, 0.22));
      }
      return out;
    }
    if (cd.st === 'spent') return [];
    const sk = pt(cx, cy + D, -0.25, -0.25);
    if (cd.st === 'future') return sproutAt(sk[0], sk[1], 14, false);
    out.push(...sproutAt(sk[0], sk[1], 24, true));
    if (cd.from === 'x') { out.push(...box3(cx, cy, -0.5, -0.3, -SW, SW, SZ, SZ, C.vStemT, C.stemSL, C.stemSR)); out.push(leaf(cx, cy, -0.42, SW, 0.08, 0.16, 0.5, C.sprout)); }
    if (cd.from === 'y') { out.push(...box3(cx, cy, -SW, SW, -0.5, -0.3, SZ, SZ, C.vStemT, C.stemSL, C.stemSR)); out.push(leaf(cx, cy, SW, -0.42, 0.16, 0.08, 0.5, C.sprout)); }
    return out;
  };
  const root = (cx, cy, dir) => {
    const out = [];
    if (dir === 'y') {
      out.push(leaf(cx, cy, -SW, 0.3, -0.18, 0.06, 0.5, C.leaf));
      out.push(...box3(cx, cy, -SW, SW, 0.2, 0.5, SZ, SZ, C.vStemT, C.stemSL, C.stemSR));
      out.push(...box3(cx, cy, -0.12, 0.12, 0.12, 0.3, 6, 6, C.vStemT, C.stemSL, C.stemSR));
    } else {
      out.push(leaf(cx, cy, 0.3, -SW, 0.06, -0.18, 0.5, C.leaf));
      out.push(...box3(cx, cy, 0.2, 0.5, -SW, SW, SZ, SZ, C.vStemT, C.stemSL, C.stemSR));
      out.push(...box3(cx, cy, 0.12, 0.3, -0.12, 0.12, 6, 6, C.vStemT, C.stemSL, C.stemSR));
    }
    return out;
  };
  const railCell = (cx, cy, cd) => {
    const out = box3(cx, cy + D, -0.5, 0.5, -0.12, 0.12, 0, 1, cd.next ? C.railNext : C.railC, C.railC, C.railC);
    if (cd.plate) {
      out.push(plate(cx, cy + D, 0.56, '#8F8C86'));
      out.push(...prism(cx, cy + 9, 0.56, D - 9, C.skirt, mix(C.skirt, '#000000', 0.08), C.skirt));
      out.push(...prism(cx, cy, 0.9, 9, C.tramT, C.tramL, C.tramR));
    }
    return out;
  };

  const seed = (cx, cy, z) => {
    const k = tone(C.yellow);
    return block(cx, cy, 0.24, z, 7, k.t, k.l, k.r).concat(block(cx, cy, 0.13, z + 7, 4, mix(k.t, '#FFFFFF', 0.1), k.l, k.r));
  };
  // sapling on the right corner (E), rooted in a small 2px soil spot with the yellow husk half-buried.
  // 3 = cotyledons 12px, 2 = stem + crown 21px, 1 = branched tree 28px (< one level)
  const SAPU = 0.36;
  const sapling = (cx, cy, left) => {
    const b = pt(cx, cy, SAPU, -SAPU), X = b[0], Y = b[1], out = [], k = tone(C.yellow), g = 2;
    const sL = mix(C.sapStem, '#000000', 0.2), sR = mix(C.sapStem, '#000000', 0.08);
    const lf = (u0, u1, v0, v1, z, th) => box3(X, Y, u0, u1, v0, v1, z + g, th, C.sapLeaf, mix(C.sapLeaf, '#000000', 0.22), mix(C.sapLeaf, '#000000', 0.09));
    const st = (z0, z1) => box3(X, Y, -0.022, 0.022, -0.022, 0.022, z1 + g, z1 - z0, C.sapStem, sL, sR);
    out.push(...block(X, Y, 0.24, 0, g, C.soil, C.soilL, C.soilR));
    out.push(...box3(X, Y, -0.05, 0.05, -0.05, 0.05, 2 + g, 2, k.t, k.l, k.r));
    if (left >= 4) {
      // just planted: husk tip + a 2px green point, 7px total
      out.push(...st(1, 5), ...lf(-0.025, 0.025, -0.025, 0.025, 5, 2));
    } else if (left === 3) {
      out.push(...st(1, 8), ...lf(0.02, 0.13, -0.04, 0.04, 10, 2), ...lf(-0.04, 0.04, -0.13, -0.02, 10, 2));
    } else if (left === 2) {
      out.push(...st(1, 17), ...lf(-0.035, 0.035, -0.12, -0.02, 13, 2), ...lf(0.02, 0.12, -0.035, 0.035, 10, 2), ...lf(-0.07, 0.07, -0.07, 0.07, 19, 4));
    } else {
      out.push(...st(1, 22));
      out.push(...box3(X, Y, -0.1, -0.02, -0.015, 0.015, 20 + g, 2, C.sapStem, sL, sR), ...box3(X, Y, 0.02, 0.1, -0.015, 0.015, 17 + g, 2, C.sapStem, sL, sR));
      out.push(...lf(-0.17, -0.03, -0.07, 0.07, 24, 5), ...lf(-0.07, 0.07, -0.07, 0.07, 26, 5), ...lf(0.03, 0.17, -0.07, 0.07, 21, 5));
    }
    return out;
  };
  // raised seed land keeps two low leaves on the right corner where the tree stood (3px, no husk, no soil)
  const seedLeaves = (cx, cy) => {
    const b = pt(cx, cy, SAPU, -SAPU), X = b[0], Y = b[1], l = mix(C.sapLeaf, '#000000', 0.22), rr = mix(C.sapLeaf, '#000000', 0.09);
    return box3(X, Y, -0.035, 0.035, -0.13, 0.0, 3, 3, C.sapLeaf, l, rr).concat(box3(X, Y, 0.0, 0.13, -0.035, 0.035, 3, 3, C.sapLeaf, l, rr));
  };
  const planted = (cx, cy, left, rider) => {
    const out = [], mh = { 1: 8, 2: 5, 3: 3 }[left] || 3, k = tone(C.yellow);
    // one seed per tile: planted at the right corner, the sapling grows straight out of that spot
    out.push(...sapling(cx, cy, left));
    // rider before stakes: stakes sit in front of the cube footprint and must stay on top
    if (rider === 'cube') out.push(...cube(cx, cy, C.blue));
    if (rider === 'box') out.push(...box(cx, cy, 0));
    const base = pt(cx, cy, 0.34, 0.34), gap = 8; // stakes 4.2px wide, 3.8px apart; four span 28px inside the ±16px front corner
    for (let i = 0; i < left; i++) {
      const dx = (i - (left - 1) / 2) * gap;
      out.push(...block(base[0] + dx, base[1], 0.04, 0, 6, k.t, k.l, k.r));
    }
    return out;
  };
  // boss beanstalk: stem up the middle of the left face; growing = sprout at the top edge, done = bud
  const stalk = (cx, cy, lv, done) => {
    const out = [], H = lv * LV, w = 0.045;
    const a = pt(cx, cy, 0.5, -SAPU + w), b = pt(cx, cy, 0.5, -SAPU - w);
    out.push(sh(P([a, b, [b[0], b[1] + H], [a[0], a[1] + H]]), C.vStemT));
    for (let i = 0; ; i++) {
      const y0 = 9 + i * 15; if (y0 > H - 5) break;
      const s = i % 2 ? 1 : -1, bs = s > 0 ? b : a, bx = bs[0], by = bs[1] + y0, dx = s * 10, dy = -s * 5;
      out.push(sh(P([[bx, by], [bx + dx * 0.5, by + dy * 0.5 - 3.5], [bx + dx, by + dy - 1], [bx + dx * 0.5, by + dy * 0.5 + 1.5]]), C.leaf));
    }
    if (done) out.push(...box3(cx, cy, 0.3, 0.48, -SAPU - 0.1, -SAPU + 0.1, 7, 7, C.bud, C.budL, C.budR));
    // growing: the top is the planted sapling itself (drawn by 'planted')
    return out;
  };


  // ---------------- CHAPTER 3 · water ----------------
  // world palettes (light / mid / more): same oklch chroma as CHAPTER 2 (×0.65 / ×1 / ×1.3), hue 200.
  // water hue 182 (green-teal, away from the cube at 235), ice hue 224. All faces opaque.
  const CH3 = {"light":{"bg":"#DDE6E7","panel":"#E9F0F1","card":"#F0F6F7","locked":"#E2EAEB","hover":"#E1E9EA","a":"#E3ECEC","b":"#DCE5E6","l":"#B7C2C2","r":"#CBD5D5","d1":"#C3D8D4","d2":"#ABC0BC","d3":"#94A8A4","wl":"#7B8E8A","wr":"#93A6A2","refl":"#E5EFED","iceT":"#E3F7FF","iceL":"#ACC2CB","iceR":"#C8DDE6","gloss":"#FFFFFF"},"mid":{"bg":"#D9E7E8","panel":"#E6F1F2","card":"#EDF7F8","locked":"#DFEBEC","hover":"#DEEAEB","a":"#DFEDEE","b":"#D9E7E7","l":"#B3C3C4","r":"#C7D6D7","d1":"#C1D9D4","d2":"#A9C0BC","d3":"#92A9A4","wl":"#7A8E8A","wr":"#92A7A2","refl":"#E5F0ED","iceT":"#E2F8FF","iceL":"#AAC2CC","iceR":"#C6DEE7","gloss":"#FFFFFF"},"more":{"bg":"#D6E8E9","panel":"#E3F2F3","card":"#EBF8F9","locked":"#DCECED","hover":"#DBEBEC","a":"#DCEEEF","b":"#D5E8E8","l":"#AFC4C5","r":"#C3D7D8","d1":"#C0D9D4","d2":"#A8C1BC","d3":"#91A9A4","wl":"#798F8A","wr":"#91A7A3","refl":"#E4F0ED","iceT":"#E0F8FF","iceL":"#A8C3CD","iceR":"#C5DEE8","gloss":"#FFFFFF"}};
  const STONE = {"t":"#EBF1F4","t2":"#F3F8FA","l":"#96A0A5","r":"#BCC6CA"};
  const WS = 6;      // water surface sits 6px below the top of land at the same level (bank lip)
  const DIP = 24;    // floating box sinks 24px: 6px above the surface = top level with the surrounding land
  const uvq = (cx, cy, u0, u1, v0, v1, f, z) => sh(P([pt(cx, cy, u0, v0, z), pt(cx, cy, u1, v0, z), pt(cx, cy, u1, v1, z), pt(cx, cy, u0, v1, z)]), f);
  const uvpoly = (cx, cy, pts, f, o) => sh(P(pts.map(p => pt(cx, cy, p[0], p[1]))), f, o);
  const wdepth = d => d <= 1.25 ? 'd1' : d <= 2.25 ? 'd2' : 'd3';
  const ringAt = (cx, cy, s, w, f, inner, o) => [plate(cx, cy, s, f, o), plate(cx, cy, Math.max(0.02, s - w), inner, o)];
  // whirlpool: three comet blades spiralling in; thin tail outside, thick head inside = direction of turn
  const circ = (r0, ou, ov, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([ou + r0 * Math.cos(a), ov + r0 * Math.sin(a)]); } return o; };
  // bowl (recommended): three nested discs deepen toward the eye, each offset along the turn, with one
  // reflection crescent per ring wrapping in the turning direction
  // occupied (a floating box sits on it): rings open out to the cell edge so the outer ring and crescents show around the box
  const whirlBowl = (cx, cy, dir, ph, pal, occ) => {
    const s = dir === 'ccw' ? -1 : 1, p0 = (ph || 0) * Math.PI / 180, out = [plate(cx, cy, 0.96, pal.d1)];
    const rings = occ ? [[0.5, mix(pal.d1, pal.d2, 0.6)], [0.4, pal.d2], [0.2, mix(pal.d2, pal.d3, 0.6)], [0.08, pal.d3]]
      : [[0.44, mix(pal.d1, pal.d2, 0.5)], [0.31, pal.d2], [0.18, mix(pal.d2, pal.d3, 0.6)], [0.08, pal.d3]];
    rings.forEach(([rr, f], k) => {
      const a = p0 + s * k * 0.9, ou = 0.035 * k * Math.cos(a), ov = 0.035 * k * Math.sin(a);
      out.push(uvpoly(cx, cy, circ(rr, ou, ov, 0, Math.PI * 2, 28), f));
      if (occ && k === 0) {
        // occupied: all three crescents ride the outer ring, outside the box footprint (|u|,|v| > 0.29)
        for (let j = 0; j < 3; j++) {
          const a0 = p0 + j * 2.094, o = [], n = [];
          for (let i = 0; i <= 12; i++) { const t = i / 12, aa = a0 + s * 1.5 * t, w = 0.17 * Math.pow(t, 0.75) * (t > 0.9 ? (1 - t) / 0.1 : 1);
            o.push([rr * Math.cos(aa), rr * Math.sin(aa)]); n.unshift([(rr - w) * Math.cos(aa), (rr - w) * Math.sin(aa)]); }
          out.push(uvpoly(cx, cy, o.concat(n), pal.refl));
        }
      }
      if (k < 3 && !occ) {
        const a0 = p0 + k * 2.1, span = 2.2, o = [], n = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12, aa = a0 + s * span * t, w = 0.115 * Math.pow(t, 0.75) * (t > 0.92 ? (1 - t) / 0.08 : 1);
          o.push([ou + rr * Math.cos(aa), ov + rr * Math.sin(aa)]); n.unshift([ou + (rr - w) * Math.cos(aa), ov + (rr - w) * Math.sin(aa)]); }
        out.push(uvpoly(cx, cy, o.concat(n), pal.refl));
      }
    });
    return out;
  };
  // spiral: two reflection arms winding 1.3 turns into the eye, thick outside, thin inside
  const whirlSpiral = (cx, cy, dir, ph, pal) => {
    const s = dir === 'ccw' ? -1 : 1, p0 = (ph || 0) * Math.PI / 180, out = [plate(cx, cy, 0.96, pal.d2), plate(cx, cy, 0.2, pal.d3)];
    for (let k = 0; k < 2; k++) {
      const o = [], n = [];
      for (let i = 0; i <= 26; i++) { const t = i / 26, a = p0 + k * Math.PI + s * t * Math.PI * 2.6, rr = 0.46 - 0.36 * t, w = 0.09 * (1 - t) + 0.015;
        o.push([rr * Math.cos(a), rr * Math.sin(a)]); n.unshift([(rr - w) * Math.cos(a), (rr - w) * Math.sin(a)]); }
      out.push(uvpoly(cx, cy, o.concat(n), pal.refl));
    }
    return out;
  };
  const whirl = (cx, cy, dir, ph, pal, style, occ) => style === 'comet' ? whirlComet(cx, cy, dir, ph, pal) : style === 'spiral' ? whirlSpiral(cx, cy, dir, ph, pal) : whirlBowl(cx, cy, dir, ph, pal, occ);
  const whirlComet = (cx, cy, dir, ph, pal) => {
    const s = dir === 'ccw' ? -1 : 1, out = [plate(cx, cy, 0.96, pal.d2), plate(cx, cy, 0.24, pal.d3)];
    for (let k = 0; k < 3; k++) {
      const a0 = (k * 120 + (ph || 0)) * Math.PI / 180, o = [], n = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, a = a0 + s * t * 1.5, rr = 0.44 - 0.18 * t, w = 0.15 * Math.pow(t, 0.7);
        o.push([rr * Math.cos(a), rr * Math.sin(a)]); n.unshift([(rr - w) * Math.cos(a), (rr - w) * Math.sin(a)]);
      }
      out.push(uvpoly(cx, cy, o.concat(n), pal.refl));
    }
    return out;
  };
  // ice stone: wider, lower and stepped (14 + 8 + 4 = 26px) so it never reads as the 30px yellow box
  const stone = (cx, cy, z, cut) => {
    z = z || 0; const t1 = Math.max(2, 14 - (cut || 0));
    return block(cx, cy, 0.64, z, t1, STONE.t, STONE.l, STONE.r)
      .concat(block(cx, cy, 0.48, z + t1, 8, STONE.t2, STONE.l, STONE.r))
      .concat(block(cx, cy, 0.28, z + t1 + 8, 4, '#FFFFFF', STONE.l, STONE.r));
  };
  const frost = (cx, cy, pal) => plate(cx, cy, 0.9, mix(FL ? FL.a : C.a, pal.iceT, 0.55));
  // yellow switch (CHAPTER 1) and the water-level switch: same yellow plate, the level switch holds a little pool
  // switch as in the current game: one yellow plate, 0.66 of the tile, rising from the floor
  const sw = (cx, cy, pressed) => { const k = tone(C.yellow); return block(cx, cy, 0.66, 0, pressed ? 1 : 4, k.t, k.l, k.r); };
  // level switch: the top stays the plain yellow plate (0.66); water is shown under / around it.
  // 'band'  (가): water-coloured band 6px on the plate sides under 2px of yellow. pressed: yellow 1px, band rises to 6px above floor too (plate sits higher on the water)
  // 'pool'  (나, recommended): the plate floats on a shallow pool (0.86, sunk 3px into the floor). pressed: pool fills up flush, plate rises 3px with it
  // 'rim'   (다): a flat water-coloured rim (0.86) around the plate on the floor. pressed: rim turns light (refl) and rises 2px
  const lsw = (cx, cy, pressed, pal, v) => {
    const k = tone(C.yellow), out = [];
    if (v === 'band') {
      const wb = 6, yt = pressed ? 1 : 2, lift = pressed ? 2 : 0;
      out.push(...block(cx, cy, 0.66, 0, wb + lift, pressed ? pal.d1 : pal.d2, pressed ? mix(pal.wl, '#FFFFFF', 0.25) : pal.wl, pressed ? mix(pal.wr, '#FFFFFF', 0.25) : pal.wr));
      out.push(...block(cx, cy, 0.66, wb + lift, yt, k.t, k.l, k.r));
      return out;
    }
    if (v === 'rim') {
      const rz = pressed ? 2 : 0;
      if (rz) out.push(...block(cx, cy, 0.86, 0, rz, pal.refl, pal.wl, pal.wr)); else out.push(plate(cx, cy, 0.86, pal.d2));
      out.push(...block(cx, cy, 0.66, rz, pressed ? 1 : 4, k.t, k.l, k.r));
      return out;
    }
    // pool
    const c = corners(cx, cy, 0.86), dep = pressed ? 0 : 3;
    if (dep) { out.push(wallDown(c.W, c.N, 0, dep, FL ? FL.r : C.b), wallDown(c.N, c.E, 0, dep, FL ? FL.l : C.b)); }
    out.push(plate(cx, cy + dep, 0.86, pressed ? pal.d1 : pal.d2));
    out.push(plate(cx, cy + dep, 0.76, pressed ? mix(pal.d1, pal.refl, 0.5) : mix(pal.d2, pal.d1, 0.5)));
    out.push(...block(cx, cy + dep, 0.66, 0, pressed ? 4 : 3, k.t, k.l, k.r));
    return out;
  };
  // mooring post: a small dark post with 1 or 2 light bands (tells boats apart)
  const POST = { t: '#9A968E', l: '#6F6C66', r: '#85827B', band: '#F2F1EE', rope: '#7E7A72' };
  const post = (cx, cy, bands) => {
    const out = block(cx, cy, 0.16, 0, 18, POST.t, POST.l, POST.r);
    for (let i = 0; i < (bands || 1); i++) out.push(...block(cx, cy, 0.165, 8 + i * 5, 2, POST.t, POST.band, POST.band));
    out.push(plate(cx, cy - 18, 0.16, POST.t));
    return out;
  };
  const ladderFlat = (cx, cy) => {
    const k = tone(C.yellow), out = [];
    [-0.16, 0.16].forEach(v => out.push(...box3(cx, cy, -0.4, 0.4, v - 0.03, v + 0.03, 3, 3, k.t, k.l, k.r)));
    [-0.24, 0, 0.24].forEach(u => out.push(...box3(cx, cy, u - 0.03, u + 0.03, -0.13, 0.13, 4, 1, k.t, k.l, k.r)));
    return out;
  };
  const crack = (cx, cy) => {
    const f = mix(FL ? FL.l : C.a, '#000000', 0.25);
    return [[[0.02, -0.03], [-0.02, 0.03], [-0.36, 0.12]], [[-0.03, -0.02], [0.03, 0.02], [0.14, -0.36]], [[-0.02, 0.0], [0.03, 0.02], [0.24, 0.22]]].map(q => uvpoly(cx, cy, q, f));
  };
  const floatBox = (X, Y, o, pal, kind) => {
    const out = [], dip = DIP + (o.dip || 0);
    if (o.ring) out.push(...ringAt(X, Y, o.ring, 0.07, pal.refl, o.top, o.ro));
    if (!o.noCollar) out.push(plate(X, Y, CS * 1.3, pal.refl));
    if (kind === 'stone') out.push(...stone(X, Y, 0, 8));
    else out.push(...cube(X, Y, C.yellow, LV - dip));
    if (o.rider) out.push(...cube(X, Y, C.blue, LV, 1, LV - dip + (o.hop || 0)));
    return out;
  };
  // one cell under water. cy0 = screen y of level 0 at this cell.
  const waterCell = (x, y, cx, cy0, h, par, cd, V, list) => {
    const pal = WT.pal, Zw = WT.Z, d = WT.W - h, top = pal[wdepth(d)], cyS = cy0 - Zw, out = [];
    out.push(...land(cx, cy0 - h * LV, h, par));
    out.push(...prism(cx, cyS, 1, Zw - h * LV, top, pal.wl, pal.wr));
    // sunk land: the tile shows through, fainter with depth. riverbeds (h < 0) show nothing.
    if (h >= 0 && !(cd && cd.bed)) out.push(plate(cx, cyS, 0.8, mix(top, FL ? FL.a : C.a, d <= 1.25 ? 0.4 : d <= 2.25 ? 0.22 : 0.1)));
    const dry = (nx, ny) => { const v = V(nx, ny); return typeof v === 'number' && v > WT.W - 0.2; };
    // bank reflection: a light strip along every far edge that touches dry land
    if (dry(x - 1, y)) out.push(uvq(cx, cyS, -0.5, -0.37, -0.5, 0.5, pal.refl));
    if (dry(x, y - 1)) out.push(uvq(cx, cyS, -0.5, 0.5, -0.5, -0.37, pal.refl));
    if (cd && cd.rip) { const q = pt(cx, cyS, cd.rip.u || 0, cd.rip.v || 0); out.push(...ringAt(q[0], q[1], cd.rip.s, 0.06, pal.refl, top, cd.rip.o)); }
    // on a whirl cell a floating box's collar goes under the whirl (collar → whirl → box) so the rings stay visible
    const onWhirl = cd && cd.t === 'whirl';
    // a box centred on the whirl drops its collar; the opened rings take its place
    const occ = onWhirl && list.some(o => (o.t === 'fbox' || o.t === 'fstone') && Math.abs(o.u || 0) < 0.2 && Math.abs(o.v || 0) < 0.2);
    if (onWhirl) out.push(...whirl(cx, cyS, cd.dir, cd.ph, pal, cd.style, occ));
    if (WT.range && WT.range[x + ',' + y]) out.push(plate(cx, cyS, 0.9, mix(top, pal.refl, 0.42 * WT.range[x + ',' + y])));
    let surf = null;
    if (cd && cd.t === 'ice') {
      const iz = (cd.lv === undefined ? WT.W : cd.lv) * LV - WS + 4;
      if (iz < Zw) out.push(plate(cx, cyS, 0.92, mix(pal.iceT, top, 0.5)));   // ice left below the new surface
      else {
        const p = cd.p === undefined ? 1 : cd.p, f = cd.from || 'x-';
        let u0 = -0.5, u1 = 0.5, v0 = -0.5, v1 = 0.5;
        if (f === 'x-') u1 = -0.5 + p; if (f === 'x+') u0 = 0.5 - p; if (f === 'y-') v1 = -0.5 + p; if (f === 'y+') v0 = 0.5 - p;
        out.push(...box3(cx, cy0, u0, u1, v0, v1, iz, iz - Zw, pal.iceT, pal.iceL, pal.iceR));
        if (p >= 1) out.push(uvq(cx, cy0, -0.34, 0.12, -0.2, -0.165, pal.gloss, iz));
        if (p >= 0.5) surf = cy0 - iz;
      }
    }
    if (ROPES[x + ',' + y]) out.push(...ROPES[x + ',' + y]);
    for (const o of list) {
      if (surf !== null && !o.float) { out.push(...obj(o, cx, surf)); continue; }
      const q = pt(cx, cyS, o.u || 0, o.v || 0), X = q[0], Y = q[1] - (o.lift || 0);
      if (o.t === 'fbox') { out.push(...floatBox(X, Y, Object.assign({ top, noCollar: onWhirl }, o), pal, 'box')); continue; }
      if (o.t === 'fstone') { out.push(...floatBox(X, Y, Object.assign({ top, noCollar: onWhirl }, o), pal, 'stone')); continue; }
      if (o.t === 'cube' && o.air !== undefined) { out.push(...cube(X, Y, C.blue, LV, 1, o.air)); continue; }
      // things standing on the sunk ground: poke out above the surface, or show through as a ghost
      const H = { box: LV, cube: LV, stone: 26, sw: 4, lsw: 4 }[o.t] || LV, col = { box: C.yellow, cube: C.blue, stone: STONE.t, sw: C.yellow, lsw: C.yellow }[o.t] || C.yellow;
      const vis = h * LV + H - Zw;
      if (vis > 0) { out.push(plate(X, Y, CS * 1.25, pal.refl)); out.push(...cube(X, Y, col, vis)); }
      else out.push(plate(X, Y, o.t === 'stone' ? 0.6 : o.t === 'sw' || o.t === 'lsw' ? 0.62 : CS, mix(col, top, o.t === 'cube' ? 0.45 : 0.55)));
    }
    return out;
  };
  // damp band on dry faces right above the water (ebb: where the water just was)
  const dampBand = (cx, cy0, h, pal) => {
    const Zw = WT.Z, zt = Math.min(h * LV, Zw + LV); if (zt <= Zw) return [];
    const c = corners(cx, cy0, 1), q = (a, b, f) => sh(P([[a[0], a[1] - zt], [b[0], b[1] - zt], [b[0], b[1] - Zw], [a[0], a[1] - Zw]]), f);
    return [q(c.W, c.S, mix(FL ? FL.l : C.a, pal.wl, 0.35)), q(c.S, c.E, mix(FL ? FL.r : C.a, pal.wr, 0.35))];
  };

  const obj = (o, cx, cy) => {
    switch (o.t) {
      case 'cube': { const p = pt(cx, cy, o.u || 0, o.v || 0); return cube(p[0], p[1], C.blue, LV, o.o, o.z); }
      case 'box': return box(cx, cy, o.z || 0);
      case 'hole': return hole(cx, cy);
      case 'mush': {
        const m = mushroom(cx, cy, o.st || 'idle');
        if (o.rider) m.shapes.push(...cube(cx, cy, C.blue, LV, 1, m.top + (o.lift || 0)));
        return m.shapes;
      }
      case 'seed': return seed(cx, cy, 0);
      case 'carry': return cube(cx, cy, C.blue).concat(seed(cx, cy, LV));
      case 'planted': return planted(cx, cy, o.n, o.rider);
      case 'stalk': return stalk(cx, cy, o.lv, o.done);
      case 'root': return root(cx, cy, o.dir);
      case 'stone': return (o.frost && WT ? [frost(cx, cy, WT.pal)] : []).concat(stone(cx, cy, 0));
      case 'sw': return sw(cx, cy, o.pressed);
      case 'lsw': return lsw(cx, cy, o.pressed, (WT && WT.pal) || CH3.mid, o.v);
      case 'post': return post(cx, cy, o.bands);
      case 'ladder': return ladderFlat(cx, cy);
      case 'fbox': return box(cx, cy, 0);
    }
    return [];
  };

  const scene = def => {
    const g = def.g, cells = def.cells || {}, objs = def.objs || {}, out = [], list = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] !== null) list.push({ x, y });
    list.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
    const V = (x, y) => (g[y] && g[y][x] !== undefined) ? g[y][x] : null;
    FL = def.floor || null; FB = def.base || 0;
    if (def.pal) { const pl = CH3[def.pal]; if (!FL) FL = { a: pl.a, b: pl.b, l: pl.l, r: pl.r }; }
    WT = def.W !== undefined ? { W: def.W, Z: def.W * LV - WS, pal: CH3[def.pal || 'mid'] } : null;
    // ropes: post head → boat. drawn inside the boat's water cell before the boat, so a rider cube covers the end.
    // slack ropes sag 7px, taut ropes are straight.
    ROPES = {};
    if (WT) {
    (def.ropes || []).forEach(rp => {
      // posts behind the boat: draw in the boat's cell (rider covers the end). posts in front: draw last.
      const bk = (rp.p[0] + rp.p[1]) > (rp.b[0] + rp.b[1]) ? '__last' : rp.b[0] + ',' + rp.b[1];
      const ph = g[rp.p[1]][rp.p[0]], a0 = iso(rp.p[0], rp.p[1], ph), A = [a0[0], a0[1] - 16];
      const b0 = iso(rp.b[0], rp.b[1], 0), bz = WT.Z + (LV - DIP) - (rp.dip || 0);
      let B = pt(b0[0], b0[1] - bz, rp.bu || 0, rp.bv || 0);
      const dx = A[0] - B[0], dy = A[1] - B[1], L0 = Math.hypot(dx, dy) || 1;
      B = [B[0] + dx / L0 * 15, B[1] + dy / L0 * 9 - 2];
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + (rp.taut ? 0 : 7 * Math.sin(Math.PI * t))]); }
      const w = 1.1, up = pts.map(p => [p[0], p[1] - w]), dn = pts.map(p => [p[0], p[1] + w]).reverse();
      (ROPES[bk] = ROPES[bk] || []).push(sh(P(up.concat(dn)), POST.rope));
    });
    }
    if (WT && def.moor) {
      WT.range = {};
      def.moor.forEach(m => { if (m.show === false) return; for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
        const d = Math.abs(x - m.p[0]) + Math.abs(y - m.p[1]); if (d > 0 && d <= m.L) WT.range[x + ',' + y] = Math.min(1, (WT.range[x + ',' + y] || 0) + (m.strong ? 1 : 0.6));
      } });
    }
    for (const c of list) {
      const v = g[c.y][c.x], isP = v === 'p', h = isP ? 0 : v, p = iso(c.x, c.y, h), cx = p[0], cy = p[1];
      const par = (c.x + c.y) % 2, key = c.x + ',' + c.y, cd = cells[key];
      if (WT && !isP && h < WT.W - 0.2) {
        const p0 = iso(c.x, c.y, 0);
        out.push(...waterCell(c.x, c.y, p0[0], p0[1], h, par, cd, V, objs[key] || []));
        continue;
      }
      if (isP) {
        const grown = cd && ((cd.t === 'vine' && cd.st === 'grown') || cd.t === 'filled');
        out.push(...pit(cx, cy, {
          nw: V(c.x - 1, c.y), ne: V(c.x, c.y - 1),
          fl: !grown && V(c.x, c.y + 1) === null, fr: !grown && V(c.x + 1, c.y) === null
        }));
        if (cd && cd.t === 'vine') out.push(...vineCell(cx, cy, cd));
        if (cd && cd.t === 'rail') out.push(...railCell(cx, cy, cd));
        if (cd && cd.t === 'filled') { const k = tone(C.yellow); out.push(...prism(cx, cy, 1, TK, k.t, k.l, k.r)); }
      } else if (cd && cd.t === 'swamp') {
        out.push(...swamp(cx, cy, h, par, cd.st));
      } else if (def.grown && def.grown[key]) {
        // seed-raised layers sit on top of the original ground; the seam shows where the side colour changes
        const gk = def.grown[key];
        out.push(...land(cx, cy + gk * LV, h - gk, par));
        out.push(...prism(cx, cy, 1, gk * LV, C.seedLandT, C.seedLandL, C.seedLandR));
        // leaves hide while a new seed grows here (planted) or on boss stalks (sapling / bud take the corner)
        if (!(objs[key] || []).some(o => o.t === 'planted' || o.t === 'stalk')) out.push(...seedLeaves(cx, cy));
      } else {
        out.push(...land(cx, cy, h, par));
        if (cd && cd.t === 'crack') out.push(...crack(cx, cy));
        if (def.damp && def.damp.tops && def.damp.tops.includes(key)) out.push(plate(cx, cy, 1, mix(par ? FL.b : FL.a, WT.pal.d1, 0.45)));
        if (def.damp && def.damp.band && WT) out.push(...dampBand(cx, iso(c.x, c.y, 0)[1], h, WT.pal));
      }
      for (const o of (objs[key] || [])) out.push(...obj(o, cx, cy));
    }
    if (ROPES.__last) out.push(...ROPES.__last);
    FL = null; FB = 0; WT = null;
    return out;
  };

  const fit = (shapes, pad) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    shapes.forEach(s => s.d.split(' ').forEach(t => {
      const v = t.split(','), x = +v[0], y = +v[1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }));
    const q = pad === undefined ? 12 : pad;
    return [x0 - q, y0 - q, x1 - x0 + q * 2, y1 - y0 + q * 2].map(Math.round).join(' ');
  };

  const mixed = () => ({
    g: [[1, 1, 1, 0, 0], [1, 0, 'p', 'p', 'p'], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
    cells: {
      '2,1': { t: 'vine', st: 'grown' }, '3,1': { t: 'vine', st: 'next', from: 'x' }, '4,1': { t: 'vine', st: 'future' },
      '1,3': { t: 'swamp', st: 'empty' }, '2,3': { t: 'swamp', st: 'empty' }
    },
    objs: {
      '0,0': [{ t: 'hole' }], '1,1': [{ t: 'root', dir: 'x' }], '4,2': [{ t: 'mush' }],
      '0,2': [{ t: 'planted', n: 2 }], '3,4': [{ t: 'seed' }], '4,4': [{ t: 'cube' }], '3,2': [{ t: 'box' }]
    }
  });

  window.CuboundIso = { TW, TH, LV, TK, D, C, mix, tone, side, scene, fit, mixed, wither, MUSH, CH3, STONE, WS, DIP };
})();
