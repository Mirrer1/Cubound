// Shared isometric renderer for Cubound cycle-2 object sheets.
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
  let FL = null;
  const land = (cx, cy, h, par, top) => {
    if (FL && !top) return prism(cx, cy, 1, h * LV + TK, par ? FL.b : FL.a, FL.l, FL.r);
    const t = top || (par ? C.b : C.a), s = side(t); return prism(cx, cy, 1, h * LV + TK, t, s.l, s.r);
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
  const box = (cx, cy, z) => cube(cx, cy, C.yellow, LV, 1, z).concat([plate(cx, cy - (z || 0) - LV, CS * 0.5, mix(C.yellow, '#000000', 0.13))]);

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
    }
    return [];
  };

  const scene = def => {
    const g = def.g, cells = def.cells || {}, objs = def.objs || {}, out = [], list = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] !== null) list.push({ x, y });
    list.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
    const V = (x, y) => (g[y] && g[y][x] !== undefined) ? g[y][x] : null;
    FL = def.floor || null;
    for (const c of list) {
      const v = g[c.y][c.x], isP = v === 'p', h = isP ? 0 : v, p = iso(c.x, c.y, h), cx = p[0], cy = p[1];
      const par = (c.x + c.y) % 2, key = c.x + ',' + c.y, cd = cells[key];
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
      }
      for (const o of (objs[key] || [])) out.push(...obj(o, cx, cy));
    }
    FL = null;
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

  window.CuboundIso = { TW, TH, LV, TK, D, C, mix, tone, side, scene, fit, mixed, wither, MUSH };
})();
