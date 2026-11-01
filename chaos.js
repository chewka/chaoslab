"use strict";
/* ============ chaos: Chaos Mode, scores + combos, the three bars, big disasters, lab cat, inspector, mini-games, stage bar, rotor map ============ */
let chaosMode = true;
try { chaosMode = localStorage.getItem('chaoslab.mode') !== 'lab'; } catch(e) {}

/* ---------- scores ---------- */
function addChaos(pts, label, at){
  const sc = S.score; if(!sc) return;
  sc.combo = S.minutes <= sc.comboUntil ? Math.min(9, sc.combo + 1) : 1;
  sc.comboUntil = S.minutes + 12;
  sc.bestCombo = Math.max(sc.bestCombo, sc.combo);
  const p = Math.round(pts * (1 + (sc.combo - 1) * .5) / 5) * 5; sc.chaos += p;
  if(label) popup(`+${p} ${label}${sc.combo > 1 ? ' ×' + sc.combo : ''}`, at, 'chaos');
}
function addLab(pts, label, at){
  if(!S.score) return;
  S.score.lab += pts;
  if(label) popup(`+${pts} ${label}`, at, 'lab');
}
function awardTitle(){
  const {lab, chaos} = S.score;
  if(lab >= 1200 && chaos >= 2500) return 'Somehow Both';
  return lab * 2 >= chaos ? 'Employee of the Month' : 'Agent of Chaos';
}

/* ---------- the three bars: You (HP), Sample, Instrument ---------- */
function dmgSample(n){
  if(S.sample == null || S.over || !batch) return;
  S.sample = Math.max(0, S.sample - n);
  if(S.sample > 0) return;
  if(batch.ptr > flowIdx('weigh')){
    log('fail', `Sample bar hit zero: ${batch.id} is too contaminated to trust. Re-prep from weighing`);
    banner(`${batch.id} ruined: re-prep`, 'fail'); addChaos(100, 'Batch ruined');
    rework();
  }
  S.sample = 70;
}
function dmgInstr(n){
  if(S.instr == null || S.over) return;
  S.instr = Math.max(0, S.instr - n);
  if(S.instr > 0 || S.instrDown) return;
  S.instrDown = true;
  log('fail', 'Instrument bar hit zero: the ICP-MS needs a service call before anything else runs');
  banner('ICP-MS down: service call', 'fail'); addChaos(120, 'Instrument down', V.torchPos);
  plasmaOff(); S.urgent.push({id:'service'});
}

/* ---------- timers in sim minutes ---------- */
function later(min, fn){ S.timers.push({at:S.minutes + min, fn}); }

/* ---------- pop-up labels, comic bursts, screen shake ---------- */
const popEl = $('#popups'), POPS = [], projV = new THREE.Vector3();
for(let i = 0; i < 12; i++){ const b = document.createElement('b'); b.style.display = 'none'; popEl.append(b); POPS.push({el:b, t:0, life:1, off:0, pos:new THREE.Vector3()}); }
function popup(text, at, kind = 'chaos'){
  const p = POPS.find(q => q.t <= 0) || POPS.reduce((a, b) => a.t < b.t ? a : b);
  if(at) p.pos.set(at[0], at[1], at[2]); else p.pos.set(S.x, 30, S.z);
  p.off = POPS.filter(q => q !== p && q.t > 1.3).length * 20;
  p.el.textContent = text; p.el.className = kind; p.el.style.display = ''; p.t = p.life = 1.9;
}
function tickPops(rdt){
  for(const p of POPS){
    if(p.t <= 0) continue;
    p.t -= rdt;
    if(p.t <= 0){ p.el.style.display = 'none'; continue; }
    projV.copy(p.pos).project(camera);
    const x = (projV.x + 1) / 2 * innerWidth, y = (1 - projV.y) / 2 * innerHeight - (p.life - p.t) * 34 - p.off;
    p.el.style.transform = `translate(${x | 0}px,${y | 0}px) translate(-50%,-50%)`;
    p.el.style.opacity = Math.min(1, p.t / .5);
  }
}
const comicEl = $('#comic'), stageEl = $('#stage');
function comic(text, kind = 'fail'){ comicEl.textContent = text; comicEl.className = ''; void comicEl.offsetWidth; comicEl.className = 'go k-' + kind; }
let shakeT = 0, shakeA = 0;
function shake(a, d){ if(reduceMotion) return; shakeA = a; shakeT = d; }

/* ---------- held props for the new jobs ---------- */
prop('ext',   g => { box(g, 1.6, 4, 1.6, 0xe8303a, -.8, -2.6, -.8); box(g, .8, .8, .8, 0x15151a, -.4, 1.4, -.4); box(g, .4, .4, 2.4, 0x15151a, -.2, 1.7, .2); });
prop('rotor', g => { box(g, 4.4, .4, 3, 0xb9bdd0, -2.2, -1.2, -1.5); for(let i = 0; i < 6; i++){ box(g, .8, 2, .8, 0xf5f5f8, -1.9 + (i % 3) * 1.4, -.8, -1.1 + Math.floor(i / 3) * 1.4); box(g, .9, .4, .9, 0x5b8be0, -1.95 + (i % 3) * 1.4, 1.2, -1.15 + Math.floor(i / 3) * 1.4); } });

/* ---------- loose bodies: avalanche jars and digester debris ---------- */
const LOOSE = [];
const JAR_COLS = [0xc8a070, 0x8a6a4a, 0xe8e2d0, 0x6b5a40, 0xffd25e];
function makeLoose(kind, hh, build){
  const g = new THREE.Group(); build(g); g.visible = false; scene.add(g);
  LOOSE.push({g, kind, hh, h:hh, v:new THREE.Vector3(), w:new THREE.Vector3(), on:false, rest:false});
}
for(let i = 0; i < 40; i++) makeLoose('jar', 1.1, g => { box(g, 1.6, 2.2, 1.6, JAR_COLS[i % 5], -.8, -1.1, -.8); box(g, 1.8, .6, 1.8, 0xefeaff, -.9, 1.1, -.9); });
[[8.6, .6, 4, 0x2b2f45], [4, 3, .6, 0xe8eaf2], [3, .8, 2.4, 0x6a7aa8], [2, 2, .6, 0xe8eaf2], [1.4, 1.4, 1.4, 0x9aa0bb], [3.4, .6, 1.2, 0x2b2f45], [1.2, 2.6, 1.2, 0xf5f5f8], [1.2, 2.6, 1.2, 0xf5f5f8]]
  .forEach(([w, h, d, c]) => makeLoose('debris', h / 2, g => box(g, w, h, d, c, -w / 2, -h / 2, -d / 2)));
