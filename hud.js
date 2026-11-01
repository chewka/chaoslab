"use strict";
/* ============ hud: panels, notebook, controls, shift reset, boot ============ */
const TAGS = {ok:'OK', warn:'WARN', fail:'FAIL', good:'GOOD', hurt:'HURT', event:'EVENT'};
const logEl = $('#log');
function log(tag, text){
  const li = document.createElement('li');
  const t = document.createElement('time'); t.textContent = clockText();
  const g = document.createElement('b'); g.className = 'tag t-' + tag; g.textContent = TAGS[tag] || tag;
  const s = document.createElement('span'); s.textContent = text;
  li.append(t, g, s); logEl.prepend(li);
  while(logEl.children.length > 80) logEl.lastChild.remove();
}
let bannerTimer = 0;
function banner(text, kind){
  const b = $('#banner'); b.textContent = text; b.className = 'panel k-' + kind; b.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, 3800);
}
const pill = $('#pill'), taskLabel = $('#taskLabel'), prog = $('#prog');
function setStatus(state, text){
  pill.dataset.s = state;
  pill.textContent = {walk:'Walking', work:'Working', away:'At lunch', idle:'Waiting'}[state] || 'Idle';
  taskLabel.textContent = text;
}
let lastPct = -1;
function setProgress(p){ const pct = Math.round(p * 100); if(pct === lastPct) return; lastPct = pct; prog.style.width = pct + '%'; prog.parentElement.setAttribute('aria-valuenow', pct); }
function drawClockHud(){ $('#clock').textContent = clockText(); }

/* ---------- pixel icons for HP and Hunger ---------- */
const HEART = ['.XX...XX.','XRRX.XRRX','XRWRXRRRX','XRRRRRRRX','.XRRRRRX.','..XRRRX..','...XRX...','....X....'];
const DRUM  = ['....XXXX.','...XBBBBX','..XBBLBBX','..XBBBBBX','..XBBBBX.','.XWXXXX..','XWWX.....','XWX......','.X.......'];
function iconURL(map, full, empty, half){
  const h = map.length, w = map[0].length, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const ch = map[y][x]; if(ch === '.') continue;
    const pal = half === 'empty' || (half === 'half' && x >= Math.ceil(w / 2)) ? empty : full;
    g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1);
  }
  return `url(${c.toDataURL()})`;
}
const VIAL  = ['...XXX...','...XWX...','..XXXXX..','..XW..X..','..XGGLX..','..XGGGX..','..XGGGX..','...XGX...','....X....'];
const WRENCH = ['.XX......','XMMX.....','XM.MX....','.XMMMX...','...XMMX..','....XMMX.','.....XMMX','......XMX','.......X.'];
const HP_PAL = [{X:'#1a0b14', R:'#ff4d6d', W:'#ffd0da'}, {X:'#1a0b14', R:'#3b3360', W:'#3b3360'}];
const FD_PAL = [{X:'#1a0e08', B:'#c8742c', L:'#f0a860', W:'#f4efe4'}, {X:'#1a0e08', B:'#3b3360', L:'#3b3360', W:'#4a4270'}];
const SM_PAL = [{X:'#0b1a12', W:'#efeaff', G:'#5fe39a', L:'#c9ffe0'}, {X:'#0b1a12', W:'#3b3360', G:'#3b3360', L:'#3b3360'}];
const IN_PAL = [{X:'#0b1024', M:'#7cc4ff'}, {X:'#0b1024', M:'#3b3360'}];
const ICON = {
  vial:  {full:iconURL(VIAL, ...SM_PAL, 'full'), half:iconURL(VIAL, ...SM_PAL, 'half'), empty:iconURL(VIAL, ...SM_PAL, 'empty')},
  wrench:{full:iconURL(WRENCH, ...IN_PAL, 'full'), half:iconURL(WRENCH, ...IN_PAL, 'half'), empty:iconURL(WRENCH, ...IN_PAL, 'empty')},
  heart:{full:iconURL(HEART, ...HP_PAL, 'full'), half:iconURL(HEART, ...HP_PAL, 'half'), empty:iconURL(HEART, ...HP_PAL, 'empty')},
  food: {full:iconURL(DRUM, ...FD_PAL, 'full'),  half:iconURL(DRUM, ...FD_PAL, 'half'),  empty:iconURL(DRUM, ...FD_PAL, 'empty')}
};
const heartsEl = $('#hearts'), foodEl = $('#food'), sampleEl = $('#sampleBar'), instrEl = $('#instrBar');
for(let i = 0; i < 10; i++) for(const el of [heartsEl, foodEl, sampleEl, instrEl]) el.append(document.createElement('i'));
function paintIcons(el, val, set){
  [...el.children].forEach((ic, i) => { const v = val - i * 10; ic.style.backgroundImage = v >= 7.5 ? set.full : v >= 2.5 ? set.half : set.empty; });
}
const hungerWord = () => S.hunger > 80 ? 'Full' : S.hunger > 55 ? 'Fed' : S.hunger > 30 ? 'Peckish' : S.hunger > 12 ? 'Hungry' : 'Starving';

