"use strict";
/* ============ sim: path planning, machines, random events, batches, spills ============ */

/* ---------- grid A* (1 voxel cells, obstacles inflated by her half-width) ---------- */
const GX0 = -48, GZ0 = -36, GW = 96, GH = 103, RAD = 4.2;
const blockedCell = new Uint8Array(GW * GH);
function buildGrid(){
  for(let j = 0; j < GH; j++) for(let i = 0; i < GW; i++){
    const x = GX0 + i + .5, z = GZ0 + j + .5;
    let ok = (x > -48 + RAD && x < 48 - RAD && z > -36 + RAD && z < 36 - RAD) || (x > -10 + RAD && x < 10 - RAD && z >= 28 && z < 50) || (x > -14 + RAD && x < 42 - RAD && z >= 46 && z < 67 - RAD);
    if(ok) for(const o of OBST) if(x > o[0] - RAD && x < o[2] + RAD && z > o[1] - RAD && z < o[3] + RAD){ ok = false; break; }
    blockedCell[j * GW + i] = ok ? 0 : 1;
  }
}
const cellOf = (x, z) => [Math.max(0, Math.min(GW - 1, Math.floor(x - GX0))), Math.max(0, Math.min(GH - 1, Math.floor(z - GZ0)))];
function nearestFree(i, j){
  if(!blockedCell[j * GW + i]) return [i, j];
  for(let r = 1; r < 40; r++) for(let dj = -r; dj <= r; dj++) for(let di = -r; di <= r; di++){
    if(Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const a = i + di, b = j + dj;
    if(a >= 0 && b >= 0 && a < GW && b < GH && !blockedCell[b * GW + a]) return [a, b];
  }
  return [i, j];
}
function astar(ai, aj, bi, bj){
  const N = GW * GH, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], start = aj * GW + ai, goal = bj * GW + bi;
  const h = n => { const dx = Math.abs(n % GW - bi), dz = Math.abs(((n / GW) | 0) - bj); return Math.max(dx, dz) + .414 * Math.min(dx, dz); };
  const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while(k > 0){ const p = (k - 1) >> 1; if(heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let k = 0; for(;;){ const l = 2 * k + 1, r = l + 1; let m = k; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r; if(m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
  g[start] = 0; push(start, h(start));
  while(heap.length){
    const n = pop(); if(n === goal) break; if(closed[n]) continue; closed[n] = 1;
    const i = n % GW, j = (n / GW) | 0;
    for(let dj = -1; dj <= 1; dj++) for(let di = -1; di <= 1; di++){
      if(!di && !dj) continue;
      const a = i + di, b = j + dj; if(a < 0 || b < 0 || a >= GW || b >= GH) continue;
      const m = b * GW + a; if(blockedCell[m]) continue;
      if(di && dj && (blockedCell[j * GW + a] || blockedCell[b * GW + i])) continue;
      const ng = g[n] + (di && dj ? 1.414 : 1);
      if(ng < g[m]){ g[m] = ng; came[m] = n; push(m, ng + h(m)); }
    }
  }
  if(came[goal] < 0 && goal !== start) return null;
  const out = []; for(let n = goal; n !== -1; n = came[n]){ out.push({x:GX0 + n % GW + .5, z:GZ0 + ((n / GW) | 0) + .5}); if(n === start) break; }
  return out.reverse();
}
function lineFree(a, b){
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / .5);
  for(let k = 0; k <= n; k++){ const [i, j] = cellOf(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n); if(blockedCell[j * GW + i]) return false; }
  return true;
}
function planPath(fx, fz, tx, tz){
  const [ai, aj] = nearestFree(...cellOf(fx, fz)), [bi, bj] = nearestFree(...cellOf(tx, tz));
  const cells = astar(ai, aj, bi, bj);
  if(!cells || !cells.length) return [{x:tx, z:tz}];
  const mid = [cells[0]];
  let i = 0;
  while(i < cells.length - 1){ let j = cells.length - 1; while(j > i + 1 && !lineFree(cells[i], cells[j])) j--; mid.push(cells[j]); i = j; }
  const path = mid.filter(p => Math.hypot(p.x - fx, p.z - fz) > 1.2);
  path.push({x:tx, z:tz});
  return path;
}

/* ---------- logging hook shared by machines ---------- */
function machineFail(tag, text, emo){ S.stats.fails++; log(tag, text); if(emo) emote(emo, 'bad'); markBad(); dmgInstr(tag === 'fail' ? 14 : 8); }

/* ---------- machines ---------- */
function resetMachines(){
  M.pre = {state:'idle', t:0, dur:15};
  M.mw = {state:'idle', t:0, dur:10, T:22, P:0, set:175, pmax:24, fail:null, failAt:0, good:false};
  M.pl = {state:'off', t:0, dur:20};
  M.as = {state:'idle', t:0, dur:24, n:20, fail:null, failAt:0, why:'', good:false};
}
function failChance(icp){
  let zoneMul = S.buff.zone > 0 ? .5 : 1;
  let p = S.failRate;
  if(S.hunger < 12) p += .02;
  if(S.hp < 35) p += .02;
  if(icp && S.buff.cones) p *= .5;
  return Math.min(.45, p * zoneMul);
}
function startPre(){
  M.pre = {state:'run', t:0, dur:15};
  if(Math.random() < failChance() * .8){ M.pre.dur = 25; machineFail('warn', 'Vigorous brown NOx in the pre-digest. Extended pre-digestion to 25 min', 'Fumes'); }
}
const MW_FAILS = [
  {w:3, when:'hold', run(){ const sid = SID(), n = randi(2, 9); lose(sid); S.cavityDirty = true; M.mw.P = rand(39, 44);
    machineFail('fail', `Vessel ${n} vented at ${fmt(M.mw.P, 0)} bar: rupture disk blew. ${sid} lost; acid vapor in the cavity`, 'BANG');
    burst(V.mwPos[0], V.mwPos[1], V.mwPos[2], 0xf0e2b0, 26, 6); banner('Digester: vessel vented', 'fail'); addChaos(80, 'Vessel vented', V.mwPos); }},
  {w:2, when:'ramp', run(){ machineFail('fail', `Temperature probe error at ${M.mw.T | 0} \u00b0C. Program aborted`, 'Error'); M.mw.state = 'paused'; urgent('mwRestart', {why:'probe'}); }},
  {w:1, when:'ramp', run(){ machineFail('fail', 'Spark in the cavity! Frayed fiber-optic sheath. Program aborted', 'Sparks!'); M.mw.state = 'paused';
    burst(V.mwPos[0], V.mwPos[1] - 2, V.mwPos[2], 0xfff0a0, 18, 7); urgent('mwRestart', {why:'spark'}); banner('Digester: arcing in the cavity', 'fail'); }},
  {w:1.5, when:'any', run(){ machineFail('warn', 'Door interlock fault; program paused 3 min while it re-latched', 'Beep'); M.mw.dur += 3; }}
];
function startMW(){
  const m = batch.m;
  Object.assign(M.mw, {state:'run', t:0, dur:m.ramp + m.hold, set:m.temp, pmax:m.organic ? rand(28, 36) : rand(16, 26), fail:null, good:false});
  if(!S.lunched && S.minutes >= 45) S.queue.unshift({id:'lunch'});   // lunch rides along with the shift's first hour-long digestion
  if(Math.random() < failChance()){
    M.mw.fail = wpick(MW_FAILS);
    M.mw.failAt = M.mw.fail.when === 'ramp' ? rand(1, m.ramp - .5) : M.mw.fail.when === 'hold' ? m.ramp + rand(.5, m.hold - .5) : rand(1, m.ramp + m.hold - 1);
  } else if(Math.random() < GOOD_CHANCE) M.mw.good = true;
  if(batch.rotorBad) rotorEscape();
}
const AS_FAILS = [
  {w:3, run(){ machineFail('warn', `CCV at position 12: ${EL()} ${randi(111, 116)}% (limit 90\u2013110%). Recalibrated and re-ran the last 10`, 'CCV!'); M.as.dur += 10; }},
  {w:2, run(){ machineFail('warn', `Internal standard \u00b9\u00b9\u2075In at ${randi(52, 66)}% in ${SID()} (limit 70\u2013130%). Diluted 10\u00d7 and re-ran`, 'Matrix'); M.as.dur += 4; }},
  {w:() => batch.needFilter ? 5 : batch.m.key === 'conc' ? 3 : 1.5, run(){ machineFail('warn', 'Nebulizer clogged by particles. Back-flushed and re-ran 3 samples', 'Clog'); M.as.dur += 6; }},
  {w:1, run(){ machineFail('fail', 'Autosampler probe crashed into a tube cap and bent', 'Crunch'); M.as.state = 'paused'; M.as.why = 'probe'; urgent('fixAS'); }},
  {w:1, run(){ machineFail('fail', 'Chiller fault: coolant at 32 \u00b0C. Plasma shut down to protect the RF coil', 'Noo'); plasmaOff(); banner('ICP-MS: chiller fault', 'fail'); }},
  {w:() => batch.m.hcl ? 1.5 : 0, run(){ machineFail('warn', 'ArCl\u207a flagged on \u2077\u2075As. Confirmed He KED mode and re-ran affected samples', 'ArCl'); M.as.dur += 5; }},
  {w:2, run(){ machineFail('warn', `Hg carryover after ${SID()}: slow washout. Extended the 2% HCl + Au rinse and re-ran the next 2`, 'Hg!'); M.as.dur += 4; }}
];
function asPositions(){ const core = live().length + 10; return core + 2 * Math.ceil(core / 20); }   // 6 cal stds + ICV/ICB + blank + samples + dup, QC pair every 20
function startAS(){
  const n = asPositions();
  Object.assign(M.as, {state:'run', t:0, dur:n * 1.0, n, fail:null, why:'', good:false});
  if(Math.random() < failChance(true)){ M.as.fail = wpick(AS_FAILS); M.as.failAt = rand(4, n - 4); }
  else if(Math.random() < GOOD_CHANCE) M.as.good = true;
}
function plasmaOff(){
  M.pl.state = 'off';
  if(M.as.state === 'run'){ M.as.state = 'paused'; M.as.why = 'plasma'; }
}
function advanceWait(id){
  if(FLOW[batch.ptr].id === id){ batch.doneAt[id] = clockText(); batch.ptr++; }
}
function updateMachines(dt){
  if(M.pre.state === 'run'){
    M.pre.t += dt;
    if(Math.random() < dt * 4) emit(V.hoodFume[0] + rand(-4, 4), V.hoodFume[1], V.hoodFume[2] + rand(-1, 1), pick([0xb5651d, 0xc8743a]), rand(-.3, .3), rand(2, 4), 0, 1.6, .7);
    if(M.pre.t >= M.pre.dur){ M.pre.state = 'idle'; log('ok', 'Pre-digestion done; effervescence has stopped'); advanceWait('pre'); }
  }
  const mw = M.mw;
  if(mw.state === 'run'){
    mw.t += dt;
    const ramp = batch.m.ramp;
    mw.T = mw.t < ramp ? 22 + (mw.set - 22) * mw.t / ramp : mw.set + Math.sin(mw.t * 3) * .8;
    mw.P = Math.max(mw.P * .9, 1 + (mw.T - 22) / (mw.set - 22) * mw.pmax);
    if(mw.fail && mw.t >= mw.failAt){ const f = mw.fail; mw.fail = null; f.run(); }
    if(mw.state === 'run' && mw.t >= mw.dur){
      log('ok', `Digestion program complete: ${mw.set} \u00b0C held ${batch.m.hold} min, peak ${fmt(mw.P, 0)} bar`);
      if(mw.good){ S.stats.goods++; log('good', 'Digester tracked the setpoint within \u00b11 \u00b0C the whole hold'); }
      mw.state = 'cool'; mw.t = 0; mw.dur = batch.m.cool; advanceWait('mw');
    }
  } else if(mw.state === 'cool'){
    mw.t += dt;
    mw.T = mw.set - (mw.set - 45) * Math.min(1, mw.t / mw.dur); mw.P = Math.max(0.5, mw.P * (1 - dt * .12));
    if(mw.t >= mw.dur){ mw.state = 'idle'; mw.T = 45; log('ok', 'Rotor down to 45 \u00b0C, safe to vent'); advanceWait('cool'); }
  } else if(mw.state === 'paused'){
    mw.T += (60 - mw.T) * dt * .05; mw.P *= 1 - dt * .2;
  } else { mw.T += (22 - mw.T) * dt * .05; mw.P *= 1 - dt * .3; }

  const pl = M.pl;
  if(pl.state === 'warm'){ pl.t += dt; if(pl.t >= pl.dur){ pl.state = 'ready'; log('ok', 'Plasma stable after the 20 min warm-up'); } }
  const as = M.as;
  if(as.state === 'run'){
    if(pl.state !== 'ready'){ as.state = 'paused'; as.why = 'plasma'; log('warn', 'Autosampler paused: no plasma'); }
    else {
      as.t += dt;
      if(as.fail && as.t >= as.failAt){ const f = as.fail; as.fail = null; f.run(); }
      if(as.state === 'run' && as.t >= as.dur){
        as.state = 'idle';
        log('ok', `Run complete: ${as.n} positions including CCV/CCB brackets`);
        if(as.good){ S.stats.goods++; log('good', 'Every CCV and CCB stayed in control the whole run'); emote('Clean!', 'good'); }
        advanceWait('as');
      }
    }
  } else if(as.state === 'paused' && as.why === 'plasma' && pl.state === 'ready'){
    as.state = 'run'; as.why = ''; log('ok', 'Plasma back. Run resumed from the last good CCV');
  }
}

/* ---------- spills ---------- */
const SPILL_COL = {glass:0xdff4ff, water:0x7cc4ff, sink:0x7cc4ff, flood:0x6fb7ff, oil:0xd8a23a, sugar:0xff8fb8, acid:0xd8e86a};
function spill(kind, x, z, w = 6, d = 5){
  if(x == null){ const f = Math.sin(S.ang), g = Math.cos(S.ang); x = S.x + f * 4; z = S.z + g * 4; }
  x = Math.max(-44, Math.min(44, x)); z = Math.max(-24, Math.min(34, z));
  const m = box(scene, w, 0.15, d, SPILL_COL[kind] || 0xd8e86a, x - w / 2, 0.05, z - d / 2, {opacity:kind === 'glass' ? .9 : .6, cast:false});
  if(kind === 'glass') burst(x, 2, z, 0xdff4ff, 10, 3, 10);
  S.spills.push({kind, x, z, mesh:m});
}
function removeSpill(s){ scene.remove(s.mesh); S.spills = S.spills.filter(q => q !== s); if(s.onClear) s.onClear(); addLab(15, 'Cleaned up', [s.x, 4, s.z]); }

/* ---------- batches ---------- */
let batchNo = 2610;
function newBatch(){
  const prev = batch ? batch.m.key : null;
  const m = pick(MATRICES.filter(x => x.key !== prev)), size = pick(BATCH_SIZES), lot = randi(1100, 9800);
  batch = {id:'B-' + (++batchNo), m, ptr:0, attempt:1, standards:false, needFilter:false, qualified:false, doneAt:{}, bad:null, rotorBad:false,
           samples:Array.from({length:size}, (_, i) => ({id:'S' + (i + 1), name:`${pick(m.names)} #${lot + i}`, lost:false, gone:false, flag:null, mass:0}))};
  // Diana's rules: Blank X goes with flower, Blank Y with concentrates, right before the first sample of its type.
  // Flower dup = first flower + "_dup"; concentrate dup = first Badder/Budder, else Live Rosin, else Distillate.
  batch.blank = m.key === 'flower' ? 'Blank X' : 'Blank Y';
  const pref = m.key === 'flower' ? [] : [/^(Badder|Budder)/, /^Live Rosin/, /^Distillate/];
  const parent = pref.map(re => batch.samples.find(s => re.test(s.name))).find(Boolean) || batch.samples[0];
  batch.dupOf = parent.id; batch.dup = parent.id + '_dup';
  S.sample = 100;
  V.hfSign.visible = m.hf;
  if(typeof buildFlow === 'function') buildFlow();
}
function rework(){
  batch.ptr = flowIdx('weigh'); batch.attempt++;
  for(let i = batch.ptr; i < FLOW.length; i++) delete batch.doneAt[FLOW[i].id];
  for(const s of batch.samples) if(s.lost && !s.gone){ s.lost = false; S.stats.lost--; }
  batch.needFilter = false; batch.qualified = false; S.vesselsDirty = true;
}
function finishBatch(){
  const l = live(), m = batch.m;
  // most cannabis results sit well under the limits; now and then one sample goes over
  const over = Math.random() < .18 && l.length ? {sid:pick(l).id, el:pick(m.el.filter(e => e[0] !== 'Hg' || Math.random() < .3))} : null;
  const parts = m.el.map(([el, , typ, lim, loq]) => {
    const vals = l.map(() => typ * Math.exp(rand(-1.6, 1.1)));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const f = v => v < loq ? `<${loq}` : fmt(v, v < .1 ? 3 : 2);
    return `${el} ${hi < loq ? '<LOQ' : f(lo) + '–' + f(hi)}`;
  });
  const passN = l.length - (over ? 1 : 0);
  log('ok', `Reported ${batch.id} (${m.name}, ${l.length} samples): ${parts.join(', ')} µg/g. ${passN}/${l.length} pass ${m.inhal ? 'inhalable' : 'non-inhalable'} limits${batch.qualified ? '; some results qualified' : ''}`);
  if(over){
    const [el, , , lim] = over.el, v = lim * rand(1.15, 2.6);
    log('fail', `${over.sid} (${sampleName(over.sid)}) ${el} ${fmt(v, 2)} µg/g over the ${lim} µg/g action limit. Re-digested in duplicate to confirm, then flagged FAIL for the client`);
    S.stats.over++; banner(`${over.sid} failed ${el}`, 'fail');
  }
  const lost = batch.samples.filter(s => s.lost).map(s => s.id);
  if(lost.length) log('warn', `Not reported: ${lost.join(', ')}. Re-sampling requested from the client`);
  S.stats.batches++; S.stats.samples += l.length;
  banner(`${batch.id} reported`, 'good'); emote('Done!', 'good');
  newBatch();
  log('event', `New batch ${batch.id}: ${batch.samples.length} ${batch.m.name.toLowerCase()} samples, ${batch.m.method}`);
  addLab(100 + l.length * 5, `${l.length} samples reported`);
}

/* ---------- random world events: 10 of them, spills most common, the safety-shower flood rarest ---------- */
const nearSt = k => ({x:ST[k].stand[0] + rand(-2, 2), z:ST[k].stand[1] + rand(-2, 2)});
function spillEvent(){
  const m = batch.m.key;
  const v = wpick([
    {w:3, k:'acid', t:'Knocked over the 2% HNO₃ rinse bottle at the hood', at:'hood'},
    {w:2, k:'water', t:'Squirt bottle of 18.2 MΩ·cm water tipped over and emptied itself across the floor', at:'water'},
    {w:2, k:'acid', t:'Autosampler rinse reservoir overflowed onto the floor', at:'autosampler'},
    {w:1.5, k:'acid', t:'Acid waste funnel backed up and dribbled down the cabinet', at:'hood'},
    {w:1.5, k:'water', t:'Elbowed a tube rack of rinse water off the balance table', at:'balance'},
    {w:() => m === 'conc' ? 3 : 0, k:'oil', t:'A vape cart leaked sticky oil through its sample bag and onto the floor', at:'fridge'},
    {w:() => m === 'edible' ? 3 : 0, k:'sugar', t:'A bag of gummy samples got warm in the courier cooler and oozed out', at:'balance'},
    {w:() => m === 'tinct' ? 3 : 0, k:'oil', t:'Tincture dropper bottle cracked and leaked MCT oil everywhere', at:'fridge'}
  ]);
  const p = nearSt(v.at); spill(v.k, p.x, p.z);
  log('event', `Spill: ${v.t}. Cleanup queued`); emote('Oops', 'bad'); react('facepalm');
}
function glassEvent(){
  const t = pick([
    'Dropped an empty glass sample jar. It did not survive',
    'Knocked a glass beaker off the drying rack',
    'A glass jar of pre-rolls slid off the cart (the pre-rolls are fine, the jar is not)',
    'Bumped a glass funnel off the bench edge',
    'The old glass Hg standard bottle (empty, thankfully) slipped out of the recycling bin'
  ]);
  const at = pick(['balance', 'hood', 'fridge', 'water']), p = nearSt(at);
  spill('glass', p.x, p.z); log('event', `${t}. Broom and dustpan, never hands`); emote('Crash!', 'bad'); react('facepalm');
}
function sinkEvent(){
  if(S.sinkOn) return;
  S.sinkOn = true;
  log('event', pick(['Sink left on with a glove plugging the drain. It is overflowing', 'Someone left the sink running to rinse a carboy. Now the floor is rinsed too', 'Faucet handle stuck open after rinsing vessels. Sink overflowing']));
  banner('Sink left on!', 'event'); emote('Water?!', 'bad');
  spill('sink', -6, -20, 10, 7);
  S.urgent.unshift({id:'sinkOff'});
}
function showerFlood(){
  if(S.showerOn) return;
  S.showerOn = true;
  log('event', pick([
    "Cart snagged the safety shower pull rod. It's dumping 20 gallons a minute onto the floor",
    'Safety shower valve failed open on its own. Indoor rainstorm by the eyewash',
    "Facilities' weekly shower test got left on. Water everywhere"]));
  banner('Safety shower flood!', 'event'); emote('FLOOD', 'bad');
  spill('flood', -34, 26, 18, 14);
  abortJob(); S.urgent.unshift({id:'showerOff'});
}
function fireAlarm(){
  if(S.alarmUntil > S.minutes) return;
  S.alarmUntil = S.minutes + 40;
  S.alarmCause = pick(['a scheduled drill nobody told night shift about', 'burnt popcorn in the office microwave down the hall', 'a dusty smoke detector in the stairwell', 'facilities testing the panel']);
  log('event', 'Fire alarm! Gloves off, evacuating. Digester left running in its shielded cabinet');
  banner('Fire alarm: evacuate', 'fail'); emote('Alarm!', 'bad');
  abortJob(); S.urgent.unshift({id:'evacuate', opt:{}});
}
const EVENTS = [
  {name:'spill',  label:'Spill', pts:25, kind:'bad',  w:10, run:spillEvent},
  {name:'glass',  label:'Broken glass', pts:30, kind:'bad',  w:6,  run:glassEvent},
  {name:'sink',   label:'Sink overflow', pts:60, kind:'bad',  w:2.5, cond:() => !S.sinkOn, run:sinkEvent},
  {name:'power',  label:'Power dip', pts:40, kind:'bad',  w:2,  run(){ dmgInstr(8); S.flicker = 1.2;
    log('event', `Power dip! Lights flickered${M.pl.state !== 'off' ? '; the plasma went out' : ''}. UPS kept the PCs alive`);
    if(M.pl.state !== 'off') plasmaOff(); if(M.mw.state === 'run') M.mw.dur += 3; banner('Power dip', 'fail'); }},
  {name:'hood',   label:'Hood alarm', pts:40, kind:'bad',  w:2,  run(){ S.blocked.hood = S.minutes + 12; S.hoodAlarmUntil = S.minutes + 12;
    log('event', 'Fume hood airflow alarm: face velocity 62 fpm. Acid work on hold while facilities checks the fan (12 min)'); banner('Hood airflow alarm', 'fail'); }},
  {name:'call',   label:'Client call', pts:15, kind:'bad',  w:2,  run(){ S.blocked.pc = S.minutes + 6;
    log('event', `Client called at ${clockText()} asking if their ${pick(batch.m.names).toLowerCase()} "passed yet." Explained digestion and ICP-MS take a little longer than that (6 min)`); emote('Ring ring', 'neutral'); }},
  {name:'courier', label:'Rush courier', kind:'good', w:2,  run(){ S.queue.unshift({id:'courier'}); log('event', 'Courier buzzed the back door with a rush cooler of samples'); banner('Rush samples at the door', 'event'); }},
  {name:'audit',  label:'QA logbook check', kind:'good', w:1.5, run(){ if(Math.random() < .5){ log('event', 'QA did a surprise logbook check. Finding: one pipette calibration sticker expires next week'); }
    else { heal(6); zone(2); log('good', 'QA did a surprise logbook check: zero findings. "Cleanest notebooks in the building"'); } }},
  {name:'alarm',  label:'Fire alarm', pts:80, kind:'bad',  w:1,  run:fireAlarm},
  {name:'flood',  label:'Shower flood', pts:150, kind:'bad',  w:0.5, cond:() => !S.showerOn, run:showerFlood}
];
function randomEvent(name){
  if(S.over || S.ko) return;
  if(S.away){ if(name) banner('Ada is out at lunch. Try again when she is back', 'event'); return; }
  const pool = EVENTS.filter(e => (!e.cond || e.cond()) && (!e.chaos || chaosMode));
  const e = name ? EVENTS.find(x => x.name === name) : wpick(pool.map(x => x.chaos ? x : Object.assign({}, x, {w:(typeof x.w === 'function' ? x.w() : x.w) * (chaosMode ? .45 : 1)})));
  if(!e || (e.cond && !e.cond())) return;
  S.stats.events++; e.run();
  if(e.pts) addChaos(e.pts, e.label);
  if(e.kind === 'good') S.stats.goods++; else S.stats.fails++;
}
