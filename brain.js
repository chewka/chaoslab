"use strict";
/* ============ brain: scheduling, job runner, vitals, visuals, main loop ============ */
function clockText(){ const m = 21 * 60 + Math.floor(S.minutes); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function markBad(){ if(batch) batch.bad = {id:FLOW[batch.ptr].id, until:S.minutes + 5}; }
function hurt(n){
  S.hp -= n; S.stats.hurts++;
  if(n >= 12) banner(`Injury: HP \u2212${n}`, 'hurt');
  if(S.hp <= 0) knockOut();
}
function abortJob(){ cur = null; setHeld(null); }
const blockedSt = st => (S.blocked[st] || 0) > S.minutes;

/* ---------- what to do next ---------- */
function prereq(jobId){
  if(jobId === 'weigh' && S.vesselsDirty) return M.mw.state === 'idle' ? 'clean' : 'wait';
  if(jobId === 'load' && S.cavityDirty) return 'cavity';
  if(jobId === 'tune' || jobId === 'cal' || jobId === 'loadAS'){
    if(M.pl.state === 'off') return 'ignite';
    if(M.pl.state === 'warm') return 'wait';
    if(jobId === 'cal' && !batch.standards) return 'standards';
  }
  return null;
}
function filler(){
  const i = batch.ptr;
  const ok = id => !blockedSt(JOBS[id].station);
  if(M.pl.state === 'off' && i >= flowIdx('acid') && ok('ignite')) return 'ignite';
  if(!batch.standards && i >= flowIdx('load') && ok('standards')) return 'standards';
  if(S.vesselsDirty && M.mw.state === 'idle' && i >= flowIdx('dilute') && ok('clean')) return 'clean';
  if(S.cavityDirty && M.mw.state === 'idle') return 'cavity';
  return null;
}
function waitRemaining(){
  const id = FLOW[batch.ptr].id;
  if(id === 'pre') return M.pre.dur - M.pre.t;
  if(id === 'mw') return M.mw.state === 'run' ? M.mw.dur - M.mw.t : 3;
  if(id === 'cool') return M.mw.dur - M.mw.t;
  if(id === 'as') return M.as.dur - M.as.t;
  if(M.pl.state === 'warm') return M.pl.dur - M.pl.t;
  return 0;
}
function watchStation(){
  const id = FLOW[batch.ptr].id;
  if(id === 'pre') return 'hood';
  if(id === 'mw' || id === 'cool') return 'microwave';
  if(id === 'as') return 'autosampler';
  if(M.pl.state === 'warm') return 'icp';
  if(blockedSt('hood')) return 'hood';
  return 'pc';
}
function waitLabel(){
  const id = FLOW[batch.ptr].id, r = Math.max(0, Math.ceil(waitRemaining()));
  if(id === 'pre') return `Watching the pre-digest fizz (${r} min left)`;
  if(id === 'mw') return M.mw.state === 'paused' ? 'Digester stopped, waiting on a fix' : `Watching the digester: ${M.mw.T | 0} \u00b0C, ${fmt(M.mw.P, 0)} bar`;
  if(id === 'cool') return `Waiting for the rotor to cool (${M.mw.T | 0} \u00b0C)`;
  if(id === 'as') return M.as.state === 'paused' ? 'Run paused, waiting on the plasma' : `Watching the ICP-MS run (${r} min left)`;
  if(M.pl.state === 'warm') return `Waiting for the plasma to warm up (${r} min)`;
  if(blockedSt('hood')) return 'Waiting for the fume hood to clear';
  if(blockedSt('pc')) return 'Waiting for LIMS to come back';
  return 'Thinking about what to do next';
}
function chooseJob(){
  if(S.urgent.length) return S.urgent.shift();
  if(S.spills.length) return {id:'spill', opt:{spill:S.spills[0]}};
  if(S.queue.length) return S.queue.shift();
  if(!S.lunched && S.hunger < 15) return {id:'lunch'};
  const step = FLOW[batch.ptr];
  if(step.job){
    const pre = prereq(step.job);
    if(pre === null){ if(!blockedSt(JOBS[step.job].station)) return {id:step.job}; }
    else if(pre !== 'wait' && !blockedSt(JOBS[pre].station)) return {id:pre};
  }
  const f = filler(); if(f) return {id:f};
  const rem = waitRemaining();
  return {id:'watch', opt:{st:watchStation()}};
}

/* ---------- job runner ---------- */
function startJob(id, opt = {}){
  const def = JOBS[id];
  let st;
  if(opt.spill || opt.at){
    const s = opt.spill || opt.at, d = Math.hypot(s.x, s.z) || 1;
    const sx = s.x - s.x / d * 6, sz = s.z - s.z / d * 6;
    st = {stand:[sx, sz], face:Math.atan2(s.x - sx, s.z - sz), name:opt.spill ? 'spill' : 'rotor'};
  } else st = ST[opt.st || def.station];
  cur = {id, def, opt, st, phase:'walk', t:0, dur:1};
  S.path = planPath(S.x, S.z, st.stand[0], st.stand[1]); S.pi = 0;
  S.walkTotal = Math.max(1, Math.hypot(st.stand[0] - S.x, st.stand[1] - S.z));
  setGloves(!!def.gloves);
  setHeld(def.carry ? def.held : null);
  setStatus('walk', def.walkText ? def.walkText(cur) : `Heading to the ${st.name}`);
}
function beginWork(){
  const c = cur, d = c.def;
  c.phase = 'work'; c.t = 0;
  let dur = typeof d.dur === 'function' ? d.dur(c) : d.dur;
  if(S.buff.caf > S.minutes) dur *= .85;
  if(S.hp < 35) dur *= 1.15;
  c.dur = dur;
  setHeld(d.held || null);
  if(d.start) d.start(c);
  if(!d.noRoll){
    const fails = (d.fails || []).filter(f => !f.cond || f.cond());
    const r = Math.random(), fc = failChance(d.icp);
    if(r < fc && fails.length){ c.fail = wpick(fails); c.failAt = rand(.3, .8); }
    else if(r < fc + GOOD_CHANCE && d.goods && d.goods.length) c.good = pick(d.goods);
  }
  setStatus(c.id === 'lunch' ? 'away' : 'work', d.text(c));
}
function fireFail(c){
  const f = c.fail; c.fired = true; S.stats.fails++;
  const tag = f.tag || 'warn';
  log(tag, f.text(c));
  emote(f.emote || pick(['Ugh', 'Nooo', '!?']), 'bad');
  if(FLOW[batch.ptr].job === c.id){ markBad(); dmgSample(5); }
  if(f.hp){ hurt(f.hp); react('hurt'); } else react('facepalm');
  if(f.apply) f.apply(c);
  if(!c.abort) setStatus('work', c.def.text(c));
}
function completeJob(){
  const c = cur, d = c.def, b = batch;
  if(c.good){ S.stats.goods++; log('good', c.good.text(c)); if(c.good.apply) c.good.apply(c); emote(pick(['Yes!', 'Nice!', 'Woo!', '\u2605']), 'good'); react('cheer'); }
  if(d.done) d.done(c);
  if(b === batch && FLOW[batch.ptr].job === c.id){ batch.doneAt[FLOW[batch.ptr].id] = clockText(); batch.ptr++; }
  if(!d.noRoll && S.buff.zone > 0) S.buff.zone--;
  if(!d.noRoll && !c.fired){ addLab(10); S.sample = Math.min(100, S.sample + 2); }
  cur = null; S.idleT = .35;
  setHeld(null); setProgress(0);
  setStatus('idle', 'Making a note');
}

/* ---------- per-frame actor update ---------- */
function lerpAngle(a, b, k){ const d = ((b - a + PI) % (PI * 2) + PI * 2) % (PI * 2) - PI; return a + d * k; }
function angleDiff(a, b){ return Math.abs(((b - a + PI) % (PI * 2) + PI * 2) % (PI * 2) - PI); }
function tickActor(dt){
  let target = POSES.idle(0, S.time);
  if(!cur){ S.idleT -= dt; if(S.idleT <= 0) { const n = chooseJob(); if(n) startJob(n.id, n.opt); } }
  if(cur && cur.phase === 'walk'){
    const p = S.path[S.pi];
    const dx = p.x - S.x, dz = p.z - S.z, dist = Math.hypot(dx, dz);
    if(dist < .3){ S.pi++; if(S.pi >= S.path.length) cur.phase = 'turn'; }
    else {
      const step = Math.min(dist, 17 * dt);
      S.x += dx / dist * step; S.z += dz / dist * step;
      S.ang = lerpAngle(S.ang, Math.atan2(dx, dz), 1 - Math.exp(-dt * 9));
      S.phase += step * .34;
      const sw = Math.sin(S.phase);
      target = {legA:sw * .6, legB:-sw * .6, armR:S.held ? -.95 : -sw * .45, armL:sw * .45, body:.06};
      const left = Math.hypot(cur.st.stand[0] - S.x, cur.st.stand[1] - S.z);
      setProgress(1 - left / S.walkTotal);
    }
  }
  if(cur && cur.phase === 'turn'){
    S.ang = lerpAngle(S.ang, cur.st.face, 1 - Math.exp(-dt * 10));
    if(angleDiff(S.ang, cur.st.face) < .05){ S.ang = cur.st.face; beginWork(); }
  }
  if(cur && cur.phase === 'work'){
    const c = cur;
    c.t += dt;
    const p = Math.min(1, c.t / c.dur);
    target = POSES[c.pose || c.def.pose](p, S.time);
    if(c.def.tick) c.def.tick(p, dt, c);
    if(c.fail && !c.fired && p >= c.failAt) fireFail(c);
    if(cur === c){
      if(c.abort){ cur = null; S.idleT = .3; setHeld(null); setProgress(0); }
      else {
        setProgress(Math.min(1, c.t / c.dur));
        if(c.id === 'watch' && Math.random() < dt * 2) setStatus('idle', waitLabel());
        if(c.t >= c.dur) completeJob();
      }
    }
  }
  if(S.react && S.react.t > 0){ S.react.t -= dt; target = POSES[S.react.pose](0, S.time); }
  applyPose(target, dt);
  const walking = cur && cur.phase === 'walk';
  const hop = S.react && S.react.t > 0 && S.react.pose === 'cheer' ? Math.abs(Math.sin(S.time * 12)) * 1.5 : 0;
  charRoot.position.set(S.x, (walking ? Math.abs(Math.sin(S.phase)) * .5 : 0) + hop, S.z);
  charRoot.rotation.set(0, S.ang, 0);
}

/* ---------- vitals ---------- */
function vitals(dt){
  if(S.away) return;
  const working = cur && cur.phase === 'work' && cur.id !== 'watch';
  S.hunger = Math.max(0, S.hunger - dt * .11 * (working ? 1.2 : 1));
  if(S.hunger < 12){
    S.hp -= dt * .12;
    if(!S.starveWarned){ S.starveWarned = true; log('warn', 'Ada is starving. Lunch can\'t come soon enough'); emote('Hungry\u2026', 'bad'); }
  } else if(S.hunger > 30) S.starveWarned = false;
  if(S.hunger > 60 && S.hp < 100) S.hp = Math.min(100, S.hp + dt * .04);
  if(S.hp <= 0) knockOut();
}
function knockOut(){
  if(S.ko) return;
  S.ko = true; S.hp = 0; S.koT = 0; cur = null; setHeld(null);
  log('hurt', 'Ada collapsed at HP 0. Coworker called occupational health');
  banner('Ada is down', 'hurt'); setStatus('hurt', 'Out cold on the lab floor');
}

/* ---------- simulation step ---------- */
function update(dt){
  if(S.over) return;
  S.time += dt;
  const prev = Math.floor(S.minutes);
  S.minutes += dt;
  if(Math.floor(S.minutes) !== prev){ drawClockHud(); }
  if(S.minutes >= SHIFT_LEN){ S.over = true; showReport('shift'); return; }
  updateMachines(dt);
  if(S.ko){
    S.koT += dt;
    const f = Math.min(1, S.koT / .8);
    charRoot.rotation.set(-f * PI / 2, S.ang, 0); charRoot.position.y = f * 2.5;
    applyPose(POSES.ko(), dt);
    if(S.koT > 3){ S.over = true; showReport('ko'); }
    return;
  }
  vitals(dt);
  if(S.minutes >= S.nextEvent){ S.nextEvent = S.minutes + (chaosMode ? rand(13, 21) : rand(24, 42)); randomEvent(); }
  tickActor(dt);
  chaosUpdate(dt);
}

/* ---------- visuals & instrument screens ---------- */
let dispAcc = 0;
function updateVisuals(rdt, sdt){
  const t = performance.now() / 1000;
  // plasma torch
  const pl = M.pl.state;
  const flick = .85 + Math.random() * .15;
  V.torchMat.color.setHex(pl === 'off' ? 0x2a2540 : pl === 'warm' ? 0xff9fd8 : 0xffffff);
  if(pl === 'ready') V.torchMat.color.multiplyScalar(flick);
  plasmaLight.intensity = pl === 'off' ? 0 : pl === 'warm' ? .5 * flick : 1 * flick;
  V.icpLed.color.setHex(pl === 'off' ? 0xff4040 : pl === 'warm' ? 0xffb547 : 0x5fe39a);
  V.icpLed.emissive.setHex(pl === 'off' ? 0x601010 : pl === 'warm' ? 0x604010 : 0x1f7a44);
  // digester
  const heat = Math.max(0, Math.min(1, (M.mw.T - 30) / 170));
  V.mwGlowMat.emissive.setRGB(heat * .9, heat * .38, heat * .12);
  mwLight.intensity = heat * 1.1;
  if(M.mw.state === 'run') V.rotor.rotation.y += sdt * 3;
  const mwBad = M.mw.state === 'paused';
  V.mwLed.color.setHex(mwBad ? 0xff4040 : M.mw.state === 'idle' ? 0x5fe39a : 0xffb547);
  V.mwLed.emissive.setHex(mwBad ? (Math.floor(t * 4) % 2 ? 0x801010 : 0x200000) : M.mw.state === 'idle' ? 0x104020 : 0x604010);
  // autosampler gantry
  if(M.as.state === 'run'){
    const k = Math.floor(M.as.t / M.as.dur * M.as.n * 1.5) % V.tubes.length, [tx, tz] = V.tubes[k];
    V.asArm.position.x += (tx - V.asArm.position.x) * Math.min(1, rdt * 6);
    V.asArm.position.z += (tz - V.asArm.position.z) * Math.min(1, rdt * 6);
    V.probe.position.y = -1.5 - Math.max(0, Math.sin(S.time * 4)) * 1.4;
    V.pump.rotation.z += sdt * 6;
  } else { V.asArm.position.x += (8 - V.asArm.position.x) * rdt * 2; V.asArm.position.z += (-20 - V.asArm.position.z) * rdt * 2; V.probe.position.y = -1.5; }
  // alarm strobe + power flicker
  const alarm = S.alarmUntil > S.minutes;
  const on = alarm && Math.floor(t * 5) % 2 === 0;
  V.strobeMat.emissive.setHex(on ? 0xff2030 : 0x200008);
  alarmLight.intensity = on ? 1.2 : 0;
  if(S.flicker > 0){ S.flicker -= rdt; hemi.intensity = Math.random() < .5 ? .15 : .62; sun.intensity = hemi.intensity > .3 ? .72 : .1; }
  else { hemi.intensity = .62; sun.intensity = .72; }
  // the blue Subaru: drives off at lunch, comes back an hour later
  const car = V.car;
  if(car.state === 'leave'){ car.t += sdt; car.g.position.x = car.home + car.t * car.t * 12; if(car.t >= 3){ car.state = 'gone'; car.g.visible = false; } }
  else if(car.state === 'arrive'){ car.t = Math.min(2, car.t + sdt); car.g.visible = true; car.g.position.x = car.home + (2 - car.t) * (2 - car.t) * 27; }
  else if(car.state === 'parked'){ car.g.visible = true; car.g.position.x = car.home; }
  // running water: sink and safety shower
  if(S.sinkOn && Math.random() < rdt * 30) emit(V.sinkPos[0] + rand(-.3, .3), V.sinkPos[1], V.sinkPos[2] + rand(-.3, .3), 0x9fd8ff, 0, -rand(2, 4), rand(0, 1), .6, .35, 10);
  if(S.showerOn) for(let i = 0; i < 2; i++) if(Math.random() < rdt * 30) emit(V.showerPos[0] + rand(-1.4, 1.4), V.showerPos[1], V.showerPos[2] + rand(-1.4, 1.4), 0x9fd8ff, rand(-.5, .5), -rand(3, 6), rand(-.5, .5), 1.1, .45, 20);
  // emote follows her head
  if(emoT > 0){ emoT -= rdt; emoSprite.position.set(S.x, 31 + (S.ko ? -24 : 0), S.z); if(emoT <= 0) emoSprite.visible = false; }
  dispAcc += rdt;
  if(dispAcc > .2){ dispAcc = 0; drawDisplays(t); }
}
function drawDisplays(t){
  // digester panel
  let g = V.mwDisp.g;
  g.fillStyle = '#0c1424'; g.fillRect(0, 0, 32, 48);
  g.font = '700 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = M.mw.state === 'idle' ? '#7c86b8' : '#ffb547'; g.fillText((M.mw.T | 0) + '\u00b0', 16, 10);
  g.fillStyle = '#7cc4ff'; g.fillText(fmt(M.mw.P, 0) + 'b', 16, 24);
  const word = {idle:'IDLE', run:M.mw.t < (batch ? batch.m.ramp : 5) ? 'RAMP' : 'HOLD', cool:'COOL', paused:'STOP'}[M.mw.state];
  g.fillStyle = M.mw.state === 'paused' ? '#ff5d73' : '#5fe39a'; g.font = '700 8px monospace'; g.fillText(word, 16, 39);
  V.mwDisp.t.needsUpdate = true;
  // hood monitor
  g = V.hoodMon.g; const hoodBad = S.hoodAlarmUntil > S.minutes;
  g.fillStyle = hoodBad && Math.floor(t * 3) % 2 ? '#5a0d18' : '#0c1a14'; g.fillRect(0, 0, 32, 12);
  g.fillStyle = hoodBad ? '#ff5d73' : '#5fe39a'; g.font = '700 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(hoodBad ? '62 fpm' : '102 fpm', 16, 6.5); V.hoodMon.t.needsUpdate = true;
  // water purifier
  g = V.waterDisp.g; const low = S.waterLowUntil > S.minutes;
  g.fillStyle = '#0c1424'; g.fillRect(0, 0, 40, 16); g.fillStyle = low ? '#ffb547' : '#7cc4ff';
  g.font = '700 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((low ? '15.8' : '18.2') + ' M\u03a9', 20, 8.5);
  V.waterDisp.t.needsUpdate = true;
  // fridge
  g = V.fridgeDisp.g; const warm = S.fridgeAlarmUntil > S.minutes;
  g.fillStyle = '#0c1424'; g.fillRect(0, 0, 28, 10); g.fillStyle = warm ? '#ff5d73' : '#5fe39a';
  g.font = '700 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(warm ? '9.1\u00b0C' : '3.8\u00b0C', 14, 5.5);
  V.fridgeDisp.t.needsUpdate = true;
  // argon gauge
  g = V.argGauge.g; g.fillStyle = '#1b1631'; g.fillRect(0, 0, 12, 20);
  const h = Math.round(S.argon / 100 * 16); g.fillStyle = S.argon < 18 ? '#ff5d73' : '#7cc4ff'; g.fillRect(3, 18 - h, 6, h);
  V.argGauge.t.needsUpdate = true;
  // LIMS screen
  const atPc = cur && cur.phase === 'work' && cur.def.station === 'pc';
  g = V.limsScr.g; g.fillStyle = blockedSt('pc') ? '#1a2c80' : '#0e1630'; g.fillRect(0, 0, 48, 30);
  if(blockedSt('pc')){ g.fillStyle = '#efeaff'; g.font = '700 7px monospace'; g.textAlign = 'center'; g.fillText('UPDATING', 24, 16); }
  else {
    g.fillStyle = '#2b4c8c'; g.fillRect(0, 0, 48, 4);
    for(let i = 0; i < 6; i++){ g.fillStyle = i === Math.floor(t * 2) % 6 && atPc ? '#f4d35e' : '#3a4670'; g.fillRect(2, 6 + i * 4, 10, 2); g.fillStyle = '#5a6690'; g.fillRect(14, 6 + i * 4, 14 + ((i * 7) % 16), 2); }
  }
  V.limsScr.t.needsUpdate = true;
  // instrument software screen
  g = V.icpScr.g; g.fillStyle = '#0b1424'; g.fillRect(0, 0, 48, 30);
  const mode = atPc && cur.def.screen ? cur.def.screen : M.as.state === 'run' ? 'run' : 'idle';
  if(mode === 'run' || mode === 'tune'){
    for(let i = 0; i < 22; i++){ const peak = [3, 7, 12, 17].includes(i) ? 18 : 4; const hh = peak * (.4 + Math.random() * .6); g.fillStyle = peak > 10 ? '#5fe39a' : '#3a6a8a'; g.fillRect(2 + i * 2, 27 - hh, 1, hh); }
  } else if(mode === 'cal'){
    g.fillStyle = '#5a6690'; g.fillRect(4, 4, 1, 22); g.fillRect(4, 26, 40, 1);
    g.strokeStyle = '#ff5d73'; g.beginPath(); g.moveTo(5, 25); g.lineTo(43, 6); g.stroke();
    g.fillStyle = '#f4d35e'; [[8,23],[14,20],[22,16],[32,11],[42,7]].forEach(([x,y]) => g.fillRect(x, y, 2, 2));
  } else if(mode === 'review'){
    for(let r = 0; r < 5; r++) for(let c2 = 0; c2 < 5; c2++){ g.fillStyle = (r * 5 + c2) % 7 === 3 ? '#ffb547' : '#2f9e5b'; g.fillRect(3 + c2 * 9, 3 + r * 5, 7, 3); }
  } else {
    g.fillStyle = pl3color(); g.fillRect(4, 10, 8, 8);
    g.fillStyle = '#7c86b8'; g.font = '700 7px monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(M.pl.state === 'off' ? 'PLASMA OFF' : M.pl.state === 'warm' ? 'WARMING' : 'READY', 15, 14.5);
  }
  V.icpScr.t.needsUpdate = true;
}
const pl3color = () => M.pl.state === 'off' ? '#ff5d73' : M.pl.state === 'warm' ? '#ffb547' : '#5fe39a';

/* ---------- camera follow + main loop ---------- */
let follow = false, followWas = false;
const homeTarget = new THREE.Vector3(-2, 8, 4), want = new THREE.Vector3();
function cameraFollow(dt){
  const k = 1 - Math.exp(-dt * 3);
  if(follow) want.set(S.x, 12, S.z);
  else if(followWas && (Math.abs(camera.zoom - HOME_ZOOM) > .02 || controls.target.distanceTo(homeTarget) > .5)) want.copy(homeTarget);
  else { followWas = false; return; }
  followWas = true;
  const d = want.clone().sub(controls.target).multiplyScalar(k);
  controls.target.add(d); camera.position.add(d);
  camera.zoom += ((follow ? 2.5 : HOME_ZOOM) - camera.zoom) * k; camera.updateProjectionMatrix();
}
const clock = new THREE.Clock();
function frame(){
  const dt = Math.min(clock.getDelta(), .05);
  const sdt = S.paused || S.over ? 0 : dt * S.speed;
  // big speed-ups run in sub-steps so walking and timers stay stable
  const steps = Math.ceil(sdt / .05) || 1;
  for(let i = 0; i < steps; i++) update(sdt / steps);
  updateParticles(sdt);
  updateVisuals(dt, sdt);
  cameraFollow(dt);
  controls.update();
  renderer.render(scene, camera);
  hudTick(dt);
  chaosFrame(dt);
  requestAnimationFrame(frame);
}