/* ---------- workflow list ---------- */
const flowEl = $('#flow');
function buildFlow(){
  flowEl.innerHTML = '';
  for(const s of FLOW){
    const li = document.createElement('li'); li.dataset.id = s.id;
    li.innerHTML = `<b class="mk"></b><span>${s.label}</span><em></em>`;
    flowEl.append(li);
  }
  $('#batchId').textContent = `Batch ${batch.id}`;
}
function renderFlow(){
  const m = batch.m;
  $('#attempt').textContent = batch.attempt > 1 ? `attempt ${batch.attempt}` : '';
  const lost = batch.samples.filter(s => s.lost).map(s => s.id);
  $('#batchMeta').textContent = `${batch.samples.length} \u00d7 ${m.name.toLowerCase()} \u00b7 ${m.inhal ? 'inhalable' : 'non-inhalable'} limits \u00b7 ${m.acids} \u00b7 ${fmt(m.mass, 2)} g${lost.length ? ' \u00b7 lost: ' + lost.join(', ') : ''}`;
  FLOW.forEach((s, i) => {
    const li = flowEl.children[i];
    let cls = i < batch.ptr ? 'done' : i === batch.ptr ? (s.wait ? 'wait' : 'cur') : 'todo';
    if(batch.bad && batch.bad.id === s.id && batch.bad.until > S.minutes) cls = 'bad';
    let det = '';
    if(i < batch.ptr) det = batch.doneAt[s.id] || '';
    else if(i === batch.ptr){
      if(s.wait){ const r = Math.max(0, Math.ceil(waitRemaining())); det = (s.id === 'mw' && M.mw.state === 'paused') || (s.id === 'as' && M.as.state === 'paused') ? 'stopped' : `${r} min`; }
      else { const pre = prereq(s.job); det = pre === 'wait' ? 'waiting' : pre ? 'needs ' + {clean:'vessels', cavity:'cavity', ignite:'plasma', standards:'stds'}[pre] : 'now'; }
    }
    if(li.className !== cls) li.className = cls;
    const em = li.lastChild; if(em.textContent !== det) em.textContent = det;
  });
  $('#stepNo').textContent = `Step ${Math.min(batch.ptr + 1, FLOW.length)}/${FLOW.length}`;
}

