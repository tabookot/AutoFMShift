//scorch.ui.js part01
function rrectPath(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ptrPos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (Wc / r.width), y: (e.clientY - r.top) * (Hc / r.height) };
  }
  function trailLife(w) {
    switch (w.type) {
      case 'plasma': return 0.55;
      case 'missile': case 'mirv': return 1.15;
      case 'death': case 'nuke': return 1.6;
      case 'napalm': return 0.9;
      case 'roller': return 0.8;
      case 'digger': return 1.0;
      case 'dirt': return 1.2;
      default: return 1.0;
    }
  }
  // pointer aiming over the FULL barrel arc
  function updateAimFromPointer(p) {
    const t = activeTank(), dir = activeDir();
    const dx = p.x - t.x, dy = (t.y - 14) - p.y;
    const dist = Math.hypot(dx, dy);
    const ax = Math.abs(dx) < 4 ? 4 : dx * dir;
    let a = Math.atan2(dy, ax) * 180 / Math.PI;
    if (a < -90) a += 360;
    aim.ang = clamp(Math.round(a), AIM_MIN, AIM_MAX);
    const reach = Math.min(Wc * 0.42, 300);
    aim.pow = clamp(Math.round(5 + 95 * (dist - 26) / reach), 5, 100);
  }
  // bottom control panel; the wind bar stays pinned to the bottom edge
  function updateTctl() {
    if (!tctlEl) return;
    const active = state === 'aim' && isHumanSeat(turn);
    const blocked = helpOpen || setupOpen || confirmOpen;
    tctlEl.classList.toggle('show', active && !blocked && (touchUI || tctlOpen));
    if (active) {
      angRange.value = Math.round(aim.ang);
      powRange.value = Math.round(aim.pow);
      angVal.textContent = Math.round(aim.ang) + '\u00b0';
      powVal.textContent = Math.round(aim.pow);
    }
  }
  
  // ================= RENDER =================
  function draw() {
    if (!ctx || !Wc || !cols) return;
    const sh = shake > 0.3 ? shake : 0;
    const shx = sh ? (noise(gt * 61) - 0.5) * 2 * sh : 0;
    const shy = sh ? (noise(gt * 47 + 9.7) - 0.5) * 2 * sh : 0;
    ctx.save();
    if (sh) ctx.translate(shx, shy);
    drawSky();
    drawTerrain();
    drawRemains();
    drawDebris();
    drawWreckBits();
    drawSinkers();
    drawTanks();
    drawWater();
    // the cave: darkness swallows the solid scene, then the baked lights
    // burn their pools back into it; glowing things (shots, fire, fx) are
    // drawn ABOVE the darkness so they read in the gloom
    if (UNDER) drawCaveShade();
    if (shot) drawShot(shot);
    subshots.forEach(drawShot);
    // beam-lit tank glows ride ABOVE the cave darkness, in each player's
    // own colour, only while a searchlight touches them
    tglow.forEach(tg => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(tg.x, tg.y, 2, tg.x, tg.y, 34);
      const tc = parseCol(tg.col);
      g.addColorStop(0, `rgba(${Math.min(255, tc[0] + 90)},${Math.min(255, tc[1] + 90)},${Math.min(255, tc[2] + 90)},${tg.a.toFixed(3)})`);
      g.addColorStop(0.5, `rgba(${tc[0] | 0},${tc[1] | 0},${tc[2] | 0},${(tg.a * 0.5).toFixed(3)})`);
      g.addColorStop(1, `rgba(${tc[0] | 0},${tc[1] | 0},${tc[2] | 0},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    drawLiquids();
    drawFire();
    drawFx();
    drawLavaBits();
    drawWindParts();
    drawGrains();
    drawHpLate();
    drawBanners();
    drawTurnCards();
    if (state === 'aim' && isHumanSeat(turn) && !helpOpen && !setupOpen && !confirmOpen) drawAim();
    ctx.restore();
    drawHUD();
    drawOffscreenMarks();
    updateTctl();
  }
  
  function drawSky() {
    // UNDERGROUND: no sky, no luminary, no reflections — rock backdrop
    if (UNDER) { drawCaveBG(); return; }
    const p = cycleT;
    skyLight = { x: -999, col: '255,255,255', a: 0 };
    const pal = biome.pal;
    const g = ctx.createLinearGradient(0, 0, 0, Hc);
    if (pal && pal.day) {
      for (let s = 0; s <= 4; s++) {
        const u = s / 4;
        const pc = sampleStops(pal.day, u);
        const nc = sampleStops(tod.stops, u);
        g.addColorStop(u, rgbaStr(mixColA(nc, pc, dayness)));
      }
    } else {
      tod.stops.forEach((c, i) => g.addColorStop(i / (tod.stops.length - 1), c));
    }
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, Wc + 60, Hc + 60);
    const nn = 1 - dayness;
    const starA = clamp((nn - 0.25) / 0.5, 0, 1);
    if (starA > 0.02) {
      stars.forEach(st => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(skyT * st.tw + st.ph));
        ctx.globalAlpha = tw * starA * 0.9;
        ctx.fillStyle = st.col;
        ctx.fillRect(st.x, st.y, st.sz, st.sz);
        if (st.cross && st.sz > 1.8) {
          ctx.globalAlpha = tw * 0.35 * starA;
          ctx.fillRect(st.x - st.sz, st.y + st.sz / 2 - 0.5, st.sz * 3, 1);
          ctx.fillRect(st.x + st.sz / 2 - 0.5, st.y - st.sz, 1, st.sz * 3);
        }
      });
      ctx.globalAlpha = 0.07 * starA;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 80; i++) {
        const t = (i * 61.7) % 100 / 100;
        ctx.fillRect(t * Wc, Hc * 0.1 + t * Hc * 0.35 + (noise(i * 3.3) - 0.5) * 50, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    {
      const inNight = p >= 0.51 && p <= 0.97;
      const mp = inNight ? (p - 0.53) / 0.44 : -0.35;
      const mx = -60 + mp * (Wc + 120);
      const my = Hc * (0.30 - Math.sin(clamp(mp, 0, 1) * Math.PI) * 0.18);
      const shimmer = 0.92 + Math.sin(skyT * 1.3) * 0.06;
      const Rm = 16 * shimmer;
      const bx = mx + moonBite * shimmer;
      const by = my - Math.abs(moonBite) * 0.3;
      const br = moonBiteR * shimmer;
      const hg = ctx.createRadialGradient(mx, my, Rm * 0.5, mx, my, Rm * 2.1);
      hg.addColorStop(0, 'rgba(200,215,235,0.28)');
      hg.addColorStop(1, 'rgba(200,215,235,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(mx, my, Rm * 2.1, 0, Math.PI * 2); ctx.fill();
      if (!moonCv) { moonCv = document.createElement('canvas'); moonCv.width = 96; moonCv.height = 96; moonCtx = moonCv.getContext('2d'); }
      const MC = 48;
      moonCtx.globalCompositeOperation = 'source-over';
      moonCtx.clearRect(0, 0, 96, 96);
      moonCtx.beginPath(); moonCtx.arc(MC, MC, Rm, 0, Math.PI * 2);
      moonCtx.fillStyle = '#dfe4ea';
      moonCtx.fill();
      moonCtx.globalCompositeOperation = 'destination-out';
      moonCtx.beginPath(); moonCtx.arc(MC + bx - mx, MC + by - my, br, 0, Math.PI * 2);
      moonCtx.fill();
      ctx.drawImage(moonCv, mx - MC, my - MC);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgba(150,160,175,0.6)';
      [[-6, 2, 3], [4, 6, 2.2]].forEach(c => {
        const cx = mx + c[0], cy = my + c[1];
        if (Math.hypot(cx - bx, cy - by) > br * 0.95) {
          ctx.beginPath(); ctx.arc(cx, cy, c[2], 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (mx > 20 && mx < Wc - 20) skyLight = { x: mx, col: '223,228,234', a: 0.45 * starA + 0.1 };
    }
    comets.forEach(c => {
      const cp = c.t / c.life;
      const sz = c.sz || 1.5;
      ctx.strokeStyle = `rgba(200,230,255,${0.85 * (1 - cp) * starA})`;
      ctx.lineWidth = sz;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x - c.vx * 0.5, c.y - c.vy * 0.5);
      ctx.stroke();
      ctx.fillStyle = `rgba(240,250,255,${(1 - cp) * 0.9 * starA})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, sz, 0, Math.PI * 2); ctx.fill();
    });
    ctx.lineWidth = 1;
    {
      const sunP = p >= 0.95 ? (p - 0.95) / 0.55 : (p + 0.05) / 0.55;
      const sx = -60 + sunP * (Wc + 120);
      const sy = Hc * (0.30 - Math.sin(clamp(sunP, 0, 1) * Math.PI) * 0.20);
      const alt = clamp((Hc * 0.30 - sy) / (Hc * 0.17), 0, 1);
      const sunC = pal && pal.sun ? pal.sun : tod.sun;
      const haloC = pal && pal.sunHalo ? pal.sunHalo : tod.sunHalo;
      const hot = mixColA(parseCol('#ff6a3a'), parseCol(sunC), alt);
      const halo = mixColA(parseCol('rgba(255,110,70,0.4)'), parseCol(haloC), alt);
      const shimmer = 1 + Math.sin(skyT * 1.1) * 0.05;
      ctx.fillStyle = rgbaStr(halo);
      ctx.beginPath(); ctx.arc(sx, sy, 52 * shimmer, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgbaStr(hot);
      ctx.beginPath(); ctx.arc(sx, sy, 24 * shimmer, 0, Math.PI * 2); ctx.fill();
      if (sx > 20 && sx < Wc - 20) skyLight = { x: sx, col: `${hot[0] | 0},${hot[1] | 0},${hot[2] | 0}`, a: 0.25 + alt * 0.6 };
    }
    if (biome.sky && biome.sky.twin) {
      const tp = (p + 0.58) % 1;
      const sp2 = tp >= 0.95 ? (tp - 0.95) / 0.55 : (tp + 0.05) / 0.55;
      const tx2 = -40 + sp2 * (Wc + 80);
      const ty2 = Hc * (0.24 - Math.sin(clamp(sp2, 0, 1) * Math.PI) * 0.14);
      const vis = clamp(dayness + 0.25, 0, 1);
      const c2 = parseCol(biome.sky.twin);
      const halo2 = mixColA([c2[0], c2[1], c2[2], 0.35], parseCol(tod.sunHalo), 0.3);
      ctx.fillStyle = rgbaStr(halo2);
      ctx.beginPath(); ctx.arc(tx2, ty2, 28, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = vis;
      ctx.fillStyle = rgbaStr(mixColA(c2, parseCol(tod.sun), 0.25));
      ctx.beginPath(); ctx.arc(tx2, ty2, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (biome.sky && biome.sky.giant) {
      const gg = biome.sky.giant;
      const gx = Wc * 0.78, gy = Hc * 0.16, gr = clamp(Wc * 0.045, 20, 38);
      const gh = ctx.createRadialGradient(gx, gy, gr * 0.5, gx, gy, gr * 1.8);
      gh.addColorStop(0, 'rgba(255,255,255,0.1)');
      gh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gh;
      ctx.beginPath(); ctx.arc(gx, gy, gr * 1.8, 0, Math.PI * 2); ctx.fill();
      if (!giantCv) { giantCv = document.createElement('canvas'); giantCv.width = 96; giantCv.height = 96; giantCtx = giantCv.getContext('2d'); }
      if (giantKey !== gg.col) {
        giantKey = gg.col;
        const GC = 48, PR = 34;
        giantCtx.globalCompositeOperation = 'source-over';
        giantCtx.clearRect(0, 0, 96, 96);
        giantCtx.save();
        giantCtx.translate(GC, GC);
        giantCtx.fillStyle = gg.col;
        giantCtx.beginPath(); giantCtx.arc(0, 0, PR, 0, Math.PI * 2); giantCtx.fill();
        giantCtx.beginPath(); giantCtx.arc(0, 0, PR - 0.5, 0, Math.PI * 2); giantCtx.clip();
        giantCtx.globalAlpha = 0.16;
        giantCtx.fillStyle = '#1a1420';
        giantCtx.fillRect(-PR, -PR * 0.42, PR * 2, 6);
        giantCtx.fillRect(-PR, -PR * 0.02, PR * 2, 7);
        giantCtx.fillRect(-PR, PR * 0.34, PR * 2, 5);
        giantCtx.globalAlpha = 0.2;
        giantCtx.fillStyle = '#ffffff';
        giantCtx.fillRect(-PR, -PR * 0.55, PR * 2, 3);
        giantCtx.restore();
        giantCtx.globalCompositeOperation = 'destination-out';
        giantCtx.beginPath(); giantCtx.arc(GC + PR * 0.72, GC - PR * 0.5, PR, 0, Math.PI * 2); giantCtx.fill();
        giantCtx.globalCompositeOperation = 'source-over';
      }
      const gs = 96 * (gr / 34);
      ctx.drawImage(giantCv, gx - gs / 2, gy - gs / 2, gs, gs);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(-0.32);
      ctx.strokeStyle = gg.ring;
      ctx.lineWidth = Math.max(2, gr * 0.12);
      ctx.beginPath(); ctx.ellipse(0, 0, gr * 1.75, gr * 0.34, 0, 0, Math.PI); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, gr * 0.05);
      ctx.beginPath(); ctx.ellipse(0, 0, gr * 1.45, gr * 0.26, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }
    for (let c = 0; c < cloudCount; c++) {
      const depth = 0.4 + noise(c * 1.7) * 0.65;
      const cy = Hc * (0.04 + noise(c * 7.7) * 0.26);
      const cw = 110 + noise(c * 3.1) * 150;
      const cx = (((cloudOff * depth) + noise(c * 13) * Wc * 1.4) % (Wc + 420) + (Wc + 420)) % (Wc + 420) - 210;
      const cl = mixColA(pal && pal.cloud ? parseCol(pal.cloud) : [56, 64, 84, 1], [255, 255, 255, 1], dayness);
      const a = (0.16 + noise(c * 5) * 0.10) * (0.5 + 0.5 * dayness) + 0.24 * (1 - dayness);
      const lobes = 16 + ((noise(c * 11.3) * 12) | 0);
      const lob = (b, shrink, lift) => {
        const u = b / (lobes - 1);
        const lx = cx + (u - 0.5) * cw * (1 - shrink * 0.3);
        const lr = Math.max(4, cw * 0.3 * Math.sin(Math.PI * clamp(u * 1.1 + 0.08, 0.08, 0.92)) * (0.65 + noise(c * 17 + b * 3) * 0.7) * (1 - shrink * 0.5));
        const ly = cy - lr * 0.3 - lift + Math.sin(b * 2.3 + c * 1.7) * 3;
        return [lx, ly, lr];
      };
      ctx.fillStyle = `rgba(${cl[0] | 0},${cl[1] | 0},${cl[2] | 0},${a.toFixed(3)})`;
      ctx.beginPath();
      for (let b = 0; b < lobes; b++) { const [lx, ly, lr] = lob(b, 0, 0); ctx.moveTo(lx + lr, ly); ctx.arc(lx, ly, lr, 0, Math.PI * 2); }
      ctx.fill();
      ctx.fillStyle = `rgba(${cl[0] | 0},${cl[1] | 0},${cl[2] | 0},${(a * 0.95).toFixed(3)})`;
      ctx.beginPath();
      for (let b = 1; b < lobes - 1; b += 2) { const [lx, ly, lr] = lob(b, 0.5, cw * 0.07); ctx.moveTo(lx + lr, ly); ctx.arc(lx, ly, lr, 0, Math.PI * 2); }
      ctx.fill();
      const dk = mixColA(cl, [16, 20, 32, 1], 0.45);
      ctx.fillStyle = `rgba(${dk[0] | 0},${dk[1] | 0},${dk[2] | 0},${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      for (let b = 0; b < lobes; b++) { const [lx, ly, lr] = lob(b, 0, 0); ctx.moveTo(lx + lr * 0.92, ly + lr * 0.3); ctx.arc(lx, ly + lr * 0.3, lr * 0.92, 0, Math.PI); }
      ctx.fill();
    }
    const hz = ctx.createLinearGradient(0, Hc * 0.45, 0, Hc * 0.75);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, (pal && pal.haze) || tod.haze);
    ctx.fillStyle = hz;
    ctx.fillRect(-30, Hc * 0.45, Wc + 60, Hc * 0.3);
  }
  
  // ============ CAVE BACKDROP: lighter earth behind the scene ============
  function drawCaveBG() {
    const g = ctx.createLinearGradient(0, 0, 0, Hc);
    g.addColorStop(0, shade(biome.sub[0], 1.7));
    g.addColorStop(0.5, shade(biome.sub[1], 1.45));
    g.addColorStop(1, shade(biome.sub[1], 1.25));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, Wc + 60, Hc + 60);
    if (groundPat) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = groundPat;
      ctx.fillRect(-30, -30, Wc + 60, Hc + 60);
      ctx.globalAlpha = 1;
    }
    // far rock furniture: background stalactites / stalagmite silhouettes
    ctx.fillStyle = hexA(biome.sub[2], 0.5);
    for (let i = 0; i < cols.length; i += 14) {
      const x = i * cols.step;
      const nz = noise(i * 4.1 + 7);
      if (nz > 0.62) {
        const h2 = 20 + (nz - 0.62) * 160;
        ctx.beginPath();
        ctx.moveTo(x - 7, -10); ctx.lineTo(x + 7, -10); ctx.lineTo(x, ceil[i] + h2 * 0.4);
        ctx.closePath(); ctx.fill();
      }
      const nz2 = noise(i * 3.7 + 51);
      if (nz2 > 0.66) {
        const h2 = 16 + (nz2 - 0.66) * 140;
        ctx.beginPath();
        ctx.moveTo(x - 8, Hc + 10); ctx.lineTo(x + 8, Hc + 10); ctx.lineTo(x, cols[i].top - h2 * 0.4);
        ctx.closePath(); ctx.fill();
      }
    }
    // darker vignette toward the edges — depth of the cavern
    const vg = ctx.createRadialGradient(Wc / 2, Hc / 2, Math.min(Wc, Hc) * 0.3, Wc / 2, Hc / 2, Math.max(Wc, Hc) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(-30, -30, Wc + 60, Hc + 60);
  }
  
// ============ CAVE LIGHT PASS: darkness + baked static lights ============
// tglow: tank glows fired this frame by the sweeping beams (drawn after
// the shots so the turrets light up in their player colour); bwlights:
// water columns lit by beams (consumed by the water pass)
let tglow = [];
let bwlights = [];
function drawCaveShade() {
    ctx.fillStyle = 'rgba(3,5,12,0.52)';
    ctx.fillRect(-30, -30, Wc + 60, Hc + 60);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    caveLights.forEach(L => {
      if (L.k !== 'cry') return;
      const fl = 0.65 + 0.35 * Math.sin(gt * L.fl + L.ph);
      const g = ctx.createRadialGradient(L.x, L.y, 1, L.x, L.y, L.r);
      g.addColorStop(0, `rgba(${L.col},${(0.34 * fl).toFixed(3)})`);
      g.addColorStop(1, `rgba(${L.col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); ctx.fill();
      const s = 0.75 + 0.55 * fl;
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.rot);
      ctx.scale(s, s);
      const facet = (w, h, off) => {
        ctx.fillStyle = `rgba(${L.col},${(0.55 + 0.3 * fl).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(-w * 0.5 + off, 0);
        ctx.lineTo(-w * 0.28 + off, -h);
        ctx.lineTo(w * 0.28 + off, -h);
        ctx.lineTo(w * 0.5 + off, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${(0.45 * fl).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(-w * 0.18 + off, -h * 0.06);
        ctx.lineTo(w * 0.1 + off, -h * 0.94);
        ctx.lineTo(w * 0.28 + off, -h);
        ctx.lineTo(w * 0.5 + off, 0);
        ctx.closePath(); ctx.fill();
      };
      if (L.shape === 'needle') facet(3.2, L.g, 0);
      else if (L.shape === 'prism') facet(L.g * 0.9, L.g, 0);
      else if (L.shape === 'druse') {
        for (let h = 0; h < L.heads; h++) facet(L.g * 0.55, L.g * (0.5 + (h & 1) * 0.4), (h - L.heads / 2) * L.g * 0.55);
      } else {
        facet(L.g * 0.7, L.g, -L.g * 0.3);
        facet(L.g * 0.7, L.g * 0.75, L.g * 0.3);
      }
      ctx.restore();
    });
    // ============ the sweeping searchlights ============
    // phase 1: ray-march every beam, recording WHAT it hits — a turret, the
    // ground, a stalactite, or the water (then straight on through the whole
    // depth to the bed). The march is long enough to reach any corner of the
    // scene even at the widest tilt. Phase 2 renders with an overlap boost:
    // two beams on one object make it 1.5x brighter
    const reach = Math.max(Wc, Hc) * 1.6;
    const beams = [];
    caveLights.forEach(L => {
      if (L.k !== 'beam') return;
      const fl = 0.8 + 0.2 * Math.sin(gt * 0.7 + L.ph);
      const an = Math.sin(gt * L.spd + L.ph * 3) * L.sw;
      const dx = Math.sin(an), dy = Math.cos(an);
      let hx = L.x, hy = L.y + 30, kind = null, tank = null, wX = null, wY = null;
      for (let s = 12; s < reach; s += 4) {
        const px = L.x + dx * s, py = L.y + dy * s;
        hx = px; hy = py;
        if (px < 2 || px > Wc - 2) break;
        for (const t of tanks) {
          if (t && !t.dead && Math.abs(px - t.x) < 13 && py > t.y - 34 && py < t.y + 8) { tank = t; break; }
        }
        if (tank) { kind = 'tank'; break; }
        if (py <= ceilAt(px)) { kind = 'ceil'; break; }
        if (py >= surfaceAt(px) - 1) { kind = 'ground'; break; }
        if (py >= waterAt(px) && surfaceAt(px) > waterLevel + 2) {
          wX = px; wY = waterAt(px);
          for (let s2 = s + 4; s2 < reach; s2 += 4) {
            const qx = L.x + dx * s2, qy = L.y + dy * s2;
            hx = qx; hy = qy;
            if (qx < 2 || qx > Wc - 2) break;
            if (qy >= surfaceAt(qx) - 1) { kind = 'bed'; break; }
            if (qy <= ceilAt(qx)) { kind = 'ceil'; break; }
          }
          if (!kind) kind = 'bed';
          break;
        }
      }
      beams.push({ L, fl, dx, dy, hx, hy, kind, tank, wX, wY });
    });
    const tnk = new Map();
    const lit = new Map();
    beams.forEach(b => {
      if (b.tank) {
        const v = tnk.get(b.tank) || { n: 0, lx: b.L.x, ly: b.L.y };
        v.n++;
        tnk.set(b.tank, v);
      }
      if (b.kind === 'ground' || b.kind === 'ceil' || b.kind === 'bed') {
        const ci = clamp(Math.round(b.hx / cols.step), 0, cols.length - 1);
        for (let k = -14; k <= 14; k++) lit.set(ci + k, (lit.get(ci + k) || 0) + 1);
      }
    });
    const boostAt = (x) => (lit.get(clamp(Math.round(x / cols.step), 0, cols.length - 1)) > 1 ? 1.5 : 1);
    // a soft glow hugging a hit surface — bright at the contact, fading to
    // the sides, repeating the surface shape. cool = the underwater bed
    // variant of the lamp's own Kelvin colour
    const bandGlow = (edge, hx, w, a, col, cool) => {
      const cc = cool ? mixTri(col, '185,215,235', 0.55) : col;
      const x0 = clamp(hx - w, 2, Wc - 2), x1 = clamp(hx + w, 2, Wc - 2);
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, `rgba(${cc},0)`);
      g.addColorStop(0.5, `rgba(${cc},${Math.min(1, a).toFixed(3)})`);
      g.addColorStop(1, `rgba(${cc},0)`);
      ctx.save();
      ctx.strokeStyle = g;
      ctx.shadowColor = `rgba(${cc},0.8)`;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, edge(x0));
      for (let px = x0 + cols.step; px <= x1; px += cols.step) ctx.lineTo(px, edge(px));
      ctx.stroke();
      ctx.restore();
    };
    // the beam's landfall on water: the cone follows the WAVE shape (each
    // waterline sample uses the live waterAt), soft entry, no hard edges
    const waterBand = (xa, wY, a, col, w) => {
      const cc = mixTri(col, '235,248,252', 0.35);
      const x0 = clamp(xa - w, 2, Wc - 2), x1 = clamp(xa + w, 2, Wc - 2);
      ctx.save();
      ctx.strokeStyle = `rgba(${cc},${(a * 0.5).toFixed(3)})`;
      ctx.shadowColor = `rgba(${cc},0.7)`;
      ctx.shadowBlur = 9;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, waterAt(x0));
      for (let px = x0 + cols.step; px <= x1; px += cols.step) ctx.lineTo(px, waterAt(px));
      ctx.stroke();
      ctx.restore();
    };
    beams.forEach(b => {
      const L = b.L, fl = b.fl, bc = L.col;
      // the cone: nested layered fills with a ROUNDED head at the lamp —
      // a small radial glow over the fixture instead of a square notch,
      // so nothing square is visible while it sweeps. The fill never ends
      // in a line: it takes the hit surface's shape and fades in a tail
      const nx = -b.dy, ny = b.dx;
      const grad = (lim) => {
        const g = ctx.createLinearGradient(L.x, L.y, b.hx, b.hy);
        g.addColorStop(0, `rgba(${bc},${(0.2 * fl).toFixed(3)})`);
        g.addColorStop(clamp(1 - lim, 0.02, 0.95), `rgba(${bc},${(0.06 * fl).toFixed(3)})`);
        g.addColorStop(1, `rgba(${bc},0)`);
        return g;
      };
      [[2.4, 1], [1.5, 0.95], [0.8, 0.82]].forEach(pp => {
        ctx.fillStyle = grad(pp[1]);
        const hw = L.w * pp[0];
        const tail = pp[1] < 1 ? 1.18 : 1;
        ctx.beginPath();
        // rounded origin: an arc around the fixture instead of a flat cap
        ctx.arc(L.x, L.y, L.w * 0.35, 0, Math.PI * 2);
        ctx.moveTo(L.x + nx * L.w * 0.35, L.y + ny * L.w * 0.35);
        ctx.lineTo(b.hx + nx * hw + b.dx * L.w * tail, b.hy + ny * hw + b.dy * L.w * tail);
        ctx.lineTo(b.hx - nx * hw + b.dx * L.w * tail, b.hy - ny * hw + b.dy * L.w * tail);
        ctx.lineTo(L.x - nx * L.w * 0.35, L.y - ny * L.w * 0.35);
        ctx.closePath(); ctx.fill();
      });
      // the lamp head: a soft round glow over the fixture — the pivot
      // reads as a lit lamp, not a rotating square
      const hg = ctx.createRadialGradient(L.x, L.y, 1, L.x, L.y, L.w * 1.3);
      hg.addColorStop(0, `rgba(${bc},${(0.5 * fl).toFixed(3)})`);
      hg.addColorStop(0.5, `rgba(${bc},${(0.18 * fl).toFixed(3)})`);
      hg.addColorStop(1, `rgba(${bc},0)`);
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.w * 1.3, 0, Math.PI * 2); ctx.fill();
      if (b.kind === 'ground') bandGlow(surfaceAt, b.hx, L.w * 1.6, 0.5 * fl * boostAt(b.hx), bc, false);
      else if (b.kind === 'ceil') bandGlow(ceilAt, b.hx, L.w * 1.6, 0.5 * fl * boostAt(b.hx), bc, false);
      else if (b.kind === 'bed' && b.wY !== null) {
        // through the water: the lit column runs to the BED, the bed glows
        // like dry land (a touch softer), and a handful of slow glints
        const xa = b.wX, xb = b.hx, wY = b.wY, bedY = Math.max(b.hy, wY + 8);
        const wc0 = mixTri(bc, '170,205,230', 0.45);
        const wc1 = mixTri(bc, '125,155,185', 0.72);
        const g = ctx.createLinearGradient(0, wY, 0, bedY);
        g.addColorStop(0, `rgba(${wc0},${(0.16 * fl).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(${wc1},${(0.09 * fl).toFixed(3)})`);
        g.addColorStop(1, `rgba(110,140,170,${(0.05 * fl).toFixed(3)})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(xa - L.w * 0.9, waterAt(xa - L.w * 0.9));
        ctx.lineTo(xa + L.w * 0.9, waterAt(xa + L.w * 0.9));
        ctx.lineTo(xb + L.w * 1.9, bedY);
        ctx.lineTo(xb - L.w * 1.9, bedY);
        ctx.closePath(); ctx.fill();
        // the beam's landfall follows the live wave shape
        waterBand(xa, wY, 0.45 * fl, bc, L.w * 1.1);
        // a few slow, deep glints — a cave pool, not the open sea
        const span = Math.max(1, bedY - wY);
        const ngl = 3;
        for (let q = 0; q < ngl; q++) {
          const f = ((gt * 0.35 + q / ngl + Math.sin(gt * 0.5 + q * 2.3) * 0.1) % 1 + 1) % 1;
          const row = wY + 4 + f * (span - 8);
          const cxr = xa + (xb - xa) * f;
          const a = (0.12 + 0.2 * Math.abs(Math.sin(gt * 0.9 + q * 2.7))) * fl;
          ctx.strokeStyle = `rgba(215,240,252,${a.toFixed(3)})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          const ln = 2 + Math.sin(q * 1.7 + gt * 0.4) * 1.2;
          ctx.moveTo(cxr - ln, row);
          ctx.lineTo(cxr + ln, row + 0.5);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        bandGlow(surfaceAt, b.hx, L.w * 1.5, 0.38 * fl * boostAt(b.hx), bc, true);
      }
      // the lamp fixture on the ceiling
      ctx.fillStyle = `rgba(${bc},0.9)`;
      ctx.fillRect(L.x - L.w * 0.55, L.y - 3, L.w * 1.1, 3);
    });
    // ============ beam-lit tank surfaces ============
    // the lit part of a turret is computed PROPERLY: the lamp direction is
    // marched across the actual silhouette (a coarse bitmap of the hull
    // sprite), and only the perimeter points the ray REACHES get glow —
    // soft additive dots along the truly facing edge. NO radial halo, NO
    // white circle: the lit pixels belong to the surface alone
    const tankGlow = (t, a, lx, ly) => {
        const SZ = 64, C = 32;
        if (!drawCaveShade._cv) {
          drawCaveShade._cv = document.createElement('canvas');
          drawCaveShade._cv.width = SZ; drawCaveShade._cv.height = SZ;
          drawCaveShade._cx = drawCaveShade._cv.getContext('2d', { willReadFrequently: true });
        }
        const sc = drawCaveShade._cx;
        sc.clearRect(0, 0, SZ, SZ);
        // the sprite origin (0,0) of the body maps to the tank's BASE point
        // (t.x, t.y); the offscreen canvas centres it at (C, C+14) so the
        // ~30px silhouette fits — the pixel→world mapping below matches this
        sc.save();
        sc.translate(C, C + 14);
        drawTurretBody(sc, 0, 0, t.col, { noShadow: true, hull: t.hull, seed: 3, dir: t === tanks[0] ? playerDir() : (tanks[1].x < tanks[0].x ? 1 : -1), ang: t.dispAng === undefined ? 45 : t.dispAng });
        sc.restore();
        // the lamp direction, canvas coords (y down), from the body centre
        const ldx = lx - t.x, ldy = ly - (t.y - 13);
        const lLen = Math.hypot(ldx, ldy) || 1;
        const ux = ldx / lLen, uy = ldy / lLen;
        const data = sc.getImageData(0, 0, SZ, SZ).data;
        const at = (px, py) => (px >= 0 && px < SZ && py >= 0 && py < SZ && data[((py | 0) * SZ + (px | 0)) * 4 + 3] > 60);
        const TC = parseCol(t.col);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // every sprite pixel is a surface point: it lights up when it FACES
        // the lamp (cos of the angle between the pixel's outward vector and
        // the lamp direction) and nothing of the hull shades it from the lamp
        // (a short march toward the lamp leaves the sprite unblocked)
        for (let py = 0; py < SZ; py++) {
          for (let px = 0; px < SZ; px++) {
            if (!at(px, py)) continue;
            const dx = px - C, dy = py - (C + 14);
            const dLen = Math.hypot(dx, dy);
            if (dLen < 2) continue;
            // proper facing: normalise the pixel vector by ITS OWN length —
            // the dot is a true cosine in -1..1, threshold 0.3 ~ ±72.5°
            const dot = (dx * ux + dy * uy) / dLen;
            if (dot <= 0.3) continue;
            let blocked = false;
            for (let s = 1.5; s < 42; s += 1.5) {
              const mx = px + ux * s, my = py + uy * s;
              if (mx < 0 || mx >= SZ || my < 0 || my >= SZ) break;
              if (at(mx, my)) { blocked = true; break; }
            }
            if (blocked) continue;
            // squarely facing = bright, grazing = dim — a soft sheen ON the
            // surface, in the player's own colour
            const aa = a * Math.pow((dot - 0.3) / 0.7, 1.25) * 0.34;
            if (aa < 0.02) continue;
            const wx = t.x + dx, wy = t.y + dy;
            ctx.fillStyle = `rgba(${Math.min(255, TC[0] + 45)},${Math.min(255, TC[1] + 45)},${Math.min(255, TC[2] + 45)},${aa.toFixed(3)})`;
            ctx.fillRect(wx, wy, 1, 1);
          }
        }
        ctx.restore();
      };
    tnk.forEach((v, t) => tankGlow(t, clamp(0.85 * (v.n > 1 ? 1.5 : 1), 0, 1), v.lx, v.ly));
    // live fire of the cave feeds its own light into the gloom
    firePatches.forEach(fp => {
      if (!fp.volc) return;
      const y = fp.y !== undefined ? fp.y : surfaceAt(fp.x);
      const g = ctx.createRadialGradient(fp.x, y - 4, 1, fp.x, y - 4, 34);
      g.addColorStop(0, `rgba(${lav().glow},0.22)`);
      g.addColorStop(1, `rgba(${lav().glow},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fp.x, y - 4, 34, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  
  function drawTerrain() {
    const N = cols.length;
    const bk = biomeKey();
    ctx.beginPath();
    ctx.moveTo(-30, Hc + 30);
    ctx.lineTo(-30, cols[0].top);
    for (let i = 0; i < N; i++) ctx.lineTo(i * cols.step, cols[i].top);
    ctx.lineTo(Wc + 30, cols[N - 1].top);
    ctx.lineTo(Wc + 30, Hc + 30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, Hc * 0.25, 0, Hc);
    g.addColorStop(0, biome.sub[0]); g.addColorStop(0.5, biome.sub[1]); g.addColorStop(1, biome.sub[2]);
    ctx.fillStyle = g;
    ctx.fill();
    if (groundPat) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = groundPat;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.clip();
    // per-biome underground strata
    const un = biome.under || { strata: [[biome.sub[1], 26], [biome.sub[2], 54]], wobble: 8, dec: 'root', dep: 'dot', twink: '255,255,255', twN: 0 };
    for (let b = 0; b < un.strata.length; b++) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = un.strata[b][0];
      ctx.beginPath();
      ctx.moveTo(0, Hc);
      for (let x = 0; x <= Wc; x += 14) {
        const i = clamp(Math.round(x / cols.step), 0, N - 1);
        ctx.lineTo(x, cols[i].top + un.strata[b][1] + Math.sin(x * 0.02 + b * 5 + seed % 7) * un.wobble);
      }
      ctx.lineTo(Wc, Hc);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // scattered stones, common to all worlds
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 3; i < N; i += 5) {
      if (noise(i * 4.9) > 0.68) {
        const y = cols[i].top + 14 + noise(i * 2.7) * 60;
        if (y < Hc - 6) ctx.fillRect(i * cols.step, y, 2 + noise(i) * 2.5, 1.6 + noise(i * 1.7) * 1.6);
      }
    }
    // surface signature layer (the cave biomes are vegetation-free by
    // construction, so the flora blocks below never fire for them)
    for (let i = 3; i < N; i += 5) {
      const x = i * cols.step;
      const st = cols[i].top;
      const nz = noise(i * 4.9), nz2 = noise(i * 2.7);
      if (un.dec === 'root' && nz > 0.55) {
        ctx.strokeStyle = shade(un.strata[0][0], 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rl = 6 + nz2 * 12;
        ctx.moveTo(x, st + 3);
        ctx.quadraticCurveTo(x + (nz2 - 0.5) * 8, st + 3 + rl * 0.5, x + (nz - 0.5) * 10, st + 3 + rl);
        ctx.stroke();
      } else if (un.dec === 'cross' && nz > 0.58) {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1;
        const y0 = st + 12 + nz2 * 52;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 7, y0 + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 3, y0 - 5); ctx.lineTo(x + 10, y0 - 1); ctx.stroke();
      } else if (un.dec === 'lens' && nz > 0.62) {
        ctx.fillStyle = 'rgba(215,235,248,0.3)';
        const y0 = st + 14 + nz2 * 46;
        ctx.fillRect(x, y0, 10 + nz * 12, 2);
        ctx.fillRect(x + 3, y0 + 5, 6 + nz * 6, 1.5);
      } else if (un.dec === 'magma' && nz > 0.5) {
        const pul = 0.3 + 0.45 * Math.max(0, Math.sin(gt * 1.4 + i * 0.7));
        ctx.strokeStyle = `rgba(${lav().hot},${pul.toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const y0 = st + 12 + nz2 * 42;
        ctx.moveTo(x, y0);
        ctx.quadraticCurveTo(x + 6, y0 - 5 - Math.sin(gt * 0.9 + i) * 2, x + 12, y0);
        ctx.stroke();
      } else if (un.dec === 'spore' && nz > 0.52) {
        ctx.fillStyle = `rgba(${un.twink},0.22)`;
        const y0 = st + 10 + nz2 * 46;
        ctx.fillRect(x, y0, 2, 2);
        ctx.fillRect(x + 4, y0 + 4, 1.5, 1.5);
        ctx.fillRect(x - 3, y0 + 7, 1.5, 1.5);
      } else if (un.dec === 'grit' && nz > 0.56) {
        ctx.fillStyle = 'rgba(255,220,170,0.3)';
        const y0 = st + 12 + nz2 * 50;
        ctx.fillRect(x, y0, 3, 1.4);
        ctx.fillRect(x + 4, y0 + 3, 2, 1.2);
      } else if (un.dec === 'ember' && nz > 0.6) {
        ctx.fillStyle = `rgba(${un.twink},0.22)`;
        const y0 = st + 12 + nz2 * 46;
        ctx.fillRect(x, y0, 2, 2);
      }
    }
    ctx.lineWidth = 1;
    // DEEP deposits: dots / shards / breathing cracks / crystal veins
    if (soilTw.length !== un.twN || (soilTw.length && (soilTw[0].sd !== seed || soilTw[0].wc !== Wc))) {
      soilTw = [];
      for (let k = 0; k < un.twN; k++) {
        const x = R(0, Wc);
        const base = surfaceAt(x);
        const y = clamp(base + R(12, Math.max(16, Hc - 6 - base)), base + 12, Hc - 4);
        soilTw.push({ x, y, ph: R(0, 6.28), sp: R(0.5, 2.2), s: R(1.4, 2.6), seg: [R(-4, 4), R(-4, 4), R(-4, 4)], l: R(8, 18), sd: seed, wc: Wc });
      }
    }
    for (let k = 0; k < soilTw.length; k++) {
      const tw = soilTw[k];
      if (inVoid(tw.x, tw.y) || tw.y < surfaceAt(tw.x) + 3) continue;
      let a;
      if (tw.dep === undefined) tw.dep = un.dep;
      if (un.dep === 'crack') a = 0.3 + 0.4 * Math.max(0, Math.sin(gt * tw.sp + tw.ph));
      else a = Math.pow(Math.max(0, Math.sin(gt * tw.sp + tw.ph)), un.dep === 'shard' ? 3 : 2);
      if (a < 0.05) continue;
      ctx.strokeStyle = `rgba(${un.twink},${(a * 0.9).toFixed(3)})`;
      ctx.fillStyle = `rgba(${un.twink},${(a * 0.9).toFixed(3)})`;
      if (un.dep === 'crack' || un.dep === 'vein') {
        ctx.lineWidth = un.dep === 'crack' ? 1.5 : 1.2;
        ctx.beginPath();
        ctx.moveTo(tw.x, tw.y);
        ctx.lineTo(tw.x + tw.seg[0], tw.y + tw.l * 0.35);
        ctx.lineTo(tw.x + tw.seg[0] + tw.seg[1], tw.y + tw.l * 0.7);
        ctx.lineTo(tw.x + tw.seg[0] + tw.seg[1] + tw.seg[2], tw.y + tw.l);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (un.dep === 'shard') {
        ctx.fillRect(tw.x, tw.y, 1.6, tw.l * 0.5 + 4);
        ctx.fillRect(tw.x - 1, tw.y + 2, 0.8, 3);
      } else {
        ctx.fillRect(tw.x - tw.s / 2, tw.y, tw.s, tw.s);
      }
    }
  // fuel pockets: the biome's own seams on the surface, the shared fossil
  // seams (CAVE_FUEL) underground
  const fuel = UNDER ? CAVE_FUEL : biome.fuel;
    pockets.forEach(pk => {
      if (pk.state === 2 || !fuel) return;
      const wP = pk.x1 - pk.x0, hP = pk.y1 - pk.y0;
      const ccx = (pk.x0 + pk.x1) / 2, ccy = (pk.y0 + pk.y1) / 2;
      const blobXY = (b) => [ccx + b[0] * wP, ccy + b[1] * hP, Math.max(4, b[2] * wP), Math.max(2.5, b[3] * hP)];
      const blobPath = () => {
        ctx.beginPath();
        pk.bl.forEach(b => { const [bx, by, brx, bry] = blobXY(b); ctx.moveTo(bx + brx, by); ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2); });
      };
      const pr = pk.state === 1 ? clamp(pk.t / pk.dur, 0, 1) : 0;
      const fy = pk.y0 + hP * pr;
      ctx.save();
      blobPath();
      ctx.clip();
      pk.bl.forEach(b => {
        const [bx, by, brx, bry] = blobXY(b);
        ctx.fillStyle = `rgba(${fuel.col},0.42)`;
        ctx.beginPath(); ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2); ctx.fill();
      });
      if (pk.state === 1) {
        ctx.fillStyle = 'rgba(8,6,4,0.6)';
        ctx.fillRect(pk.x0 - wP, pk.y0 - hP * 2, wP * 3, Math.max(0, fy - pk.y0) + 2);
      }
      ctx.fillStyle = `rgba(${fuel.spark},0.5)`;
      for (let k = 0; k < 5; k++) {
        const sx = pk.x0 + ((seed * 31 + k * 47) % (pk.x1 - pk.x0 - 4)) + 2;
        const sy = Math.max(fy + 3, pk.y0 + 4 + ((seed * 17 + k * 53) % Math.max(1, pk.y1 - pk.y0 - 8)));
        ctx.fillRect(sx, sy, 2, 2);
      }
      if (pk.state === 1) {
        ctx.strokeStyle = 'rgba(255,140,40,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pk.x0, fy);
        for (let x = pk.x0 + 6; x < pk.x1; x += 7) ctx.lineTo(x, fy + Math.sin(x * 0.3 + gt * 7) * 2.5);
        ctx.lineTo(pk.x1, fy);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      ctx.restore();
      blobPath();
      ctx.strokeStyle = `rgba(${fuel.col},0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (pk.state === 1) {
        const gl2 = ctx.createRadialGradient(ccx, fy, 2, ccx, fy, wP * 0.7);
        gl2.addColorStop(0, 'rgba(255,110,30,0.25)');
        gl2.addColorStop(1, 'rgba(255,110,30,0)');
        ctx.fillStyle = gl2;
        ctx.fillRect(pk.x0 - 6, fy - 20, pk.x1 - pk.x0 + 12, 40);
      }
    });
    ctx.restore();
    // surface strip + burn + melt + LIQUID LAVA POOLS, per column
    for (let i = 0; i < N; i++) {
      const c = cols[i];
      const x = i * cols.step, w = cols.step + 0.5;
      const prev = i > 0 ? cols[i - 1].top : c.top;
      const sl = (c.top - prev);
      const mouth = c.h1 > 0 && c.h0 <= c.top + 2;
      if (c.surf > 0 && !mouth) {
        ctx.fillStyle = biome.surf;
        ctx.fillRect(x, c.top, w, c.surf);
        ctx.fillStyle = biome.surfHi;
        ctx.fillRect(x, c.top, w, 1.5);
        ctx.fillStyle = sl > 1 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, c.top + 1.5, w, Math.max(0, c.surf - 1.5));
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, c.top, w, 2.5);
      }
      if (c.burn > 0) {
        ctx.globalAlpha = c.burn * 0.5;
        ctx.fillStyle = '#c84818';
        ctx.fillRect(x, c.top, w, 6 + c.burn * 7);
        ctx.globalAlpha = 1;
      }
      if (c.melt > 0) {
        const L = lav();
        ctx.globalAlpha = c.melt * 0.8;
        ctx.fillStyle = `rgb(${L.hot})`;
        ctx.fillRect(x, c.top, w, 3 + c.melt * 6);
        ctx.globalAlpha = c.melt * 0.55;
        ctx.fillStyle = `rgb(${L.core})`;
        ctx.fillRect(x, c.top, w, 2);
        ctx.globalAlpha = 1;
      }
      // the pool: molten = live hot palette with a pulsing skin; cooling =
      // the colour SLIDES to this world's own earth — the mass becomes ground
      if (c.lava > 0.4) {
        const L = lav();
        const hot = c.lavaT < LAVA_MELT;
        const cp = hot ? 0 : clamp((c.lavaT - LAVA_MELT) / (LAVA_COOL - LAVA_MELT), 0, 1);
        const body = hot ? L.hot : mixTri(L.deep, hexTri(biome.sub[1]), cp);
        const skin = hot ? L.core : mixTri(L.hot, hexTri(biome.surf), cp);
        const top = c.top - c.lava;
        ctx.fillStyle = hot
          ? `rgba(${body},${(0.8 + Math.sin(gt * 8 + i) * 0.15).toFixed(2)})`
          : `rgba(${body},${(0.92 - cp * 0.08).toFixed(2)})`;
        ctx.fillRect(x, top, w, c.lava + 0.5);
        ctx.fillStyle = hot
          ? `rgba(${skin},0.9)`
          : `rgba(${skin},${(0.7 * (1 - cp) + 0.28).toFixed(2)})`;
        ctx.fillRect(x, top, w, Math.max(1, c.lava * 0.4));
      }
    }
    // tunnel voids
    {
      let i = 0;
      while (i < N) {
        if (cols[i].h1 <= 0) { i++; continue; }
        let j = i + 1;
        while (j < N && cols[j].h1 > 0) j++;
        const vA = (k) => Math.max(cols[k].h0, cols[k].top);
        const x0 = i * cols.step - 0.5;
        const x1 = (j - 1) * cols.step + cols.step;
        ctx.beginPath();
        ctx.moveTo(x0, vA(i));
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, vA(k));
        for (let k = j - 1; k >= i; k--) ctx.lineTo(k * cols.step, cols[k].h1);
        ctx.closePath();
        const gg = ctx.createLinearGradient(0, vA(i), 0, Math.max(cols[i].h1, vA(i) + 1));
        gg.addColorStop(0, shade(biome.sub[0], 0.5));
        gg.addColorStop(0.35, shade(biome.sub[1], 0.34));
        gg.addColorStop(1, shade(biome.sub[2], 0.42));
        ctx.fillStyle = gg;
        ctx.fill();
        if (groundPat) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = groundPat;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, (vA(i) + cols[i].h1) / 2);
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, (vA(k) + cols[k].h1) / 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(196,168,132,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, vA(i) + 0.5);
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, vA(k) + 0.5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150,116,82,0.4)';
        ctx.beginPath();
        ctx.moveTo(x0, cols[i].h1 - 0.5);
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, cols[k].h1 - 0.5);
        ctx.stroke();
        ctx.lineWidth = 1;
        const mouth = (k) => {
          const c = cols[k];
          if (c.h0 <= c.top + 2) {
            ctx.fillStyle = 'rgba(255,214,150,0.5)';
            ctx.fillRect(k * cols.step - 1, c.top + 1, 2, 2);
            ctx.fillRect(k * cols.step - 1, c.top + 4, 2, 1);
          }
        };
        mouth(i); mouth(j - 1);
        i = j;
      }
    }
    // flora blocks — cave biomes never reach them, kept for surface worlds
    if (bk === 'green') {
      ctx.strokeStyle = 'rgba(52,92,32,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < N; i += 3) {
        const c = cols[i];
        if (c.surf <= 0 || c.burn > 0.2 || (c.h1 > 0 && c.h0 <= c.top + 2)) continue;
        if (noise(i * 13.7) < 0.55) continue;
        const x = i * cols.step;
        const h = 3 + noise(i * 3.3) * 4;
        const sway = Math.sin(gt * 1.6 + i * 0.7) * 1.2;
        ctx.moveTo(x, c.top + 1);
        ctx.lineTo(x + sway, c.top - h);
        if (noise(i * 7.7) > 0.5) {
          ctx.moveTo(x + 2, c.top + 1);
          ctx.lineTo(x + 2 + sway * 0.7, c.top - h * 0.7);
        }
      }
      ctx.stroke();
    } else if (bk === 'xeno') {
      for (let i = 0; i < N; i += 4) {
        const c = cols[i];
        if (c.surf <= 0 || c.burn > 0.2 || (c.h1 > 0 && c.h0 <= c.top + 2)) continue;
        if (noise(i * 9.3) < 0.6) continue;
        const x = i * cols.step;
        const h = 3 + noise(i * 3.3) * 5;
        const sway = Math.sin(gt * 1.3 + i * 0.5) * 1.2;
        ctx.strokeStyle = 'rgba(150,105,215,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, c.top + 1);
        ctx.quadraticCurveTo(x + sway * 0.4, c.top - h * 0.6, x + sway, c.top - h);
        ctx.stroke();
        ctx.fillStyle = 'rgba(140,235,255,0.85)';
        ctx.fillRect(x + sway - 1, c.top - h - 1, 2, 2);
      }
    } else if (bk === 'desert' || bk === 'rust') {
      ctx.strokeStyle = bk === 'rust' ? 'rgba(90,42,28,0.35)' : 'rgba(122,92,52,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < N; i += 6) {
        const c = cols[i];
        if (c.surf <= 0) continue;
        const x = i * cols.step;
        ctx.moveTo(x, c.top + 3);
        ctx.quadraticCurveTo(x + 4, c.top + 1, x + 8, c.top + 3.5);
      }
      ctx.stroke();
    }
    // floor edge line — a neutral rim inside the caves
    const edgePath = () => {
      ctx.beginPath();
      ctx.moveTo(0, cols[0].top);
      for (let i = 1; i < N; i++) ctx.lineTo(i * cols.step, cols[i].top);
    };
//scorch.ui.js part02
    ctx.strokeStyle = UNDER ? 'rgba(255,255,255,0.1)' : (isDayT() ? 'rgba(80,160,60,0.55)' : 'rgba(46,204,113,0.4)');
    ctx.lineWidth = 1.6;
    edgePath(); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = UNDER ? 'rgba(255,255,255,0.06)' : (isDayT() ? 'rgba(190,240,160,0.3)' : 'rgba(150,255,190,0.22)');
    ctx.save();
    ctx.translate(0, 0.5);
    edgePath(); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
    // ============ THE CAVE CEILING: inverted ground, full width ============
    if (UNDER && ceil) {
      ctx.beginPath();
      ctx.moveTo(-30, -30);
      ctx.lineTo(-30, ceil[0]);
      for (let i = 0; i < N; i++) ctx.lineTo(i * cols.step, ceil[i]);
      ctx.lineTo(Wc + 30, ceil[N - 1]);
      ctx.lineTo(Wc + 30, -30);
      ctx.closePath();
      const gc = ctx.createLinearGradient(0, 0, 0, Hc * 0.3);
      gc.addColorStop(0, shade(biome.sub[1], 0.9));
      gc.addColorStop(1, biome.sub[0]);
      ctx.fillStyle = gc;
      ctx.fill();
      if (groundPat) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = groundPat;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // the underside edge of the ceiling — the "inverted surface"
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-30, ceil[0]);
      for (let i = 0; i < N; i++) ctx.lineTo(i * cols.step, ceil[i] + 0.5);
      ctx.stroke();
      ctx.lineWidth = 1;
      // fossil vents: dormant = a faint warm seam, erupting = a pulsing
      // furnace mouth in the rock, spent = a dead dark crack
      caveVents.forEach(v => {
        const cx = (v.x0 + v.x1) / 2;
        const cy = ceilAt(cx);
        const L = lav();
        const gl = v.state === 1 ? 0.5 + 0.4 * Math.sin(gt * 18) : v.state === 0 ? 0.16 + 0.1 * Math.sin(gt * 2 + cx) : 0.05;
        const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, 26);
        gr.addColorStop(0, `rgba(${L.glow},${(gl * 0.8).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${L.glow},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(cx, cy, (v.x1 - v.x0) / 2, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${v.state === 2 ? '20,16,14' : L.hot},${Math.max(0.25, gl).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(v.x0, cy - 1); ctx.lineTo(v.x0 + 6, cy - 4); ctx.lineTo(cx, cy - 7);
        ctx.lineTo(v.x1 - 5, cy - 3); ctx.lineTo(v.x1, cy - 1);
        ctx.stroke();
        ctx.lineWidth = 1;
      });
    }
    if (volcano) {
      volcano.craters.forEach(cr => {
        if (cr.y > waterAt(cr.x)) return;
        const L = lav();
        const gg = ctx.createRadialGradient(cr.x, cr.y, 1, cr.x, cr.y, 8);
        gg.addColorStop(0, `rgba(${L.glow},${(0.25 + volcano.power * 0.2).toFixed(3)})`);
        gg.addColorStop(1, `rgba(${L.glow},0)`);
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(cr.x, cr.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgb(${L.hot})`;
        ctx.fillRect(cr.x - 2, cr.y - 1, 4, 2);
      });
    }
  }
  
  function drawWater() {
    if (!waterH) return;
    ensureWaterFx();
    const dark = !isDayT();
    const N = cols.length;
    const wp = biome.pal && biome.pal.water;
    let sc, dc;
    if (UNDER) {
      // cave water: deep, still, NO sky mirror, NO reflections
      const wtop = parseCol(wp ? wp.top : '#3a4a5a');
      const m = mixColA(wtop, [12, 18, 28, 1], 0.62);
      sc = [clamp(Math.round(m[0]), 0, 255), clamp(Math.round(m[1]), 0, 255), clamp(Math.round(m[2]), 0, 255)];
      dc = parseCol(wp ? wp.deep : '#0a141e');
    } else {
      const L = tod.stops.length;
      const hz = mixColA(parseCol(tod.stops[Math.max(0, L - 2)]), parseCol(tod.stops[L - 1]), 0.5);
      if (wp) {
        const m = mixColA(parseCol(wp.top), hz, dark ? 0.55 : 0.4);
        sc = [clamp(Math.round(m[0]), 0, 255), clamp(Math.round(m[1]), 0, 255), clamp(Math.round(m[2]), 0, 255)];
        dc = parseCol(wp.deep);
      } else {
        const f = dark ? 0.6 : 1;
        sc = [
          clamp(Math.round(hz[0] * 0.82 * f), 0, 255),
          clamp(Math.round(hz[1] * 0.92 * f + 4), 0, 255),
          clamp(Math.round(hz[2] * 0.98 * f + 14), 0, 255)
        ];
        dc = [
          clamp(Math.round(hz[0] * 0.22 + 6), 0, 255),
          clamp(Math.round(hz[1] * 0.3 + 12), 0, 255),
          clamp(Math.round(hz[2] * 0.4 + 26), 0, 255)
        ];
      }
    }
    const g = ctx.createLinearGradient(0, waterLevel - 14, 0, Hc * 0.98);
    g.addColorStop(0, `rgba(${sc[0]},${sc[1]},${sc[2]},0.5)`);
    g.addColorStop(0.45, `rgba(${(sc[0] * 0.45 + dc[0] * 0.55) | 0},${(sc[1] * 0.45 + dc[1] * 0.55) | 0},${(sc[2] * 0.45 + dc[2] * 0.55) | 0},0.66)`);
    g.addColorStop(1, `rgba(${dc[0]},${dc[1]},${dc[2]},0.88)`);
    const bodyPath = () => {
      ctx.beginPath();
      if (WATER_MODE === 2) {
        ctx.moveTo(-30, waterLevel + waterH[0]);
        for (let k = 0; k < N; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
        ctx.lineTo(Wc + 30, waterLevel + waterH[N - 1]);
        ctx.lineTo(Wc + 30, Hc + 30);
        ctx.lineTo(-30, Hc + 30);
        ctx.closePath();
      } else {
        let i = 0;
        while (i < N) {
          if (cols[i].top <= waterLevel) { i++; continue; }
          let j = i + 1;
          while (j < N && cols[j].top > waterLevel) j++;
          ctx.moveTo(i * cols.step, waterLevel + waterH[i]);
          for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
          for (let k = j - 1; k >= i; k--) ctx.lineTo(k * cols.step, cols[k].top);
          ctx.closePath();
          i = j;
        }
      }
    };
    ctx.fillStyle = g;
    bodyPath();
    ctx.fill();
    ctx.save();
    bodyPath();
    ctx.clip();
    for (let b = 0; b < wBands.length; b++) {
      const wb = wBands[b];
      const bw = Math.max(150, Wc * wb.w);
      const span = Wc + bw;
      let bx = (gt * wb.sp * 50 + wb.ph * 90) % span;
      if (bx < 0) bx += span;
      bx = bx - bw + Math.sin(gt * 0.4 + wb.ph) * 14;
      const by = waterLevel + wb.d;
      const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.5, `rgba(${Math.min(255, sc[0] + 40)},${Math.min(255, sc[1] + 40)},${Math.min(255, sc[2] + 30)},0.12)`);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(bx, by, bw, 5);
    }
    ctx.fillStyle = `rgb(${Math.min(255, sc[0] + 30)},${Math.min(255, sc[1] + 30)},${Math.min(255, sc[2] + 20)})`;
    for (let b = 0; b < wBlobs.length; b++) {
      const wb = wBlobs[b];
      const x = wb.fx * Wc + Math.sin(gt * 0.25 + wb.ph) * 10;
      const y = waterLevel + wb.d + Math.sin(gt * 0.18 + wb.ph * 2) * 5;
      ctx.globalAlpha = clamp(wb.a * (0.45 + 0.55 * Math.sin(gt * 0.5 + wb.ph)), 0, 0.5);
      ctx.fillRect(x, y, 2.2 * wb.s, 1.4);
    }
    ctx.globalAlpha = 1;
    // sun road glints — surface worlds only (UNDER has no luminary)
    const lOn = !UNDER && skyLight.x > 10 && skyLight.x < Wc - 10 && skyLight.a > 0.06;
    const cdim = 1 - 0.45 * clamp((tod.clouds - 0.2) / 0.35, 0, 1);
    const LI = lOn ? clamp(skyLight.a * cdim, 0, 1) : 0;
    if (LI > 0.03) {
      const lp = skyLight.col.split(',');
      const sr = Math.min(255, (clamp(+lp[0] || 0, 0, 255) | 0) + 25);
      const sg2 = Math.min(255, (clamp(+lp[1] || 0, 0, 255) | 0) + 25);
      const sb2 = Math.min(255, (clamp(+lp[2] || 0, 0, 255) | 0) + 25);
      for (let q = 0; q < glints.length; q++) {
        const gl = glints[q];
        if (gl.fl < 0) continue;
        const gx = gl.axis ? skyLight.x + gl.u * (5 + gl.dy * 0.55) : gl.x;
        const pr = gl.fl / gl.dur;
        let a;
        if (pr < gl.rise) a = pr / gl.rise;
        else if (pr < gl.rise + gl.hold) a = 1;
        else a = clamp(1 - (pr - gl.rise - gl.hold) / Math.max(0.01, 1 - gl.rise - gl.hold), 0, 1);
        const A = a * LI;
        if (A <= 0.02) continue;
        const yb = waterAt(gx);
        const yC = (xx) => yb + 1 + gl.dy + clamp(waterAt(xx) - yb, -1.5, 1.5);
        const ln = gl.len;
        const x0 = gx - ln / 2;
        ctx.strokeStyle = `rgba(${sr},${sg2},${sb2},${(A * 0.95).toFixed(3)})`;
        ctx.lineWidth = gl.wdt;
        ctx.beginPath();
        ctx.moveTo(x0, yC(x0));
        ctx.lineTo(gx, yC(gx));
        ctx.lineTo(x0 + ln, yC(x0 + ln));
        ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = A * 0.34;
        ctx.strokeStyle = `rgba(${sr},${sg2},${sb2},0.6)`;
        ctx.lineWidth = gl.wdt + 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, yC(gx));
        ctx.lineTo(x0 + ln, yC(gx));
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.lineCap = 'butt';
      }
    }
    ctx.restore();
    for (let k = 0; k < N; k++) {
      const c = cols[k];
      if (c.h1 <= 0) continue;
      const v0 = Math.max(c.h0, c.top);
      const wy = Math.max(v0, waterLevel + waterH[k] * 0.5);
      if (c.h1 > wy + 1) {
        ctx.fillStyle = `rgba(${sc[0]},${sc[1]},${sc[2]},0.55)`;
        ctx.fillRect(k * cols.step, wy, cols.step + 0.5, c.h1 - wy);
        ctx.fillStyle = `rgba(${dc[0]},${dc[1]},${dc[2]},0.55)`;
        ctx.fillRect(k * cols.step, c.h1 - 3, cols.step + 0.5, 3);
        if (waterLevel > v0) {
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(k * cols.step, waterLevel + waterH[k] * 0.5, cols.step + 0.5, 1);
        }
      }
    }
    const surfPath = () => {
      ctx.beginPath();
      if (WATER_MODE === 2) {
        ctx.moveTo(-30, waterLevel + waterH[0]);
        for (let k = 0; k < N; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
      } else {
        let started = false;
        for (let k = 0; k < N; k++) {
          const x = k * cols.step, y = waterLevel + waterH[k];
          if (cols[k].top <= waterLevel) { started = false; continue; }
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
      }
    };
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(${Math.min(255, sc[0] + 70)},${Math.min(255, sc[1] + 70)},${Math.min(255, sc[2] + 60)},0.8)`;
    surfPath(); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(6,20,40,0.3)';
    ctx.save();
    ctx.translate(0, 1.6);
    surfPath(); ctx.stroke();
    ctx.restore();
    // beam-lit water in caves: the lit column runs from the waterline to
  // the BED, the whole cone width brightens and gains sun-road-style
  // glints as if the beam were the luminary
  if (UNDER && bwlights.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    bwlights.forEach(B => {
      const wl = waterAt((B.x0 + B.x1) / 2);
      if (B.ly > wl - 6) return;
      const wid = Math.max(B.x1 - B.x0, 14);
      const g = ctx.createLinearGradient(B.x0 - 0, B.ly, B.x0, Math.min(Hc, wl + (Hc - wl) * 0.85));
      g.addColorStop(0, `rgba(190,215,235,${(0.16 * B.fl).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(140,170,200,${(0.10 * B.fl).toFixed(3)})`);
      g.addColorStop(1, `rgba(80,110,140,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(B.x0 - 3, B.ly);
      ctx.lineTo(B.x1 + 3, B.ly);
      ctx.lineTo(B.x1 + 3 + wid * 0.3, Math.min(Hc, wl + (Hc - wl) * 0.9));
      ctx.lineTo(B.x0 - 3 - wid * 0.3, Math.min(Hc, wl + (Hc - wl) * 0.9));
      ctx.closePath(); ctx.fill();
      // glints like the sun road: flare points along the lit column
      const cn = Math.round(wid / 4) + 4;
      for (let q = 0; q < cn; q++) {
        const gx = R(B.x0, B.x1);
        const gy = R(B.ly + 4, Math.min(Hc - 4, wl + (Hc - wl) * 0.8));
        const dw = waterAt(gx) - gy;
        if (dw < 6) continue;
        const a = (0.3 + 0.4 * Math.sin(q * 3.7 + gt * 2)) * B.fl * clamp(dw / 40, 0.3, 1);
        ctx.strokeStyle = `rgba(210,235,250,${a.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const ln = 3 + Math.sin(q * 2.1 + gt) * 1.5;
        ctx.moveTo(gx - ln, gy);
        ctx.lineTo(gx + ln, gy + 1);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    });
    ctx.restore();
  }
  const starA = UNDER ? 0 : clamp(((1 - dayness) - 0.25) / 0.5, 0, 1);
    if (starA > 0.35) {
      ctx.fillStyle = `rgba(230,240,255,${(0.5 * starA).toFixed(3)})`;
      for (let k = 0; k < 14; k++) {
        const x = (noise(k * 5.3 + 11) * Wc) % Wc;
        if (WATER_MODE !== 2 && surfaceAt(x) <= waterLevel) continue;
        const y = waterAt(x);
        const tw = Math.abs(Math.sin(gt * (1.5 + noise(k) * 2) + k * 2.4));
        if (tw > 0.6) ctx.fillRect(x, y - 0.8, 1.4, 1.4);
      }
    }
    if (lOn && (WATER_MODE === 2 || surfaceAt(skyLight.x) > waterLevel + 6)) {
      const baseA = skyLight.a * 0.22 * cdim;
      for (let k = 0; k < 9; k++) {
        const yy = waterAt(skyLight.x) + 2 + k * 5;
        if (surfaceAt(skyLight.x) <= yy) break;
        const wob = Math.sin(gt * 1.4 + k * 1.7) * 4;
        const w2 = (14 - k) * (0.7 + 0.5 * noise(k * 3.1 + gt * 0.7));
        ctx.fillStyle = `rgba(${skyLight.col},${(baseA * (1 - k * 0.09)).toFixed(3)})`;
        ctx.fillRect(skyLight.x - w2 / 2 + wob, yy, w2, 1.6);
      }
    }
  }
  
  function drawHpLate() {
    fx.forEach(f => {
      if (f.k !== 'hp') return;
      const p = f.t / f.life;
      const a = 1 - p;
      const yy = f.y - ease(p) * 34;
      ctx.font = '700 18px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp(a * 1.4, 0, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText('-' + f.val, f.x, yy);
      ctx.fillStyle = f.val >= 25 ? '#ff5a4a' : '#ffd23f';
      ctx.fillText('-' + f.val, f.x, yy);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    });
  }
  
  function drawBanners() {
    fx.forEach(f => {
      if (f.k !== 'banner') return;
      const p = f.t / f.life;
      const inT = clamp(f.t / 0.22, 0, 1);
      const outA = clamp((1 - p) * 3, 0, 1);
      const sc = 1 + (1 - ease(inT)) * 0.5;
      const fs = clamp(Wc * 0.085, 36, 74) * sc;
      ctx.save();
      ctx.translate(Wc / 2, Hc * 0.34);
      ctx.globalAlpha = outA;
      ctx.textAlign = 'center';
      ctx.font = `900 ${fs}px Orbitron, monospace`;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(4, fs * 0.1);
      ctx.strokeText(f.txt, 0, 0);
      const g = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.2);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.55, f.col);
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.fillText(f.txt, 0, 0);
      ctx.restore();
    });
  }
  
  function drawTurnCards() {
    if (!turnCard || turnIntro <= 0) return;
    const outA = clamp(turnIntro * 2.5, 0, 1);
    const fs = clamp(Wc * 0.055, 26, 52);
    ctx.save();
    ctx.translate(Wc / 2, Hc * 0.42);
    ctx.globalAlpha = outA;
    ctx.textAlign = 'center';
    ctx.font = `700 ${fs * 0.38}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('ХОД ПЕРЕДАН', 0, -fs * 0.62);
    ctx.font = `900 ${fs}px Orbitron, monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(4, fs * 0.09);
    ctx.strokeText(turnCard.txt, 0, fs * 0.35);
    const g = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.55, turnCard.col);
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillText(turnCard.txt, 0, fs * 0.35);
    const left = Math.max(1, Math.ceil(turnIntro));
    const blink = turnIntro <= 1;
    ctx.font = `900 ${fs * 0.7}px Orbitron, monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(3, fs * 0.07);
    ctx.strokeText('' + left, 0, fs * 1.05);
    ctx.fillStyle = blink ? (Math.sin(gt * 10) < 0 ? '#ff2a1a' : '#ff5a4a') : turnCard.col;
    ctx.fillText('' + left, 0, fs * 1.05);
    ctx.restore();
  }
  
  // lava bombs ride the world's lava palette
  function drawLavaBits() {
    if (!lavaBits.length) return;
    const L = lav();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${L.hot},0.4)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    lavaBits.forEach(lb => { ctx.moveTo(lb.x - lb.vx * 0.035, lb.y - lb.vy * 0.035); ctx.lineTo(lb.x, lb.y); });
    ctx.stroke();
    ctx.fillStyle = `rgba(${L.hot},0.85)`;
    ctx.beginPath();
    lavaBits.forEach(lb => { ctx.moveTo(lb.x + lb.s, lb.y); ctx.arc(lb.x, lb.y, lb.s, 0, Math.PI * 2); });
    ctx.fill();
    ctx.fillStyle = `rgba(${L.core},0.9)`;
    ctx.beginPath();
    lavaBits.forEach(lb => { ctx.moveTo(lb.x + lb.s * 0.45, lb.y); ctx.arc(lb.x, lb.y, lb.s * 0.45, 0, Math.PI * 2); });
    ctx.fill();
    ctx.restore();
  }
  function drawFx() {
    fx.forEach(f => {
      const p = f.t / f.life;
      if (f.k === 'flash') {
        // ragged flash: main disc + three offset lobes + white-hot core
        const a0 = Math.max(0, 1 - p);
        if (f.sd === undefined) f.sd = R(0, 100);
        ctx.globalAlpha = a0 * 0.95;
        ctx.fillStyle = f.col || '#fff';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + p * 0.5), 0, Math.PI * 2); ctx.fill();
        for (let b = 0; b < 3; b++) {
          const an = f.sd + b * 2.1 + p * 2;
          const rr = f.r * (0.28 + 0.25 * Math.abs(Math.sin(f.sd * 1.3 + b * 1.7)));
          ctx.globalAlpha = a0 * (0.5 - b * 0.12);
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(an) * f.r * 0.3, f.y + Math.sin(an) * f.r * 0.25, rr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = a0 * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.3 * (0.6 + p * 0.6), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.k === 'skyflash') {
        ctx.fillStyle = f.col + (f.a * (1 - p) * (1 - p)).toFixed(3) + ')';
        ctx.fillRect(-40, -40, Wc + 80, Hc + 80);
      } else if (f.k === 'star') {
        const rad = f.r * (0.35 + ease(p) * 1.2);
        const a = 1 - p;
        const n = f.spikes || 8, rot = f.rot || 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${f.col},${(a * 0.5).toFixed(3)})`;
        ctx.beginPath();
        for (let k = 0; k < n * 2; k++) {
          const an = rot + k * Math.PI / n;
          const rr = (k & 1) ? rad * 0.55 : rad * (0.8 + Math.sin(k * 3.7) * 0.2);
          ctx.lineTo(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * 0.85);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${(a * 0.85).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, rad * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === 'spark') {
        const a = 1 - p, rad = f.r * 0.3 + ease(p) * f.r * 1.1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        (f.pts || []).forEach(q => {
          const an = q.a + p * q.spin;
          ctx.strokeStyle = `rgba(${f.col},${(a * 0.8).toFixed(3)})`;
          ctx.lineWidth = q.w;
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(an) * rad, f.y + Math.sin(an) * rad);
          ctx.lineTo(f.x + Math.cos(an) * (rad + q.l * f.r), f.y + Math.sin(an) * (rad + q.l * f.r));
          ctx.stroke();
        });
        ctx.restore();
        ctx.lineWidth = 1; ctx.lineCap = 'butt';
      } else if (f.k === 'crackle') {
        const a = 1 - p, rad = f.r * (0.7 + ease(p) * 1.5);
        ctx.fillStyle = `rgba(${f.col},${(a * 0.7).toFixed(3)})`;
        for (let k = 0; k < 14; k++) {
          const an = k / 14 * Math.PI * 2 + (k % 3) * 0.2;
          const rr = rad * (0.9 + Math.sin(k * 5.3 + (f.rot || 0)) * 0.15);
          ctx.fillRect(f.x + Math.cos(an) * rr - 1, f.y + Math.sin(an) * rr * 0.8 - 1, 2, 2);
        }
      } else if (f.k === 'ring') {
        const r = f.r0 + (f.r1 - f.r0) * ease(p);
        ctx.strokeStyle = `rgba(${f.col},${(0.55 * (1 - p)).toFixed(3)})`;
        ctx.lineWidth = 2.5 * (1 - p) + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'wring') {
        const a = 1 - p;
        ctx.strokeStyle = `rgba(200,230,255,${(0.55 * a).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, Math.max(1.5, f.r * 0.24), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'ember') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const a = 1 - p;
        const col = p < 0.35 ? '255,210,110' : p < 0.65 ? '255,130,40' : '170,50,20';
        ctx.fillStyle = `rgba(${col},${(a * 0.9).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,220,${(a * 0.5).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.s * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === 'jet') {
        const a = 1 - p;
        const h = f.h === undefined ? f.hMax * 0.3 : f.h;
        const flick = 1 + Math.sin(gt * 24 + f.x) * 0.15;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.75;
        const g = ctx.createLinearGradient(0, f.y, 0, f.y - h);
        g.addColorStop(0, 'rgba(255,190,80,0.85)');
        g.addColorStop(0.5, 'rgba(255,90,30,0.5)');
        g.addColorStop(1, 'rgba(200,40,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.w * 0.5 * flick, f.y - h, f.w * flick, h);
        ctx.restore();
      } else if (f.k === 'lflow') {
        const L = lav();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const tr = f.trail || [];
        const n = tr.length;
        for (let s = 1; s < n; s++) {
          const a = s / n;
          ctx.strokeStyle = `rgba(${a > 0.6 ? L.core : L.hot},${(0.2 + 0.5 * a).toFixed(3)})`;
          ctx.lineWidth = 1 + f.s * 1.7 * a;
          ctx.beginPath();
          ctx.moveTo(tr[s - 1].x, tr[s - 1].y);
          ctx.lineTo(tr[s].x, tr[s].y);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.s * 2.4);
        g.addColorStop(0, `rgba(${L.core},0.95)`);
        g.addColorStop(0.45, `rgba(${L.hot},0.75)`);
        g.addColorStop(1, `rgba(${L.deep},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.s * 1.6, f.s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === 'vsmoke') {
        const a = 1 - p;
        const col = f.steam ? `rgba(215,228,240,${(0.25 * a).toFixed(3)})` : `rgba(28,24,22,${(0.36 * a).toFixed(3)})`;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.15, f.r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'shock') {
        const r = f.r0 + (f.r1 - f.r0) * ease(p);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
        ctx.lineWidth = 2.5 - p;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * 0.88, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.2 * (1 - p)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'shieldPop') {
        const a = 1 - p;
        ctx.strokeStyle = hexA(f.col, 0.7 * a);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, 16 + p * 20, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = hexA(f.col, 0.25 * a);
        ctx.beginPath(); ctx.arc(f.x, f.y, 16 + p * 20, Math.PI, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1;
      } else if (f.k === 'plasmaOrb') {
        const r = p < 0.15 ? f.r * (0.3 + (p / 0.15) * 0.7) : f.r;
        const GW = f.gw || 34;
        const cell = (2 * r) / GW;
        const want = Math.floor(f.t / 0.1);
        while (f.gen < want) {
          f.gen++;
          const src = f.grid;
          const dst = new Uint8Array(src.length);
          let pop = 0;
          for (let gy = 0; gy < GW; gy++) {
            for (let gx = 0; gx < GW; gx++) {
              let n = 0;
              for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                  if (ox || oy) n += src[((gy + oy + GW) % GW) * GW + ((gx + ox + GW) % GW)];
                }
              }
              const a = src[gy * GW + gx];
              const v = (n === 3 || (a && n === 2)) ? 1 : 0;
              dst[gy * GW + gx] = v;
              pop += v;
            }
          }
          f.grid = dst;
          for (let m = 0; m < 3; m++) {
            const rx = (Math.random() * GW) | 0, ry = (Math.random() * GW) | 0;
            if (Math.hypot(rx - GW / 2, ry - GW / 2) < GW * 0.42) f.grid[ry * GW + rx] = 1;
          }
          if (pop < 6) {
            for (let k = 0; k < 40; k++) {
              const rx = clamp((GW / 2 + R(-9, 9)) | 0, 0, GW - 1);
              const ry = clamp((GW / 2 + R(-9, 9)) | 0, 0, GW - 1);
              f.grid[ry * GW + rx] = 1;
            }
          }
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(1 - p * 0.55, 0.25, 0.9);
        const s = Math.max(1, cell * 0.85);
        for (let gy = 0; gy < GW; gy++) {
          for (let gx = 0; gx < GW; gx++) {
            if (!f.grid[gy * GW + gx]) continue;
            ctx.fillStyle = ((gx + gy) & 1) ? 'rgba(255,215,110,0.85)' : 'rgba(255,70,40,0.9)';
            ctx.fillRect(f.x - r + gx * cell, f.y - r + gy * cell, s, s);
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (f.k === 'fire') {
        // inhomogeneous fireball: three jittered sub-blobs + flame tongues
        const r = f.r * (0.5 + ease(p) * 0.7);
        const flick = Math.sin(gt * 31 + f.x) * 0.12;
        if (f.sd === undefined) f.sd = R(0, 100);
        const sd = f.sd;
        const baseA = Math.max(0, 1 - p * 1.15);
        for (let b = 0; b < 3; b++) {
          const bx = f.x + Math.sin(gt * (8.7 + b * 4.3) + sd + b * 2.7) * r * (0.2 + b * 0.04);
          const by = f.y + Math.cos(gt * (6.9 + b * 3.7) + sd * 1.7 + b * 1.9) * r * 0.14 - b * r * 0.1;
          const br = Math.max(4, r * (0.62 + 0.16 * Math.sin(sd + b * 2.2) - b * 0.1));
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          if (f.nuke) { g.addColorStop(0, '#fff8e0'); g.addColorStop(0.5, '#ffc23a'); g.addColorStop(1, '#b83a10'); }
          else { g.addColorStop(0, '#ffe8b0'); g.addColorStop(0.55, f.col ? `rgba(${f.col},0.8)` : '#e8802a'); g.addColorStop(1, 'rgba(120,40,10,0)'); }
          ctx.globalAlpha = baseA * (b ? 0.75 : 1);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(bx, by, br * (1 + flick * 0.5), br * (1 - flick * 0.5), b * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 4; b++) {
          const th = r * (0.4 + 0.22 * Math.abs(Math.sin(sd + b * 1.8))) * (0.5 + 0.5 * Math.sin(gt * 17 + b * 2.9 + sd));
          if (th <= 2) continue;
          const tx = f.x + Math.sin(sd * 1.3 + b * 2.4) * r * 0.34 + Math.sin(gt * 13 + b * 3.1 + sd) * r * 0.08;
          ctx.globalAlpha = baseA * 0.5;
          ctx.fillStyle = (b & 1) ? '#ffd23f' : `rgba(${f.col || '232,128,42'},0.9)`;
          ctx.beginPath();
          ctx.moveTo(tx - r * 0.1, f.y + r * 0.1);
          ctx.quadraticCurveTo(tx - r * 0.06, f.y - th * 0.5, tx + Math.sin(gt * 9 + b) * r * 0.06, f.y - th);
          ctx.quadraticCurveTo(tx + r * 0.08, f.y - th * 0.5, tx + r * 0.12, f.y + r * 0.1);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        if (p < 0.55) {
          ctx.globalAlpha = (1 - p / 0.55) * 0.75;
          ctx.fillStyle = '#fff6dc';
          ctx.beginPath();
          ctx.arc(f.x + Math.sin(gt * 11 + sd) * r * 0.05, f.y, r * (0.28 + p * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'smoke') {
        const r = f.r * (1 + p * 1.2);
        ctx.fillStyle = `rgba(62,58,54,${0.2 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'wisp') {
        ctx.strokeStyle = `rgba(226,238,244,${(0.18 * (1 - p)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sw = Math.sin(gt * 2 + (f.ph || 0)) * 3;
        ctx.moveTo(f.x - 2, f.y);
        ctx.quadraticCurveTo(f.x + sw, f.y - 5, f.x - 1, f.y - 10);
        ctx.quadraticCurveTo(f.x - sw - 2, f.y - 15, f.x + 1, f.y - 20);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'bubble') {
        ctx.strokeStyle = `rgba(200,230,255,${0.55 * (1 - p)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'drop') {
        ctx.fillStyle = `rgba(178,215,242,${0.8 * (1 - p * 0.4)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'wcol') {
        const a = 1 - p;
        const hgt = Math.sin(Math.min(1, p * 1.35) * Math.PI) * f.r * 1.6;
        ctx.fillStyle = `rgba(185,218,240,${0.5 * a})`;
        ctx.beginPath();
        ctx.moveTo(f.x - f.r * 0.16, f.y);
        ctx.quadraticCurveTo(f.x - f.r * 0.09, f.y - hgt * 0.55, f.x, f.y - hgt);
        ctx.quadraticCurveTo(f.x + f.r * 0.09, f.y - hgt * 0.55, f.x + f.r * 0.16, f.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(225,242,252,${0.4 * a})`;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 2, f.r * 0.3, 4 + p * 3, 0, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'mush') {
        ctx.globalAlpha = 0.5 * (1 - p * 0.8);
        const rise = ease(p) * f.r * 0.9;
        const capY = f.y - rise;
        ctx.fillStyle = 'rgba(120,105,95,0.55)';
        for (let b = 0; b < 5; b++) {
          const a = b / 5 * Math.PI * 2 + gt * 0.3;
          ctx.beginPath();
          ctx.ellipse(f.x + Math.cos(a) * f.r * 0.4, capY + Math.sin(a) * f.r * 0.12, f.r * (0.55 - b * 0.06), f.r * (0.3 - b * 0.03), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(100,88,78,0.5)';
        ctx.fillRect(f.x - f.r * 0.2, capY, f.r * 0.4, rise + f.r * 0.4);
        ctx.globalAlpha = 1;
      } else if (f.k === 'splash') {
        ctx.strokeStyle = `rgba(200,230,255,${0.7 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + p), Math.PI, Math.PI * 2); ctx.stroke();
      }
    });
  }
  
  function drawDebris() {
    debris.forEach(d => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.col;
      ctx.fillRect(-d.s / 2, -d.s / 2, d.s, d.s * 0.8);
      ctx.restore();
    });
  }
  
  function drawWreckBits() {
    wreckBits.forEach(w => {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.rot);
      ctx.fillStyle = w.col;
      ctx.fillRect(-w.s / 2, -w.s / 2, w.s, w.s * 0.75);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-w.s / 2, w.s * 0.25, w.s, w.s * 0.25);
      ctx.restore();
    });
  }
  
  function drawLiquids() {
    liquids.forEach(l => {
      ctx.fillStyle = l.w.col;
      ctx.beginPath(); ctx.arc(l.x, l.y, 2.2, 0, Math.PI * 2); ctx.fill();
    });
  }
  
  // volcano fires carry the world's lava palette
  function drawFire() {
    const L = lav();
    firePatches.forEach(fp => {
      const y = fp.volc && fp.y !== undefined ? fp.y : surfaceAt(fp.x);
      const k = clamp(fp.life / 2, 0, 1);
      const h = (6 + Math.abs(Math.sin(gt * 9 + fp.x)) * 6) * k;
      ctx.fillStyle = fp.volc ? `rgba(${L.hot},0.75)` : 'rgba(255,110,20,0.75)';
      ctx.beginPath(); ctx.moveTo(fp.x - 4, y); ctx.lineTo(fp.x, y - h); ctx.lineTo(fp.x + 4, y); ctx.fill();
      ctx.fillStyle = fp.volc ? `rgba(${L.core},0.8)` : 'rgba(255,200,60,0.8)';
      ctx.beginPath(); ctx.moveTo(fp.x - 2, y); ctx.lineTo(fp.x, y - h * 0.6); ctx.lineTo(fp.x + 2, y); ctx.fill();
    });
  }
  
  function drawRemains() {
    remains.forEach(rm => {
      if (rm.sunk) return;
      const tilt = rm.style === 'nuke' ? 0.14 : rm.style === 'plasma' ? -0.12 : rm.style === 'sand' ? 0.05 : 0.08;
      drawTurretBody(ctx, rm.x, rm.y, rm.col, { wreck: true, hull: rm.hull, ang: rm.style === 'nuke' ? 12 : 26, tilt, alpha: rm.wreck === 1 ? 0.92 : 0.8, seed: Math.round(rm.x) });
      if (rm.wreck === 1) {
        const fl = 4 + Math.abs(Math.sin(gt * 11)) * 5;
        ctx.fillStyle = 'rgba(255,110,20,0.85)';
        ctx.beginPath(); ctx.moveTo(rm.x - 4, rm.y - 24); ctx.lineTo(rm.x, rm.y - 24 - fl); ctx.lineTo(rm.x + 4, rm.y - 24); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,60,0.9)';
        ctx.beginPath(); ctx.moveTo(rm.x - 2, rm.y - 24); ctx.lineTo(rm.x, rm.y - 24 - fl * 0.6); ctx.lineTo(rm.x + 2, rm.y - 24); ctx.fill();
      }
    });
  }
  function drawSinkers() {
    sinkers.forEach(sk => {
      drawTurretBody(ctx, sk.x, sk.y, sk.col, { wreck: true, hull: sk.hull, ang: 30, tilt: 0.06, alpha: clamp(0.95 - sk.t / 14, 0.3, 0.9), seed: Math.round(sk.x) });
    });
  }
  
  function drawShield(t) {
    const cy = t.y - 14, rr = 26;
    const pulse = 0.7 + Math.sin(skyT * 2.4 + t.x) * 0.18;
    const x0 = t.x - rr - 2, x1 = t.x + rr + 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, -60);
    ctx.lineTo(x0, surfaceAt(x0));
    for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, surfaceAt(x));
    ctx.lineTo(x1, surfaceAt(x1));
    ctx.lineTo(x1, -60);
    ctx.closePath();
    ctx.clip();
    const gg = ctx.createRadialGradient(t.x, cy, rr * 0.4, t.x, cy, rr);
    gg.addColorStop(0, hexA(t.col, 0.10 * pulse));
    gg.addColorStop(0.8, hexA(t.col, 0.3 * pulse));
    gg.addColorStop(1, hexA(t.col, 0.02));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(t.x, cy, rr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA(t.col, 0.55 * pulse);
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(t.x, cy, rr * 0.94, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
  }
  
  function drawTanks() {
    if (state === 'aim') {
      if (isHumanSeat(turn)) tanks[turn].dispAng = aim.ang;
      if (GMODE === 1 && turn >= 1) tanks[1].dispAng = aiAim;
    }
    tanks.forEach((t, i) => {
      if (t.dead) return;
      const hpF = 1 - clamp(t.hp, 0, TANK_HP) / TANK_HP;
      const submerged = t.y > waterLevel + 2;
      ctx.save();
      if (submerged) ctx.globalAlpha = 0.65;
      drawTurretBody(ctx, t.x, t.y, t.col, {
        dir: i === 0 ? playerDir() : (tanks[1].x < tanks[0].x ? 1 : -1),
        ang: t.dispAng === undefined ? 45 : t.dispAng,
        hpF, recoil: t.recoil || 0, seed: i * 7 + 3, hull: t.hull
      });
      ctx.restore();
      if (t.dying) {
        const pu = 0.5 + Math.sin(gt * 9) * 0.3;
        ctx.strokeStyle = `rgba(255,80,50,${pu.toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(t.x, t.y - 16, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (t.shield > 0) drawShield(t);
      if (t.hp < 50 && t.shield === 0 && !t.dying) {
        ctx.globalAlpha = 0.28 + 0.2 * Math.sin(skyT * 3 + t.x);
        ctx.fillStyle = '#555';
        ctx.fillRect(t.x + R(-2, 2), t.y - 28 - Math.sin(skyT * 2) * 3, 3, 3);
        ctx.globalAlpha = 1;
      }
      if (t.hp < 25 && t.shield === 0 && !t.dying) {
        const fl = 3 + Math.abs(Math.sin(skyT * 9)) * 3;
        ctx.fillStyle = '#ff6a00';
        ctx.beginPath(); ctx.moveTo(t.x - 3, t.y - 24); ctx.lineTo(t.x, t.y - 24 - fl); ctx.lineTo(t.x + 3, t.y - 24); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(t.x - 1.5, t.y - 24); ctx.lineTo(t.x, t.y - 24 - fl * 0.6); ctx.lineTo(t.x + 1.5, t.y - 24); ctx.fill();
      }
    });
  }
  
  function drawTrail(p) {
    const n = p.trail.length;
    if (!n) return;
    const life = trailLife(p.w);
    const type = p.w.type;
    ctx.save();
    if (type === 'plasma') ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const q = p.trail[i];
      const age = clamp((gt - q.t) / life, 0, 1);
      const k = 1 - age;
      if (k <= 0) continue;
      if (type === 'death' || type === 'nuke') {
        ctx.globalAlpha = k * 0.45;
        ctx.fillStyle = age < 0.4 ? '#5a5a5f' : '#2c2c30';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 10, 0, Math.PI * 2); ctx.fill();
        if (age < 0.12) {
          ctx.globalAlpha = k;
          ctx.fillStyle = '#ff9a3a';
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      } else if (type === 'plasma') {
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = hexA(p.w.col, 0.8);
        const sz = 2.4 + age * 6;
        ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
        if (age < 0.2) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = '#fff2dd';
          ctx.fillRect(q.x - 1.1, q.y - 1.1, 2.2, 2.2);
        }
      } else if (type === 'funky') {
        ctx.globalAlpha = k * 0.85;
        ctx.fillStyle = ['#a29bff', '#ffd23f', '#ff6b9d', '#7bffc4'][(i + ((q.t * 10) | 0)) % 4];
        const s = 1.8 + Math.sin(i * 2.7) * 0.8;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(i * 1.3);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (type === 'napalm') {
        ctx.globalAlpha = k * 0.85;
        ctx.fillStyle = age < 0.5 ? '#ffd23f' : '#d85a18';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 3.5, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'roller') {
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = '#c2ab86';
        ctx.beginPath(); ctx.arc(q.x, q.y - age * 4, 1.5 + age * 4, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'digger') {
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = i % 2 ? '#8a6a3a' : '#6b4a2c';
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(i * 0.9);
        ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
        ctx.restore();
      } else if (type === 'dirt') {
        ctx.globalAlpha = k * 0.3;
        ctx.fillStyle = '#cbb490';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = k * 0.3;
        ctx.fillStyle = age < 0.3 ? '#e8e2d8' : '#b0b4bb';
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 + age * 7, 0, Math.PI * 2); ctx.fill();
        if (age < 0.18) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = '#ffd88a';
          ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  
  function drawShot(p) {
    if (!p || p.dead) return;
    drawTrail(p);
    ctx.save();
    if (p.inWater) ctx.globalAlpha = 0.6;
    ctx.translate(p.x, p.y);
    ctx.rotate((p.w.type === 'roller' ? p.rot : Math.atan2(p.vy, p.vx)) + (p.digging ? Math.sin(gt * 30) * 0.12 : 0));
    drawProjectileShape(ctx, p.w);
    ctx.restore();
    if (p.digging) {
      const frac = clamp((p.dugLen || 0) / Math.max(1, p.charge), 0, 1);
      const label = `БУР ${Math.round(frac * 100)}%`;
      ctx.font = '700 10px Orbitron, monospace';
      ctx.textAlign = 'center';
      const lx = clamp(p.x, 44, Wc - 44);
      const ly = Math.max(28, surfaceAt(lx) - 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(label, lx, ly);
      ctx.textAlign = 'left';
    }
  }
  
  // off-screen projectile indicator: a DOM layer ABOVE the HUD bar
  function drawOffscreenMarks() {
    const box = overlay.querySelector('.sc-offmark');
    if (!box) return;
    const list = [shot, ...subshots].filter(p => p && !p.dead && p.y < -8);
    if (!list.length) { if (box.childElementCount) box.innerHTML = ''; return; }
    let html = '';
    list.forEach(p => {
      const x = clamp(p.x, 20, Wc - 20) | 0;
      const col = p.w.col || '#fff';
      html += `<span class="sc-om" style="left:${x}px;color:${col}">\u25B2${Math.round(-p.y / 10)}</span>`;
    });
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  
  function drawWindParts() {
    windParts.forEach(p => {
      const sw = Math.sin(p.ph);
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind === 'leaf') {
        ctx.rotate(sw * 0.6);
        ctx.fillStyle = `rgba(140,190,110,${p.a * 0.3})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 2.2, p.s, sw * 0.5, 0, Math.PI * 2); ctx.fill();
      } else {
        const pc = M().partCol || '130,125,120';
        ctx.fillStyle = `rgba(${pc},${p.a})`;
        ctx.fillRect(-p.s * 0.4, -p.s * 0.4, p.s * 0.8, p.s * 0.8);
      }
      ctx.restore();
    });
  }
  
  function drawGrains() {
    if (!grains.length) return;
    ctx.fillStyle = biome.surf;
    grains.forEach(g => ctx.fillRect(g.x, g.y, g.s, g.s));
  }
  //scorch.ui.js part03
  function drawAim() {
    const t = activeTank();
    const dir = activeDir();
    const rad = aim.ang * Math.PI / 180;
    const pos = { x: t.x + Math.cos(rad) * 18 * dir, y: t.y - 12 - Math.sin(rad) * 18 };
    const vel = { vx: Math.cos(rad) * aim.pow * (VMAX / 100) * dir, vy: -Math.sin(rad) * aim.pow * (VMAX / 100) };
    const dt = 1 / 60;
    let apex = null;
    let hit = null;
    const pts = [];
    for (let i = 0; i < 140; i++) {
      integrate(pos, vel, 0, dt);
      pts.push({ x: pos.x, y: pos.y });
      if (!apex || pos.y < apex.y) apex = { x: pos.x, y: pos.y };
      if (pos.x < 0 || pos.x > Wc || pos.y > Hc) break;
      if (pos.y < 0) break;
      if (shotBlocked(pos.x, pos.y)) { hit = { x: pos.x, y: pos.y }; break; }
    }
    const halo = UNDER ? 'rgba(255,196,110,0.8)' : isDayT() ? 'rgba(15,30,55,0.8)' : 'rgba(255,255,255,0.85)';
    for (let i = 5; i < pts.length; i += 6) {
      const q = pts[i];
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(gt * 4 - i * 0.22);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = UNDER ? '#ff9b2f' : indColHi();
      ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (hit) {
      ctx.strokeStyle = UNDER ? '#ff9b2f' : indColHi();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hit.x - 5, hit.y - 5); ctx.lineTo(hit.x + 5, hit.y + 5);
      ctx.moveTo(hit.x + 5, hit.y - 5); ctx.lineTo(hit.x - 5, hit.y + 5);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(hit.x, hit.y, ARSENAL[currentCur()].r * 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (apex && Math.abs(wind) > 0.8 && !UNDER) {
      const ch = wind < 0 ? '‹' : '›';
      ctx.font = 'bold 13px Orbitron, monospace';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(ch.repeat(Math.round(Math.abs(wind))), apex.x - 14, apex.y - 10);
      ctx.fillStyle = indColHi();
      ctx.fillText(ch.repeat(Math.round(Math.abs(wind))), apex.x - 14, apex.y - 10);
    }
    if (drag && drag.moved) {
      const cy = t.y - 12;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(t.x, cy); ctx.lineTo(drag.x, drag.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = indColHi();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, cy, 14 + aim.pow * 0.45, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      const label = `${Math.round(aim.ang)}\u00b0  ${Math.round(aim.pow)}`;
      ctx.font = '700 12px Orbitron, monospace';
      const tw = ctx.measureText(label).width + 16;
      let lx = drag.x + 14, ly = drag.y - 26;
      if (lx + tw > Wc - 8) lx = drag.x - tw - 14;
      if (ly < 40) ly = drag.y + 16;
      rrectPath(ctx, lx, ly, tw, 22, 6);
      ctx.fillStyle = 'rgba(8,12,20,0.85)';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(label, lx + 8, ly + 15);
    }
  }
  
  // HUD: fixed bright palette; on narrow screens the LABELS collapse into
  // ICONS and the weapon NAME into its live ICON
  function drawHUD() {
    if (!hudRefs) return;
    const H = hudRefs;
    const w = ARSENAL[currentCur()];
    H.ang.textContent = Math.round(aim.ang);
    H.pow.textContent = Math.round(aim.pow);
    H.wname.textContent = w.name;
    const wk = turn + '|' + currentCur();
    if (H.wiconCtx && H.wicon && H.wicon._k !== wk) {
      H.wicon._k = wk;
      const mc = H.wiconCtx;
      mc.clearRect(0, 0, 22, 22);
      mc.save();
      mc.translate(11, 11);
      mc.rotate(-Math.PI / 4);
      mc.scale(1.25, 1.25);
      drawProjectileShape(mc, w);
      mc.restore();
    }
    H.ammo.textContent = w.ammo === Infinity ? '∞' : currentInv()[w.key];
    H.ammo.className = 'sc-ammo' + (w.ammo === Infinity ? '' : currentInv()[w.key] <= 1 ? ' critical' : ' limited');
    H.round.textContent = `${round}/${ROUNDS_MAX}`;
    H.wins.innerHTML = `<b style="color:${players[0].col}">${wins}</b> : <b style="color:${players[1].col}">${wins2}</b>`;
    H.score.innerHTML = `<b style="color:${players[0].col}">${score}</b> : <b style="color:${players[1].col}">${score2}</b>`;
    const hpCol = 'rgba(250,252,255,0.97)';
    const t0 = tanks[0], t1 = tanks[1];
    const shd = (t) => t && t.shield > 0 ? ' <i class="sc-shd"></i>' : '';
    H.you.innerHTML = `${biomeLabel()}${UNDER ? ' · пещера' : ''}&nbsp;&nbsp;<span style="color:${players[0].col}">${esc(players[0].name)}</span> <b style="color:${hpCol}">${Math.max(0, Math.round(t0 ? t0.hp : 0))}</b>${shd(t0)}`;
    H.enemy.innerHTML = `<span style="color:${players[1].col}">${esc(players[1].name)}</span> <b style="color:${hpCol}">${Math.max(0, Math.round(t1 ? t1.hp : 0))}</b>${shd(t1)}`;
    H.lasthit.textContent = lastHitInfo || '';
    const strength = Math.round(Math.abs(wind));
    const ch = wind < 0 ? '‹' : '›';
    const daySky = isDayT();
    H.windarrow.textContent = ch.repeat(Math.max(1, strength));
    const wc = w.wind > 0.45 ? (daySky ? '#a03030' : '#ff6a7a') : w.wind > 0.2 ? (daySky ? '#9a6a00' : '#f1c40f') : (daySky ? '#1b3f8f' : '#00d4ff');
    H.windarrow.style.color = wc;
    H.windval.style.color = wc;
    H.windval.textContent = Math.abs(wind).toFixed(1);
    H.round.style.color = players[hudSeat()].col;
    if (state === 'aim' && isHumanSeat(turn) && Wc > 420 && turnIntro <= 0) {
      const tleft = Math.ceil(Math.max(0, turnTimer));
      const warn = turnTimer < 10;
      const blink = warn && Math.sin(gt * (turnTimer < 5 ? 12 : 7) < 0);
      ctx.save();
      ctx.font = `800 ${warn ? 16 : 13}px Orbitron, monospace`;
      ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(`${tleft}s`, Wc - 56, 28);
      ctx.fillStyle = blink ? '#ff2a1a' : warn ? '#ff5a4a' : 'rgba(255,255,255,0.85)';
      ctx.fillText(`${tleft}s`, Wc - 56, 28);
      ctx.restore();
    }
  }
  
  // records table (shared by the over-screen and the help panel)
  function fillRecordsTable(tab, hlIdx) {
    if (!tab) return;
    tab.innerHTML = '';
    const hr = document.createElement('tr');
    ['#', 'Очки', 'Побед', 'Игрок', 'Дата'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
    tab.appendChild(hr);
    const recs = records().slice(0, MAX_REC);
    if (!recs.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'рекордов пока нет';
      tr.appendChild(td);
      tab.appendChild(tr);
      return;
    }
    recs.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (i === hlIdx) tr.className = 'me';
      const td0 = document.createElement('td');
      td0.textContent = i + 1;
      tr.appendChild(td0);
      [r.score, r.wins || 0].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
      const tdp = document.createElement('td');
      tdp.className = 'sc-recpl';
      const chip = document.createElement('canvas');
      chip.width = 36; chip.height = 36;
      drawMiniTurret(chip.getContext('2d'), 36, r.pcol || '#2ecc71', r.phull || 'classic');
      tdp.appendChild(chip);
      const nm = document.createElement('span');
      nm.textContent = r.pname || 'Player1';
      nm.style.color = r.pcol || '#2ecc71';
      tdp.appendChild(nm);
      tr.appendChild(tdp);
      const td4 = document.createElement('td');
      td4.textContent = r.date;
      tr.appendChild(td4);
      tab.appendChild(tr);
    });
  }
  function renderRecords(hlIdx) { fillRecordsTable(scSel('.sc-over .sc-rectab'), hlIdx); }
  
  function showOver() {
    const won = wins >= Math.ceil(ROUNDS_MAX / 2);
    const key = (r) => r.date + '|' + r.score + '|' + (r.wins || 0);
    const before = records().map(key);
    saveRec(players[0], score, wins);
    saveRec(players[1], score2, wins2);
    const recs = records();
    const myIdx = recs.findIndex(r => !before.includes(key(r)));
    const titleEl = scSel('.sc-over-title');
    if (GMODE === 2) {
      const winner = won ? players[0] : players[1];
      titleEl.textContent = `🏆 ${winner.name} побеждает!`;
      titleEl.style.color = winner.col;
    } else {
      titleEl.textContent = won ? '🏆 Победа!' : '💥 Поражение';
      titleEl.style.color = '';
    }
    const res = scSel('.sc-over-res');
    res.innerHTML = '';
    res.appendChild(document.createTextNode('Очки: '));
    const sb = document.createElement('b');
    sb.style.color = 'var(--accent)';
    sb.textContent = score;
    res.appendChild(sb);
    if (GMODE === 2) {
      res.appendChild(document.createTextNode(' — '));
      const sb2 = document.createElement('b');
      sb2.style.color = players[1].col;
      sb2.textContent = score2;
      res.appendChild(sb2);
      res.appendChild(document.createTextNode(`   побед: ${wins} : ${wins2}`));
    } else {
      res.appendChild(document.createTextNode(`\u00a0\u00a0побед: ${wins} : ${wins2}`));
    }
    renderRecords(myIdx);
    scSel('.sc-over').classList.add('show');
    state = 'over';
  }
  // ================= UI BUILD =================
  function build() {
    if (overlay) return;
    const css = document.createElement('style');
    css.textContent = `
      .sc-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(5,7,10,0.92); display: none; align-items: center; justify-content: center; }
      .sc-overlay.show { display: flex; }
      .sc-wrap { position: relative; width: 92vw; height: 92vh; border: 1px solid var(--accent); border-radius: var(--radius); overflow: hidden; background: #03050a; }
      .sc-close { position: absolute; right: 10px; top: 10px; z-index: 5; width: 34px; height: 34px; background: var(--panel-light); border: 1px solid var(--pink); color: var(--pink); border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'DejaVu Sans', sans-serif; }
      .sc-close:hover { background: var(--pink); color: var(--bg); }
      .sc-hud { position: absolute; left: 0; right: 0; top: 0; z-index: 4; display: flex; gap: 8px 20px; align-items: center; padding: 8px 56px 8px 14px; font-family: 'Orbitron', monospace; font-size: 22px; color: rgba(212,222,238,0.92); text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7); pointer-events: none; flex-wrap: wrap; line-height: 1.3; }
      .sc-hud b { color: #f0f6ff; }
      .sc-hud .sc-lasthit { color: #ffd23f; max-width: 360px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 18px; }
      .sc-hud .sc-aimctl { pointer-events: auto; cursor: pointer; border: 1px solid transparent; border-radius: 6px; padding: 3px 8px; }
      .sc-hud .sc-aimctl:hover { border-color: rgba(150,190,235,0.55); color: #fff; }
      .sc-hud .sc-aimctl:hover b { color: #ffd23f; }
      .sc-hud .sc-stat { pointer-events: auto; cursor: help; }
      .sc-hud .sc-ic2 { display: none; font-style: normal; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif; }
      .sc-hud .sc-lab { font-style: normal; }
      .sc-hint { position: absolute; left: 50%; top: 54px; transform: translateX(-50%); z-index: 6; background: rgba(8,12,20,0.92); border: 1px solid var(--border); color: #e8eef8; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-family: 'Segoe UI', system-ui, sans-serif; max-width: 82%; display: none; pointer-events: none; }
      .sc-hint.show { display: block; }
      .sc-wpn { pointer-events: auto; cursor: pointer; border: 1px solid var(--border); padding: 3px 10px; border-radius: 6px; color: rgba(232,240,250,0.95); background: rgba(5,7,10,0.7); display: flex; gap: 8px; align-items: center; }
      .sc-wpn:hover { border-color: rgba(150,190,235,0.55); }
      .sc-wpn .sc-ammo { color: #6ee7a0; } .sc-wpn .sc-ammo.limited { color: #ffd23f; } .sc-wpn .sc-ammo.critical { color: #ff7a8a; }
      .sc-wpn .sc-wicon { display: none; flex-shrink: 0; }
      .sc-helpbtn { pointer-events: auto; cursor: pointer; color: rgba(222,232,246,0.92); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; background: rgba(5,7,10,0.7); }
      .sc-helpbtn:hover { color: #7ecbff; border-color: rgba(126,203,255,0.6); }
      .sc-pvpbtn { pointer-events: auto; cursor: pointer; color: rgba(222,232,246,0.92); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; background: rgba(5,7,10,0.7); }
      .sc-pvpbtn:hover { color: #7ecbff; border-color: rgba(126,203,255,0.6); }
      .sc-sym { font-style: normal; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif; }
      .sc-offmark { position: absolute; left: 0; right: 0; top: 0; z-index: 5; pointer-events: none; }
      .sc-offmark .sc-om { position: absolute; top: 5px; transform: translateX(-50%); font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.85); white-space: nowrap; letter-spacing: 0.5px; }
      canvas.sc-cv { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
      .sc-help { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; padding: 16px 22px 18px; width: 90%; font-size: 21px; line-height: 1.65; color: var(--text); display: none; max-height: 84vh; }
      .sc-help.show { display: flex; flex-direction: column; }
      .sc-help-top { position: relative; flex-shrink: 0; margin-bottom: 8px; }
      .sc-help-top h4 { margin: 0; }
      .sc-help-body { overflow-y: auto; min-height: 0; padding-right: 4px; }
      .sc-help h4 { color: var(--accent); margin-bottom: 8px; font-size: 26px; }
      .sc-help h5 { margin: 16px 0 6px; font-size: 20px; }
      .sc-help table { font-size: 20px; }
      .sc-help td { padding: 4px 12px; }
      .sc-help td:first-child { color: var(--accent); font-family: monospace; white-space: nowrap; }
      .sc-help .sc-rectab { margin-bottom: 0; font-size: 14px; }
      .sc-help .sc-rectab th { padding: 5px 6px; }
      .sc-help .sc-rectab td { padding: 6px 6px; }
      .sc-helpx { position: absolute; right: 0; top: -2px; width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; z-index: 2; }
      .sc-helpx:hover { border-color: var(--pink); color: var(--pink); }
      .sc-wpnhelp { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
      .sc-wpnhelp .sc-wpnrow { display: flex; align-items: center; gap: 12px; }
      .sc-wpnhelp .sc-wpnrow canvas { flex-shrink: 0; }
      .sc-wpnhelp .sc-wt { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
      .sc-wpnhelp .sc-wt b { color: var(--accent); font-size: 18px; }
      .sc-wpnhelp .sc-wt span { color: var(--text-dim); font-size: 15px; }
      .sc-wpnhelp .sc-ww { margin-left: auto; flex-shrink: 0; color: var(--text-dim); font-size: 14px; font-family: 'Orbitron', monospace; white-space: nowrap; }
      .sc-lives { position: absolute; left: 14px; bottom: 10px; z-index: 4; display: flex; gap: 22px; font-family: 'Orbitron', monospace; font-size: 22px; color: rgba(212,222,238,0.92); pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7); }
      .sc-lives b { font-weight: 700; }
      .sc-lives .sc-shd { display: inline-block; width: 13px; height: 13px; border: 2px solid #4ac0ff; border-radius: 50%; vertical-align: -1px; opacity: 0.85; margin-left: 5px; }
      .sc-windbar { position: absolute; right: 14px; bottom: 12px; z-index: 4; pointer-events: none; display: flex; align-items: center; gap: 10px; font-family: 'Orbitron', monospace; font-size: 28px; color: rgba(212,222,238,0.92); text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7); }
      .sc-windarrow { font-size: 40px; letter-spacing: -4px; }
      .sc-tctl { position: absolute; left: 50%; transform: translateX(-50%); bottom: 62px; z-index: 5; display: none; flex-direction: column; gap: 5px; width: calc(100% - 20px); background: rgba(6,10,18,0.86); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; font-family: 'Orbitron', monospace; pointer-events: auto; }
      .sc-tctl.show { display: flex; }
      .sc-tctl .sc-trow { display: flex; align-items: center; gap: 8px; height: 42px; }
      .sc-tctl .sc-tl { width: 46px; flex-shrink: 0; color: #9fb2cc; font-size: 10px; letter-spacing: 1px; }
      .sc-tctl input { flex: 1; min-width: 0; accent-color: #ffb020; cursor: pointer; }
      .sc-tctl .sc-tv { min-width: 40px; text-align: right; color: #ffd23f; font-weight: 700; font-size: 13px; }
      .sc-tb { width: 42px; height: 42px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--border); background: var(--panel-light); color: #e8eef8; font-size: 20px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
      .sc-tb:active { background: #ffb020; color: #10131a; }
      .sc-over { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 8; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; padding: 24px 28px; min-width: 320px; max-width: 90%; max-height: 85vh; overflow-y: auto; display: none; text-align: center; }
      .sc-over.show { display: block; }
      .sc-over h3 { color: var(--accent); margin-bottom: 10px; font-size: 18px; }
      .sc-over .sc-over-res { margin-bottom: 14px; font-size: 13px; }
      .sc-rectab { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; user-select: none; }
      .sc-rectab th { color: var(--accent); border-bottom: 1px solid var(--border); padding: 4px 6px; text-align: left; }
      .sc-rectab td { padding: 6px 6px; border-bottom: 1px solid var(--border); }
      .sc-rectab tr.me td { color: var(--yellow); }
      .sc-rectab tr.me { animation: sc-me 1.2s ease-in-out infinite; }
      .sc-rectab .sc-recpl { display: flex; align-items: center; gap: 8px; }
      @keyframes sc-me { 0%, 100% { background: transparent; } 50% { background: rgba(241,196,15,0.15); } }
      .sc-over button { margin: 0 6px; padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 12px; }
      .sc-over button:hover { border-color: var(--accent); color: var(--accent); }
      .sc-wmenu { position: absolute; z-index: 7; background: var(--panel); border: 1px solid var(--accent); border-radius: 8px; padding: 4px; display: none; max-width: 92%; }
      .sc-wmenu.show { display: block; }
      .sc-wmenu .sc-witem { display: flex; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 12px; color: var(--text); }
      .sc-wmenu .sc-witem:hover { background: var(--panel-light); }
      .sc-wmenu .sc-witem.sel { background: var(--accent); color: var(--bg); }
      .sc-wmenu .sc-witem canvas { flex-shrink: 0; }
      .sc-wmenu .sc-witem .num { color: var(--accent); font-family: monospace; width: 12px; }
      .sc-wmenu .sc-witem.sel .num { color: var(--bg); }
      .sc-wmenu .sc-witem .cnt { margin-left: auto; color: var(--text-dim); font-size: 10px; min-width: 18px; text-align: right; }
      .sc-wmenu .sc-witem.noammo { opacity: 0.35; cursor: not-allowed; }
      .sc-setup { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 9; background: var(--panel); border: 2px solid var(--accent); border-radius: 12px; padding: 0 22px 16px; width: min(640px, 94%); max-height: 88vh; display: none; flex-direction: column; font-size: 13px; }
      .sc-setup.show { display: flex; }
      .sc-setup-head { position: relative; flex-shrink: 0; padding: 16px 0 0; }
      .sc-setup h3 { color: var(--accent); margin: 0 44px 4px 0; font-size: 17px; letter-spacing: 2px; }
      .sc-setup .sc-setup-sub { color: var(--text-dim); font-size: 11px; margin-bottom: 14px; font-family: 'Orbitron', monospace; letter-spacing: 1px; }
      .sc-setup-body { overflow-y: auto; min-height: 0; }
      .sc-set-x { position: absolute; right: 0; top: 16px; z-index: 5; width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; }
      .sc-set-x:hover { border-color: var(--pink); color: var(--pink); }
      .sc-setup .sc-mode-row { display: flex; gap: 10px; margin-bottom: 14px; }
      .sc-setup .sc-mode-btn { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 15px; text-align: center; }
      .sc-setup .sc-mode-btn .sc-mm { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; }
      .sc-setup .sc-mode-btn .sc-mm b { color: var(--text-dim); font-size: 11px; letter-spacing: 1px; }
      .sc-setup .sc-mode-btn .sc-ic { font-style: normal; font-size: 22px; line-height: 1; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif; }
      .sc-setup .sc-mode-btn small { display: block; font-size: 9px; letter-spacing: 1px; margin-top: 4px; color: var(--text-dim); }
      .sc-setup .sc-mode-btn.sel { border-color: var(--accent); color: var(--accent); background: rgba(20,40,60,0.5); box-shadow: 0 0 0 1px var(--accent) inset; }
      .sc-setup .sc-cols { display: flex; gap: 14px; }
      .sc-setup .sc-pl-block { flex: 1; min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: rgba(4,8,14,0.35); }
      .sc-setup .sc-pl-block.locked { opacity: 0.75; }
      .sc-setup .sc-pl-block .sc-pl-err { color: var(--pink); font-size: 10px; min-height: 14px; margin: 2px 0 4px; font-family: 'Orbitron', monospace; }
      .sc-setup .sc-pl-head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; position: relative; }
      .sc-setup .sc-pl-head label { width: 74px; flex-shrink: 0; color: var(--accent); font-family: 'Orbitron', monospace; font-size: 11px; letter-spacing: 1px; }
      .sc-setup .sc-pl-head input { flex: 1; min-width: 0; padding: 7px 32px 7px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 13px; }
      .sc-setup .sc-pl-head input:disabled { opacity: 0.55; }
      .sc-setup .sc-pl-head input::placeholder { color: var(--text-dim); }
      .sc-setup .sc-pl-block input.sc-name-bad { border-color: var(--pink); }
      .sc-setup .sc-pl-tools { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; gap: 3px; }
      .sc-setup .sc-pl-tools button { width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); font-size: 11px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
      .sc-setup .sc-pl-tools button:hover { border-color: var(--accent); color: var(--accent); }
      .sc-pl-del { display: block; width: 100%; margin-top: 10px; padding: 7px 0; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); font-size: 10px; letter-spacing: 1px; font-family: 'Orbitron', monospace; cursor: pointer; }
      .sc-pl-del:hover { border-color: var(--pink); color: var(--pink); }
      .sc-setup .sc-matrix { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
      .sc-setup .sc-mcell { border: 2px solid var(--border); border-radius: 8px; cursor: pointer; background: rgba(8,12,20,0.5); padding: 0; }
      .sc-setup .sc-mcell:hover { border-color: var(--accent); }
      .sc-setup .sc-mcell.sel { border-color: var(--accent); background: rgba(20,40,60,0.45); box-shadow: 0 0 0 1px var(--accent) inset; }
      .sc-setup .sc-matrix-title { font-size: 9px; color: var(--text-dim); letter-spacing: 1px; font-family: 'Orbitron', monospace; margin-bottom: 4px; }
      .sc-setup .sc-palette { display: flex; gap: 6px; flex-wrap: wrap; }
      .sc-setup .sc-sw { width: 24px; height: 24px; border-radius: 7px; border: 2px solid rgba(0,0,0,0.4); cursor: pointer; padding: 0; }
      .sc-setup .sc-sw.sel { border-color: #fff; box-shadow: 0 0 0 2px var(--accent); }
      .sc-setup .sc-sw.taken { opacity: 0.25; cursor: not-allowed; }
      .sc-setup .sc-suggest { position: absolute; left: 0; right: 0; top: 100%; margin-top: 3px; background: var(--panel); border: 1px solid var(--accent); border-radius: 6px; max-height: 170px; overflow-y: auto; z-index: 3; display: none; box-shadow: 0 6px 18px rgba(0,0,0,0.6); }
      .sc-setup .sc-suggest.show { display: block; }
      .sc-setup .sc-suggest .sc-sug-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; cursor: pointer; color: var(--text); font-size: 12px; border-bottom: 1px solid var(--border); }
      .sc-setup .sc-suggest .sc-sug-item:hover, .sc-setup .sc-suggest .sc-sug-item.hov { background: rgba(20,40,60,0.5); }
      .sc-setup .sc-suggest .sc-sug-item canvas { flex-shrink: 0; }
      .sc-setup .sc-suggest .sc-sug-item .sc-sug-del { margin-left: auto; width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
      .sc-setup .sc-suggest .sc-sug-item .sc-sug-del:hover { border-color: var(--pink); color: var(--pink); }
      .sc-setup .sc-setup-btns { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
      .sc-setup .sc-setup-btns button { padding: 10px 18px; border-radius: 7px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 18px; }
      .sc-setup .sc-setup-btns .sc-go { border-color: var(--accent); color: var(--accent); font-size: 22px; }
      .sc-setup .sc-setup-btns button:hover { border-color: var(--accent); }
      .sc-hullgal { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
      .sc-hullgal .sc-hg-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
      .sc-hullgal .sc-hg-item span { font-size: 15px; color: var(--text-dim); }
      .sc-confirm { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 11; background: var(--panel); border: 2px solid var(--pink); border-radius: 10px; padding: 20px 24px; width: min(360px, 90%); display: none; text-align: center; }
      .sc-confirm.show { display: block; }
      .sc-confirm p { color: var(--text); font-size: 13px; margin: 0 0 16px; }
      .sc-confirm .sc-confirm-btns { display: flex; gap: 10px; justify-content: center; }
      .sc-confirm button { padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 12px; }
      .sc-confirm .sc-yes { border-color: var(--pink); color: var(--pink); }
      .sc-light .sc-setup, .sc-light .sc-help, .sc-light .sc-confirm, .sc-light .sc-over, .sc-light .sc-wmenu, .sc-light .sc-suggest { background: #ffffff; }
      .sc-light .sc-mode-btn, .sc-light .sc-set-x, .sc-light .sc-helpx, .sc-light .sc-pb-btn, .sc-light .sc-pl-tools button, .sc-light .sc-pl-del, .sc-light .sc-sug-del, .sc-light .sc-over button, .sc-light .sc-confirm button, .sc-light .sc-setup .sc-setup-btns button { background: #ffffff; border-color: rgba(22,32,48,0.22); }
      .sc-light .sc-helpbtn, .sc-light .sc-pvpbtn, .sc-light .sc-wpn { background: rgba(255,255,255,0.82); border-color: rgba(22,32,48,0.18); }
      .sc-light .sc-setup .sc-pl-block { background: rgba(240,244,250,0.65); border-color: rgba(22,32,48,0.16); }
      .sc-light .sc-setup .sc-mcell { background: #ffffff; border-color: rgba(22,32,48,0.22); }
      .sc-light .sc-mode-btn.sel { background: rgba(230,126,34,0.14); }
      .sc-light .sc-setup .sc-pl-head input { background: #ffffff; border-color: rgba(22,32,48,0.25); }
      .sc-light .sc-suggest .sc-sug-item:hover, .sc-light .sc-suggest .sc-sug-item.hov { background: rgba(226,232,240,0.9); }
      .sc-light .sc-tctl { background: rgba(255,255,255,0.94); border-color: rgba(22,32,48,0.2); }
      .sc-light .sc-tctl .sc-tl { color: #51617a; }
      .sc-light .sc-tctl .sc-tv { color: #b35a00; }
      .sc-light .sc-tb { background: #ffffff; border-color: rgba(22,32,48,0.22); color: #22304a; }
      .sc-light .sc-tb:active { background: #ffb020; color: #10131a; }
      /* ===== NARROW-SCREEN adaptation ===== */
      @media (max-width: 760px) {
        .sc-hud { font-size: 17px; gap: 6px 12px; padding: 6px 48px 6px 10px; }
        .sc-hud .sc-lab { display: none; }
        .sc-hud .sc-ic2 { display: inline; }
        .sc-hud .sc-lasthit { font-size: 14px; max-width: 70vw; }
        .sc-wpn .sc-wname { display: none; }
        .sc-wpn .sc-wicon { display: block; }
        .sc-lives { font-size: 16px; gap: 14px; flex-wrap: wrap; row-gap: 4px; max-width: calc(100% - 130px); }
        .sc-windbar { font-size: 20px; gap: 6px; }
        .sc-windarrow { font-size: 28px; letter-spacing: -3px; }
      }
      @media (max-width: 600px) {
        .sc-setup .sc-cols { flex-direction: column; }
        .sc-setup .sc-pl-head { flex-wrap: wrap; }
        .sc-setup .sc-pl-head label { width: 100%; margin-bottom: 3px; }
        .sc-setup .sc-pl-head input { flex: 1 1 calc(100% - 40px); padding-right: 10px; }
        .sc-setup .sc-pl-tools { position: static; transform: none; margin-left: auto; }
        .sc-help { width: 94%; font-size: 17px; padding: 12px 14px 14px; }
        .sc-help h4 { font-size: 21px; }
        .sc-help h5 { font-size: 17px; margin: 12px 0 5px; }
        .sc-help table { font-size: 16px; }
        .sc-help tbody, .sc-help tr, .sc-help td { display: block; width: 100%; box-sizing: border-box; }
        .sc-help td { padding: 2px 0 6px; border: none; }
        .sc-help td:first-child { padding-top: 8px; white-space: normal; }
        .sc-wpnhelp .sc-wpnrow { flex-wrap: wrap; }
        .sc-wpnhelp .sc-wt { flex-basis: calc(100% - 52px); }
        .sc-wpnhelp .sc-ww { margin-left: 52px; }
        .sc-help .sc-rectab th { display: none; }
        .sc-help .sc-rectab tr, .sc-help .sc-rectab td { display: block; border: none; padding: 2px 0; }
        .sc-help .sc-rectab td:nth-child(2)::before { content: 'Очки: '; color: var(--accent); }
        .sc-help .sc-rectab td:nth-child(3)::before { content: 'Побед: '; color: var(--accent); }
        .sc-help .sc-rectab td:nth-child(5)::before { content: 'Дата: '; color: var(--accent); }
      }
    `;
    document.head.appendChild(css);
    overlay = document.createElement('div');
    overlay.className = 'sc-overlay';
    overlay.innerHTML = `
      <div class="sc-wrap">
        <button class="sc-close" title="Ядерный выход">☢</button>
        <div class="sc-hud">
          <span class="sc-aimctl" data-hint="Угол наклона ствола (−20…200°, включая вниз и за спину): ←→ или свайп прицела"><i class="sc-ic2">∠</i><i class="sc-lab">Угол</i> <b class="sc-ang"></b>°</span>
          <span class="sc-aimctl" data-hint="Сила выстрела (5–100): ↑↓, колесо мыши или расстояние прицела"><i class="sc-ic2">⚡</i><i class="sc-lab">Сила</i> <b class="sc-pow"></b></span>
          <span class="sc-wpn"><canvas class="sc-wicon" width="22" height="22"></canvas><span class="sc-wname"></span><span class="sc-ammo"></span></span>
          <span class="sc-helpbtn" title="Справка">?</span>
          <span class="sc-pvpbtn sc-sym" title="Игроки и режим">&#x2699;&#xFE0E;</span>
          <span class="sc-stat" data-hint="Раунд: всего 5, открывающий чередуется"><i class="sc-ic2">⊙</i><i class="sc-lab">Раунд</i> <b class="sc-round"></b></span>
          <span class="sc-stat" data-hint="Победы: игрок 1 : игрок 2 (до 3 из 5)"><i class="sc-ic2">★</i><i class="sc-lab">Побед</i> <b class="sc-wins"></b></span>
          <span class="sc-stat" data-hint="Счёт: очки обоих бойцов за раунды"><i class="sc-ic2">Σ</i><i class="sc-lab">Счёт</i> <b class="sc-score"></b></span>
          <span class="sc-lasthit"></span>
        </div>
        <div class="sc-windbar"><span class="sc-windarrow"></span><span class="sc-windval"></span><span style="font-size:14px">ветер</span></div>
        <div class="sc-wmenu"></div>
        <div class="sc-offmark"></div>
        <div class="sc-hint"></div>
        <canvas class="sc-cv"></canvas>
        <div class="sc-tctl">
          <div class="sc-trow" data-k="ang">
            <span class="sc-tl">УГОЛ</span>
            <button class="sc-tb" data-d="-1" title="−1">&minus;</button>
            <input type="range" min="-20" max="200" step="1">
            <button class="sc-tb" data-d="1" title="+1">+</button>
            <b class="sc-tv"></b>
          </div>
          <div class="sc-trow" data-k="pow">
            <span class="sc-tl">СИЛА</span>
            <button class="sc-tb" data-d="-1" title="−1">&minus;</button>
            <input type="range" min="5" max="100" step="1">
            <button class="sc-tb" data-d="1" title="+1">+</button>
            <b class="sc-tv"></b>
          </div>
        </div>
        <div class="sc-lives"><span class="sc-you"></span><span class="sc-enemy"></span></div>
        <div class="sc-help">
          <div class="sc-help-top">
            <button class="sc-helpx" title="Закрыть справку">✕</button>
            <h4>Scorch</h4>
          </div>
          <div class="sc-help-body">
            <table>
              <tr><td>Drag / свайп</td><td>прицел: направление от турели - угол, расстояние - сила (ближе - слабее)</td></tr>
              <tr><td>Клик «Угол» / «Сила»</td><td>панель ползунков внизу экрана (не модальная — траектория видна); Esc - закрыть</td></tr>
              <tr><td>Панель внизу (тач)</td><td>угол и сила сразу оба, кнопки −/+ шаг по 1 для точной настройки</td></tr>
              <tr><td>Дуга ствола</td><td>от −20° (вниз вперёд) до 200° (вниз за спину) — ствол не пересекает корпус турели</td></tr>
              <tr><td>Иконки HUD (∠ ⚡ ⊙ ★ Σ)</td><td>на узком экране метки сжимаются в иконки, а название оружия — в его значок; тап по иконке — подсказка</td></tr>
              <tr><td>Колесо / ↑↓ / ←→</td><td>сила / угол ствола — свои у каждого игрока; выстрел — только в свой ход</td></tr>
              <tr><td>Space / клик / тап</td><td>огонь (после отсчёта 3-2-1)</td></tr>
              <tr><td>1–9, 0 / W / клик по оружию</td><td>выбор оружия</td></tr>
              <tr><td>Esc / ✕</td><td>закрыть окно (справку, панель, выбор игроков); повтор — выход</td></tr>
              <tr><td>Esc / ☢ / клик мимо</td><td>выход (☢ - всё взрывается как настоящий Nuke, ровно 2 секунды; из дуэли — через подтверждение)</td></tr>
            </table>
            <h5>Правила</h5>
            <div style="color:var(--text-dim);font-size:19px">
              5 раундов, боезапас на всю игру. Первый стрелок раунда 1 —
              случайный, дальше раунды строго чередуются. Карта случая: либо
              архипелаг - море на всю ширину окна и острова, либо материк с
              озёрами, либо ПОДЗЕМНАЯ ПЕЩЕРА (только в мирах без
              растительности). Утонувшее оседает на дно. На ход даётся 60
              секунд (таймер стоит, пока открыто окно): на 10, 5 и 1 секунде -
              тихий сигнал, по истечении ход пропускается. Обычные ракеты в
              воде просто тонут. Напалм выжигает в земле ямы. Смерть с
              перевесом урона разваливает танк на куски. ПОСЛЕДНИЙ ШАНС: если
              бойца добивают огнём (напалм, лава) во время ЕГО хода
              прицеливания - турель с 0 hp получает ~2.6 секунды и один
              последний выстрел, после чего гибнет; умирающий обведён
              пульсирующим красным кольцом и урона больше не получает. Лава
              вулкана жалит на 1-3 hp за шарик и ~8 hp/с в луже, поджигая
              накрытую турель. У склона турель прикрывает вал с рвом. В песке,
              снегу и ржавых дюнах ветер переносит частицы грунта: рельеф
              мигрирует по ветру. Тройной клик по таблице рекордов сбрасывает
              её и записывает текущий результат (нули не пишутся; рекорды
              пишутся обоим бойцам, включая компьютер).
            </div>
            <h5>Дуэль на одном устройстве</h5>
            <div style="color:var(--text-dim);font-size:19px">
              Кнопка «⚙» — режим: против компьютера или двое за одним экраном.
              Угол и сила у каждого игрока свои и восстанавливаются при
              передаче хода. Боец с одним именем - ОДИН И ТОТ ЖЕ боец в обоих
              режимах: цвет и корпус хранятся в общем профиле по имени и не
              расходятся между PvC и PvP. Цвет и вид компьютера тоже
              настраиваются, имя менять нельзя. В дуэли между ходами карточка
              «ХОД ПЕРЕДАН» с отсчётом 3-2-1 даёт время передать клавиатуру;
              как только она исчезла — сразу можно стрелять. Выход из начатой
              дуэли — только через подтверждение (Esc, клик мимо, ☢).
            </div>
            <h5>Миры</h5>
            <div style="color:var(--text-dim);font-size:19px">
              Земные: Холмы, Пустыня, Арктика, Вулкан. Инопланетные: Ксено -
              пурпурная кора с биолюминесцентными спорами под двойной звездой;
              Ржавые дюны - железный песок луны газового гиганта с кольцом
              (приливный ветер гонит дюны); Пепел - серый шлак кратеров,
              сосед-гигант висит в небе. ВУЛКАН есть на трёх мирах: Вулкан -
              классическая оранжевая лава, Ксено - бирюзовая, Пепел -
              фиолетовый шлак; поведение одинаковое, палитра своя. Лава -
              ЖИДКОСТЬ: скопившись в низине, лужа выравнивается как жидкость и
              понемногу прожигает дно, а остывая ПРЕВРАЩАЕТСЯ В СЛОЙ ЗЕМЛИ
              (прирост всегда больше выжига — яма заполняется, и лава течёт
              дальше по новой земле, накрывая и поджигая турель; цвет при этом
              плавно уходит в цвет почвы). Стекая в воду, лава каменеет много
              быстрее и наращивает дно, не успевая его жечь. У холмов и ксено
              под землёй горючие пласты (2-4 на карту): поджигает почти любое
              огневое оружие (кроме бура Digger на этапе бурения, дирта и
              роллера на этапе качения — их ВЗРЫВЫ поджигают); изредка сидят
              ГИГАНТСКИЕ залежи — их детонация перекраивает полкарты. На
              восходе и закате небо горит одинаково, но в обратном порядке.
            </div>
            <h5>Пещеры</h5>
            <div style="color:var(--text-dim);font-size:19px">
              ~каждый третий раунд в пустыне, арктике, на вулкане, в ржавых
              дюнах или пепле проходит ПОД ЗЕМЛЁЙ: неба, светил и отражений в
              воде нет. Сверху - СВОД: перевёрнутая невысокая земля на всю
              ширину, с сталактитами; вулканов на своде нет, но в нём сидят
              ИСКОПАЕМЫЕ гнёзда - взрыв рядом вскрывает их, и они изливают
              ОГОНЬ И ЗЕМЛЮ ВНИЗ волнами. Выстрелы по своду отрывают от него
              породу - она обрушивается вниз и насыпает холм на полу, как
              Dirt Ball. Задник - светлая порода с дальними силуэтами; свет
              дают мерцающие кристаллы и яркие прожекторы (освещение
              просчитано при расстановке - радиусы обрезаны по породе).
              Дно - обычное: тёмная вода в низинах и вулкан, если он есть в
              биоме; лавовые бомбы отскакивают от свода вниз. Огонь и
              снаряды видно в темноте сами по себе.
            </div>
            <h5>Как читать мир</h5>
            <div style="color:var(--text-dim);font-size:19px">
              День и ночь по кругу. Плазма не взрывает: она прилипает к турели
              и жжёт её постепенно (~9 hp/с, суммарно не больше ~46 hp), плавит
              землю под жертвой и проваливается вместе с ней в яму. Роллер
              усилен: 56 hp, катится дольше и разгоняется на склонах — на
              расстоянии он сильнее ракеты, при 3 патронах против бесконечных
              ракет. Digger вгрызается в склон и сверляет по расписанию
              (счётчик БУР % над буром): заряд на 0.42 экрана суммарного
              бурения, полёт в воздухе бесплатный. Сквозь туннели пролетают
              снаряды, вода затекает и колышется, две трубы в стопку - обвал.
              Взрывы многослойные: рваная звезда лучей, веер искровых
              трассеров, кольцо треска, эллиптическая ударная волна и
              неоднородное, разбитое на дрожащие ячейки пламя — цвет каждого
              оружия свой. Редкое оружие бьет в несколько стадий. Движение
              грунта не убивает - максимум 30 hp за раунд. У туррелей щит.
              Вода живёт от музыки: дорожка бликов под светилом — цвет и
              яркость светила, с учётом облачности.
            </div>
            <h5>Оружие</h5>
            <div class="sc-wpnhelp"></div>
            <h5>Турели</h5>
            <div class="sc-hullgal"></div>
            <h5>Рекорды (топ-10)</h5>
            <table class="sc-rectab sc-rechelp"></table>
          </div>
        </div>
        <div class="sc-setup">
          <div class="sc-setup-head">
            <button class="sc-set-x" title="Отмена">✕</button>
            <h3>SCORCH ARENA</h3>
            <div class="sc-setup-sub">SELECT YOUR FIGHTER</div>
          </div>
          <div class="sc-setup-body">
            <div class="sc-mode-row">
              <button class="sc-mode-btn" data-m="1" title="1 игрок против компьютера"><span class="sc-mm"></span><small>ПРОТИВ КОМПЬЮТЕРА</small></button>
              <button class="sc-mode-btn" data-m="2" title="Дуэль на одном устройстве"><span class="sc-mm"></span><small>ДУЭЛЬ НА ОДНОМ ЭКРАНЕ</small></button>
            </div>
            <div class="sc-cols">
              <div class="sc-pl-block" data-p="0"></div>
              <div class="sc-pl-block" data-p="1"></div>
            </div>
            <div class="sc-setup-btns">
              <button class="sc-go sc-sym" title="В бой!">&#x25B6;</button>
            </div>
          </div>
        </div>
        <div class="sc-confirm">
          <p>Дуэль не окончена. Сдаться и выйти?</p>
          <div class="sc-confirm-btns">
            <button class="sc-no">Продолжить</button>
            <button class="sc-yes">Выйти</button>
          </div>
        </div>
        <div class="sc-over">
          <h3 class="sc-over-title"></h3>
          <div class="sc-over-res"></div>
          <table class="sc-rectab"></table>
          <button class="sc-again sc-sym" title="Новая игра">&#x21BB; Заново</button><button class="sc-over-close">Закрыть</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    syncLightTheme();
    try {
      const themeMO = new MutationObserver(syncLightTheme);
      themeMO.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
      themeMO.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    } catch (e) {}
    cv = overlay.querySelector('canvas.sc-cv');
    ctx = cv.getContext('2d');
    tctlEl = overlay.querySelector('.sc-tctl');
    const angRow = tctlEl.querySelector('[data-k="ang"]');
    const powRow = tctlEl.querySelector('[data-k="pow"]');
    angRange = angRow.querySelector('input');
    powRange = powRow.querySelector('input');
    angVal = angRow.querySelector('.sc-tv');
    powVal = powRow.querySelector('.sc-tv');
    tctlEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    angRange.addEventListener('input', () => { aim.ang = clamp(+angRange.value, AIM_MIN, AIM_MAX); draw(); });
    powRange.addEventListener('input', () => { aim.pow = clamp(+powRange.value, 5, 100); draw(); });
    [angRow, powRow].forEach(row => {
      const isAng = row.dataset.k === 'ang';
      row.querySelectorAll('.sc-tb').forEach(b => {
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state === 'over' || state === 'closing') return;
          if (isAng) aim.ang = clamp(aim.ang + (+b.dataset.d), AIM_MIN, AIM_MAX);
          else aim.pow = clamp(aim.pow + (+b.dataset.d), 5, 100);
          draw();
        });
      });
    });
  //scorch.ui.js part04
    const wiconCv = overlay.querySelector('.sc-wpn .sc-wicon');
    hudRefs = {
      ang: scSel('.sc-ang'), pow: scSel('.sc-pow'), wname: scSel('.sc-wname'), ammo: scSel('.sc-ammo'),
      round: scSel('.sc-round'), wins: scSel('.sc-wins'), score: scSel('.sc-score'),
      you: scSel('.sc-you'), enemy: scSel('.sc-enemy'), lasthit: scSel('.sc-lasthit'),
      windarrow: scSel('.sc-windarrow'), windval: scSel('.sc-windval'),
      wicon: wiconCv, wiconCtx: wiconCv ? wiconCv.getContext('2d') : null
    };
    touchUI = !!(window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));
    // HUD icon hints: tap an icon → short explanation bubble
    let hintT = null;
    const showHint = (txt) => {
      const h = overlay.querySelector('.sc-hint');
      h.textContent = txt;
      h.classList.add('show');
      clearTimeout(hintT);
      hintT = setTimeout(() => h.classList.remove('show'), 1800);
    };
    overlay.querySelectorAll('[data-hint]').forEach(el => {
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); showHint(el.dataset.hint); });
    });
    // hull gallery in help
    const gal = overlay.querySelector('.sc-hullgal');
    HULLS.forEach(h => {
      const it = document.createElement('div');
      it.className = 'sc-hg-item';
      const c3 = document.createElement('canvas');
      c3.width = 52; c3.height = 52;
      drawMiniTurret(c3.getContext('2d'), 52, '#8fa6c4', h.key);
      it.appendChild(c3);
      const lb = document.createElement('span');
      lb.textContent = h.name;
      it.appendChild(lb);
      gal.appendChild(it);
    });
    // weapon cards in help
    const wpnDesc = {
      MISSILE: 'урон 36 hp',
      FUNKY: 'каскад: 8×24 hp + финал 24 hp',
      DEATH: 'урон 80 hp + ударная волна',
      NUKE: 'урон 105 hp + кольцо пожаров',
      PLASMA: 'прилипает: 32 hp + ~9 hp/с (потолок ~46 hp) и плавка грунта',
      NAPALM: '10 hp + огонь ~7 hp/с (до 2 очагов)',
      ROLLER: 'урон 56 hp, катится по склону дольше и быстрее',
      DIGGER: 'бур 14 hp/такт + финал 38 hp (бур не поджигает залежи)',
      DIRT: 'без урона — насыпь грунта',
      MIRV: 'залп: 5×30 hp'
    };
    const wgal = overlay.querySelector('.sc-wpnhelp');
    ARSENAL.forEach((w, i) => {
      const row = document.createElement('div');
      row.className = 'sc-wpnrow';
      const ic = document.createElement('canvas');
      ic.width = 40; ic.height = 40;
      const mc = ic.getContext('2d');
      mc.translate(20, 20); mc.rotate(-Math.PI / 4); mc.scale(1.5, 1.5);
      drawProjectileShape(mc, w);
      row.appendChild(ic);
      const tx = document.createElement('div');
      tx.className = 'sc-wt';
      const b = document.createElement('b');
      b.textContent = `${(i + 1) % 10} — ${w.name} ×${w.ammo === Infinity ? '∞' : w.ammo}`;
      tx.appendChild(b);
      const sp = document.createElement('span');
      sp.textContent = wpnDesc[w.key] || `урон ${w.dmg} hp`;
      tx.appendChild(sp);
      row.appendChild(tx);
      const ww = document.createElement('span');
      ww.className = 'sc-ww';
      ww.title = 'Подверженность ветру';
      ww.textContent = `ветер ${Math.round(w.wind * 100)}%`;
      row.appendChild(ww);
      wgal.appendChild(row);
    });
    const helpEl = overlay.querySelector('.sc-help');
    const wmenu = overlay.querySelector('.sc-wmenu');
    const setupEl = overlay.querySelector('.sc-setup');
    const confirmEl = overlay.querySelector('.sc-confirm');
    const refreshHelpRecs = () => fillRecordsTable(helpEl.querySelector('.sc-rechelp'), -1);
    const closeHelp = () => { helpEl.classList.remove('show'); helpOpen = false; };
    const closeSetup = () => { setupEl.classList.remove('show'); setupOpen = false; };
    const closeConfirm = () => { confirmEl.classList.remove('show'); confirmOpen = false; };
    scSel('.sc-helpbtn').onclick = (e) => {
      e.stopPropagation();
      const willOpen = !helpEl.classList.contains('show');
      closeSetup(); closeConfirm();
      helpEl.classList.toggle('show', willOpen);
      helpOpen = willOpen;
      if (willOpen) refreshHelpRecs();
    };
    overlay.querySelector('.sc-helpx').onclick = (e) => { e.stopPropagation(); closeHelp(); };
    helpEl.onclick = (e) => e.stopPropagation();
    scSel('.sc-again').onclick = (e) => { e.stopPropagation(); scSel('.sc-over').classList.remove('show'); start(); };
    scSel('.sc-over-close').onclick = (e) => { e.stopPropagation(); scSel('.sc-over').classList.remove('show'); closeGame(false); };
    scSel('.sc-wpn').onclick = (e) => { e.stopPropagation(); renderWeaponMenu(); wmenu.classList.toggle('show'); };
    wmenu.onclick = (e) => e.stopPropagation();
    // hidden reset: TRIPLE click/tap the record table
    let recClickN = 0, recClickT = 0;
    scSel('.sc-over .sc-rectab').addEventListener('click', (e) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - recClickT > 900) recClickN = 0;
      recClickT = now;
      if (++recClickN < 3) return;
      recClickN = 0;
      try { localStorage.removeItem(LS_KEY); } catch (e2) {}
      saveRec(players[0], score, wins);
      saveRec(players[1], score2, wins2);
      renderRecords(0);
      refreshHelpRecs();
    });
    // ============ MK-style setup, two side-by-side columns ============
    const setup = { mode: GMODE, blocks: [null, null], draft: [null, null], sug: [null, null], picked: [null, null] };
    const draftForMode = (mode) => {
      const c = lastCfg()[mode];
      const d0 = c && c.p0 ? { name: c.p0.name, col: c.p0.col, hull: c.p0.hull } : { name: 'Player1', col: '#2ecc71', hull: 'classic' };
      let d1;
      if (mode === 1) d1 = { name: 'GLM', col: c && c.p1 ? c.p1.col : '#ff4757', hull: c && c.p1 ? c.p1.hull : 'classic' };
      else d1 = c && c.p1 ? { name: c.p1.name, col: c.p1.col, hull: c.p1.hull } : { name: 'Player2', col: '#3498db', hull: 'classic' };
      if (mode === 2) Object.assign(d1, profLook(d1.name, d1));
      Object.assign(d0, profLook(d0.name, d0));
      return [d0, d1];
    };
    const renderModeIcons = () => {
      overlay.querySelectorAll('.sc-mode-btn').forEach(b => {
        const holder = b.querySelector('.sc-mm');
        if (!holder) return;
        holder.innerHTML = +b.dataset.m === 1
          ? '<i class="sc-ic">\u263A</i><b>VS</b><i class="sc-ic">\u2699\uFE0E</i>'
          : '<i class="sc-ic">\u263A</i><b>VS</b><i class="sc-ic">\u263A</i>';
      });
    };
    const getSuggestions = (pi, showAll) => {
      const ps = profiles().filter(pr => pr.name !== 'GLM');
      const nm = (setup.draft[pi].name || '').trim().toLowerCase();
      if (showAll || !nm) return ps;
      return ps.filter(pr => pr.name.toLowerCase().indexOf(nm) === 0);
    };
    const closeSuggest = (pi) => { if (setup.sug[pi]) { setup.sug[pi].classList.remove('show'); } };
    const removeProfile = (pi, name, reopen) => {
      const nm = (name || '').trim();
      if (nm) saveProfiles(profiles().filter(q => q.name.toLowerCase() !== nm.toLowerCase()));
      if (nm && (setup.draft[pi].name || '').trim().toLowerCase() === nm.toLowerCase()) {
        setup.draft[pi].name = '';
        setup.picked[pi] = null;
        const inp = setup.blocks[pi] && setup.blocks[pi].querySelector('input');
        if (inp) inp.value = '';
      }
      renderSetupBlocks();
      if (reopen) renderSuggest(pi, true); else closeSuggest(pi);
    };
    const deleteFighter = (pi, name) => {
      const nm = (name || '').trim();
      if (!nm) return;
      const hasRecs = records().some(r => (r.pname || '').toLowerCase() === nm.toLowerCase());
      if (!hasRecs) { removeProfile(pi, nm, false); return; }
      askConfirm(`У бойца «${nm}» есть записи в таблице рекордов. Удалить бойца вместе с его рекордами?`, () => {
        try { localStorage.setItem(LS_KEY, JSON.stringify(records().filter(r => (r.pname || '').toLowerCase() !== nm.toLowerCase()))); } catch (e2) {}
        removeProfile(pi, nm, false);
      }, { no: 'Отменить', yes: 'Удалить' });
    };
    const renderSuggest = (pi, showAll) => {
      const blk = setup.blocks[pi];
      if (!blk) return;
      closeSuggest(1 - pi);
      let sug = setup.sug[pi];
      if (!sug) {
        sug = document.createElement('div');
        sug.className = 'sc-suggest';
        blk.querySelector('.sc-pl-head').appendChild(sug);
        setup.sug[pi] = sug;
      }
      sug.innerHTML = '';
      const list = getSuggestions(pi, showAll).slice(0, 6);
      if (!list.length) { sug.classList.remove('show'); return; }
      list.forEach(pr => {
        const si = document.createElement('div');
        si.className = 'sc-sug-item';
        const cc = document.createElement('canvas');
        cc.width = 26; cc.height = 26;
        drawMiniTurret(cc.getContext('2d'), 26, pr.col, pr.hull);
        si.appendChild(cc);
        const nm = document.createElement('span');
        nm.textContent = pr.name;
        si.appendChild(nm);
        const del = document.createElement('button');
        del.className = 'sc-sug-del';
        del.title = 'Удалить бойца';
        del.textContent = '✕';
        del.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); deleteFighter(pi, pr.name); };
        del.onclick = (ev) => ev.stopPropagation();
        si.appendChild(del);
        si.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); loadProfile(pi, pr); };
        sug.appendChild(si);
      });
      sug.classList.add('show');
    };
    const loadProfile = (pi, pr) => {
      setup.draft[pi].name = pr.name;
      setup.draft[pi].col = pr.col;
      setup.draft[pi].hull = pr.hull;
      setup.picked[pi] = pr.name;
      closeSuggest(pi);
      renderSetupBlocks();
    };
    const upsertProfileNow = (pi) => {
      const d = setup.draft[pi];
      const nm = (d.name || '').trim();
      if (!nm || (pi === 1 && setup.mode === 1) || nm.toLowerCase() === 'glm') return;
      const ps = profiles();
      const i = ps.findIndex(pr => pr.name.toLowerCase() === nm.toLowerCase());
      if (i < 0) return;
      ps[i] = { name: nm, col: d.col, hull: d.hull };
      saveProfiles(ps);
    };
    const checkName = (pi) => {
      const blk = setup.blocks[pi];
      if (!blk) return true;
      const inp = blk.querySelector('input');
      const err = blk.querySelector('.sc-pl-err');
      const nm = (setup.draft[pi].name || '').trim();
      let bad = '';
      if (nm && (setup.draft[1 - pi].name || '').trim().toLowerCase() === nm.toLowerCase()) bad = 'ИМЯ ЗАНЯТО СОПЕРНИКОМ';
      else if (pi === 0 && setup.mode === 2 && nm.toLowerCase() === 'glm') bad = 'ИМЯ ЗАНЯТО КОМПЬЮТЕРОМ';
      err.textContent = bad;
      if (inp) inp.classList.toggle('sc-name-bad', !!bad);
      return !bad;
    };
    const renderSetupBlocks = () => {
      setup.blocks.forEach((blk, pi) => {
        if (!blk) return;
        const p = setup.draft[pi];
        const locked = pi === 1 && setup.mode === 1;
        blk.classList.toggle('locked', locked);
        const input = blk.querySelector('input');
        if (input && input !== document.activeElement) input.value = p.name;
        const tools = blk.querySelector('.sc-pl-tools');
        if (tools) tools.style.display = locked ? 'none' : 'flex';
        const delB = blk.querySelector('.sc-pl-del');
        if (delB) delB.style.display = locked ? 'none' : 'block';
        blk.querySelectorAll('.sc-mcell').forEach((mc, i) => {
          mc.classList.toggle('sel', HULLS[i].key === p.hull);
          drawMiniTurret(mc.getContext('2d'), 52, setup.draft[pi].col, HULLS[i].key);
        });
        blk.querySelectorAll('.sc-sw').forEach((sw, i) => {
          sw.classList.toggle('sel', HULL_COLORS[i] === p.col);
          sw.classList.toggle('taken', setup.draft[1 - pi].col === HULL_COLORS[i]);
        });
        checkName(pi);
      });
      overlay.querySelectorAll('.sc-mode-btn').forEach(b => {
        b.classList.toggle('sel', +b.dataset.m === setup.mode);
      });
      renderModeIcons();
    };
    const buildBlock = (pi) => {
      const blk = setup.blocks[pi];
      blk.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'sc-pl-head';
      const lbl = document.createElement('label');
      lbl.textContent = pi === 0 ? 'ИГРОК 1' : (setup.mode === 2 ? 'ИГРОК 2' : 'КОМПЬЮТЕР');
      head.appendChild(lbl);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.value = setup.draft[pi].name;
      input.setAttribute('autocomplete', 'off');
      input.disabled = pi === 1 && setup.mode === 1;
      input.oninput = () => {
        setup.draft[pi].name = input.value;
        const nmv = input.value.trim();
        if (nmv && !(pi === 1 && setup.mode === 1)) {
          const m = profiles().find(pr => pr.name.toLowerCase() === nmv.toLowerCase());
          setup.picked[pi] = m ? m.name : null;
          if (m) { setup.draft[pi].col = m.col; setup.draft[pi].hull = m.hull; }
        } else setup.picked[pi] = null;
        renderSetupBlocks();
        renderSuggest(pi);
      };
      input.onfocus = () => renderSuggest(pi);
      input.onblur = () => setTimeout(() => closeSuggest(pi), 150);
      head.appendChild(input);
      // ▾ toggles this column's own saved-fighters list
      const tools = document.createElement('span');
      tools.className = 'sc-pl-tools';
      const dd = document.createElement('button');
      dd.className = 'sc-t-dd';
      dd.textContent = '▾';
      dd.title = 'Сохранённые бойцы';
      dd.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
      dd.onclick = (e) => {
        e.stopPropagation();
        const open = setup.sug[pi] && setup.sug[pi].classList.contains('show');
        closeSuggest(0); closeSuggest(1);
        if (!open) renderSuggest(pi, true);
      };
      tools.appendChild(dd);
      head.appendChild(tools);
      blk.appendChild(head);
      const err = document.createElement('div');
      err.className = 'sc-pl-err';
      blk.appendChild(err);
      const mtt = document.createElement('div');
      mtt.className = 'sc-matrix-title';
      mtt.textContent = 'КОРПУС';
      blk.appendChild(mtt);
      const mtx = document.createElement('div');
      mtx.className = 'sc-matrix';
      HULLS.forEach(h => {
        const mc = document.createElement('canvas');
        mc.width = 52; mc.height = 52;
        mc.className = 'sc-mcell';
        mc.title = h.name;
        drawMiniTurret(mc.getContext('2d'), 52, setup.draft[pi].col, h.key);
        mc.onclick = () => { setup.draft[pi].hull = h.key; upsertProfileNow(pi); renderSetupBlocks(); };
        mtx.appendChild(mc);
      });
      blk.appendChild(mtx);
      const pal = document.createElement('div');
      pal.className = 'sc-palette';
      HULL_COLORS.forEach(cc => {
        const sw = document.createElement('button');
        sw.className = 'sc-sw';
        sw.style.background = cc;
        sw.onclick = () => {
          if (setup.draft[1 - pi].col === cc) return;
          setup.draft[pi].col = cc;
          upsertProfileNow(pi);
          renderSetupBlocks();
        };
        pal.appendChild(sw);
      });
      blk.appendChild(pal);
      const delBtn = document.createElement('button');
      delBtn.className = 'sc-pl-del';
      delBtn.textContent = '✕ УДАЛИТЬ БОЙЦА';
      delBtn.title = 'Удалить сохранённого бойца (с рекордами — спросит)';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteFighter(pi, setup.picked[pi] || setup.draft[pi].name);
      };
      blk.appendChild(delBtn);
      setup.sug[pi] = null;
    };
    overlay.querySelectorAll('.sc-mode-btn').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        setup.mode = +b.dataset.m;
        setup.draft = draftForMode(setup.mode);
        setup.picked = [null, null];
        buildBlock(0);
        buildBlock(1);
        renderSetupBlocks();
      };
    });
    const openSetup = () => {
      setup.mode = GMODE;
      setup.draft = draftForMode(setup.mode);
      setup.picked = [null, null];
      setup.blocks = [overlay.querySelector('.sc-pl-block[data-p="0"]'), overlay.querySelector('.sc-pl-block[data-p="1"]')];
      buildBlock(0);
      buildBlock(1);
      closeHelp(); closeConfirm();
      renderSetupBlocks();
      setupEl.classList.add('show');
      setupOpen = true;
    };
    scSel('.sc-pvpbtn').onclick = (e) => { e.stopPropagation(); openSetup(); };
    overlay.querySelector('.sc-set-x').onclick = (e) => { e.stopPropagation(); closeSetup(); };
    scSel('.sc-go').onclick = (e) => {
      e.stopPropagation();
      if (!checkName(0) || !checkName(1)) { beep(220, 0.12, 0.2); return; }
      GMODE = setup.mode;
      players[0] = { name: setup.draft[0].name.trim() || 'Player1', col: setup.draft[0].col, hull: setup.draft[0].hull, ai: false };
      players[1] = setup.mode === 1
        ? { name: 'GLM', col: setup.draft[1].col, hull: setup.draft[1].hull, ai: true }
        : { name: setup.draft[1].name.trim() || 'Player2', col: setup.draft[1].col, hull: setup.draft[1].hull, ai: false };
      if (players[1].col === players[0].col) {
        const ci = HULL_COLORS.indexOf(players[0].col);
        players[1].col = HULL_COLORS[(ci + 1) % HULL_COLORS.length];
      }
      saveLastCfg(setup.mode, players[0], players[1]);
      const ps = profiles();
      const known = ps.map(q => q.name.toLowerCase());
      [players[0]].concat(setup.mode === 2 ? [players[1]] : []).forEach(pl => {
        if ((pl.name === 'Player1' || pl.name === 'Player2') && known.indexOf(pl.name.toLowerCase()) < 0) return;
        const i = ps.findIndex(pr => pr.name.toLowerCase() === pl.name.toLowerCase());
        if (i >= 0) ps[i] = { name: pl.name, col: pl.col, hull: pl.hull };
        else ps.push({ name: pl.name, col: pl.col, hull: pl.hull });
      });
      saveProfiles(ps);
      closeSetup();
      start();
    };
    // ============ exit confirmation — every exit route in pvp ============
    const requestExit = (boom) => {
      if (!boom && GMODE === 2 && confirmClose && state !== 'over') {
        askConfirm('Дуэль не окончена. Сдаться и выйти?', () => closeGame(false));
        return;
      }
      closeGame(boom);
    };
    scSel('.sc-no').onclick = (e) => { e.stopPropagation(); confirmAction = null; closeConfirm(); };
    scSel('.sc-yes').onclick = (e) => {
      e.stopPropagation();
      const act = confirmAction;
      confirmAction = null;
      closeConfirm();
      if (act) act();
    };
    // HUD chips toggle the bottom control panel (non-modal)
    overlay.querySelectorAll('.sc-aimctl').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state !== 'aim' || helpOpen) return;
        tctlOpen = !tctlOpen;
        draw();
      });
    });
    document.addEventListener('click', () => wmenu.classList.remove('show'));
  
    window.addEventListener('resize', resize);
    // canvas input stays fully live while the bottom panel is up
    cv.addEventListener('pointerdown', (e) => {
      if (setupOpen || confirmOpen) return;
      if (helpOpen) { closeHelp(); return; }
      if (wmenu.classList.contains('show')) { wmenu.classList.remove('show'); return; }
      if (state === 'over' || state === 'closing') return;
      if (state !== 'aim' || !isHumanSeat(turn)) return;
      drag = { x: ptrPos(e).x, y: ptrPos(e).y, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch {}
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = ptrPos(e);
      if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > 5) drag.moved = true;
      if (drag.moved) { drag.x = p.x; drag.y = p.y; updateAimFromPointer(p); }
    });
    cv.addEventListener('pointerup', () => {
      if (drag && !drag.moved && state === 'aim' && isHumanSeat(turn) && turnIntro <= 0) {
        if (turn === 0) fire();
        else if (GMODE === 2) fire2();
      }
      drag = null;
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (state !== 'aim' || !isHumanSeat(turn)) return;
      aim.pow = clamp(aim.pow + (e.deltaY < 0 ? 1 : -1), 10, 100);
      draw();
    }, { passive: false });
    window.addEventListener('keydown', keyH, true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) requestExit(false); });
    overlay.querySelector('.sc-close').onclick = () => requestExit(true);
  }
  
  function renderWeaponMenu() {
    const wmenu = overlay.querySelector('.sc-wmenu');
    const chip = overlay.querySelector('.sc-wpn');
    const wrap = overlay.querySelector('.sc-wrap');
    const cr = chip.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    wmenu.style.left = Math.max(4, Math.min(cr.left - wr.left, wr.width - 230)) + 'px';
    wmenu.style.top = (cr.bottom - wr.top + 4) + 'px';
    wmenu.innerHTML = '';
    const inv = currentInv();
    const ccur = currentCur();
    ARSENAL.forEach((w, i) => {
      const has = inv[w.key] > 0 || w.ammo === Infinity;
      const item = document.createElement('div');
      item.className = 'sc-witem' + (i === ccur ? ' sel' : '') + (has ? '' : ' noammo');
      const mini = document.createElement('canvas');
      mini.width = 26; mini.height = 26;
      const mc = mini.getContext('2d');
      mc.translate(13, 13); mc.rotate(-Math.PI / 4);
      drawProjectileShape(mc, w);
      item.appendChild(mini);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = (i + 1) % 10;
      item.appendChild(num);
      const nm = document.createElement('span');
      nm.textContent = w.name;
      item.appendChild(nm);
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      cnt.textContent = w.ammo === Infinity ? '∞' : inv[w.key];
      item.appendChild(cnt);
      item.onclick = (e) => { e.stopPropagation(); if (!has) return; setCurrentCur(i); wmenu.classList.remove('show'); draw(); };
      wmenu.appendChild(item);
    });
  }
  
  function rescaleWorld(oW, oH) {
    const kx = Wc / oW, ky = Hc / oH;
    const N = NCOL();
    const step = Wc / N;
    const nc = [];
    for (let i = 0; i < N; i++) {
      const oi = clamp(Math.round((i * step / kx) / cols.step), 0, cols.length - 1);
      const c = cols[oi];
      nc.push({
        top: c.top * ky, surf: c.surf, burn: c.burn, melt: c.melt,
        h0: c.h1 > 0 ? c.h0 * ky : 0, h1: c.h1 > 0 ? c.h1 * ky : 0, sid: c.sid,
        lava: c.lava * ky, lavaT: c.lavaT
      });
    }
    nc.step = step;
    cols = nc;
    // rescale the cave ceiling profile and everything hanging in the cave
    if (UNDER && ceil) {
      const nceil = [];
      const oc = ceil.length;
      const oldStep = oW / oc;
      for (let i = 0; i < N; i++) {
        const oi = clamp(Math.round((i * step / kx) / oldStep), 0, oc - 1);
        nceil.push(ceil[oi] * ky);
      }
      ceil = nceil;
      caveLights.forEach(L => {
        L.x *= kx; L.y *= ky;
        if (L.k === 'cry') L.r *= Math.sqrt(kx * ky);
        else { L.fy *= ky; L.w *= Math.sqrt(kx * ky); }
      });
      caveVents.forEach(v => {
        v.x0 *= kx; v.x1 *= kx;
        v.cix = clamp(Math.round(((v.x0 + v.x1) / 2) / step), 4, N - 5);
      });
    }
    waterLevel *= ky;
    waterH = null;
    ripples = [];
    tanks.forEach(t => { t.x = clamp(t.x * kx, 20, Wc - 20); t.y *= ky; });
    remains.forEach(rm => { rm.x *= kx; rm.y *= ky; });
    sinkers.forEach(sk => { sk.x *= kx; sk.y *= ky; });
    wreckBits.forEach(w => { w.x *= kx; w.y *= ky; });
    pockets.forEach(pk => { pk.x0 *= kx; pk.x1 *= kx; pk.y0 *= ky; pk.y1 *= ky; });
    if (state === 'fly') { shot = null; subshots = []; endTurn(); }
    else { shot = null; subshots = []; }
    liquids = []; debris = []; windParts = []; grains = []; lavaBits = [];
    if (volcano) {
      volcano.x *= kx; volcano.y *= ky;
      volcano.r *= Math.sqrt(kx * ky);
      volcano.coneBot *= ky;
      volcano.extra = [];
      volcScan();
    }
    groundPat = null;
    buildGroundTex();
    dirtyA = 0; dirtyB = N - 1;
  }
  
  function resize() {
    if (!overlay) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) { setTimeout(resize, 60); return; }
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const oW = Wc, oH = Hc;
    Wc = r.width; Hc = r.height;
    if (cols && oW) rescaleWorld(oW, oH);
    if (cols) draw();
  }
  
  function keyH(e) {
    if (!overlay || !overlay.classList.contains('show')) return;
    if (e.key === 'Escape') {
      // Esc unwinds ONE modal at a time: weapon menu → confirm → setup →
      // control panel → help, and only then considers leaving the game
      const wmenu = overlay.querySelector('.sc-wmenu');
      if (wmenu.classList.contains('show')) { wmenu.classList.remove('show'); return; }
      if (confirmOpen) { overlay.querySelector('.sc-confirm').classList.remove('show'); confirmOpen = false; confirmAction = null; return; }
      if (setupOpen) { overlay.querySelector('.sc-setup').classList.remove('show'); setupOpen = false; return; }
      if (tctlOpen && !touchUI) { tctlOpen = false; return; }
      if (helpOpen) { overlay.querySelector('.sc-help').classList.remove('show'); helpOpen = false; return; }
      if (scSel('.sc-over').classList.contains('show')) { scSel('.sc-over').classList.remove('show'); closeGame(false); return; }
      // pvp in progress → confirmation, otherwise straight out
      if (GMODE === 2 && confirmClose && state !== 'over') { askConfirm('Дуэль не окончена. Сдаться и выйти?', () => closeGame(false)); return; }
      closeGame(false);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (state !== 'aim' || !isHumanSeat(turn)) return;
      const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
      const inv = currentInv();
      if (idx < ARSENAL.length && (inv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity)) { setCurrentCur(idx); overlay.querySelector('.sc-wmenu').classList.remove('show'); draw(); }
      return;
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','W','ц','Ц'].includes(e.key)) e.preventDefault();
    if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') { nextWeapon(); return; }
    if (state !== 'aim' || !isHumanSeat(turn)) return;
    // aiming is always live; firing and the trajectory are own-turn only.
    // The clamps span the FULL barrel arc (AIM_MIN..AIM_MAX)
    const ccw = activeDir();
    if (e.key === 'ArrowLeft') aim.ang = clamp(aim.ang + ccw, AIM_MIN, AIM_MAX);
    if (e.key === 'ArrowRight') aim.ang = clamp(aim.ang - ccw, AIM_MIN, AIM_MAX);
    if (e.key === 'ArrowUp') aim.pow = clamp(aim.pow + 1, 10, 100);
    if (e.key === 'ArrowDown') aim.pow = clamp(aim.pow - 1, 10, 100);
    if (e.key === ' ') {
      if (turnIntro > 0) return;
      if (turn === 0) fire();
      else if (GMODE === 2) fire2();
      return;
    }
    if (e.key.startsWith('Arrow')) draw();
  }
  function nextWeapon() {
    const inv = currentInv();
    for (let i = 1; i <= ARSENAL.length; i++) {
      const idx = (currentCur() + i) % ARSENAL.length;
      if (inv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity) { setCurrentCur(idx); draw(); return; }
    }
    setCurrentCur(0); draw();
  }