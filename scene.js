/* Local 3D projections. All geometry is illustrative; no model/API dependency. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  const control = document.querySelector('.motion-toggle');
  function updateControl() {
    document.body.classList.toggle('motion-paused', paused);
    control.textContent = paused ? 'Bật chuyển động ↗' : 'Tạm dừng chuyển động Ⅱ';
    control.setAttribute('aria-pressed', String(paused));
  }
  control.addEventListener('click', () => { paused = !paused; updateControl(); renderAll(performance.now()); });
  reduced.addEventListener('change', () => { paused = reduced.matches; updateControl(); renderAll(performance.now()); });
  updateControl();

  const revealNodes = document.querySelectorAll('.about-grid,.section-heading,.project,.skill-row,.journey-grid,.award,.connect');
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => entries.forEach(e => {
      e.target.classList.toggle('in-view', e.isIntersecting);
    }), { threshold: 0.08 });
    revealNodes.forEach(n => { n.classList.add('reveal'); reveal.observe(n); });
    document.body.classList.add('motion-ready');
  }
  const progress = document.querySelector('.scroll-progress');
  function scrollProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
  }
  addEventListener('scroll', scrollProgress, { passive: true });
  addEventListener('resize', scrollProgress); scrollProgress();

  const scenes = [...document.querySelectorAll('canvas[data-scene]')].map(canvas => {
    const ctx = canvas.getContext('2d');
    return { canvas, ctx, kind: canvas.dataset.scene, width: 1, height: 1, visible: true, x: 0, y: 0, time: 0 };
  }).filter(s => s.ctx);
  function resize(s) {
    const rect = s.canvas.getBoundingClientRect();
    s.width = rect.width; s.height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    s.canvas.width = Math.max(1, rect.width * dpr);
    s.canvas.height = Math.max(1, rect.height * dpr);
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(s, s.time);
  }
  scenes.forEach(s => {
    new ResizeObserver(() => resize(s)).observe(s.canvas);
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { s.visible = e[0].isIntersecting; }).observe(s.canvas);
    s.canvas.addEventListener('pointermove', e => { const r = s.canvas.getBoundingClientRect(); s.x = (e.clientX - r.left) / r.width - .5; s.y = (e.clientY - r.top) / r.height - .5; if (paused) draw(s, s.time); });
    s.canvas.addEventListener('pointerleave', () => { s.x = s.y = 0; if (paused) draw(s, s.time); });
    resize(s);
  });
  const labels = { morph: ['01 / SHAPE RECONSTRUCTION', '2D → 3D'], neural: ['02 / ARTIFICIAL INTELLIGENCE', 'NODES × CONNECTIONS'], geometry: ['03 / GEOMETRIC AI', 'STRUCTURE × SPACE'] };
  document.querySelectorAll('[data-scene-mode]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-scene-mode]').forEach(item => { item.classList.toggle('active', item === b); item.setAttribute('aria-pressed', String(item === b)); });
    const hero = scenes.find(s => s.canvas.id === 'mesh');
    if (!hero) return;
    hero.kind = b.dataset.sceneMode;
    const [caption, suffix] = labels[hero.kind];
    document.querySelector('#scene-label').textContent = caption;
    document.querySelector('#scene-suffix').textContent = suffix;
    hero.canvas.setAttribute('aria-label', caption);
    draw(hero, hero.time);
  }));

  function project(s, p, time, scale = 1) {
    const ay = time * .24 + .5 + s.x * .5, ax = -.35 + s.y * .4;
    const x = p[0] * Math.cos(ay) + p[2] * Math.sin(ay);
    const z = -p[0] * Math.sin(ay) + p[2] * Math.cos(ay);
    const y = p[1] * Math.cos(ax) - z * Math.sin(ax);
    const zz = p[1] * Math.sin(ax) + z * Math.cos(ax);
    const perspective = 6 / (6 + zz);
    const unit = Math.min(s.width, s.height) * .255 * scale;
    return { x: s.width * .5 + x * unit * perspective, y: s.height * .46 + y * unit * perspective, z: zz };
  }
  function line(ctx, a, b, opacity = .2, width = .7) {
    ctx.strokeStyle = `rgba(28,33,24,${opacity})`; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function shadow(s, time) {
    const c = s.ctx, y = s.height * .78;
    c.save(); c.translate(s.width * .5, y); c.scale(1, .15);
    const r = Math.min(s.width, s.height) * .27;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, '#2c2c2c24'); g.addColorStop(1, '#2c2c2c00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function morph(s, time) {
    const c = s.ctx, rows = 22, cols = 38;
    const mix = .5 + Math.sin(time * .48) * .46;
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      pts[j] = [];
      const v = j / rows * Math.PI;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols * Math.PI * 2;
        let p = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
        const edge = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]), .001);
        const f = 1 + mix * (1 / edge - 1) * .66;
        p = p.map(a => a * f);
        pts[j][i] = project(s, p, time);
      }
    }
    const faces = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const p = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
      faces.push({ p, depth: p.reduce((n, v) => n + v.z, 0) / 4, i, j });
    }
    faces.sort((a, b) => b.depth - a.depth);
    faces.forEach(f => {
      const tone = Math.round(88 + (f.depth + 1.6) * 37 + 48 * Math.pow(Math.max(0, Math.cos(f.i / cols * Math.PI * 2 + time * .24 - 1)), 12));
      c.beginPath(); c.moveTo(f.p[0].x, f.p[0].y); f.p.slice(1).forEach(p => c.lineTo(p.x, p.y)); c.closePath();
      c.fillStyle = `rgb(${tone},${tone},${tone})`; c.fill(); c.strokeStyle = '#2b2b2b25'; c.lineWidth = .45; c.stroke();
    });
    // Image-plane motif floating in front of the reconstructed object.
    const x = s.width * .13, y = s.height * .58 + Math.sin(time) * 5, side = s.width * .13;
    c.fillStyle = '#ffffffd9'; c.strokeStyle = '#49494988'; c.lineWidth = .8;
    c.fillRect(x, y, side, side); c.strokeRect(x, y, side, side);
    c.beginPath(); c.moveTo(x + side * .18, y + side * .78); c.lineTo(x + side * .5, y + side * .22); c.lineTo(x + side * .83, y + side * .78); c.closePath(); c.stroke();
    c.setLineDash([3, 4]); c.beginPath(); c.moveTo(x + side, y + side * .5); c.lineTo(s.width * .4, s.height * .57); c.stroke(); c.setLineDash([]);
  }
  function device(s, time) {
    // A complete low-poly machine-vision camera with lens, mount and base.
    const c = s.ctx, faces = [];
    const pose = (-1.05 + Math.sin(time * .45) * .25) / .24;
    const P = p => project(s, [p[0], p[1] + Math.sin(time * .8) * .025, p[2]], pose, 1.24);
    function face(vertices, tone) {
      const p = vertices.map(P);
      faces.push({ p, depth: p.reduce((n, v) => n + v.z, 0) / p.length, tone });
    }
    function box(x0, y0, z0, x1, y1, z1, tone) {
      const v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
      [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((f,i) => face(f.map(n=>v[n]),Math.max(8,Math.min(250,tone+[8,-28,28,-37,-14,-5][i]))));
    }
    function cylinder(cx, cy, z0, z1, radius, tone, capTone) {
      const ring = z => Array.from({length:48},(_,i)=>[cx+radius*Math.cos(i/48*Math.PI*2),cy+radius*Math.sin(i/48*Math.PI*2),z]);
      const a=ring(z0),b=ring(z1);
      for(let i=0;i<48;i++) face([a[i],a[(i+1)%48],b[(i+1)%48],b[i]],Math.max(8,Math.min(250,tone+Math.sin(i/48*Math.PI*2)*30)));
      face(a,capTone); face(b,tone-10);
    }
    box(-.96,-.72,-.40,.96,.31,.43,202);
    box(-.87,-.62,-.44,.87,.21,-.40,52);
    box(-.23,.3,-.02,.23,.77,.24,118);
    box(-.8,.77,-.55,.8,.92,.66,180);
    box(-.65,.92,-.40,.65,.97,.51,38);
    box(.30,-.48,-.48,.72,-.06,-.44,18);
    box(.36,-.40,-.487,.66,-.14,-.48,88);
    cylinder(-.27,-.20,-.45,-.73,.40,75,60);
    cylinder(-.27,-.20,-.74,-.92,.35,46,125);
    cylinder(-.27,-.20,-.93,-.95,.29,24,20);
    cylinder(-.27,-.20,-.96,-.97,.20,68,63);
    cylinder(-.27,-.20,-.98,-.99,.125,22,12);
    // Lens reflections, fasteners, cooling slots and a small antenna.
    face([[-.42,-.32,-1],[-.31,-.37,-1],[-.14,-.19,-1],[-.20,-.13,-1]],166);
    for (const x of [-.78,.78]) for(const y of [-.53,.11]) cylinder(x,y,-.455,-.468,.025,150,158);
    for(let i=0;i<5;i++) box(.965,-.46+i*.105,-.15,.973,-.43+i*.105,.29,58);
    box(.55,-.95,.15,.60,-.72,.20,44);
    box(.51,-1.02,.11,.64,-.94,.24,95);
    faces.sort((a,b)=>b.depth-a.depth).forEach(f=>{
      c.beginPath(); c.moveTo(f.p[0].x,f.p[0].y); f.p.slice(1).forEach(p=>c.lineTo(p.x,p.y)); c.closePath();
      c.fillStyle=`rgb(${f.tone},${f.tone},${f.tone})`;c.fill();c.lineWidth=.45;c.strokeStyle='#00000022';c.stroke();
    });
  }

  function network(s, time, geometry) {
    const c = s.ctx, count = geometry ? 12 : 48;
    const points = [];
    for (let i = 0; i < count; i++) {
      const y = 1 - i / (count - 1) * 2, radius = Math.sqrt(1 - y * y), a = i * 2.39996;
      const wobble = geometry ? 1 + .12 * Math.sin(time + i) : 1;
      const raw = [Math.cos(a) * radius * wobble, y * wobble, Math.sin(a) * radius * wobble];
      points.push({ ...project(s, raw, time), raw });
    }
    points.forEach((a, i) => points.slice(i + 1).forEach((b, j) => {
      const distance = Math.hypot(...a.raw.map((v, k) => v - b.raw[k]));
      if (distance < (geometry ? 1.23 : .68)) {
        line(c, a, b, geometry ? .4 : .19, geometry ? .8 : .6);
        const pulse = ((time * .25 + i * .13 + j * .11) % 1);
        c.beginPath(); c.fillStyle = '#2b2b2b'; c.arc(a.x + (b.x - a.x) * pulse, a.y + (b.y - a.y) * pulse, 1.4, 0, Math.PI * 2); c.fill();
      }
    }));
    points.sort((a, b) => b.z - a.z).forEach((p, i) => {
      const radius = geometry ? 4.3 : 2.8;
      const gradient = c.createRadialGradient(p.x - 1, p.y - 1, 0, p.x, p.y, radius * 2);
      gradient.addColorStop(0, '#a0a0a0'); gradient.addColorStop(.35, '#474747'); gradient.addColorStop(1, '#1a1a1a');
      c.fillStyle = gradient; c.beginPath(); c.arc(p.x, p.y, radius * (1.1 - p.z * .15), 0, Math.PI * 2); c.fill();
      if (geometry) { c.fillStyle = '#787878'; c.font = '9px monospace'; c.fillText('v' + i, p.x + 9, p.y - 9); }
    });
    // An orbit around the spatial graph.
    let prev;
    for (let i = 0; i <= 90; i++) {
      const t = i / 90 * Math.PI * 2;
      const p = project(s, [1.4 * Math.cos(t), .2 * Math.sin(t), 1.4 * Math.sin(t)], time);
      if (prev) line(c, prev, p, .13); prev = p;
    }
  }
  function draw(s, time) {
    if (!s.width || !s.height) return;
    const c = s.ctx; c.clearRect(0, 0, s.width, s.height);
    shadow(s, time);
    if (s.kind === 'device') device(s, time); else if (s.kind === 'morph') morph(s, time); else network(s, time, s.kind === 'geometry');
    c.fillStyle = '#8c8c8c'; c.font = '9px monospace';
    c.fillText('+', 20, s.height * .5); c.fillText('+', s.width - 26, s.height * .5);
  }
  function renderAll(now) { scenes.forEach(s => draw(s, s.time)); }
  let last = 0;
  function animate(now) {
    if (now - last > 32) {
      const delta = Math.min((now - last) / 1000, .05); last = now;
      if (!paused && !document.hidden) scenes.forEach(s => { if (s.visible) { s.time += delta; draw(s, s.time); } });
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