function launch(o, x, y, z, vx, vy, vz){
  o.g.position.set(x, y, z); o.g.rotation.set(0, rand(0, PI * 2), 0);
  o.v.set(vx, vy, vz); o.w.set(rand(-7, 7), rand(-7, 7), rand(-7, 7));
  o.h = Math.max(o.hh, .9); o.on = true; o.rest = false; o.g.visible = true;
}
function hideLoose(kind){ for(const o of LOOSE) if(o.kind === kind){ o.on = false; o.g.visible = false; } }
function stepLoose(dt){
  const gm = S.gravMul, vortexOn = S.vortexUntil > S.minutes;
  for(const o of LOOSE){
    if(!o.on) continue;
    const p = o.g.position;
    if(vortexOn){
      const dx = -37 - p.x, dy = 18 - p.y, dz = -28 - p.z, d = Math.hypot(dx, dy, dz) || 1;
      if(d < 4){ o.on = false; o.g.visible = false; continue; }
      if(d < 70){ o.rest = false; o.v.x += (dx / d * 70 - dz / d * 25) * dt; o.v.y += dy / d * 70 * dt + 50 * dt; o.v.z += (dz / d * 70 + dx / d * 25) * dt; o.w.set(6, 6, 6); }
    }
    if(o.rest && gm > 0) continue;
    if(o.rest && gm < 0){ o.rest = false; o.v.y = rand(2, 6); o.w.set(rand(-2, 2), rand(-2, 2), rand(-2, 2)); }
    o.v.y -= 120 * dt * gm;
    if(gm < 0) o.v.y = Math.min(o.v.y, 5);
    const sp = Math.hypot(o.v.x, o.v.y, o.v.z); if(sp > 60) o.v.multiplyScalar(60 / sp);
    p.addScaledVector(o.v, dt);
    o.g.rotation.x += o.w.x * dt; o.g.rotation.y += o.w.y * dt; o.g.rotation.z += o.w.z * dt;
    if(p.y > 38){ p.y = 38; o.v.y = Math.min(0, o.v.y); }
    if(p.x < -38){ p.x = -38; o.v.x = Math.abs(o.v.x) * .5; } if(p.x > 44){ p.x = 44; o.v.x = -Math.abs(o.v.x) * .5; }
    if(p.z < -22){ p.z = -22; o.v.z = Math.abs(o.v.z) * .5; } if(p.z > 32){ p.z = 32; o.v.z = -Math.abs(o.v.z) * .5; }
    if(p.y < o.h){
      p.y = o.h;
      if(o.v.y < 0) o.v.y *= -.35;
      o.v.x *= .78; o.v.z *= .78; o.w.multiplyScalar(.6);
      if(gm > 0 && Math.abs(o.v.y) < 3 && Math.hypot(o.v.x, o.v.z) < 2){
        o.rest = true; o.v.set(0, 0, 0);
        const lying = o.kind === 'jar' && Math.random() < .5;
        o.g.rotation.set(lying ? PI / 2 : 0, o.g.rotation.y, 0);
        p.y = lying ? .9 : o.hh;
      }
    }
  }
}

/* ---------- fire: spreads to the next station unless Ada puts it out ---------- */
const FIRE_AT = {hood:[-37, 12, -31], microwave:[-15.5, 24.5, -32], icp:[12, 16.5, -30], pc:[40.5, 12, -31], autosampler:[4.5, 10.5, -20], fridge:[-44, 26.5, 17.5]};
const FIRE_NEXT = {hood:'microwave', microwave:'icp', icp:'pc', pc:'icp', autosampler:'icp', fridge:'hood'};
const FIRE_LIGHTS = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xff7a2a, 0, 36); scene.add(l); return l; });
function startFire(st){
  st = st || pick(Object.keys(FIRE_AT));
  if(S.over || S.fires.length >= 3 || S.fires.some(f => f.st === st)) return;
  const light = FIRE_LIGHTS.find(l => !S.fires.some(f => f.light === l));
  const f = {st, pos:FIRE_AT[st], light, spreadAt:S.minutes + 14};
  light.position.set(f.pos[0], f.pos[1] + 2, f.pos[2] + 3);
  S.fires.push(f); S.blocked[st] = 1e9;
  log('event', `Fire at the ${ST[st].name}! ${pick(['A Kimwipe got too close to something hot', 'Nobody is sure how. Nobody ever is', 'Sparks found the paper towel stash', 'The sticky note that said "do not overheat" was the first to go'])}`);
  banner(`Fire at the ${ST[st].name}!`, 'fail'); comic('FIRE!', 'fail'); shake(5, .5);
  addChaos(100, 'Fire!', f.pos); emote('FIRE!', 'bad');
  if(cur && !['lunch', 'evacuate', 'extinguish'].includes(cur.id)) abortJob();
  S.urgent.unshift({id:'extinguish', opt:{st, fire:f}});
}
function fireOut(f){
  if(!S.fires.includes(f)) return;
  S.fires = S.fires.filter(q => q !== f); f.light.intensity = 0; S.blocked[f.st] = 0;
  burst(f.pos[0], f.pos[1], f.pos[2], 0xf3f3f6, 16, 4, -2);
}

/* ---------- microwave kaboom ---------- */
function kaboom(){
  if(S.boomT > 0 || S.rotorLoose) return;
  S.boomT = 3;
  banner('Digester overload!', 'fail'); emote('Uh oh…', 'bad');
  log('event', pick(['Someone left a metal spatula in the digester. It is sparking and rattling', 'A foil-wrapped sample snuck into the rotor. The digester is rattling hard', 'Digester overloaded: rotor rattling, sparks behind the glass']));
}
function explode(){
  const [x, y, z] = V.mwPos;
  V.mwGroup.position.set(0, 0, 0);
  burst(x, y - 3, z + 1, 0xffb547, 40, 12); burst(x, y - 3, z + 1, 0xff5d2a, 30, 9); burst(x, y, z + 1, 0x3a3350, 26, 5, -3);
  comic('KA-BOOM!', 'fail'); shake(14, .9);
  for(const o of LOOSE) if(o.kind === 'debris') launch(o, x + rand(-3, 3), y - 4 + rand(-2, 2), z + 2, rand(-14, 14), rand(18, 34), rand(14, 30));
  V.mwGlowMat.color.setHex(0x111018);
  addChaos(200, 'Microwave KA-BOOM', V.mwPos); dmgInstr(35);
  S.cavityDirty = true;
  if(M.mw.state === 'run'){ lose(SID()); M.mw.state = 'paused'; M.mw.fail = null; S.urgent.push({id:'mwRestart', opt:{why:'boom'}}); }
  log('fail', 'KA-BOOM. The digester door blew off and skidded across the floor. Cavity is a mess');
  const d = Math.hypot(S.x + 15.5, S.z + 24);
  if(d < 34 && !S.away && !S.ko){
    setSoot(true); S.sootUntil = S.minutes + 30; hurt(6); react('hurt'); emote('*cough*', 'bad');
    S.x += (S.x + 15.5) / (d || 1) * 3; S.z += (S.z + 24) / (d || 1) * 3;
    later(2, () => { if(S.soot) S.queue.unshift({id:'washFace'}); });
  }
  if(Math.random() < .35) later(1, () => startFire('microwave'));
  later(2.5, () => S.spills.push({kind:'debris', x:-15.5, z:-14, mesh:new THREE.Object3D(), onClear(){ hideLoose('debris'); V.mwGlowMat.color.setHex(0x3a3550); }}));
}

