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
    vineT: '#CDD3BA', vineL: '#9FA68C', vineR: '#B7BEA3',
    socket: '#878B77', socketNext: '#C9CFB5', sprout: '#AEB598',
    soil: '#DCD9C9', soilL: '#B7B4A5', soilR: '#CBC8B8',
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
  const land = (cx, cy, h, par, top) => { const t = top || (par ? C.b : C.a), s = side(t); return prism(cx, cy, 1, h * LV + TK, t, s.l, s.r); };
  const wallDown = (a, b, top, bot, f) => sh(P([[a[0], a[1] - top], [b[0], b[1] - top], [b[0], b[1] + bot], [a[0], a[1] + bot]]), f);

  const pit = (cx, cy, o) => {
    const c = corners(cx, cy, 1), s = side(C.a), out = [];
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

  const MUSH = { idle: { st: 14, cs: 0.48, ct: 6, d: 3 }, pressed: { st: 9, cs: 0.54, ct: 5, d: 2 }, spring: { st: 18, cs: 0.44, ct: 6, d: 3 } };
  const mushroom = (cx, cy, st) => {
    const S = MUSH[st] || MUSH.idle, out = [];
    out.push(plate(cx, cy, 0.4, mix(C.a, '#000000', 0.08)));
    out.push(...block(cx, cy, 0.2, 0, S.st, C.stemT, C.stemL, C.stemR));
    out.push(...block(cx, cy, S.cs, S.st, S.ct, C.capT, C.capL, C.capR));
    out.push(...block(cx, cy, S.cs * 0.6, S.st + S.ct, S.d, mix(C.capT, '#FFFFFF', 0.12), C.capL, C.capR));
    return { shapes: out, top: S.st + S.ct + S.d };
  };

  const vineCell = (cx, cy, cd) => {
    const out = [];
    if (cd.st === 'grown') return prism(cx, cy, 1, TK, C.vineT, C.vineL, C.vineR);
    if (cd.st === 'future') return [plate(cx, cy + D, 0.26, C.socket)];
    out.push(plate(cx, cy + D, 0.3, C.socketNext));
    out.push(...box3(cx, cy + D, -0.05, 0.05, -0.05, 0.05, 22, 22, C.sprout, mix(C.sprout, '#000000', 0.2), mix(C.sprout, '#000000', 0.08)));
    const tt = mix(C.vineT, '#000000', 0.06);
    if (cd.from === 'x') out.push(...box3(cx, cy, -0.5, -0.34, -0.17, 0.17, 0, 7, tt, C.vineL, C.vineR));
    if (cd.from === 'y') out.push(...box3(cx, cy, -0.17, 0.17, -0.5, -0.34, 0, 7, tt, C.vineL, C.vineR));
    return out;
  };
  const root = (cx, cy, dir) => {
    const p = dir === 'y' ? pt(cx, cy, 0, 0.3) : pt(cx, cy, 0.3, 0);
    return block(p[0], p[1], 0.26, 0, 5, C.vineT, C.vineL, C.vineR);
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
  const planted = (cx, cy, left) => {
    const out = [], mh = { 1: 8, 2: 5, 3: 3 }[left] || 3, k = tone(C.yellow);
    out.push(...block(cx, cy, 0.4, 0, mh, C.soil, C.soilL, C.soilR));
    out.push(...block(cx, cy, 0.14, mh, 3 + (3 - Math.min(3, left)) * 2, k.t, k.l, k.r));
    const base = pt(cx, cy, 0.37, 0.37), gap = 9;
    for (let i = 0; i < left; i++) {
      const dx = (i - (left - 1) / 2) * gap;
      out.push(...block(base[0] + dx, base[1], 0.06, 0, 6, k.t, k.l, k.r));
    }
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
      case 'planted': return planted(cx, cy, o.n);
      case 'root': return root(cx, cy, o.dir);
    }
    return [];
  };

  const scene = def => {
    const g = def.g, cells = def.cells || {}, objs = def.objs || {}, out = [], list = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] !== null) list.push({ x, y });
    list.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
    const V = (x, y) => (g[y] && g[y][x] !== undefined) ? g[y][x] : null;
    for (const c of list) {
      const v = g[c.y][c.x], isP = v === 'p', h = isP ? 0 : v, p = iso(c.x, c.y, h), cx = p[0], cy = p[1];
      const par = (c.x + c.y) % 2, key = c.x + ',' + c.y, cd = cells[key];
      if (isP) {
        const grown = cd && cd.t === 'vine' && cd.st === 'grown';
        out.push(...pit(cx, cy, {
          nw: V(c.x - 1, c.y), ne: V(c.x, c.y - 1),
          fl: !grown && V(c.x, c.y + 1) === null, fr: !grown && V(c.x + 1, c.y) === null
        }));
        if (cd && cd.t === 'vine') out.push(...vineCell(cx, cy, cd));
        if (cd && cd.t === 'rail') out.push(...railCell(cx, cy, cd));
      } else if (cd && cd.t === 'swamp') {
        out.push(...swamp(cx, cy, h, par, cd.st));
      } else {
        out.push(...land(cx, cy, h, par));
      }
      for (const o of (objs[key] || [])) out.push(...obj(o, cx, cy));
    }
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

  window.CuboundIso = { TW, TH, LV, TK, D, C, mix, tone, side, scene, fit, mixed };
})();