/* ---------- instruments ---------- */
function renderInstr(){
  const mw = M.mw, pl = M.pl, as = M.as;
  const mwTxt = mw.state === 'idle' ? `<span class="c-dim">Idle \u00b7 ${mw.T | 0} \u00b0C</span>`
    : mw.state === 'paused' ? '<span class="c-bad">Stopped</span>'
    : `<span class="${mw.state === 'cool' ? 'c-info' : 'c-warn'}">${mw.state === 'cool' ? 'Cooling' : mw.t < batch.m.ramp ? 'Ramping' : 'Holding'} \u00b7 ${mw.T | 0} \u00b0C \u00b7 ${fmt(mw.P, 0)} bar</span>`;
  const plTxt = pl.state === 'off' ? '<span class="c-bad">Off</span>' : pl.state === 'warm' ? `<span class="c-warn">Warming \u00b7 ${Math.ceil(pl.dur - pl.t)} min</span>` : '<span class="c-ok">Ready \u00b7 1550 W</span>';
  const asTxt = as.state === 'run' ? `<span class="c-ok">Run \u00b7 ${Math.min(as.n, Math.floor(as.t / as.dur * as.n) + 1)}/${as.n}</span>` : as.state === 'paused' ? `<span class="c-bad">Paused \u00b7 ${as.why === 'probe' ? 'probe bent' : 'no plasma'}</span>` : '<span class="c-dim">Idle</span>';

  const rows = [
    ['Digester', mwTxt],
    ['Plasma', plTxt],
    ['Autosampler', asTxt],
    ['Argon', `<span class="meter"><i style="width:${S.argon.toFixed(0)}%;background:var(--event)"></i></span>bulk supply`],
    ['Water', S.waterLowUntil > S.minutes ? '<span class="c-warn">15.8 M\u03a9\u00b7cm</span>' : '<span class="c-ok">18.2 M\u03a9\u00b7cm</span>'],
    ['Fume hood', S.hoodAlarmUntil > S.minutes ? '<span class="c-bad">62 fpm \u00b7 alarm</span>' : '<span class="c-ok">102 fpm</span>'],
    ['Vessels', (S.vesselsDirty ? '<span class="c-warn">Dirty</span>' : '<span class="c-ok">Clean</span>') + (S.cavityDirty ? ' \u00b7 <span class="c-bad">cavity</span>' : '')],
    ['Floor', S.showerOn ? '<span class="c-bad">Flooding</span>' : S.sinkOn ? '<span class="c-bad">Sink overflowing</span>' : S.spills.length ? `<span class="c-warn">${S.spills.length} spill${S.spills.length > 1 ? 's' : ''}</span>` : '<span class="c-ok">Clear</span>'],
    ['Cal standards', batch.standards ? '<span class="c-ok">Ready</span>' : '<span class="c-dim">Not made</span>']
  ];
  const html = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const dl = $('#instrList'); if(dl.innerHTML !== html) dl.innerHTML = html;
}
function renderBuffs(){
  const b = [];
  if(S.gloves) b.push(['Gloves on', 'info']);
  if(S.buff.zone > 0) b.push([`In the zone \u00d7${S.buff.zone}`, 'good']);
  if(S.away) b.push(['Out to lunch', 'info']);
  if(S.hunger < 12) b.push(['Starving', 'bad']);
  b.push([batch.m.inhal ? 'Inhalable limits' : 'Non-inhalable limits', 'info']);
  if(S.lunched && !S.away) b.push(['Lunch done', 'good']);
  if(S.sinkOn) b.push(['Sink on', 'bad']);
  if(S.showerOn) b.push(['Shower flood', 'bad']);
  if(S.alarmUntil > S.minutes) b.push(['Fire alarm', 'bad']);
  if(S.fires && S.fires.length) b.push([`On fire \u00d7${S.fires.length}`, 'bad']);
  if(S.soot) b.push(['Sooty', 'bad']);
  if(S.vortexUntil > S.minutes) b.push(['Vortex', 'bad']);
  if(S.gravUntil > S.minutes) b.push(['Zero-G', 'info']);
  if(S.rotorLoose) b.push(['Rotor loose', 'bad']);
  if(chaosMode) b.push(['Chaos mode', 'bad']);
  const html = b.map(([t, k]) => `<span class="buff b-${k}">${t}</span>`).join('');
  const el = $('#buffs'); if(el.innerHTML !== html) el.innerHTML = html;
}
let hudAcc = 0;
function hudTick(dt){
  hudAcc += dt; if(hudAcc < .25) return; hudAcc = 0;
  paintIcons(heartsEl, S.hp, ICON.heart); paintIcons(foodEl, S.hunger, ICON.food);
  paintIcons(sampleEl, S.sample, ICON.vial); paintIcons(instrEl, S.instr, ICON.wrench);
  $('#sampleNum').textContent = Math.round(S.sample); $('#instrNum').textContent = Math.round(S.instr);
  sampleEl.classList.toggle('low', S.sample < 30 && !reduceMotion); instrEl.classList.toggle('low', S.instr < 30 && !reduceMotion);
  heartsEl.classList.toggle('low', S.hp < 30 && !S.ko && !reduceMotion);
  foodEl.classList.toggle('low', S.hunger < 12 && !reduceMotion);
  $('#hpNum').textContent = Math.max(0, Math.round(S.hp));
  $('#hungerWord').textContent = hungerWord();
  renderFlow(); renderInstr(); renderBuffs(); chaosHud();
  $('#tally').textContent = `${S.stats.fails} fails \u00b7 ${S.stats.goods} wins`;
}

/* ---------- shift report ---------- */
function showReport(kind){
  $('#repTitle').textContent = kind === 'ko' ? 'Sent to occupational health' : 'Shift report, 07:00';
  $('#repAward').textContent = awardTitle();
  $('#repSub').textContent = kind === 'ko'
    ? `Ada's HP hit zero at ${clockText()}. The incident report is longer than the batch report.`
    : `Ada clocks out, drives the blue Subaru home, and day shift inherits ${batch.id} at step ${batch.ptr + 1}.`;
  const st = S.stats;
  const sc = S.score;
  const rows = [['Lab Score', sc.lab.toLocaleString()], ['Chaos Score', sc.chaos.toLocaleString()], ['Best disaster combo', '\u00d7' + sc.bestCombo], ['Tips changed in time', `${sc.tips} / ${sc.tips + sc.tipMiss}`], ['Batches reported', st.batches], ['Samples reported', st.samples], ['Samples over an action limit', st.over], ['Samples lost', st.lost], ['QC reviews passed', `${st.qcPass} / ${st.qcTotal}`],
    ['Things that went wrong', st.fails], ['Lucky breaks', st.goods], ['Spills cleaned up', st.cleanups], ['Random events', st.events], ['Lunch', st.meals ? 'Yes, 1 hour' : 'Skipped']];
  $('#repStats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#repBtn').textContent = kind === 'ko' ? 'Start a new shift' : 'Start next shift';
  $('#report').hidden = false; $('#repBtn').focus();
}
$('#repBtn').addEventListener('click', () => { $('#report').hidden = true; newShift(); });