/* ---------- fume hood vortex ---------- */
function vortex(){
  S.vortexUntil = S.minutes + 9; S.blocked.hood = S.minutes + 9;
  banner('Fume hood vortex!', 'event'); comic('WHOOOSH!', 'event');
  log('event', 'Facilities cranked the fume hood fan to MAX. Gloves, Kimwipes and sample labels are flying into the hood');
  addChaos(150, 'Fume hood vortex', [-37, 26, -28]); emote('Whoa!', 'bad');
}

/* ---------- delivery avalanche ---------- */
function avalanche(){
  const free = LOOSE.filter(o => o.kind === 'jar' && !o.on);
  if(free.length < 30) return;
  banner('Delivery avalanche!', 'event'); comic('AVALANCHE!', 'event'); shake(6, .6);
  log('event', `The delivery truck backed into the roof hatch: ${free.length} sample jars are raining into the lab`);
  free.forEach((o, i) => later(i * .05, () => launch(o, rand(-22, 26), rand(42, 60), rand(-14, 24), rand(-4, 4), 0, rand(-4, 4))));
  addChaos(200, 'Jar avalanche', [2, 30, 4]); emote('Jars?!', 'bad'); react('flail');
  later(4, () => S.spills.push({kind:'jars', x:2, z:6, mesh:new THREE.Object3D(), onClear(){ hideLoose('jar'); S.queue.push({id:'stash'}); }}));
}

/* ---------- gravity glitch ---------- */
function gravityGlitch(){
  S.gravUntil = S.minutes + 9;
  banner('Gravity glitch!', 'event'); comic('ZERO-G?!', 'event');
  log('event', 'Gravity glitched. Every drop of liquid in the lab is floating around in wobbly blobs');
  addChaos(120, 'Gravity glitch'); emote('Wheee', 'good');
}

/* ---------- foam geyser ---------- */
SPILL_COL.foam = 0xf5f0c8;
function foamGeyser(){
  S.foamUntil = S.minutes + 4;
  banner('Foam geyser!', 'event'); comic('FOAM!', 'event');
  log('event', 'Too much H₂O₂ too fast: a foam geyser is erupting out of the fume hood');
  addChaos(50, 'Foam geyser', [-35, 20, -28]); emote('Foam!', 'bad'); react('facepalm');
  later(3, () => spill('foam', -34, -20, 9, 6));
}

/* ---------- runaway rotor (an unbalanced rotor breaks loose and spins across the floor) ---------- */
function rotorPlan(){
  const v = nVessels(), outer = Math.min(24, v), inner = Math.max(0, v - 24);
  return {v, outer, inner, fillers:inner > 0 && inner < 17 ? 17 - inner : 0};
}
function rotorEscape(){
  if(S.rotorLoose || S.boomT > 0) return;
  const r = V.rotor, a = rand(.25, PI - .25);
  scene.add(r); r.position.set(-15.7, .6, -22); r.visible = true;
  S.rotorLoose = {vx:Math.cos(a) * 34, vz:Math.sin(a) * 34, stopped:false, carried:false, hitCd:0};
  if(M.mw.state === 'run') M.mw.state = 'paused';
  M.mw.fail = null;
  log('event', 'Unbalanced rotor! It shook loose, popped the door and is spinning across the floor');
  banner('Rotor on the loose!', 'fail'); comic('RUNAWAY ROTOR!', 'fail'); shake(8, .6);
  addChaos(250, 'Runaway rotor', [-15.7, 8, -20]); dmgInstr(15); emote('My rotor!', 'bad');
}
function rotorHome(){
  V.mwGroup.add(V.rotor); V.rotor.position.copy(V.rotorHome); V.rotor.rotation.set(0, 0, 0); V.rotor.visible = true;
}
function stepRotor(dt){
  const L = S.rotorLoose; if(!L || L.stopped) return;
  const r = V.rotor, p = r.position;
  p.x += L.vx * dt; p.z += L.vz * dt;
  if(p.x < -38 || p.x > 44){ L.vx *= -.8; p.x = Math.max(-38, Math.min(44, p.x)); burst(p.x, 2, p.z, 0xfff0a0, 6, 4, 10); }
  if(p.z < -21 || p.z > 32){ L.vz *= -.8; p.z = Math.max(-21, Math.min(32, p.z)); burst(p.x, 2, p.z, 0xfff0a0, 6, 4, 10); }
  const k = 1 - dt * .22; L.vx *= k; L.vz *= k;
  const sp = Math.hypot(L.vx, L.vz), wob = Math.min(1, sp / 10) * .24;
  r.rotation.y += dt * sp * .7; r.rotation.x = Math.sin(S.time * 9) * wob; r.rotation.z = Math.cos(S.time * 9) * wob;
  if(Math.random() < dt * sp * .4) emit(p.x + rand(-2, 2), .6, p.z + rand(-2, 2), 0xfff0a0, rand(-3, 3), rand(2, 5), rand(-3, 3), .4, .4, 10);
  L.hitCd -= dt;
  if(L.hitCd <= 0 && sp > 6 && !S.away && !S.ko && Math.hypot(p.x - S.x, p.z - S.z) < 5){
    L.hitCd = 3; hurt(4); react('hurt'); emote('OW!', 'bad'); addChaos(60, 'Rotor strike');
    S.x += L.vx * .08; S.z += L.vz * .08;
  }
  if(sp < 1.5){
    L.stopped = true; r.rotation.set(0, r.rotation.y, 0);
    log('event', 'The rotor finally wobbled to a stop. Going to get it');
    S.urgent.push({id:'catchRotor', opt:{at:{x:p.x, z:p.z}}});
  }
}

