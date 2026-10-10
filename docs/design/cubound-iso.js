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
    out.push(plate(cx, cy + D, 1, (FL && FL.pit) || C.pitFloor));
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
  // k < 1 shrinks the stone (boss 130 melt)
  const stone = (cx, cy, z, cut, k) => {
    z = z || 0; k = k === undefined ? 1 : k; const t1 = Math.max(2, 14 - (cut || 0)) * k;
    return block(cx, cy, 0.64 * k, z, t1, STONE.t, STONE.l, STONE.r)
      .concat(block(cx, cy, 0.48 * k, z + t1, 8 * k, STONE.t2, STONE.l, STONE.r))
      .concat(block(cx, cy, 0.28 * k, z + t1 + 8 * k, 4 * k, '#FFFFFF', STONE.l, STONE.r));
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
  // whirl pull range (12월드). p = { ax:'x'|'y', sg: ±1 toward the whirl, k: cells away, st: style, o: 0..1 }
  // 가 'streak': two light current streaks per cell, wide upstream and thin toward the whirl
  // 나 'lane'  : a darker channel 0.4 wide running through the cross, continuous from cell to cell (recommended)
  // 다 'ripple': two light ripple bars across the line near each cell's whirl-side edge
  const pullMark = (cx, cy, p, top, pal) => {
    const o = p.o === undefined ? 1 : p.o, A = (t, s) => p.ax === 'x' ? [t * p.sg, s] : [s, t * p.sg], out = [];
    const poly = (pts, f) => out.push(uvpoly(cx, cy, pts.map(q => A(q[0], q[1])), f));
    if (p.st === 'lane') {
      const w = 0.2, f = mix(top, pal.d3, 0.42 * o);
      poly([[-0.5, -w], [0.5, -w], [0.5, w], [-0.5, w]], f);
      poly([[-0.5, -w], [0.5, -w], [0.5, -w + 0.035], [-0.5, -w + 0.035]], mix(top, pal.refl, 0.55 * o));
    } else if (p.st === 'ripple') {
      const f = mix(top, pal.refl, 0.8 * o);
      [[0.36, 0.26], [0.18, 0.17]].forEach(([t, h]) => poly([[t - 0.03, -h], [t + 0.03, -h], [t + 0.03, h], [t - 0.03, h]], f));
    } else {
      const f = mix(top, pal.refl, 0.8 * o);
      [[-0.15, -0.42, 0.12], [0.15, -0.12, 0.42]].forEach(([s, t0, t1]) => poly([[t0, s - 0.045], [t1, s - 0.008], [t1, s + 0.008], [t0, s + 0.045]], f));
    }
    return out;
  };
  const floatBox = (X, Y, o, pal, kind) => {
    const out = [], dip = DIP + (o.dip || 0);
    if (o.ring) out.push(...ringAt(X, Y, o.ring, 0.07, pal.refl, o.top, o.ro));
    const moat = kind === 'stone' && o.sv === 'moat', iceFloor = kind === 'stone' && (o.sv === 'shadow' || o.sv === 'rim');
    if (!o.noCollar && !moat && !iceFloor) out.push(plate(X, Y, CS * 1.3, pal.refl));
    if (kind === 'stone') {
      // floating ice stone. default: 18px above the surface. moat: the stone's own water cell turns one step darker.
      // low: lower step under water (shows through), 12px above.
      const m = o.melt || 0, k = 1 - m * 0.5, low = o.sv === 'low', cut = low ? 14 : 8 + m * 10;
      if (moat) out.push(plate(X, Y, 0.96, pal.d2), plate(X, Y, 0.82, mix(pal.d2, pal.d3, 0.4)));
      if (iceFloor) {
        // the stone's own cell is ice too (4px slab, same as the frozen ring) and travels with the stone.
        // shadow: thin darker ice line hugging the stone base. rim: darker ice band along the cell edge.
        const fs = 1 - m * 0.6;
        if (m < 1) {
          if (o.sv === 'rim') { out.push(...prism(X, Y - 4, fs, 4, mix(pal.iceT, pal.iceL, 0.3), pal.iceL, pal.iceR)); out.push(plate(X, Y - 4, fs * 0.84, pal.iceT)); }
          else { out.push(...prism(X, Y - 4, fs, 4, pal.iceT, pal.iceL, pal.iceR)); out.push(plate(X, Y - 4, 0.64 * k + 0.09, mix(pal.iceT, pal.iceL, 0.7))); }
          out.push(...stone(X, Y, 4, cut, k));
        }
        return out;
      }
      if (low) out.push(plate(X, Y, 0.74, mix(STONE.t, o.top, 0.55)));
      if (m < 1) out.push(...stone(X, Y, 0, cut, k));
      if (o.ring && moat) out.push(...ringAt(X, Y, o.ring, 0.07, pal.refl, pal.d2, o.ro));
    }
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
    if (onWhirl) out.push(...whirl(cx, cyS, 'cw', cd.ph, pal, cd.style, occ));
    if (cd && cd.plug === 'ghost') out.push(plate(cx, cyS, CS * 1.05, mix(C.yellow, top, 0.62)), plate(cx, cyS, CS * 0.62, mix(C.yellow, top, 0.72)));
    if (WT.pull && WT.pull[x + ',' + y] && !onWhirl) out.push(...pullMark(cx, cyS, WT.pull[x + ',' + y], top, pal));
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
      // boat frozen into the ice: only its top 3px shows, inside a white frost rim with a darker crack line
      if (o.frozen && surf !== null) {
        const q = pt(cx, surf, o.u || 0, o.v || 0);
        out.push(plate(q[0], q[1], CS * 1.42, mix(pal.iceT, pal.iceL, 0.45)), plate(q[0], q[1], CS * 1.3, pal.gloss));
        out.push(...cube(q[0], q[1], C.yellow, 3));
        if (o.rider) out.push(...cube(q[0], q[1], C.blue, LV, 1, 3));
        continue;
      }
      if (surf !== null && !o.float) { out.push(...obj(o, cx, surf)); continue; }
      const q = pt(cx, cyS, o.u || 0, o.v || 0), X = q[0], Y = q[1] - (o.lift || 0);
      if (o.wake) { const n = o.wake; [0.28, 0.5, 0.72].forEach((d, i) => { const w = pt(cx, cyS, (o.u || 0) - n[0] * d, (o.v || 0) - n[1] * d); out.push(plate(w[0], w[1], CS * (1.2 - i * 0.22), pal.refl, 0.75 - i * 0.22)); }); }
      if (o.t === 'fbox') { out.push(...floatBox(X, Y, Object.assign({ top, noCollar: onWhirl }, o), pal, 'box')); continue; }
      if (o.t === 'fstone') { out.push(...floatBox(X, Y, Object.assign({ top, noCollar: onWhirl }, o), pal, 'stone')); continue; }
      if (o.t === 'cube' && o.air !== undefined) { out.push(...cube(X, Y, C.blue, LV, 1, o.air)); continue; }
      if (o.t === 'hole') { out.push(plate(X, Y, 0.62, mix(C.hole, top, 0.5)), plate(X, Y + 1, 0.46, mix(C.holeIn, top, 0.42))); continue; }
      if (o.t === 'gbox') {
        // box resting on sunk ground: its top stays at ground + 30, the water line climbs / drops along its sides
        const vis = h * LV + LV - Zw;
        if (vis > 0) { out.push(plate(X, Y, CS * 1.25, pal.refl)); out.push(...cube(X, Y, C.yellow, vis)); if (o.rider) out.push(...cube(X, Y, C.blue, LV, 1, vis)); }
        else out.push(plate(X, Y, CS, mix(C.yellow, top, 0.55)));
        continue;
      }
      if (o.t === 'raw') { out.push(...obj(o, X, Y)); continue; }
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

  // 14 world level device. Yellow plate (0.62, 3px · pressed 1px) + a fixture on the right (E) corner, clear of a rider on the plate.
  // tap (가): post 14px + spout + handwheel. pressed (open): a stream from the spout and a puddle on the plate.
  // lever (나): hinge block 5px + arm. idle: arm leans back. pressed: arm swings forward-down, water ring at the hinge.
  const LVX = { u: 0.38, v: -0.38 };
  const lvPlate = (cx, cy, pressed, pal, v) => {
    const k = tone(C.yellow), out = block(cx, cy, 0.62, 0, pressed ? 1 : 3, k.t, k.l, k.r);
    return out;
  };
  const lvFix = (cx, cy, pressed, pal, v) => {
    const k = tone(C.yellow), out = [], b = pt(cx, cy, LVX.u, LVX.v);
    if (v === 'lever') {
      if (pressed) out.push(plate(b[0], b[1], 0.3, pal.d1), plate(b[0], b[1], 0.22, mix(pal.d1, pal.refl, 0.5)));
      out.push(...block(b[0], b[1], 0.16, 0, 5, k.t, k.l, k.r));
      const A = [b[0], b[1] - 5], T = pressed ? [b[0] + 11, b[1] - 8] : [b[0] - 4, b[1] - 20];
      const dx = T[0] - A[0], dy = T[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L * 1.7, ny = dx / L * 1.7;
      out.push(sh(P([[A[0] + nx, A[1] + ny], [T[0] + nx, T[1] + ny], [T[0] - nx, T[1] - ny], [A[0] - nx, A[1] - ny]]), k.l));
      out.push(...block(T[0], T[1] + 3, 0.1, 0, 5, k.t, k.l, k.r));
      return out;
    }
    // spout points to the outside (right, away from a rider); open: wide stream + pool round the base, wheel turns light
    const sp = [b[0] + 13, b[1] - 1];
    if (pressed) out.push(plate(sp[0], sp[1], 0.34, pal.d1), plate(sp[0], sp[1], 0.24, mix(pal.d1, pal.refl, 0.55)));
    out.push(...block(b[0], b[1], 0.11, 0, 14, k.t, k.l, k.r));
    out.push(sh(P([[b[0] + 3, b[1] - 13], [b[0] + 14, b[1] - 8], [b[0] + 14, b[1] - 4], [b[0] + 3, b[1] - 9]]), k.r));
    if (pressed) out.push(sh(P([[sp[0] - 2.6, sp[1] - 5], [sp[0] + 2.6, sp[1] - 5], [sp[0] + 2.6, sp[1] + 1], [sp[0] - 2.6, sp[1] + 1]]), pal.d1), sh(P([[sp[0] - 0.8, sp[1] - 5], [sp[0] + 0.8, sp[1] - 5], [sp[0] + 0.8, sp[1]], [sp[0] - 0.8, sp[1]]]), pal.refl));
    // handwheel: closed = the yellow wheel with a dark hub. open = wheel turned a quarter (hub slot across) and lit by water colour
    out.push(...block(b[0], b[1] - 14, 0.26, 0, 2, pressed ? pal.refl : k.t, k.l, k.r));
    if (pressed) out.push(uvq(b[0], b[1] - 16, -0.12, 0.12, -0.025, 0.025, pal.d2)); else out.push(uvq(b[0], b[1] - 16, -0.025, 0.025, -0.12, 0.12, k.l));
    return out;
  };

  // ---------- CHAPTER 4 · fire ----------
  // world palettes: CHAPTER 2 (C) oklch lightness per value, hue 55 (warm ash, between rose and CHAPTER 1's yellow-grey), chroma ×0.65 / ×1 / ×1.3
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const gam = c => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };
  const hexOk = h => {
    const r = lin(parseInt(h.slice(1, 3), 16)), g = lin(parseInt(h.slice(3, 5), 16)), b = lin(parseInt(h.slice(5, 7), 16));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, Math.hypot(A, B)];
  };
  const okHex = (L, Cc, H) => {
    const A = Cc * Math.cos(H * Math.PI / 180), B = Cc * Math.sin(H * Math.PI / 180);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
    return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(v => gam(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const CH2C = { bg: '#E2E6DB', panel: '#EDF0E7', card: '#F4F6EE', locked: '#E7EAE0', hover: '#E6E9DF', a: '#EAEBE0', b: '#E2E5DA', l: '#BFC1B4', r: '#D2D4C8', pit: '#A6A89B' };
  const CH4 = {};
  // amber: same chroma as mid, hue 72 (amber / ember orange), away from mid's rose (55) and short of CHAPTER 1's yellow-grey (~85, far lower chroma)
  [['light', 0.65, 55], ['mid', 1, 55], ['more', 1.3, 55], ['amber', 1, 72]].forEach(([n, f, hu]) => { CH4[n] = {}; for (const k in CH2C) { const q = hexOk(CH2C[k]); CH4[n][k] = okHex(q[0], q[1] * f, hu); } });
  // char (burnt wood, warm black), heat (glowing), ash, stove stone, flame
  // char: burnt log, one step lighter grey-brown. ring = end-grain ring / log highlight, split = bark cracks
  const CHAR = { t: '#7A6D61', g: '#5A4F46', l: '#5E544A', r: '#6C6156', ring: '#6E6155', hi: '#8C7E70' };
  // heat: ember glow (campfire orange → yellow), no red
  const HEAT = { t: '#A3694A', l: '#7C4F39', r: '#8F5C42', crack: '#F08C3A', hot: '#F8B04C', core: '#FCDD86', ring: '#C77A45', hi: '#D98E4E' };
  const ASH = { t: '#C4BDB4', l: '#9C958C', r: '#B0A9A0' };
  const STOVE = { t: '#A9A39B', l: '#7D776F', r: '#928C84', coal: '#3C3632', bed: '#CFC8BF' };
  const FLAME = { o: '#EE8A36', m: '#F6AE45', i: '#FBDC7E' };
  const FLAME_B = { o: '#F49A3C', m: '#F9C255', i: '#FEEDA6' };
  // cube fire strength 4 → 1: smaller and duller (core fades out first)
  const FL_N = { 4: FLAME, 3: { o: '#EE8A36', m: '#F4A84A', i: '#F8CB76' }, 2: { o: '#E68F4C', m: '#EFAA5E', i: '#EFAA5E' }, 1: { o: '#D9976A', m: '#E4AC82', i: '#E4AC82' } };
  const GLOW_N = { 4: HEAT.core, 3: HEAT.hot, 2: HEAT.crack, 1: '#D9976A' };
  // lean: tip shifts sideways by lean × height (rolling cube: flames trail, still burn upward)
  const tongue = (x, y, w, h, pal, lean) => {
    const L = lean || 0;
    const f = (W, H, c) => sh(P([[x - W / 2, y - H * 0.2, 0.2], [x - W * 0.36, y - H * 0.58, 0.58], [x - W * 0.06, y - H, 1], [x + W * 0.22, y - H * 0.64, 0.64], [x + W / 2, y - H * 0.24, 0.24], [x + W * 0.26, y, 0], [x - W * 0.26, y, 0]].map(q => [q[0] + L * H * q[2], q[1]])), c);
    return [f(w, h, pal.o), f(w * 0.66, h * 0.7, pal.m), f(w * 0.34, h * 0.42, pal.i)];
  };
  // tongues on the plane at height z: list of [u, v, h]; all stay under one level (30px)
  const fire = (cx, cy, z, list, pal, wk, lean) => {
    const out = [];
    list.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(([u, v, h]) => { const p = pt(cx, cy, u, v, z); out.push(...tongue(p[0], p[1], h * 0.7 * (wk || 1), h, pal || FLAME, lean)); });
    return out;
  };
  const spark = (x, y, s, f) => sh(P([[x, y - s], [x + s * 0.7, y], [x, y + s], [x - s * 0.7, y]]), f);
  // light instead of flames. ph = flicker phase 0 / 1 / 2 → glow × 1 / 0.8 / 0.92 (one cycle 2.4s). sparks rise 10px and fade over 1.6s, a new one every ~0.9s
  const PH = [1, 0.8, 0.92];
  const pool = (cx, cy, z, s, o, f) => [[1, 0.35], [0.74, 0.6], [0.5, 1]].map(([k, a]) => plate(cx, cy - z, s * k, f || HEAT.hot, o * a));
  const SPK = [[-0.14, -0.08, 0], [0.12, -0.16, 1], [0.04, 0.12, 2], [-0.22, 0.14, 1], [0.24, 0.04, 0], [-0.04, -0.26, 2], [0.2, -0.3, 1], [-0.28, -0.02, 0]];
  const riseSparks = (cx, cy, z, k, top, ph) => SPK.slice(0, k).map(([u, v, j], i) => { const t = ((j + (ph || 0)) % 3) / 3, p = pt(cx, cy, u, v, z + 3 + t * top); return Object.assign(spark(p[0], p[1], i % 2 ? 1.2 : 1.5, i % 2 ? HEAT.hot : HEAT.core), { o: 1 - t * 0.6 }); });
  // wall = a low char pile (0.8 of the tile, 22px, under one level): a wide base lump + two smaller lumps on top.
  // bridge = two split logs lying side by side, told apart by tone only (no drawn lines).
  // heat 0 → 0.5 → 1: every face blends from char toward ember; upper faces lead (they warm first). no cracks.
  const PILE = [[[0, 0, 0.8, 0, 13], [-0.13, -0.1, 0.46, 13, 9], [0.17, 0.13, 0.3, 13, 6]], [[0, 0, 0.8, 0, 13], [0.1, -0.14, 0.46, 13, 9], [-0.15, 0.15, 0.3, 13, 6]]];
  const charTone = t => ({ t: mix(CHAR.t, HEAT.t, t), l: mix(CHAR.l, HEAT.l, t), r: mix(CHAR.r, HEAT.r, t), hi: mix(CHAR.hi, HEAT.hot, t * 0.85), lo: mix(mix(CHAR.t, CHAR.l, 0.45), HEAT.ring, t) });
  const charLog = (cx, cy, par, heat, isP, G, kk) => {
    G = G || 1;
    const k = kk || charTone(heat), out = [];
    if (!isP) {
      PILE[par ? 1 : 0].forEach(([u, v, s, z, h], i) => { const p = pt(cx, cy, u, v); out.push(...block(p[0], p[1], s, z, h, i ? k.hi : k.t, k.l, k.r)); });
      if (heat >= 1) PILE[par ? 1 : 0].forEach(([u, v, s, z, h]) => { const p = pt(cx, cy, u, v, z + h); out.push(plate(p[0], p[1], s * 0.62, HEAT.hot, 0.75 * G), plate(p[0], p[1], s * 0.34, HEAT.core, 0.85 * G)); });
      return out;
    }
    out.push(...prism(cx, cy, 1, TK, k.lo, k.l, k.r));
    [[-0.5, -0.02], [0.02, 0.5]].forEach(([v0, v1], i) => { const vc = (v0 + v1) / 2; out.push(uvq(cx, cy, -0.5, 0.5, v0 + 0.01, v1 - 0.01, k.t), uvq(cx, cy, -0.5, 0.5, vc - 0.09, vc + 0.04, (i + (par ? 1 : 0)) % 2 ? k.hi : mix(k.t, k.hi, 0.5)));
      const E = Array.from({ length: 14 }, (_, n) => { const a = n / 14 * Math.PI * 2, p = pt(cx, cy, 0.5, vc + 0.2 * Math.cos(a)); return [p[0], p[1] + TK * 0.5 + TK * 0.32 * Math.sin(a)]; });
      out.push(sh(P(E), mix(k.r, k.hi, 0.45)));
      if (heat >= 1) out.push(Object.assign(uvq(cx, cy, -0.42, 0.42, vc - 0.11, vc + 0.06, HEAT.hot), { o: 0.7 * G }), Object.assign(uvq(cx, cy, -0.3, 0.3, vc - 0.07, vc + 0.02, HEAT.core), { o: 0.8 * G })); });
    return out;
  };
  // boss 200: charred char that never leaves. one step darker than char; lv 1 → 2 = ember specks brighten each move toward the re-light.
  // wall = a low 5px slab (the cube stands on it, z 5) + two small lumps at the back corners. cs: a = ember specks (default) | b = soot mottling, no specks
  const CT = { t: mix(CHAR.t, '#000000', 0.28), l: mix(CHAR.l, '#000000', 0.25), r: mix(CHAR.r, '#000000', 0.25), hi: mix(CHAR.hi, '#000000', 0.3) };
  const charredTone = h => ({ t: mix(CT.t, HEAT.t, h), l: mix(CT.l, HEAT.l, h), r: mix(CT.r, HEAT.r, h), hi: mix(CT.hi, HEAT.hot, h * 0.85), lo: mix(mix(CT.t, CT.l, 0.45), HEAT.ring, h) });
  const SPECK = [0, 0.3, 0.55];
  const charredWall = (cx, cy, par, h, lv, cs, G) => {
    const k = charredTone(h), out = [...block(cx, cy, 0.84, 0, 5, k.t, k.l, k.r)];
    (par ? [[-0.04, -0.27, 0.24, 4], [-0.27, -0.05, 0.28, 5]] : [[-0.27, -0.05, 0.24, 4], [-0.05, -0.27, 0.28, 5]]).forEach(([u, v, sz, hh]) => { const p = pt(cx, cy, u, v); out.push(...block(p[0], p[1], sz, 5, hh, k.hi, k.l, k.r)); });
    if (h === 0 && cs !== 'b') [[0.14, 0.12], [-0.12, 0.22], [0.24, -0.12]].forEach(([u, v]) => { const p = pt(cx, cy, u, v, 5); out.push(plate(p[0], p[1], 0.09, HEAT.crack, SPECK[lv] || 0.3)); });
    if (h === 0 && cs === 'b') [[0.1, 0.1, 0.34], [-0.16, 0.2, 0.22]].forEach(([u, v, sz]) => { const p = pt(cx, cy, u, v, 5); out.push(plate(p[0], p[1], sz, mix(k.t, ASH.t, 0.28), 0.7)); });
    if (h >= 1) { const p = pt(cx, cy, 0, 0, 5); out.push(plate(p[0], p[1], 0.56, HEAT.hot, 0.7 * G), plate(p[0], p[1], 0.3, HEAT.core, 0.85 * G)); }
    return out;
  };
  const charredBridge = (cx, cy, par, h, lv, cs, G) => {
    const out = charLog(cx, cy, par, h, true, G, charredTone(h));
    if (h === 0 && cs !== 'b') [[-0.22, -0.26], [0.2, 0.24], [0.3, -0.24]].forEach(([u, v]) => out.push(Object.assign(uvq(cx, cy, u - 0.045, u + 0.045, v - 0.045, v + 0.045, HEAT.crack), { o: SPECK[lv] || 0.3 })));
    if (h === 0 && cs === 'b') [[-0.2, -0.26, 0.16], [0.16, 0.24, 0.12]].forEach(([u, v, z]) => out.push(Object.assign(uvq(cx, cy, u - z, u + z, v - 0.07, v + 0.07, mix(CT.t, ASH.t, 0.28)), { o: 0.7 })));
    return out;
  };
  const lumps = (cx, ty, list) => {
    const out = [];
    list.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(([u, v, s, h, e]) => {
      const p = pt(cx, ty, u, v);
      out.push(...block(p[0], p[1], s, 0, h, e ? HEAT.t : ASH.t, e ? HEAT.l : ASH.l, e ? HEAT.r : ASH.r));
      if (e) out.push(plate(p[0], p[1] - h, s * 0.42, HEAT.hot, 0.55));
    });
    return out;
  };
  const BRIDGE_F = [[-0.2, -0.14, 16], [0.17, -0.1, 13], [-0.02, 0.16, 14], [0.22, 0.2, 10]];
  const BRIDGE_FB = [[-0.22, -0.16, 28], [0.18, -0.12, 24], [-0.04, 0.14, 26], [0.24, 0.2, 19], [-0.26, 0.24, 17], [0.02, -0.3, 21], [0.3, -0.28, 15]];
  // wall (one level, on the ground) or bridge (16px slab over a pit). st: cold | warm | burn | held | crumble | gone | ghost (o = opacity)
  const charCell = (cx, cy, cd, par, isP) => {
    const st = cd.st || 'cold', out = [];
    if (st === 'gone') { out.push(isP ? plate(cx, cy + D, 0.5, mix((FL && FL.pit) || C.pitFloor, ASH.t, 0.4)) : plate(cx, cy, 0.5, mix(FL ? (par ? FL.b : FL.a) : C.a, ASH.t, 0.4))); return out; }
    if (st === 'crumble') {
      if (isP) out.push(...lumps(cx, cy + 12, [[-0.22, -0.2, 0.42, 8, 1], [0.2, -0.06, 0.38, 7, 0], [-0.08, 0.24, 0.32, 6, 0]]));
      else { out.push(plate(cx, cy, 0.72, mix(FL ? (par ? FL.b : FL.a) : C.a, ASH.t, 0.55))); out.push(...lumps(cx, cy, [[-0.15, -0.12, 0.34, 10, 1], [0.17, -0.08, 0.28, 7, 0], [-0.04, 0.18, 0.28, 5, 1], [0.2, 0.2, 0.18, 4, 0]])); }
      return out;
    }
    if (st === 'charred' || st === 'rewarm' || st === 'reburn') {
      const hh = st === 'reburn' ? 1 : st === 'rewarm' ? 0.5 : 0, G = PH[cd.ph || 0] * (cd.boss ? 1.25 : 1), lv = cd.lv || 1, Gm = Math.min(1, G);
      if (st === 'reburn') out.push(...pool(cx, cy, 0, cd.boss ? 1.75 : 1.35, (cd.boss ? 0.2 : 0.13) * G));
      if (st === 'rewarm') out.push(...pool(cx, cy, 0, cd.boss ? 1.3 : 1.1, cd.boss ? 0.09 : 0.07));
      let q = isP ? charredBridge(cx, cy, par, hh, lv, cd.cs, Gm) : charredWall(cx, cy, par, hh, lv, cd.cs, Gm);
      if (cd.re !== undefined) { q = q.map(x => Object.assign({}, x, { o: (x.o === undefined ? 1 : x.o) * (1 - cd.re) })); out.push(...q, ...charLog(cx, cy, par, 0, isP, 1).map(x => Object.assign({}, x, { o: cd.re }))); return out; }
      out.push(...q);
      if (st === 'reburn') { const z = isP ? 0 : 9; if (cd.boss) out.push(...pool(cx, cy, z, 0.7, 0.35 * G, HEAT.core)); out.push(...riseSparks(cx, cy, z, cd.boss ? 7 : 2, cd.boss ? 20 : 12, cd.ph)); }
      return out;
    }
    const heat = { cold: 0, ghost: 0, warm: 0.5, held: 0.5, burn: 1 }[st] || 0;
    const G = PH[cd.ph || 0] * (cd.boss ? 1.25 : 1);
    if (st === 'burn') out.push(...pool(cx, isP ? cy : cy, 0, cd.boss ? 1.75 : 1.35, (cd.boss ? 0.2 : 0.13) * G));
    let s = charLog(cx, cy, par, heat, isP, Math.min(1, G));
    if (st === 'ghost') s = s.map(q => Object.assign({}, q, { o: cd.o === undefined ? 0.5 : cd.o }));
    out.push(...s);
    if (st === 'burn') { const z = isP ? 0 : 22; if (cd.boss) out.push(...pool(cx, cy, z, 0.7, 0.35 * G, HEAT.core)); out.push(...riseSparks(cx, cy, z, cd.boss ? 7 : isP ? 2 : 2, cd.boss ? 20 : 12, cd.ph)); }
    return out;
  };
  // ember tile (불씨 칸): flush with the floor, an ash bed with one coal. on = bed glows, low flame (12px)
  const emberTile = (cx, cy, on) => {
    const out = [plate(cx, cy, 0.6, STOVE.t), plate(cx, cy, 0.48, on ? HEAT.crack : STOVE.bed)];
    if (on) out.push(plate(cx, cy, 0.34, HEAT.hot));
    out.push(...block(cx, cy, 0.2, 0, 4, on ? HEAT.core : CHAR.t, on ? HEAT.crack : CHAR.l, on ? HEAT.hot : CHAR.r));
    if (on) out.push(...pool(cx, cy, 0, 1.05, 0.1), plate(cx, cy - 4, 0.12, HEAT.core, 0.9), ...riseSparks(cx, cy, 4, 1, 9));
    return out;
  };
  // cube heat: no flame shapes. a warm glow laid over / around the cube; the cube faces keep their colour.
  // strength 4 → 1 = glow opacity and spread. under = drawn before the cube, over = after.
  const CA = CS / 2, CI = { 4: 1, 3: 0.78, 2: 0.58, 1: 0.38 };
  const silo = (cx, cy, zb, g) => { const A = CA, c = pt(cx, cy, 0, 0, zb + LV / 2), f = 1 + g / 30;
    return P([pt(cx, cy, -A, -A, zb + LV), pt(cx, cy, A, -A, zb + LV), pt(cx, cy, A, -A, zb), pt(cx, cy, A, A, zb), pt(cx, cy, -A, A, zb), pt(cx, cy, -A, A, zb + LV)].map(p => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f])); };
  const tint = (cx, cy, z, f, o) => Object.assign(uvq(cx, cy, -CA, CA, -CA, CA, f, z), { o });
  // cube holding embers: thin warm light laid over the faces, no halo outside the cube. I = strength; ph 1 at FIRE 1 = flicker dip (× 0.45, 0.8s)
  const band = (cx, cy, face, z0, z1, f, o) => { const A = CA, Q = face === 'l' ? [[-A, A], [A, A]] : [[A, A], [A, -A]];
    return Object.assign(sh(P([pt(cx, cy, Q[0][0], Q[0][1], z0), pt(cx, cy, Q[1][0], Q[1][1], z0), pt(cx, cy, Q[1][0], Q[1][1], z1), pt(cx, cy, Q[0][0], Q[0][1], z1)]), f), { o }); };
  // I1 = strength override (refill / dying), fr = glow height × (sinks as it dies), spk = one last ember above the top (px)
  const cubeGlow = (cx, cy, zb, n, mode, lean, ph, I1, fr, spk) => {
    const I0 = I1 !== undefined ? I1 : CI[n], under = [], over = []; if (!I0) return { under, over };
    if (spk) { const p = pt(cx, cy, 0.04, -0.06, zb + LV + spk); over.push(Object.assign(spark(p[0], p[1], 1.4, HEAT.hot), { o: 0.7 })); }
    const I = I0 * (ph ? 0.45 : 1), zt = zb + LV;
    const lift = (fr, o) => ['l', 'r'].forEach(f => [[1, 0.35], [0.62, 0.6], [0.32, 1]].forEach(([k, a]) => over.push(band(cx, cy, f, zb, zb + LV * fr * k, HEAT.hot, o * a * I))));
    const one = z => { if (n < 3 || ph) return; const p = pt(cx, cy, 0.04, -0.06, zt + z); over.push(spark(p[0] + (lean || 0) * z, p[1], 1.4, HEAT.core)); };
    if (mode === 'under') { under.push(...pool(cx, cy, zb, 0.62 + 0.3 * I, 0.22 * I)); lift(0.55 * (fr === undefined ? 1 : fr), 0.42); if (I1 === undefined) one(9); }
    else if (mode === 'pool') { under.push(...pool(cx, cy, zb, 0.68 + 0.42 * I, 0.3 * I)); ['l', 'r'].forEach(f => over.push(band(cx, cy, f, zb, zb + 4, HEAT.hot, 0.35 * I))); one(9); }
    else { under.push(...pool(cx, cy, zb, 0.6 + 0.2 * I, 0.14 * I)); lift(0.3, 0.3); const p = pt(cx, cy, 0, 0, zt); over.push(plate(p[0], p[1], CS * 0.62, HEAT.hot, 0.32 * I), plate(p[0], p[1], CS * 0.32, HEAT.core, 0.45 * I)); one(7); }
    return { under, over };
  };
  const numTag = (cx, y, n) => [sh(P([[cx - 11, y - 17], [cx + 11, y - 17], [cx + 11, y + 3], [cx - 11, y + 3]]), '#3A3936'), { d: n0(cx) + ',' + n0(y - 2), txt: String(n), fs: 14, f: '#F7F6F4', o: 1 }];
  const n0 = v => Math.round(v * 10) / 10;
  // brazier (화로): raised stone bowl (8px) of coals, always burning (tongues to 28px). rider: the flame moves onto the cube
  const brazier = (cx, cy, rider, I, fr, flash) => {
    const out = block(cx, cy, 0.8, 0, 8, STOVE.t, STOVE.l, STOVE.r);
    const pre = pool(cx, cy, 0, 1.6, 0.16);
    out.unshift(...pre);
    out.push(plate(cx, cy - 8, 0.66, STOVE.coal), ...[[-0.14, -0.1, 0.26], [0.13, -0.06, 0.24], [-0.04, 0.14, 0.22], [0.12, 0.16, 0.16], [-0.18, 0.08, 0.14]].map(([u, v, s]) => { const p = pt(cx, cy, u, v, 9); return plate(p[0], p[1], s, HEAT.hot); }), ...[[-0.14, -0.1, 0.13], [0.13, -0.06, 0.12], [-0.04, 0.14, 0.1]].map(([u, v, s]) => { const p = pt(cx, cy, u, v, 9.5); return plate(p[0], p[1], s, HEAT.core); }), ...pool(cx, cy, 9, 0.62, 0.3, HEAT.core));
    if (!rider) out.push(...riseSparks(cx, cy, 9, 4, 17));
    else { if (flash) out.push(...pool(cx, cy, 9, 1.1, 0.22, HEAT.core)); const g = cubeGlow(cx, cy, 8, 4, 'under', 0, 0, I, fr); out.push(...g.under, ...cube(cx, cy, C.blue, LV, 1, 8), ...g.over); }
    return out;
  };

  // boss 170 burning box. st: cold | hint (faint heat while the cube holds fire) | warm | burn | crumble | gone | ghost (o). same steps as the char wall
  const ashBox = (cx, cy, o) => {
    const st = o.st || 'cold', p = pt(cx, cy, o.u || 0, 0), X = p[0], Y = p[1], out = [], fa = FL ? FL.a : C.a;
    if (st === 'gone') return [plate(X, Y, 0.5, mix(fa, ASH.t, 0.4), o.o === undefined ? 1 : o.o)];
    if (st === 'crumble') { out.push(plate(X, Y, 0.72, mix(fa, ASH.t, 0.55))); out.push(...lumps(X, Y, [[-0.15, -0.12, 0.36, 12, 1], [0.17, -0.08, 0.3, 8, 0], [-0.04, 0.18, 0.28, 6, 1], [0.2, 0.2, 0.2, 4, 0]])); out.push(...riseSparks(X, Y, 10, 2, 12, 1)); return out; }
    const k = tone(C.yellow), h = { warm: 0.5, burn: 1 }[st] || 0;
    if (st === 'ghost') return block(X, Y, CS, 0, LV, k.t, k.l, k.r, o.o === undefined ? 0.5 : o.o);
    if (st === 'burn') out.push(...pool(X, Y, 0, 1.35, 0.13));
    if (st === 'warm') out.push(...pool(X, Y, 0, 1.1, 0.07));
    if (st === 'hint') out.push(...pool(X, Y, 0, 0.92, 0.06));
    out.push(...block(X, Y, CS, 0, LV, mix(k.t, HEAT.hi, h * 0.75), mix(k.l, HEAT.l, h * 0.8), mix(k.r, HEAT.r, h * 0.8)));
    const bandUp = (H, a) => ['l', 'r'].forEach(f => [[1, 0.35], [0.62, 0.6], [0.32, 1]].forEach(([q, b]) => out.push(band(X, Y, f, 0, H * q, HEAT.hot, a * b))));
    if (st === 'hint') bandUp(12, 0.2);
    if (st === 'warm') bandUp(LV * 0.6, 0.4);
    if (st === 'burn') { bandUp(LV, 0.5); const t = pt(X, Y, 0, 0, LV); out.push(plate(t[0], t[1], CS * 0.62, HEAT.hot, 0.7), plate(t[0], t[1], CS * 0.34, HEAT.core, 0.8), ...riseSparks(X, Y, LV, 2, 12)); }
    return out;
  };

  // ---------- CHAPTER 4 · powder keg (18) ----------
  // stacked blocks like the ice stone and char pile: a body block (0.7, 15px) + one smaller lid block (0.46, 5px). same tone() faces as the box.
  // band = one darker face round the middle of the body. warm tan, between box yellow and char grey-brown
  const KEG = { base: '#B38662', fuse: CHAR.l, plug: '#A4452E' };
  const KB = 0.48, KBH = 24, KL = 0.34, KLH = 4, KH = KBH + KLH, ZU = TH;   // 0.48 (≈25px deep) × 28px: upright. hoops: two darker side bands (z 3–6, 18–21)
  const ring = (cx, cy, r, z, du, dv) => Array.from({ length: 20 }, (_, i) => { const a = i / 20 * Math.PI * 2; return pt(cx, cy, (du || 0) + r * Math.cos(a), (dv || 0) + r * Math.sin(a), z); });
  const ell = (cx, cy, r, z, f, o, du, dv) => sh(P(ring(cx, cy, r, z, du, dv)), f, o);
  // fuse (ring): four cords on the front two sides of the ledge (inset 0.29), right corner → front corner → left corner; the back sides hide behind the lid.
  // fs 'line': four cords from the lid centre straight out to the front-right edge (lid top, then ledge)
  const RING = [{ q: [0.185, 0.225, -0.16, -0.025], b: [0.185, 0.225, -0.08, -0.025], e: [0.205, -0.025] }, { q: [0.185, 0.225, 0.025, 0.16], b: [0.185, 0.225, 0.105, 0.16], e: [0.205, 0.16] },
    { q: [0.025, 0.16, 0.185, 0.225], b: [0.025, 0.08, 0.185, 0.225], e: [0.025, 0.205] }, { q: [-0.16, -0.025, 0.185, 0.225], b: [-0.16, -0.105, 0.185, 0.225], e: [-0.16, 0.205] }];
  const keg = (cx, cy, o) => {
    const st = o.st || 'cold', ht = st === 'lit' ? 0.3 : st === 'swell' ? 0.72 : 0, sc = st === 'swell' ? 1.07 : 1;
    const p = pt(cx, cy, o.u || 0, o.v || 0), X = p[0], Y = p[1], a = o.o === undefined ? 1 : o.o, out = [], k = tone(KEG.base), kl = tone(mix(KEG.base, '#FFFFFF', 0.1));
    if (ht) out.push(...pool(X, Y, 0, 1 + ht, 0.14 * ht + 0.04));
    const h = (c, t2) => mix(c, t2, ht), bh = KBH * sc, lh = KLH * sc, H = bh + lh;
    out.push(...block(X, Y, KB * sc, 0, bh, h(k.t, HEAT.hi), h(k.l, HEAT.l), h(k.r, HEAT.r), a));
    if (o.hoops !== false) [6, 21].forEach(z => out.push(...prism(X, Y - z * sc, KB * sc, 3 * sc, '#000000', h(mix(k.l, '#000000', 0.16), HEAT.l), h(mix(k.r, '#000000', 0.16), HEAT.r), a).slice(0, 2)));
    const fz = bh + 2, fuseC = { t: KEG.fuse, l: CHAR.g, r: mix(KEG.fuse, CHAR.g, 0.5) };
    const glow = (u, v, z) => { const q = pt(X, Y, u, v, z); out.push(plate(q[0], q[1], 0.2, HEAT.hot, 0.45), plate(q[0], q[1], 0.11, HEAT.core, 0.75), Object.assign(spark(q[0] - (o.trail || 0) * 4, q[1] - 7, 1.5, HEAT.core), { o: 0.9 })); };
    const n = o.fuse, ringF = n !== undefined && o.fs !== 'line';
    const side = i => { const R = RING[i], burn = o.lit && i === n - 1;
      out.push(...box3(X, Y, R.q[0], R.q[1], R.q[2], R.q[3], fz, 2, fuseC.t, fuseC.l, fuseC.r, a));
      if (burn) { out.push(...box3(X, Y, R.b[0], R.b[1], R.b[2], R.b[3], fz, 2, HEAT.core, HEAT.crack, HEAT.hot, a)); glow(R.e[0], R.e[1], fz); } };
    out.push(...block(X, Y, KL * sc, bh, lh, h(kl.t, HEAT.hi), h(kl.l, HEAT.l), h(kl.r, HEAT.r), a));
    if (o.plug !== false) { const pk = tone(KEG.plug); out.push(...block(X, Y, 0.1 * sc, H, 3, pk.t, pk.l, pk.r, a)); }
    if (ringF) [0, 1, 2, 3].filter(i => i < n).forEach(side);
    if (n !== undefined && o.fs === 'line') for (let i = 0; i < n; i++) {
      const u0 = 0.05 + i * 0.048, u1 = u0 + 0.036, z = u1 <= KL / 2 + 0.01 ? H + 2 : fz, burn = o.lit && i === n - 1;
      out.push(...box3(X, Y, u0, u1, -0.025, 0.025, z, 2, fuseC.t, fuseC.l, fuseC.r, a));
      if (burn) { out.push(...box3(X, Y, u1 - 0.03, u1, -0.025, 0.025, z, 2, HEAT.core, HEAT.crack, HEAT.hot, a)); glow(u1, 0, z); }
    }
    if (st === 'swell') out.push(plate(X, Y - H, KL * 0.8, HEAT.hot, 0.55), plate(X, Y - H, KL * 0.45, HEAT.core, 0.7));
    if (st === 'lit' && n === undefined) out.push(plate(X, Y - H, KL * 0.5, HEAT.hot, 0.35));
    if (o.lit && n === 0) out.push(plate(X, Y - H, KL * 0.6, HEAT.core, 0.7));
    return out;
  };
  // ---------- CHAPTER 4 · iron bar (19) ----------
  // base plate (4px) + body (7px) + a lighter 2px top band = sheen on the upper edge (faces, no lines). any angle; roll = tilt about the long axis (bridge wobble)
  const IRONS = { a: '#4C5259', b: '#5F6B76' };
  const IRON = IRONS.a, IRON_B = mix(IRON, '#000000', 0.18);
  const ironK = col => { const b = IRONS[col || 'a'], k = tone(b); return { k, kb: tone(mix(b, '#000000', 0.18)), hi: { t: mix(b, '#FFFFFF', 0.36), l: mix(k.l, '#FFFFFF', 0.2), r: mix(k.r, '#FFFFFF', 0.2) } }; };
  const oprism = (cx, cy, cu, cv, L, W, a, z, h, k, o, R) => {
    const c = Math.cos(a), s2 = Math.sin(a), out = [];
    const q = (u, v, zz) => { if (!R) return pt(cx, cy, u, v, zz);
      if (R.ax === 'u') { const du = u - R.u0, dz = (zz - R.z0) / ZU, rc = Math.cos(R.a), rs = Math.sin(R.a); return pt(cx, cy, R.u0 + du * rc - dz * rs, v, R.z0 + (du * rs + dz * rc) * ZU); }
      const dv = v - (R.v0 || 0), dz = (zz - R.z0) / ZU, rc = Math.cos(R.a), rs = Math.sin(R.a); return pt(cx, cy, u, (R.v0 || 0) + dv * rc - dz * rs, R.z0 + (dv * rs + dz * rc) * ZU); };
    const loc = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([x, y]) => [cu + x * c - y * s2, cv + x * s2 + y * c]);
    for (let i = 0; i < 4; i++) {
      const A = loc[i], B = loc[(i + 1) % 4]; let nu = B[1] - A[1], nv = -(B[0] - A[0]);
      if (nu * ((A[0] + B[0]) / 2 - cu) + nv * ((A[1] + B[1]) / 2 - cv) < 0) { nu = -nu; nv = -nv; }
      const Ln = Math.hypot(nu, nv); nu /= Ln; nv /= Ln; if (nu + nv < 0.001) continue;
      const kk = Math.max(0, Math.min(1, (nu - nv + 1) / 2));
      out.push(sh(P([q(A[0], A[1], z), q(B[0], B[1], z), q(B[0], B[1], z + h), q(A[0], A[1], z + h)]), mix(k.l, k.r, kk), o));
    }
    out.push(sh(P(loc.map(p => q(p[0], p[1], z + h))), k.t, o));
    return out;
  };
  const ibar = (cx, cy, o) => {
    const a = (o.ang || 0) * Math.PI / 180, z = o.z || 0, op = o.o === undefined ? 1 : o.o, len = o.len || 1.64, K3 = ironK(o.col), bl = o.full ? len : len - 0.14;
    // heat (boss 190): ember glow laid into the iron faces, sheen warms most; a faint floor glow under each cell. no flame shapes
    const ht = o.heat || 0, pre = [];
    if (ht) { const m = (c, t, f) => mix(c, t, f * ht);
      K3.k = { t: m(K3.k.t, HEAT.hi, 0.5), l: m(K3.k.l, HEAT.l, 0.55), r: m(K3.k.r, HEAT.r, 0.55) };
      K3.kb = { t: m(K3.kb.t, HEAT.t, 0.35), l: m(K3.kb.l, HEAT.l, 0.35), r: m(K3.kb.r, HEAT.r, 0.35) };
      K3.hi = { t: m(K3.hi.t, HEAT.hot, 0.6), l: m(K3.hi.l, HEAT.crack, 0.45), r: m(K3.hi.r, HEAT.hot, 0.45) };
      const c = Math.cos(a), s2 = Math.sin(a), nc = Math.max(2, Math.round(len - 0.64 + 1));
      for (let i = 0; i < nc; i++) { const t = -(len - 0.64) / 2 + i * (len - 0.64) / (nc - 1), q = pt(cx, cy, t * c, t * s2, z); pre.push(...pool(q[0], q[1], 0, 0.95, 0.1 * ht * op)); } }
    // tip = one end sagging over a pit edge: pitch (x bars, u–z) / tipv (y bars, v–z) about the rim corner at pivot offset pu / pv, bar bottom
    const R = o.roll ? { v0: 0, z0: z + 6.5, a: o.roll * Math.PI / 180 } : o.pitch ? { ax: 'u', u0: o.pu || 0, z0: z, a: o.pitch * Math.PI / 180 } : o.tipv ? { v0: o.pv || 0, z0: z, a: o.tipv * Math.PI / 180 } : null;
    // lip = bridge end lying flush on the rim: a base-coloured 0.36 footprint and the 0.24 sheen top, both at the bar's top height (no step faces)
    if (o.style === 'lip') return [...pre, ...oprism(cx, cy, 0, 0, len, 0.36, a, z, 0.3, { t: K3.kb.t, l: K3.kb.l, r: K3.kb.r }, op), ...oprism(cx, cy, 0, 0, len, 0.24, a, z + 0.3, 0.3, { t: K3.hi.t, l: K3.hi.l, r: K3.hi.r }, op)];
    // lit = fire from burning logs below, cast up on the lower front faces only (base plate + bottom of the body), ang 0 bars. [[u0, u1], ...] in bar-local u
    const lit = [];
    (o.lit || []).forEach(([u0, u1]) => {
      const fv = (v, za, zb, f, al) => lit.push(sh(P([pt(cx, cy, u0, v, z + za), pt(cx, cy, u1, v, z + za), pt(cx, cy, u1, v, z + zb), pt(cx, cy, u0, v, z + zb)]), f, al * op));
      fv(0.18, 0, 4, HEAT.hot, 0.32); fv(0.18, 0, 1.6, HEAT.core, 0.22); fv(0.12, 4, 6.5, HEAT.hot, 0.14);
      if (u1 >= len / 2 - 0.01) { const fu = (u, v0, v1, za, zb, f, al) => lit.push(sh(P([pt(cx, cy, u, v0, z + za), pt(cx, cy, u, v1, z + za), pt(cx, cy, u, v1, z + zb), pt(cx, cy, u, v0, z + zb)]), f, al * op)); fu(len / 2, -0.18, 0.18, 0, 4, HEAT.hot, 0.32); }
    });
    if (lit.length) return [...pre, ...oprism(cx, cy, 0, 0, len, 0.36, a, z, 4, K3.kb, op, R), ...oprism(cx, cy, 0, 0, bl, 0.24, a, z + 4, 7, K3.k, op, R), ...oprism(cx, cy, 0, 0, bl, 0.24, a, z + 11, 2, K3.hi, op, R), ...lit];
    return [...pre, ...oprism(cx, cy, 0, 0, len, 0.36, a, z, 4, K3.kb, op, R), ...oprism(cx, cy, 0, 0, bl, 0.24, a, z + 4, 7, K3.k, op, R), ...oprism(cx, cy, 0, 0, bl, 0.24, a, z + 11, 2, K3.hi, op, R)];
  };
  const rcube = (cx, cy, o) => oprism(cx, cy, 0, 0, CS, CS, 0, o.z || 0, LV, tone(C.blue), 1, o.roll ? { v0: 0, z0: -6.5, a: o.roll * Math.PI / 180 } : null);

  // cube tipping over its far bottom edge (blocked push-away). ang in degrees, toward +u
  const tcube = (cx, cy, ang, z0, back) => {
    const A = CA, th = ang * Math.PI / 180, k = tone(C.blue), c = Math.cos(th), s2 = Math.sin(th), Z = z0 || 0, e = back ? -1 : 1;
    const R = (u, v, z) => { const du = u - e * A; return pt(cx, cy, e * A + du * c + e * (z / ZU) * s2, v, Z - e * du * s2 * ZU + z * c); };
    return [sh(P([R(-A, A, 0), R(A, A, 0), R(A, A, LV), R(-A, A, LV)]), k.l), sh(P([R(A, A, 0), R(A, -A, 0), R(A, -A, LV), R(A, A, LV)]), k.r), sh(P([R(-A, -A, LV), R(A, -A, LV), R(A, A, LV), R(-A, A, LV)]), k.t)];
  };
  // burst light over the keg cell. ph: glow | flash | fade | end
  const SPR = Array.from({ length: 12 }, (_, i) => [i / 12 * Math.PI * 2 + 0.3, 0.5 + 0.22 * (i % 3), 6 + (i * 7) % 20]);
  const burst = (cx, cy, ph) => {
    const out = [];
    if (ph === 'glow') out.push(...pool(cx, cy, 0, 1.8, 0.16));
    if (ph === 'flash') {
      out.push(...pool(cx, cy, 0, 3.1, 0.26), ...pool(cx, cy, 0, 1.6, 0.42, HEAT.core));
      [[0.62, 0.22], [0.44, 0.38], [0.26, 0.6]].forEach(([r, a], i) => out.push(ell(cx, cy, r, 12 + i * 2, i === 2 ? '#FFF3D2' : HEAT.core, a)));
      SPR.forEach(([an, r, z], i) => { const q = pt(cx, cy, r * Math.cos(an), r * Math.sin(an), z); out.push(spark(q[0], q[1], i % 2 ? 1.3 : 1.8, i % 2 ? HEAT.hot : HEAT.core)); });
    }
    if (ph === 'fade') { out.push(...pool(cx, cy, 0, 2.4, 0.12)); SPR.slice(0, 8).forEach(([an, r, z], i) => { const q = pt(cx, cy, (r + 0.4) * Math.cos(an), (r + 0.4) * Math.sin(an), Math.min(28, z + 6)); out.push(Object.assign(spark(q[0], q[1], 1.2, i % 2 ? HEAT.hot : HEAT.core), { o: 0.55 })); }); }
    if (ph === 'end') out.push(...pool(cx, cy, 0, 1.3, 0.05));
    return out;
  };
  // dust over a cut cell. du, dv = away from the keg. ph: rise | spread | settle
  const dust = (cx, cy, ph, du, dv) => {
    const a = mix(FL ? FL.l : '#BFC1B4', ASH.t, 0.45), b = mix(FL ? FL.a : C.a, ASH.t, 0.35), out = [], d = (k, z) => [du * k, dv * k, z];
    const puff = (k, z, r, o, f) => { const q = d(k, z); out.push(ell(cx, cy, r, q[2], f, o, q[0], q[1])); };
    const bit = (k, z, s, sx) => { const q = pt(cx, cy, du * k + sx * dv, dv * k + sx * du, z); out.push(...block(q[0], q[1], s, 0, 3, b, FL ? FL.l : '#BFC1B4', FL ? FL.r : '#D2D4C8')); };
    if (ph === 'rise') { puff(0, 4, 0.38, 0.5, a); puff(0.1, 11, 0.32, 0.45, b); puff(0.18, 18, 0.22, 0.4, a); bit(0.3, 14, 0.07, 0.18); bit(0.36, 20, 0.06, -0.16); bit(0.22, 24, 0.05, 0.02); }
    if (ph === 'spread') { puff(0.2, 3, 0.48, 0.3, a); puff(0.3, 9, 0.4, 0.26, b); bit(0.5, 2, 0.07, 0.2); bit(0.56, 2, 0.06, -0.2); }
    if (ph === 'settle') puff(0.25, 1, 0.5, 0.13, a);
    return out;
  };

  const obj = (o, cx, cy) => {
    switch (o.t) {
      case 'brazier': return brazier(cx, cy, o.rider, o.I, o.fr, o.flash);
      case 'abox': return ashBox(cx, cy, o);
      case 'keg': return keg(cx, cy, o);
      case 'ibar': return ibar(cx, cy, o);
      case 'rcube': return rcube(cx, cy, o);
      case 'shade': return oprism(cx, cy, 0, 0, o.L, o.W, (o.ang || 0) * Math.PI / 180, 0, 0.2, { t: o.f, l: o.f, r: o.f }, o.o === undefined ? 1 : o.o);
      case 'mark': return [plate(cx, cy, o.s || 0.86, o.f, o.o === undefined ? 1 : o.o)];
      case 'tcube': return tcube(cx, cy, o.ang || 0, o.z, o.back);
      case 'burst': return burst(cx, cy, o.ph);
      case 'dust': return dust(cx, cy, o.ph, o.du || 0, o.dv || 0);
      // ambient overlay drawn in this cell's paint order (so walls in front cover it). raw = svg markup in cell-local coords
      case 'raw': return [{ d: n0(cx) + ',' + n0(cy), f: 'none', o: 0, raw: '<g transform="translate(' + n0(cx) + ',' + n0(cy) + ')">' + o.raw + '</g>' }];
      case 'fcube': {
        const z = (o.z || 0) + (o.roll ? 5 : 0), p = o.roll ? pt(cx, cy, o.roll, 0) : [cx, cy], lean = o.roll ? -0.32 : 0;
        const g = cubeGlow(p[0], p[1], z, o.n, o.mode || 'under', lean, o.ph, o.I, o.fr, o.spk), out = g.under.concat(cube(p[0], p[1], C.blue, LV, 1, z), g.over);
        if (o.num) out.push(...numTag(p[0], p[1] - z - LV - 24, o.n)); return out; }
      case 'flame': return pool(cx, cy, o.z || 0, 1.2, 0.15).concat(riseSparks(cx, cy, o.z || 0, 3, 14));
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
      case 'fbox': case 'gbox': return o.rider ? box(cx, cy, 0).concat(cube(cx, cy, C.blue, LV, 1, LV)) : box(cx, cy, 0);
      case 'lvd': return lvPlate(cx, cy, o.pressed, (WT && WT.pal) || CH3.mid, o.v);
      case 'lvx': return lvFix(cx, cy, o.pressed, (WT && WT.pal) || CH3.mid, o.v);
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
    if (WT && def.pull) {
      WT.pull = {};
      def.pull.forEach(pw => { if (pw.show === false) return; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        for (let k = 1; ; k++) {
          const x = pw.p[0] + dx * k, y = pw.p[1] + dy * k, v = V(x, y), cd = cells[x + ',' + y];
          if (typeof v !== 'number' || v >= def.W - 0.2 || (cd && ((cd.t === 'ice' && !def.pullIce) || cd.t === 'whirl'))) break;
          WT.pull[x + ',' + y] = { ax: dx ? 'x' : 'y', sg: -(dx || dy), k, st: pw.st || 'lane', o: pw.o };
        }
      }); });
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
      if (WT && def.Wc) { const w = def.Wc[key] !== undefined ? def.Wc[key] : def.W; WT.W = w; WT.Z = w * LV - WS; }
      if (WT && !isP && h < WT.W - 0.2) {
        const p0 = iso(c.x, c.y, 0);
        out.push(...waterCell(c.x, c.y, p0[0], p0[1], h, par, cd, V, objs[key] || []));
        continue;
      }
      if (isP) {
        const grown = cd && ((cd.t === 'vine' && cd.st === 'grown') || cd.t === 'filled' || (cd.t === 'mfill' && (cd.o === undefined || cd.o === 1)) || (cd.t === 'charbridge' && cd.st !== 'gone' && cd.st !== 'crumble'));
        out.push(...pit(cx, cy, {
          nw: V(c.x - 1, c.y), ne: V(c.x, c.y - 1),
          fl: !grown && V(c.x, c.y + 1) === null, fr: !grown && V(c.x + 1, c.y) === null
        }));
        if (cd && cd.t === 'vine') out.push(...vineCell(cx, cy, cd));
        if (cd && cd.t === 'rail') out.push(...railCell(cx, cy, cd));
        if (cd && cd.t === 'charbridge') out.push(...charCell(cx, cy, cd, par, true));
        if (cd && cd.t === 'filled') { const k = tone(C.yellow); out.push(...prism(cx, cy, 1, TK, k.t, k.l, k.r)); }
        if (cd && cd.t === 'mfill') { const k = tone(IRON); out.push(...prism(cx, cy, 1, TK, k.t, k.l, k.r, cd.o)); }
      } else if (cd && cd.t === 'iceland') {
        // CHAPTER 1 ice floor: the whole block is ice (sides down to the base), one gloss line
        const pl = WT ? WT.pal : CH3.mid;
        out.push(...prism(cx, cy, 1, (h - FB) * LV + TK, pl.iceT, pl.iceL, pl.iceR));
        out.push(uvq(cx, cy, -0.34, 0.12, -0.2, -0.165, pl.gloss));
      } else if (cd && (cd.t === 'charwall' || cd.t === 'ember')) {
        out.push(...land(cx, cy, h, par));
        out.push(...(cd.t === 'ember' ? emberTile(cx, cy, cd.on) : charCell(cx, cy, cd, par, false)));
      } else if (cd && cd.t === 'void') {
      } else if (cd && cd.t === 'yfill') { const k = tone(C.yellow); out.push(...prism(cx, cy, 1, TK, k.t, k.l, k.r));
      } else if (cd && (cd.t === 'gland' || cd.t === 'drop')) {
        const th = (h - FB) * LV + TK, t = FL ? (par ? FL.b : FL.a) : (par ? C.b : C.a), sd = FL ? { l: FL.l, r: FL.r } : side(t);
        out.push(...prism(cx, cy + (cd.dz || 0), 1, th, t, sd.l, sd.r, cd.o === undefined ? 1 : cd.o));
      } else if (cd && cd.t === 'regrow') {
        out.push(...land(cx, cy, h, par));
        const t = FL ? (par ? FL.b : FL.a) : (par ? C.b : C.a), sd = FL ? { l: FL.l, r: FL.r } : side(t);
        out.push(...prism(cx, cy - cd.add * LV, 1, cd.add * LV, t, sd.l, sd.r, cd.o));
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
        if (def.chan && def.chan[key]) {
          // boss 140 sluice channel: a groove along the cell, filled with water while the pools exchange
          const ax = def.chan[key], pl = WT ? WT.pal : CH3.mid, f = def.chanFlow ? pl.d1 : mix(par ? FL.b : FL.a, pl.d2, 0.42);
          const w = 0.1, seg = ax === 'x' ? [-0.5, 0.5, -w, w] : [-w, w, -0.5, 0.5];
          out.push(uvq(cx, cy, seg[0], seg[1], seg[2], seg[3], f));
          if (def.chanFlow) out.push(uvq(cx, cy, seg[0], seg[1], ax === 'x' ? -0.03 : seg[2], ax === 'x' ? 0.03 : seg[3], pl.refl));
          if (ax !== 'x' && ax !== 'y') {}
        }
        if (def.damp && def.damp.tops && def.damp.tops.includes(key)) out.push(plate(cx, cy, 1, mix(par ? FL.b : FL.a, WT.pal.d1, 0.45)));
        if (def.damp && def.damp.band && WT) out.push(...dampBand(cx, iso(c.x, c.y, 0)[1], h, WT.pal));
      }
      for (const o of (objs[key] || [])) out.push(...obj(o, cx, cy));
      (def.late || []).forEach(it => { if (it.after !== key) return; const q = iso(it.x, it.y, it.h || 0); out.push(...obj(it.o, q[0], q[1])); });
    }
    if (ROPES.__last) out.push(...ROPES.__last);
    (def.over || []).forEach(it => { const v = V(it.x, it.y), h = it.h !== undefined ? it.h : (typeof v === 'number' ? v : 0), p = iso(it.x, it.y, h); out.push(...obj(it.o, p[0], p[1])); });
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

  window.CuboundIso = { TW, TH, LV, TK, D, C, mix, tone, side, scene, fit, mixed, wither, MUSH, CH3, STONE, WS, DIP, CH4, CH2C, FIRE: { CHAR, HEAT, ASH, STOVE, FLAME, FLAME_B, FL_N, GLOW_N, CT }, KEG: { KEG, KH, tone }, BAR: { IRON, IRON_B, IRONS, ironK } };
})();