/* ---------- shift reset ---------- */
let shiftNo = 0;
function newShift(){
  shiftNo++;
  for(const s of (S.spills || [])) scene.remove(s.mesh);
  Object.assign(S, {
    minutes:0, time:0, speed:S.speed || 1, paused:S.paused ?? reduceMotion, failRate:S.failRate || .03,
    hp:100, hunger:82, gloves:S.gloves, held:S.held, x:-6, z:4, ang:.6, phase:0, path:null, pi:0, walkTotal:1,
    argon:rand(78, 94), vesselsDirty:false, cavityDirty:false, away:false, lunched:false, sinkOn:false, showerOn:false, alarmCause:'',
    buff:{zone:0, caf:-1, band:-1, cones:false, pipette:false},
    blocked:{}, urgent:[], queue:[], spills:[], idleT:1, lastCoffee:-200, lastAid:-100,
    ko:false, koT:0, over:false, react:null, flicker:0, alarmUntil:0, hoodAlarmUntil:0, waterLowUntil:0, fridgeAlarmUntil:0, starveWarned:false,
    sample:100, instr:100, score:{lab:0, chaos:0, combo:0, comboUntil:-1, bestCombo:0, tips:0, tipMiss:0, tipStreak:0},
    fires:[], timers:[], vortexUntil:0, gravUntil:0, foamUntil:0, gravMul:1, boomT:0, sootUntil:0, rotorLoose:null, instrDown:false,
    nextEvent:rand(15, 26),
    stats:{batches:0, samples:0, fails:0, goods:0, hurts:0, meals:0, coffees:0, events:0, lost:0, qcPass:0, qcTotal:0, over:0, cleanups:0}
  });
  cur = null; setHeld(null); setGloves(false);
  charRoot.rotation.set(0, S.ang, 0); charRoot.position.set(S.x, 0, S.z); charRoot.visible = true;
  Object.assign(V.car, {state:'parked', t:0});
  resetMachines(); chaosReset(); newBatch();
  logEl.innerHTML = '';
  drawClockHud();
  log('event', `Shift ${shiftNo} started${chaosMode ? ' in CHAOS MODE' : ''}. Parked the blue Subaru out back. Lab at 21 \u00b0C, sample fridge at 3.8 \u00b0C`);
  log('event', `First batch ${batch.id}: ${batch.samples.length} ${batch.m.name.toLowerCase()} samples for As, Cd, Hg, Pb`);
  setStatus('idle', 'Clocking in, lab coat on');
}

/* ---------- controls ---------- */
const pauseBtn = $('#pause');
function syncPause(){ pauseBtn.textContent = S.paused ? 'Play' : 'Pause'; pauseBtn.setAttribute('aria-pressed', String(S.paused)); }
pauseBtn.addEventListener('click', () => { S.paused = !S.paused; syncPause(); });
const speedBtn = $('#speed');
speedBtn.addEventListener('click', () => { S.speed = {1:2, 2:4, 4:8, 8:1}[S.speed]; speedBtn.textContent = S.speed + '\u00d7'; });
$('#follow').addEventListener('click', e => { follow = !follow; e.currentTarget.setAttribute('aria-pressed', String(follow)); });
$('#panels').addEventListener('click', e => { const on = $('#hud').classList.toggle('min'); e.currentTarget.setAttribute('aria-pressed', String(!on)); });
$('#chaos').addEventListener('click', () => { if(!S.over && !S.ko) randomEvent(); });
buildChaosControls();
const riskEl = $('#risk');
[.01, .03, .06].forEach(r => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = Math.round(r * 100) + '%';
  b.setAttribute('aria-label', `Failure rate ${Math.round(r * 100)} percent`);
  b.addEventListener('click', () => { S.failRate = r; for(const o of riskEl.children) o.setAttribute('aria-pressed', String(o === b)); });
  riskEl.append(b);
});
const pxEl = $('#px');
[1, 2, 3, 4].forEach(n => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.setAttribute('aria-label', 'Pixel size ' + n);
  b.addEventListener('click', () => { pixelSize = n; for(const o of pxEl.children) o.setAttribute('aria-pressed', String(o === b)); resize(); });
  pxEl.append(b);
});

/* ---------- boot ---------- */
buildGrid();
newShift();
syncPause();
for(const o of riskEl.children) o.setAttribute('aria-pressed', String(o.textContent === Math.round(S.failRate * 100) + '%'));
for(const o of pxEl.children) o.setAttribute('aria-pressed', String(+o.textContent === pixelSize));
resize();
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => signs.forEach(d => d()));
frame();