/* ---------- walkers shared by the cat and the inspector ---------- */
function walkTo(o, x, z){ o.path = planPath(o.x, o.z, x, z); o.pi = 0; }
function stepWalk(o, speed, dt){
  if(!o.path || o.pi >= o.path.length) return true;
  const p = o.path[o.pi], dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
  if(d < .3){ o.pi++; return o.pi >= o.path.length; }
  const st = Math.min(d, speed * dt);
  o.x += dx / d * st; o.z += dz / d * st;
  o.ang = lerpAngle(o.ang, Math.atan2(dx, dz), 1 - Math.exp(-dt * 9));
  o.phase += st * .45;
  return false;
}
function hinge(parent, x, y, z){ const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/* ---------- the lab cat ---------- */
const CAT = {g:new THREE.Group(), st:'off', x:0, z:46, y:0, ang:PI, phase:0, t:0, legs:[]};
{
  const g = CAT.g, C = 0xf2a65a, D = 0xd9822b, Wt = 0xfff3e0;
  box(g, 3, 3, 6, C, -1.5, 2.2, -3);
  for(const z of [-2, -.2, 1.6]) box(g, 3.1, .5, .7, D, -1.55, 4.8, z);
  box(g, 2, 1.8, .3, Wt, -1, 2.6, 2.9);
  CAT.head = hinge(g, 0, 5, 3);
  box(CAT.head, 2.8, 2.6, 2.4, C, -1.4, -.9, -.8);
  box(CAT.head, .8, 1, .6, C, -1.3, 1.6, -.3); box(CAT.head, .8, 1, .6, C, .5, 1.6, -.3);
  box(CAT.head, .5, .5, .2, 0x2f8f4a, -.95, .3, 1.55, {cast:false}); box(CAT.head, .5, .5, .2, 0x2f8f4a, .45, .3, 1.55, {cast:false});
  box(CAT.head, .5, .4, .2, 0xff8fb8, -.25, -.3, 1.6, {cast:false}); box(CAT.head, 1.4, .6, .4, Wt, -.7, -.9, 1.3, {cast:false});
  for(const [x, z] of [[-1, 2], [1, 2], [-1, -2], [1, -2]]){ const l = hinge(g, x, 2.4, z); box(l, .9, 2.4, .9, C, -.45, -2.4, -.45); CAT.legs.push(l); }
  CAT.tail = hinge(g, 0, 4.4, -3); box(CAT.tail, .7, .7, 4.2, D, -.35, -.35, -4.2);
  g.visible = false; scene.add(g);
}
const CAT_TOP = [-15, 24, -32.5];
function catEvent(){
  if(CAT.st !== 'off') return;
  Object.assign(CAT, {x:0, z:46, y:0, ang:PI, st:'in', t:0, target:pick(['autosampler', 'balance', 'water', 'pc'])});
  const s = ST[CAT.target].stand; walkTo(CAT, s[0], s[1]);
  CAT.g.visible = true;
  log('event', 'The lab cat slipped in through the back door. Nobody knows whose cat it is');
  banner('Lab cat!', 'event'); popup('Mrrp?', [0, 10, 44], 'say');
}
function catLeave(){
  if(CAT.st === 'off' || CAT.st === 'out') return;
  if(CAT.st === 'loaf'){ CAT.st = 'down'; CAT.t = 0; } else { CAT.st = 'out'; walkTo(CAT, 0, 46); }
  popup('Hsss', [CAT.x, CAT.y + 8, CAT.z], 'say');
}
function stepCat(dt){
  if(CAT.st === 'off') return;
  CAT.t += dt;
  let moving = false;
  if(CAT.st === 'in'){
    moving = true;
    if(stepWalk(CAT, 16, dt)){ CAT.st = 'mischief'; CAT.t = 0; }
  } else if(CAT.st === 'mischief'){
    CAT.ang = lerpAngle(CAT.ang, ST[CAT.target].face, 1 - Math.exp(-dt * 8));
    if(CAT.t > 1.6){
      const fx = CAT.x + Math.sin(CAT.ang) * 3.5, fz = CAT.z + Math.cos(CAT.ang) * 3.5, sid = SID();
      spill(Math.random() < .5 ? 'glass' : 'water', fx, fz, 4, 3);
      dmgSample(8); addChaos(60, 'Cat knocked a tube off', [CAT.x, 9, CAT.z]);
      log('event', `The cat batted the tube for ${sid} off the ${ST[CAT.target].name}. Kept eye contact the whole time`);
      CAT.st = 'toMw'; walkTo(CAT, ST.microwave.stand[0], ST.microwave.stand[1]);
    }
  } else if(CAT.st === 'toMw'){
    moving = true;
    if(stepWalk(CAT, 16, dt)){ CAT.st = 'up'; CAT.t = 0; CAT.from = [CAT.x, CAT.z]; }
  } else if(CAT.st === 'up' || CAT.st === 'down'){
    const k = Math.min(1, CAT.t / .5), a = CAT.st === 'up' ? k : 1 - k;
    const [fx, fz] = CAT.from || [ST.microwave.stand[0], ST.microwave.stand[1]];
    CAT.x = fx + (CAT_TOP[0] - fx) * a; CAT.z = fz + (CAT_TOP[2] - fz) * a; CAT.y = CAT_TOP[1] * a + Math.sin(k * PI) * 6;
    if(k >= 1){
      if(CAT.st === 'up'){ CAT.st = 'loaf'; CAT.t = 0; CAT.ang = 0; S.urgent.push({id:'shoo'}); popup('purr', [CAT.x, 32, CAT.z], 'say'); log('event', 'The cat is now loafing on top of the digester because it is warm'); }
      else { CAT.y = 0; CAT.st = 'out'; walkTo(CAT, 0, 46); }
    }
  } else if(CAT.st === 'loaf'){
    if(CAT.t > 45) catLeave();
  } else if(CAT.st === 'out'){
    moving = true;
    if(stepWalk(CAT, 26, dt)){ CAT.st = 'off'; CAT.g.visible = false; }
  }
  const sw = moving ? Math.sin(CAT.phase * 2.2) * .7 : 0, loaf = CAT.st === 'loaf';
  CAT.legs.forEach((l, i) => { l.rotation.x = loaf ? (i < 2 ? -1.4 : 1.4) : (i % 3 === 0 ? sw : -sw); });
  CAT.tail.rotation.x = loaf ? 0 : -.7; CAT.tail.rotation.y = Math.sin(S.time * (CAT.st === 'mischief' ? 9 : 3)) * .5;
  CAT.head.rotation.x = CAT.st === 'mischief' ? .4 : 0;
  CAT.g.position.set(CAT.x, CAT.y - (loaf ? 1.8 : 0) + (moving ? Math.abs(Math.sin(CAT.phase * 2.2)) * .4 : 0), CAT.z);
  CAT.g.rotation.set(0, CAT.ang, 0);
}

/* ---------- the inspector: walks a lap with a clipboard; fires and spills become findings ---------- */
const INSP = {g:new THREE.Group(), st:'off', x:0, z:46, ang:PI, phase:0, t:0, si:0, findings:0, shakeT:0, legs:[]};
{
  const g = INSP.g, suit = 0x5d6475;
  for(const x of [-2, 2]){ const l = hinge(g, x, 9, 0); box(l, 3, 9, 3, 0x3b3f52, -1.5, -9, -1.5); box(l, 3, 1, 3.6, 0x1d1d26, -1.5, -9, -1.5); INSP.legs.push(l); }
  box(g, 8, 9, 4, suit, -4, 9, -2);
  box(g, 2, 6, .3, 0xf3f3f6, -1, 12, 2); box(g, .8, 5, .4, 0xc0392b, -.4, 12.5, 2.1);
  box(g, 1.8, 7.5, 2.4, suit, -5.8, 10.5, -1.2); box(g, 1.8, 7.5, 2.4, suit, 4, 10.5, -1.2);
  box(g, 5, 6.2, .4, 0x8a6a4a, -2.5, 9.6, 2.6); box(g, 4.2, 4.6, .2, 0xf3f3f6, -2.1, 10.2, 3, {cast:false}); box(g, 1.6, .6, .3, 0x9aa0bb, -.8, 15.5, 2.8, {cast:false});
  INSP.head = hinge(g, 0, 18, 0);
  box(INSP.head, 6, 6, 6, 0xd9a07a, -3, 0, -3);
  box(INSP.head, 6.4, 1.6, 6.4, 0x3a2a20, -3.2, 5, -3.2); box(INSP.head, 6.4, 3, 1.6, 0x3a2a20, -3.2, 2.4, -3.2);
  box(INSP.head, 2, 1.2, .2, 0x15151a, -2.6, 3, 3.05, {cast:false}); box(INSP.head, 2, 1.2, .2, 0x15151a, .6, 3, 3.05, {cast:false}); box(INSP.head, 1.4, .3, .2, 0x15151a, -.7, 3.4, 3.05, {cast:false});
  box(INSP.head, 2.4, .5, .2, 0x7a3a2a, -1.2, 1.2, 3.05, {cast:false});
  g.visible = false; scene.add(g);
}
const INSP_STOPS = ['hood', 'microwave', 'icp', 'pc'];
function inspectorEvent(){
  if(INSP.st !== 'off') return;
  Object.assign(INSP, {x:0, z:46, ang:PI, st:'walk', t:0, si:0, findings:0, shakeT:0});
  const s = ST[INSP_STOPS[0]].stand; walkTo(INSP, s[0], s[1] + 7);
  INSP.g.visible = true;
  banner('Inspector incoming!', 'event'); comic('INSPECTOR!', 'event');
  log('event', 'An inspector with a clipboard just walked in for a surprise lap. Act natural'); emote('Act natural', 'neutral');
}
function inspectorCheck(){
  const k = INSP_STOPS[INSP.si], near = (x, z) => Math.hypot(x - INSP.x, z - INSP.z) < 24;
  const why = S.fires.some(f => near(f.pos[0], f.pos[2])) ? 'fire' : S.spills.some(s => near(s.x, s.z)) ? 'spill' :
    (k === 'microwave' && (S.cavityDirty || S.rotorLoose)) ? 'digester' : (S.soot && near(S.x, S.z)) ? 'soot' : (CAT.st !== 'off' && near(CAT.x, CAT.z)) ? 'cat' : '';
  if(why){
    INSP.findings++; INSP.shakeT = 2.5;
    addChaos(150, 'Inspector saw that', [INSP.x, 28, INSP.z]);
    log('warn', `Inspector at the ${ST[k].name}: slow head shake. Wrote down the ${({fire:'fire', spill:'mess on the floor', digester:'state of the digester', soot:'soot on Ada', cat:'cat'})[why]}`);
  } else popup('✓', [INSP.x, 28, INSP.z], 'lab');
}
function stepInspector(dt){
  if(INSP.st === 'off') return;
  INSP.t += dt;
  let moving = false;
  if(INSP.st === 'walk'){
    moving = true;
    if(stepWalk(INSP, 10, dt)){ INSP.st = 'check'; INSP.t = 0; }
  } else if(INSP.st === 'check'){
    INSP.ang = lerpAngle(INSP.ang, PI, 1 - Math.exp(-dt * 6));
    if(INSP.t > 2.5){
      inspectorCheck();
      INSP.si++;
      if(INSP.si < INSP_STOPS.length){ const s = ST[INSP_STOPS[INSP.si]].stand; walkTo(INSP, s[0], s[1] + 7); INSP.st = 'walk'; }
      else { INSP.st = 'out'; walkTo(INSP, 0, 46); }
    }
  } else if(INSP.st === 'out'){
    moving = true;
    if(stepWalk(INSP, 12, dt)){
      INSP.st = 'off'; INSP.g.visible = false;
      if(INSP.findings === 0){ addLab(200, 'Clean inspection', [0, 20, 40]); log('good', 'Inspector left with zero findings and a small, approving nod'); }
      else log('warn', `Inspector left with ${INSP.findings} finding${INSP.findings === 1 ? '' : 's'}. Expect an email`);
    }
  }
  INSP.shakeT -= dt;
  const sw = moving ? Math.sin(INSP.phase) * .5 : 0;
  INSP.legs[0].rotation.x = sw; INSP.legs[1].rotation.x = -sw;
  INSP.head.rotation.y = INSP.shakeT > 0 ? Math.sin(INSP.t * 5) * .45 : 0;
  INSP.head.rotation.x = INSP.st === 'check' ? .25 : 0;
  INSP.g.position.set(INSP.x, moving ? Math.abs(Math.sin(INSP.phase)) * .4 : 0, INSP.z);
  INSP.g.rotation.set(0, INSP.ang, 0);
}

/* ---------- mini-games: CHANGE TIP! and plasma ignition ---------- */
const Q = {open:false};
const qteEl = $('#qte'), qTitle = $('#qteTitle'), qSub = $('#qteSub'), qBtn = $('#qteBtn'), qZone = $('#qteZone'), qFill = $('#qteFill'), qMark = $('#qteMark');
function openQTE(o){
  if(Q.open || document.hidden || S.over) return false;
  Object.assign(Q, {pos:0, dir:1, tries:0, zone:[.42, .58]}, o, {open:true, t:0});
  qTitle.textContent = o.title; qSub.textContent = o.sub; qBtn.textContent = o.btn;
  const timing = o.kind === 'timing';
  qZone.style.display = qMark.style.display = timing ? '' : 'none'; qFill.style.display = timing ? 'none' : '';
  if(timing){ qZone.style.left = Q.zone[0] * 100 + '%'; qZone.style.width = (Q.zone[1] - Q.zone[0]) * 100 + '%'; }
  qteEl.hidden = false;
  return true;
}
function closeQTE(){ Q.open = false; qteEl.hidden = true; }
function pressQTE(){
  if(!Q.open) return;
  if(Q.kind === 'tap'){ closeQTE(); Q.onHit(); return; }
  if(Q.pos >= Q.zone[0] && Q.pos <= Q.zone[1]){ closeQTE(); Q.onHit(); return; }
  Q.tries++; Q.onMiss();
  if(Q.tries >= 3){ closeQTE(); if(Q.onTimeout) Q.onTimeout(); }
}
function tickQTE(rdt){
  if(!Q.open || S.paused) return;
  Q.t += rdt;
  if(Q.kind === 'tap'){
    qFill.style.width = Math.max(0, 1 - Q.t / Q.dur) * 100 + '%';
    if(Q.t >= Q.dur){ closeQTE(); Q.onMiss(); }
  } else {
    Q.pos += Q.dir * rdt * 1.3;
    if(Q.pos > 1){ Q.pos = 1; Q.dir = -1; } else if(Q.pos < 0){ Q.pos = 0; Q.dir = 1; }
    qMark.style.left = Q.pos * 100 + '%';
    if(Q.t >= Q.dur){ closeQTE(); if(Q.onTimeout) Q.onTimeout(); }
  }
}
function tipCue(){
  openQTE({kind:'tap', title:'CHANGE TIP!', sub:'Fresh tip before the next reagent', btn:'Eject tip  [Q]', dur:2.6, key:'q',
    onHit(){ const sc = S.score; sc.tips++; sc.tipStreak++; addLab(10 + 5 * Math.min(sc.tipStreak - 1, 4), sc.tipStreak > 1 ? `Clean tip ×${sc.tipStreak}` : 'Clean tip'); emote('Click!', 'good'); },
    onMiss(){
      const sc = S.score; sc.tipMiss++; sc.tipStreak = 0;
      if(!chaosMode){ log('ok', 'Missed the tip cue, so Ada changed the tip herself'); return; }
      const sid = SID(); flag(sid, 'contam'); dmgSample(12); addChaos(25, 'Gross green tube');
      log('warn', `Skipped a tip change: ${sid} picked up a green streak. Contaminated`); emote('Ew', 'bad');
      burst(S.x + Math.sin(S.ang) * 4, 13, S.z + Math.cos(S.ang) * 4, 0x7dff6a, 10, 2);
    }});
}
function addCues(id, at){
  const d = JOBS[id], orig = d.tick;
  d.tick = (p, dt, c) => {
    if(orig) orig(p, dt, c);
    c.cueI = c.cueI || 0;
    if(c.cueI < at.length && p >= at[c.cueI]){ c.cueI++; tipCue(); }
  };
}
addCues('acid', [.5]);
addCues('dilute', [.3, .65]);
JOBS.ignite.start = c => {
  openQTE({kind:'timing', title:'LIGHT THE PLASMA', sub:'Hit ignite while the marker is in the green', btn:'Ignite  [Space]', dur:7, key:' ', zone:[.43, .57],
    onHit(){ c.fail = null; if(!c.good) c.good = JOBS.ignite.goods[0]; comic('WHUMP!', 'good'); addLab(30, Q.tries ? 'Plasma lit' : 'First-try plasma', V.torchPos); burst(V.torchPos[0], V.torchPos[1], V.torchPos[2] + 1, 0xd98cff, 18, 5); },
    onMiss(){ popup('pfft', V.torchPos, 'say'); burst(V.torchPos[0], V.torchPos[1], V.torchPos[2] + 1, 0x6f6797, 8, 2, -2); addChaos(20, 'Plasma pfft', V.torchPos); }});
};
JOBS.load.start = () => { if(chaosMode && rotorPlan().fillers > 0 && Math.random() < .3) batch.rotorBad = true; };
qBtn.addEventListener('click', pressQTE);
addEventListener('keydown', e => {
  if(!Q.open || e.repeat) return;
  if(e.key.toLowerCase() === Q.key || e.key === 'Enter' || (e.key === ' ' && Q.key === ' ')){ e.preventDefault(); pressQTE(); }
});

/* ---------- new jobs ---------- */
J('extinguish', {station:null, dur:4, pose:'spray', held:'ext', carry:true, noRoll:true,
  walkText:c => `Grabbing the extinguisher for the ${ST[c.opt.st].name} fire`,
  text:() => 'Spraying the fire: pull, aim, squeeze, sweep',
  tick(p, dt, c){
    const f = c.opt.fire; if(!S.fires.includes(f)) return;
    if(Math.random() < dt * 40){ const hx = S.x + Math.sin(S.ang) * 3, hz = S.z + Math.cos(S.ang) * 3, dx = f.pos[0] - hx, dy = f.pos[1] - 12, dz = f.pos[2] - hz, d = Math.hypot(dx, dy, dz) || 1;
      emit(hx, 12, hz, 0xf3f3f6, dx / d * 18 + rand(-2, 2), dy / d * 18 + rand(-1, 2), dz / d * 18 + rand(-2, 2), d / 18, rand(.8, 1.4), -1); }
  },
  done(c){ if(!S.fires.includes(c.opt.fire)) return; fireOut(c.opt.fire); addLab(20, 'Fire out', c.opt.fire.pos); log('ok', `Fire at the ${ST[c.opt.st].name} is out. Tagged the extinguisher for a refill`); }});
J('shoo', {station:'microwave', dur:2, pose:'reach', noRoll:true,
  walkText:() => 'Off to evict the cat', text:() => 'Shooing the cat off the warm digester',
  done(){ if(CAT.st !== 'loaf') return; catLeave(); addLab(10, 'Cat evicted', CAT_TOP); log('ok', 'Cat evicted. It left slowly, to make a point'); }});
J('catchRotor', {station:null, dur:2, pose:'crouch', noRoll:true,
  walkText:() => 'Chasing down the runaway rotor', text:() => 'Wrestling the rotor off the floor',
  done(){ V.rotor.visible = false; if(S.rotorLoose) S.rotorLoose.carried = true; S.urgent.unshift({id:'reseat'}); }});
J('reseat', {station:'microwave', dur:3, pose:'torque', held:'rotor', carry:true, noRoll:true,
  walkText:() => 'Carrying the rotor back to the digester', text:() => 'Reseating the rotor, fillers in this time',
  done(){
    rotorHome(); S.rotorLoose = null; batch.rotorBad = false; addLab(30, 'Rotor rescued', V.mwPos);
    if(M.mw.state === 'paused' && !S.boomT){ Object.assign(M.mw, {state:'run', t:0, fail:null}); log('ok', `Rotor back in with ${rotorPlan().fillers} light-blue fillers. Balanced. Digestion restarted from the top`); }
    else log('ok', 'Rotor back in the digester, balanced with fillers');
  }});
J('washFace', {station:'sink', dur:3, pose:'wash', noRoll:true,
  walkText:() => 'Off to wash the soot off', text:() => 'Scrubbing the soot off at the sink',
  done(){ setSoot(false); log('ok', 'Washed off the soot. The glasses were somehow spotless the whole time'); }});
J('service', {station:'icp', dur:10, pose:'torque', held:'wrench', noRoll:true,
  walkText:() => 'Service call: grabbing the ICP-MS toolkit', text:() => 'Cleaning cones, new pump tubing, re-aligning the torch',
  done(){ S.instr = 100; S.instrDown = false; addLab(40, 'Instrument serviced', V.torchPos); log('ok', 'Serviced the ICP-MS: clean cones, fresh pump tubing, torch aligned. Instrument bar back to full'); }});

/* ---------- chaos events (Chaos Mode picks these most of the time; the cat and inspector visit in both modes) ---------- */
EVENTS.push(
  {name:'cat',       label:'Lab cat',          kind:'bad', w:2,   cond:() => CAT.st === 'off', run:catEvent},
  {name:'inspector', label:'Inspector',        kind:'bad', w:1.2, cond:() => INSP.st === 'off', run:inspectorEvent},
  {name:'blaze',     label:'Fire!',            chaos:true, kind:'bad', w:2.2, cond:() => S.fires.length < 3, run:() => startFire()},
  {name:'kaboom',    label:'Microwave kaboom', chaos:true, kind:'bad', w:1.6, cond:() => !(S.boomT > 0) && !S.rotorLoose, run:kaboom},
  {name:'vortex',    label:'Hood vortex',      chaos:true, kind:'bad', w:1.8, cond:() => S.vortexUntil <= S.minutes, run:vortex},
  {name:'avalanche', label:'Jar avalanche',    chaos:true, kind:'bad', w:1.5, cond:() => LOOSE.filter(o => o.kind === 'jar' && !o.on).length >= 30, run:avalanche},
  {name:'gravity',   label:'Gravity glitch',   chaos:true, kind:'bad', w:1.5, cond:() => S.gravUntil <= S.minutes, run:gravityGlitch},
  {name:'foam',      label:'Foam geyser',      chaos:true, kind:'bad', w:1.8, cond:() => !(S.foamUntil > S.minutes), run:foamGeyser},
  {name:'rotor',     label:'Runaway rotor',    chaos:true, kind:'bad', w:1,   cond:() => !S.rotorLoose && !(S.boomT > 0), run:rotorEscape}
);

/* ---------- per sim-step update (runs inside update(), after Ada moves) ---------- */
function chaosUpdate(dt){
  for(let i = S.timers.length - 1; i >= 0; i--) if(S.minutes >= S.timers[i].at){ const t = S.timers.splice(i, 1)[0]; t.fn(); }
  const grav = S.gravUntil > S.minutes, vort = S.vortexUntil > S.minutes;
  S.gravMul = grav ? -.25 : 1;
  stepLoose(dt); stepRotor(dt); stepCat(dt); stepInspector(dt);
  if(S.soot && S.minutes > S.sootUntil) setSoot(false);
  // digester rattling before the boom
  if(S.boomT > 0){
    S.boomT -= dt;
    V.mwGroup.position.set(rand(-.35, .35), 0, rand(-.35, .35));
    if(Math.random() < dt * 40) emit(V.mwPos[0] + rand(-3, 3), V.mwPos[1] - 4 + rand(-3, 3), V.mwPos[2] + 1, 0xfff0a0, rand(-4, 4), rand(1, 5), rand(1, 4), .4, .4, 10);
    if(S.boomT <= 0){ S.boomT = 0; explode(); }
  }
  // fires: flames, smoke, spreading
  for(const f of S.fires.slice()){
    if(Math.random() < dt * 30) emit(f.pos[0] + rand(-2.2, 2.2), f.pos[1], f.pos[2] + rand(-1.5, 1.5), pick([0xff5d2a, 0xffb547, 0xffe08a]), rand(-.6, .6), rand(6, 11), rand(-.6, .6), rand(.4, .8), rand(.8, 1.5));
    if(Math.random() < dt * 8) emit(f.pos[0] + rand(-1, 1), f.pos[1] + 4, f.pos[2], 0x2a2440, rand(-.5, .5), rand(3, 5), rand(-.5, .5), 1.6, rand(1.2, 2));
    if(S.minutes > f.spreadAt){ f.spreadAt = S.minutes + 14; startFire(FIRE_NEXT[f.st]); }
  }
  // vortex: debris streams into the hood and Ada gets dragged toward it
  if(vort){
    if(Math.random() < dt * 45){
      const a = rand(0, PI * 2), r = rand(14, 46), x = -37 + Math.cos(a) * r, z = -6 + Math.sin(a) * r * .55, y = rand(2, 22);
      const dx = -37 - x, dy = 18 - y, dz = -29 - z, d = Math.hypot(dx, dy, dz);
      emit(x, y, z, pick([0xefeaff, 0x7b6cff, 0x9fd8ff, 0xffd25e]), dx / d * 32 - dz / d * 10, dy / d * 32, dz / d * 32 + dx / d * 10, d / 32, rand(.4, .8));
    }
    if(!S.away && !S.ko){
      const dx = -37 - S.x, dz = -19 - S.z, d = Math.hypot(dx, dz);
      if(d > 7 && d < 60){ S.x += dx / d * dt * 6; S.z += dz / d * dt * 6; }
      if(!S.react || S.react.t <= 0) S.react = {pose:'flail', t:.6};
    }
  }
  // gravity glitch: floating blobs, floating spills, floating Ada
  if(grav){
    if(Math.random() < dt * 14) emit(rand(-40, 40), rand(1, 6), rand(-24, 30), pick([0x9fd8ff, 0x7cc4ff, 0xd8e86a, 0xf5f0c8]), rand(-.6, .6), rand(1, 3), rand(-.6, .6), rand(2, 3.5), rand(1, 1.8), 1.5);
    if(!S.away && !S.ko) charRoot.position.y += 2.5 + Math.sin(S.time * 2.2) * 1.2;
  }
  for(const s of S.spills){
    if(s.baseY == null) s.baseY = s.mesh.position.y;
    s.mesh.position.y = grav ? s.baseY + 4 + Math.sin(S.time * 1.7 + s.x) * 1.2 : s.baseY;
  }
  // foam geyser
  if(S.foamUntil > S.minutes && Math.random() < dt * 60) emit(-35 + rand(-1, 1), 14, -30 + rand(-1, 1), pick([0xf5f0c8, 0xffffff, 0xe8e2b0]), rand(-3, 3), rand(10, 18), rand(1, 4), rand(.8, 1.4), rand(.8, 1.4), 12);
}

/* ---------- per real frame: pop-ups, shake, fire light flicker, mini-game timer ---------- */
function chaosFrame(rdt){
  tickPops(rdt); tickQTE(rdt);
  if(shakeT > 0){
    shakeT -= rdt;
    const k = shakeA * Math.max(0, shakeT);
    stageEl.style.transform = shakeT > 0 ? `translate(${rand(-k, k) | 0}px,${rand(-k, k) | 0}px)` : '';
  }
  for(const f of S.fires || []) f.light.intensity = 1.3 + Math.random() * .7;
}

/* ---------- shift reset ---------- */
function chaosReset(){
  for(const l of FIRE_LIGHTS) l.intensity = 0;
  hideLoose('jar'); hideLoose('debris');
  rotorHome();
  V.mwGroup.position.set(0, 0, 0); V.mwGlowMat.color.setHex(0x3a3550);
  setSoot(false);
  CAT.st = 'off'; CAT.g.visible = false; INSP.st = 'off'; INSP.g.visible = false;
  closeQTE(); shakeT = 0; stageEl.style.transform = '';
}

/* ---------- HUD: stage bar, scores, combo, rotor map ---------- */
const STAGES = ['Logging', 'Weighing', 'Digesting', 'Emptying tubes', 'Diluting', 'Transferring', 'Running', 'Reporting'];
const STAGE_OF = {login:0, pull:1, weigh:1, acid:2, pre:2, load:2, mw:2, cool:2, vent:3, dilute:4, transfer:5, tune:6, cal:6, loadAS:6, as:6, review:6, report:7};
const ADA_ICON = (() => {
  const map = ['..HHHHHH..', '.HHHHHHHH.', 'HHSSSSSSHH', 'HFFFSSFFFH', 'HFKFSSFKFH', 'HSFSSSSFSH', 'HSSSSSSSSH', 'HHSSPPSSHH', 'H..CCCC..H', '..CCBBCC..'];
  const pal = {H:'#f4d35e', S:'#f2c29a', F:'#f7f7fb', K:'#15151a', P:'#e88a8a', C:'#f3f3f6', B:'#4b7bd1'};
  const c = document.createElement('canvas'); c.width = c.height = 10; const g = c.getContext('2d');
  map.forEach((row, y) => [...row].forEach((ch, x) => { if(pal[ch]){ g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return `url(${c.toDataURL()})`;
})();
let stageLis = [], adaEl = null, lastStage = -1;
function renderStages(){
  const k = STAGE_OF[FLOW[batch.ptr].id] ?? 0;
  if(k !== lastStage){
    lastStage = k;
    stageLis.forEach((li, i) => { li.className = i < k ? 'done' : i === k ? 'cur' : ''; });
    stageLis[k].prepend(adaEl);
  }
  const l = live(), a = l.length ? l[0].id.slice(1) : '0', b = l.length ? l[l.length - 1].id.slice(1) : '0';
  const html = `<b>${STAGES[k]}</b> samples ${a} - ${b} <span class="c-dim">· ${batch.id}</span>`;
  const el = $('#stageSay'); if(el.innerHTML !== html) el.innerHTML = html;
}
const rmap = $('#rotorMap'), rg = rmap.getContext('2d'), RPOS = [];
for(let i = 0; i < 24; i++){ const a = i / 24 * PI * 2 - PI / 2; RPOS.push([Math.cos(a) * 34, Math.sin(a) * 34]); }
for(let i = 0; i < 17; i++){ const a = i / 17 * PI * 2 - PI / 2; RPOS.push([Math.cos(a) * 20, Math.sin(a) * 20]); }
const RCOL = {blank:'#f4d35e', s:'#efeaff', dup:'#ff9f43', filler:'#9fd8ff', contam:'#7dff6a'};
function drawRotor(){
  const r = rotorPlan(), li = flowIdx('load');
  const loading = cur && cur.id === 'load' && cur.phase === 'work';
  let n = batch.ptr > li ? r.v : loading ? Math.floor(r.v * Math.min(1, cur.t / cur.dur)) : 0;
  if(S.rotorLoose) n = 0;
  const kinds = [{k:'blank'}];
  for(const s of live()){ kinds.push({k:s.flag === 'contam' ? 'contam' : 's'}); if(s.id === batch.dupOf) kinds.push({k:'dup'}); }
  const done = n >= r.v && r.v > 0, fill = done && !batch.rotorBad ? r.fillers : 0;
  const spin = M.mw.state === 'run' && !S.rotorLoose ? (performance.now() / 600) % (PI * 2) : 0, cs = Math.cos(spin), sn = Math.sin(spin);
  rg.clearRect(0, 0, 84, 84);
  rg.fillStyle = '#0e0b1d'; rg.beginPath(); rg.arc(42, 42, 41, 0, PI * 2); rg.fill();
  rg.fillStyle = '#4d4384'; rg.fillRect(40, 40, 4, 4);
  RPOS.forEach(([x, y], i) => {
    const kind = i < n ? (kinds[i] ? kinds[i].k : 's') : i < n + fill ? 'filler' : null;
    rg.fillStyle = kind ? RCOL[kind] : '#3b3360';
    rg.fillRect(Math.round(42 + x * cs - y * sn) - 2, Math.round(42 + x * sn + y * cs) - 2, 5, 5);
  });
  const cap = $('#rotorCap');
  let txt, cls = '';
  if(S.rotorLoose){ txt = 'Rotor loose!'; cls = 'bad'; }
  else if(loading || done){ txt = batch.rotorBad ? 'Unbalanced!' : M.mw.state === 'run' ? 'Spinning' : 'Balanced'; cls = batch.rotorBad ? 'bad' : 'ok'; }
  else txt = r.inner ? `${r.outer} outer + ${r.inner} inner${r.fillers ? ` + ${r.fillers} filler${r.fillers === 1 ? '' : 's'}` : ''}` : `${r.outer} in the outer ring`;
  if(cap.textContent !== txt) cap.textContent = txt;
  if(cap.className !== cls) cap.className = cls;
}
function chaosHud(){
  $('#labScore').textContent = S.score.lab.toLocaleString();
  $('#chaosScore').textContent = S.score.chaos.toLocaleString();
  const sc = S.score, cb = $('#combo'), on = sc.combo >= 2 && S.minutes <= sc.comboUntil;
  cb.hidden = !on; if(on) cb.textContent = `DISASTER ×${sc.combo}!`;
  renderStages(); drawRotor();
}

/* ---------- controls: mode switch + summon menu ---------- */
function syncMode(){ for(const b of $('#mode').children) b.setAttribute('aria-pressed', String((b.dataset.m === 'chaos') === chaosMode)); }
function setMode(m){
  chaosMode = m === 'chaos';
  try { localStorage.setItem('chaoslab.mode', m); } catch(e) {}
  syncMode();
  log('event', chaosMode ? 'CHAOS MODE on: a disaster every few minutes, missed tip changes contaminate tubes' : 'Lab mode: a normal night shift with the odd surprise');
  S.nextEvent = S.minutes + (chaosMode ? rand(3, 6) : rand(15, 26));
}
function toggleSummon(force){
  const el = $('#summon'), open = force ?? el.hidden;
  el.hidden = !open; $('#summonBtn').setAttribute('aria-expanded', String(open));
}
function buildChaosControls(){
  const modeEl = $('#mode');
  [['lab', 'Lab'], ['chaos', 'Chaos']].forEach(([m, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.m = m;
    b.addEventListener('click', () => setMode(m)); modeEl.append(b);
  });
  syncMode();
  const list = $('#summonList');
  for(const e of EVENTS){
    const b = document.createElement('button'); b.type = 'button'; b.textContent = e.label; if(e.chaos) b.className = 'chaos';
    b.addEventListener('click', () => { toggleSummon(false); randomEvent(e.name); });
    list.append(b);
  }
  $('#summonBtn').addEventListener('click', () => toggleSummon());
  addEventListener('keydown', e => { if(e.key === 'Escape') toggleSummon(false); });
  const ol = $('#stages');
  stageLis = STAGES.map(s => { const li = document.createElement('li'); li.innerHTML = `<b class="dot"></b><span class="l">${s}</span>`; ol.append(li); return li; });
  adaEl = document.createElement('i'); adaEl.className = 'ada'; adaEl.style.backgroundImage = ADA_ICON;
  $('#rotorFig').title = 'Rotor map: yellow = Blank X/Y, orange = _dup, white = samples, light blue = balance fillers, green = contaminated';
}
