"use strict";
/* ============ jobs: the cannabis heavy-metals workflow (As, Cd, Hg, Pb) and everything around it ============ */
const FLOW = [
  {id:'login',  job:'login',  label:'Log batch in LIMS'},
  {id:'pull',   job:'pull',   label:'Pull samples from 4 °C fridge'},
  {id:'weigh',  job:'weigh',  label:'Weigh into TFM vessels'},
  {id:'acid',   job:'acid',   label:'Add DI water, HNO₃, H₂O₂ (2 mL each)'},
  {id:'pre',    wait:'pre',   label:'Pre-digest, caps off'},
  {id:'load',   job:'load',   label:'Cap, torque, load rotor'},
  {id:'mw',     wait:'mw',    label:'Microwave digestion program'},
  {id:'cool',   wait:'cool',  label:'Cool below 50 °C'},
  {id:'vent',   job:'vent',   label:'Vent + empty digestion tubes'},
  {id:'dilute', job:'dilute', label:'Dilute + 0.5 mL HCl, 0.1 mL Au'},
  {id:'transfer', job:'transfer', label:'Transfer to test tubes 2101+'},
  {id:'tune',   job:'tune',   label:'Plasma check + tune'},
  {id:'cal',    job:'cal',    label:'Calibrate As, Cd, Hg, Pb'},
  {id:'loadAS', job:'loadAS', label:'Load autosampler'},
  {id:'as',     wait:'as',    label:'ICP-MS run with QC'},
  {id:'review', job:'review', label:'Review QC + LCS recovery'},
  {id:'report', job:'report', label:'Report vs action limits'}
];
const flowIdx = id => FLOW.findIndex(s => s.id === id);

/* ---------- small helpers the jobs share ---------- */
const live = () => batch.samples.filter(s => !s.lost);
const nLive = () => live().length;
const nVessels = () => nLive() + 2;          // + Blank X (flower) or Blank Y (concentrates) + one _dup
const SID = () => { const l = live(); return l.length ? pick(l).id : 'S1'; };
const EL = () => pick(batch.m.el)[0];
function lose(id, gone){ const s = batch.samples.find(x => x.id === id); if(s && !s.lost){ s.lost = true; s.gone = !!gone; S.stats.lost++; dmgSample(10); } }
function flag(id, f){ const s = batch.samples.find(x => x.id === id); if(s) s.flag = f; }
function zone(n){ S.buff.zone = Math.max(S.buff.zone, n); }
function heal(n){ S.hp = Math.min(100, S.hp + n); }
function feed(n){ S.hunger = Math.min(100, S.hunger + n); }
function urgent(id, opt){ S.urgent.push({id, opt:opt || {}}); }
function idRange(){ const l = live(); return l.length ? `${l[0].id}–${l[l.length - 1].id}` : 'none'; }
const sampleName = id => { const s = batch.samples.find(x => x.id === id); return s ? s.name : id; };

const JOBS = {};
function J(id, def){ def.id = id; JOBS[id] = def; }

/* ---------- the batch workflow ---------- */
J('login', {station:'pc', dur:() => 3 + batch.samples.length * .05, pose:'type', screen:'lims',
  text:() => `Logging ${batch.id} into LIMS`,
  done(){ log('ok', `Digestion log for ${batch.id}: ${batch.blank} first, then ${batch.samples.length} ${batch.m.name.toLowerCase()} samples, plus ${batch.dup} (${nVessels()} tubes). ${batch.m.inhal ? 'Inhalable' : 'Non-inhalable'} action limits, ${batch.m.method}`); },
  fails:[
    {w:3, emote:'Ugh', text:() => 'LIMS timed out mid-entry. Re-typed the chain of custody (+4 min)', apply:c => c.dur += 4},
    {w:2, emote:'Hmm', text:() => `Two jars both labeled "${batch.samples[1].name}". Called the client: the second is ${batch.samples[2].name} (+5 min)`, apply:c => c.dur += 5},
    {w:2, emote:'Jam!', text:() => 'Label printer jammed and spat out 40 blank labels (+3 min)', apply:c => c.dur += 3}],
  goods:[
    {text:() => 'Client pre-registered every sample. LIMS import took 30 seconds', apply:() => zone(1)},
    {text:() => `Barcode scanner read all ${batch.samples.length} labels on the first pass`, apply:() => heal(4)}]
});
J('pull', {station:'fridge', dur:() => 2 + batch.samples.length * .05, pose:'reach',
  text:() => `Pulling ${batch.samples.length} samples for ${batch.id}`,
  done(){ log('ok', `Pulled ${batch.samples.length} samples from the 4 °C fridge (log ${fmt(rand(2.9, 4.6))} °C). Custody seals intact`); },
  fails:[
    {w:3, emote:'Hmm', text:c => `Custody seal on ${c.sid = SID()} was torn. Photographed it and noted it on the CoC`, apply:c => flag(c.sid, 'seal')},
    {w:2, emote:'Huh', text:c => `${c.sid = SID()} arrived with only ${fmt(rand(.3, .45), 2)} g. Weighed what there is and noted the low mass`},
    {w:1, emote:'Warm?!', text:() => `Fridge read ${fmt(rand(8.6, 10.2))} °C: day shift left the door ajar. Temperature excursion logged`}],
  goods:[{text:() => 'Day shift pre-sorted the samples by ID. Bless them', apply:() => heal(5)}]
});
J('weigh', {station:'balance', dur:() => 4 + nLive() * .3, pose:'bench', gloves:true, held:'tray', carry:true,
  text:() => `Weighing ${fmt(batch.m.mass, 3)} g of ${nLive()} samples into TFM vessels`,
  done(){
    const ms = live().map(s => { s.mass = batch.m.mass + rand(-.0046, .0046); return `${s.id} ${s.mass.toFixed(4)}`; });
    log('ok', `Weighed ${ms.length} samples into TFM vessels (target ${batch.m.mass.toFixed(3)} ± 0.005 g): ${ms.slice(0, 4).join(', ')} … g. ${batch.dup} weighed right after its parent, ${batch.blank} is an empty tube`);
  },
  fails:[
    {w:3, cond:() => batch.m.key === 'flower', emote:'Zap!', text:c => `Static: ${c.sid = SID()} flower clung to the spatula and the weigh boat. Anti-static gun, re-weighed (+3 min)`, apply:c => c.dur += 3},
    {w:3, cond:() => batch.m.key === 'conc', emote:'Sticky', text:c => `${c.sid = SID()} rosin would not leave the spatula. Warmed it and weighed by difference (+3 min)`, apply:c => c.dur += 3},
    {w:3, cond:() => batch.m.key === 'edible', emote:'Gummy', text:c => `${c.sid = SID()} gummy had to be minced with a ceramic knife to get a representative 0.5 g (+3 min)`, apply:c => c.dur += 3},
    {w:2, emote:'Hmm', text:() => 'Daily check weight read 200.0021 g (limit ±0.0010 g). Internal calibration and re-check (+4 min)', apply:c => c.dur += 4},
    {w:2, emote:'Achoo', text:() => 'Sneezed at the balance. Re-weighed the two open vessels (+3 min)', apply:c => c.dur += 3}],
  goods:[{text:() => 'Check weight read 200.0000 g exactly. Perfect start', apply:() => zone(2)}]
});
J('acid', {station:'hood', dur:() => 4 + nVessels() * .14, pose:'pour', gloves:true, held:'bottle',
  text:() => `Adding ${batch.m.acids} to ${nVessels()} vessels`,
  tick(p, dt){ if(Math.random() < dt * 3) emit(-37 + rand(-3, 3), 14, -31 + rand(-1, 1), 0xd9c27a, 0, rand(2, 4), 0, 1, .5); },
  done(){ log('ok', `Added ${batch.m.acids} to ${nVessels()} vessels, fresh tip for every reagent, H₂O₂ slowly after the HNO₃. Caps off to pre-digest`); startPre(); },
  fails:[
    {w:3, emote:'Foam!', text:c => `${c.sid = SID()} foamed up hard with the H₂O₂. Added it dropwise and let it settle (+4 min)`, apply:c => { c.dur += 4; burst(-35, 13, -30, 0xf5f0c8, 14, 3); }},
    {w:2, emote:'Ugh', text:() => 'HNO₃ dispenser stuck mid-stroke. Swapped in the spare dispenser (+3 min)', apply:c => c.dur += 3},
    {w:2, emote:'Oops', text:() => 'Double-dosed HNO₃ into the method blank. Dumped, rinsed, redid the MB (+4 min)', apply:c => c.dur += 4}],
  goods:[{text:() => `Hood at ${randi(100, 106)} fpm, sash on the mark, zero fumes escaping. Textbook`, apply:() => zone(1)}]
});
J('load', {station:'microwave', dur:() => 3 + nVessels() * .1, pose:'torque', gloves:true, held:'wrench',
  text:() => `Capping, torquing and loading ${nVessels()} vessels`,
  done(){ const m = batch.m, r = rotorPlan();
    if(batch.rotorBad) log('warn', `Capped and torqued ${nVessels()} vessels but forgot the ${r.fillers} light-blue filler tubes. The inner ring is lopsided…`);
    else log('ok', `Capped and torqued ${nVessels()} vessels: outer ring ${r.outer}/24${r.inner ? `, inner ring ${r.inner} + ${r.fillers} light-blue filler${r.fillers === 1 ? '' : 's'} = 17` : ''}. Balanced. Program: ${m.ramp} min ramp to ${m.temp} °C, hold ${m.hold} min`);
    startMW(); },
  fails:[
    {w:3, emote:'Crack', text:() => `Cracked liner on vessel ${randi(3, nVessels())} caught during inspection. Swapped in a spare (+3 min)`, apply:c => c.dur += 3},
    {w:2, emote:'Wobble', text:() => 'Rotor out of balance on the turntable. Rearranged the vessels (+2 min)', apply:c => c.dur += 2}],
  goods:[{text:() => 'Every seal and burst disk passed inspection on the first look', apply:() => zone(1)}]
});
J('vent', {station:'hood', dur:() => 3 + nVessels() * .07, pose:'bench', gloves:true, held:'vessel',
  text:() => `Venting ${nVessels()} vessels slowly in the fume hood`,
  tick(p, dt){ if(Math.random() < dt * 10) emit(-35 + rand(-3, 3), 14, -30 + rand(-1, 1), pick([0xb5651d, 0xc8743a, 0x9a5a2a]), rand(-.4, .4), rand(2.5, 5), 0, 1.4, .8); },
  done(){ log('ok', `Vented each vessel slowly in the hood, brown NOx out. Digests ${batch.m.digest}`); },
  fails:[
    {w:2.5, emote:'Hiss', text:() => `First vessel hissed hard at ${randi(54, 58)} °C. Closed the hood sash and gave the rotor 5 more minutes (+5 min)`, apply:c => c.dur += 5},
    {w:2.5, cond:() => batch.m.key === 'conc', emote:'Hmm', text:c => `Oily film on ${c.sid = SID()}: incomplete digestion. Will filter through 0.45 µm PTFE`, apply:() => { batch.needFilter = true; }},
    {w:1.5, emote:'Stuck', text:() => `Cap seized on vessel ${randi(2, nVessels())}. Vessel wrench and patience (+2 min)`, apply:c => c.dur += 2}],
  goods:[{text:() => `All ${nVessels()} digests crystal clear on the first look`, apply:() => heal(4)}]
});
J('dilute', {station:'water', dur:() => 6 + nVessels() * .25 + (batch.needFilter ? 4 : 0) + (S.buff.pipette ? 3 : 0), pose:'pour', gloves:true, held:'tubes',
  text:() => `Diluting ${nVessels()} digests to 50 mL${batch.needFilter ? ' and filtering' : ''}`,
  done(){
    let t = `Emptied ${nVessels()} digests into 50 mL tubes, rinsed vessels 3×, added 0.5 mL HCl + 0.1 mL gold to hold the Hg, diluted to 50.0 mL with 18.2 MΩ·cm water; internal standards Ge, In, Tb, Bi at 10 µg/L`;
    if(batch.needFilter) t += '. Filtered the cloudy digests through 0.45 µm PTFE';
    log('ok', t); S.vesselsDirty = true; S.buff.pipette = false;
  },
  fails:[
    {w:3, emote:'15.8?!', text:() => 'Purifier read 15.8 MΩ·cm. Swapped the polishing cartridge and flushed 10 L (+6 min)', apply:c => { c.dur += 6; S.waterLowUntil = S.minutes + 6; }},
    {w:2, emote:'Oops', text:() => 'Forgot internal standard in two tubes. Spiked and re-mixed (+3 min)', apply:c => c.dur += 3},
    {w:1.5, emote:'Hmm', text:c => `Overshot ${c.sid = SID()} to ${fmt(rand(50.9, 51.8))} mL. Recorded the actual volume for the calculation`}],
  goods:[{text:() => 'Every tube landed right on the 50.0 mL line', apply:() => zone(1)}]
});
J('tune', {station:'pc', dur:8, pose:'type', icp:true, screen:'tune',
  text:() => 'Running the daily performance check',
  done(){ log('ok', `Performance check: ⁷Li ${randi(60, 95)} kcps, ¹¹⁵In ${randi(210, 330)} kcps, ²⁰⁸Pb ${randi(180, 300)} kcps; CeO⁺/Ce⁺ ${fmt(rand(1.1, 1.9))}%, Ce²⁺/Ce⁺ ${fmt(rand(1.4, 2.8))}%, RSD ${fmt(rand(1.1, 2.9))}%. He KED verified on ⁷⁵As. Pass`); },
  fails:[
    {w:3, emote:'Oxides!', text:() => `Oxides at ${fmt(rand(3.1, 4.2))}% CeO⁺/Ce⁺ (limit 2%). Dropped nebulizer flow 0.05 L/min and re-tuned (+5 min)`, apply:c => c.dur += 5},
    {w:2, emote:'Weak', text:() => `¹¹⁵In down to ${randi(31, 48)} kcps. Pulled and cleaned the sampler and skimmer cones (+12 min)`, apply:c => c.dur += 12},
    {w:2, emote:'Pulsing', text:() => `Signal pulsing at ${fmt(rand(6, 9))}% RSD: pump tubing flattened. Replaced the tubing (+5 min)`, apply:c => c.dur += 5}],
  goods:[{text:() => `¹¹⁵In at ${randi(405, 440)} kcps, best sensitivity this month`, apply:() => zone(2)}]
});
J('cal', {station:'pc', dur:10, pose:'type', icp:true, screen:'cal',
  text:() => 'Calibrating As, Cd, Pb 0.1–50 µg/L and Hg 0.05–5 µg/L',
  done(c){ const lo = c.good ? 0.9999 : 0.9995; const rs = batch.m.el.map(e => `${e[0]} r = ${(lo + Math.random() * (0.99999 - lo)).toFixed(5)}`); log('ok', `Calibration: ${rs.join(', ')}. ICV ${randi(95, 104)}%, ICB below MDL`); },
  fails:[
    {w:3, emote:'r=0.996', text:c => `${c.el = EL()} curve r = 0.9962 (needs ≥ 0.999). Remade the mid standard and re-ran (+8 min)`, apply:c => c.dur += 8},
    {w:2, emote:'114%', text:() => `ICV ${EL()} at 114% (limit 90–110%). Fresh second-source ICV passed at 101% (+5 min)`, apply:c => c.dur += 5},
    {w:2, emote:'Pb?!', text:() => 'Calibration blank shows Pb at 0.3 µg/L. Traced to a dusty tip box; re-made the blank (+6 min)', apply:c => c.dur += 6},
    {w:1.5, emote:'Hg low', text:() => 'Low Hg standard reading 70%: it plated onto the tube. Re-made it fresh with Au (+5 min)', apply:c => c.dur += 5}],
  goods:[{text:() => 'Every curve r > 0.9999. Printing this one for the wall', apply:() => { heal(5); zone(1); }}]
});
J('loadAS', {station:'autosampler', dur:() => 2 + nVessels() * .05, pose:'bench', gloves:true, held:'tubes', carry:true, icp:true,
  text:() => 'Loading the autosampler racks',
  done(){ const n = asPositions(); log('ok', `Autosampler loaded: cal standards, ICV, ICB, ${batch.blank}, ${idRange()}, ${batch.dup}, QC every 20 (${n} positions)`); startAS(); },
  fails:[
    {w:2, emote:'Oops', text:() => 'Rack 2 went in backwards; positions reversed. Re-loaded (+2 min)', apply:c => c.dur += 2},
    {w:1.5, emote:'Empty', text:() => 'Rinse reservoir ran dry. Refilled with 2% HNO₃ + 0.5% HCl (+2 min)', apply:c => c.dur += 2}],
  goods:[{text:() => 'Racks seated first try with a perfect click', apply:() => heal(2)}]
});
J('review', {station:'pc', dur:() => 5 + nLive() * .08, pose:'type', screen:'review',
  text:() => 'Reviewing QC and LCS recoveries',
  done(c){
    S.stats.qcTotal++; S.stats.qcPass++;
    const rec = batch.m.el.map(e => `${e[0]} ${randi(c.good ? 97 : 90, c.good ? 103 : 108)}%`);
    log('ok', `QC: MB below LOQ; LCS ${rec.join(', ')}; MS/MSD ${randi(88, 108)}/${randi(88, 108)}% (RPD ${fmt(rand(.8, 6))}%); DUP RPD ${fmt(rand(1, 9))}%. Pass`);
  },
  fails:[
    {w:1.5, tag:'fail', emote:'126%?!', text:() => `LCS ${EL()} recovery 126% (limit 80–120%). Batch fails QC; re-digest from weighing`, apply:c => { S.stats.qcTotal++; rework(); c.abort = true; banner(`${batch.id} failed QC: re-prep`, 'fail'); }},
    {w:1.5, tag:'fail', emote:'Contam!', text:() => `Method blank Pb at ${fmt(rand(.03, .05), 3)} µg/g, above the LOQ. Contamination; batch re-prep`, apply:c => { S.stats.qcTotal++; rework(); c.abort = true; banner(`${batch.id} failed QC: re-prep`, 'fail'); }},
    {w:3, emote:'Hmm', text:() => `MS ${EL()} recovery ${randi(62, 68)}%: matrix suppression. Results qualified`, apply:() => { batch.qualified = true; }}],
  goods:[{text:() => 'LCS within ±3% on all four metals', apply:() => heal(6)}]
});
J('report', {station:'pc', dur:() => 2 + nLive() * .05, pose:'type', screen:'lims',
  text:() => `Reporting ${batch.id} against action limits`,
  done(){ finishBatch(); },
  fails:[{w:2, emote:'Units!', text:() => 'LIMS rejected the upload: µg/L vs µg/g. Fixed the dilution factor and re-submitted (+3 min)', apply:c => c.dur += 3}],
  goods:[{text:() => 'Client replied within a minute: "fastest turnaround all year"', apply:() => heal(8)}]
});

J('transfer', {station:'autosampler', dur:() => 3 + nVessels() * .08, pose:'pour', gloves:true, held:'tubes', carry:true,
  text:() => `Transferring ${nVessels()} digests into test tubes, rack row 2`,
  done(){ const n = nVessels(); log('ok', `Transferred ${n} digests into test tubes ${2101}–${2100 + n}, numbered from the bottom-left corner of the rack`); },
  fails:[
    {w:3, emote:'Oops', text:() => 'Rack numbered from the wrong corner. Re-sorted from the bottom-left (+3 min)', apply:c => c.dur += 3},
    {w:2, emote:'Clink', text:c => `Dropped the tube for ${c.sid = SID()}. Poured a fresh one from the 50 mL digest (+2 min)`, apply:c => c.dur += 2}],
  goods:[{text:() => 'Every vial ID matched the Make Batch sample list on the first look', apply:() => zone(1)}]
});

/* ---------- side tasks ---------- */
J('ignite', {station:'icp', dur:3, pose:'reach', icp:true,
  text:() => 'Lighting the plasma',
  done(){ M.pl.state = 'warm'; M.pl.t = 0; M.pl.dur = 20; log('ok', 'Plasma lit: RF 1550 W, Ar 15 L/min, nebulizer 1.0 L/min. 20 min warm-up'); },
  fails:[
    {w:3, emote:'Come on', text:() => 'Plasma refused to ignite twice. Reseated the torch, lit on the third try (+3 min)', apply:c => c.dur += 3},
    {w:2, emote:'Hmm', text:() => 'Interface vacuum slow to pump down. Waited it out (+4 min)', apply:c => c.dur += 4}],
  goods:[{text:() => 'Plasma lit on the first try with a satisfying whump', apply:() => heal(3)}]
});
J('standards', {station:'water', dur:8, pose:'bench', gloves:true,
  text:() => 'Preparing calibration standards',
  done(){ batch.standards = true; log('ok', 'Prepared As/Cd/Pb 0.1, 0.5, 1, 5, 10, 50 µg/L and Hg 0.05, 0.1, 0.5, 1, 5 µg/L in 2% HNO₃ + 0.5% HCl with Au; second-source ICV'); },
  fails:[
    {w:2, emote:'98.1%', text:() => 'Pipette check failed (98.1% at 100 µL). Swapped pipettes, re-made the low standard (+4 min)', apply:c => c.dur += 4},
    {w:1.5, emote:'Expired', text:() => 'Hg stock expired last week. Opened a fresh lot (+3 min)', apply:c => c.dur += 3}],
  goods:[{text:() => 'Pipette check read 100.0% at every volume', apply:() => zone(1)}]
});
J('clean', {station:'microwave', dur:6, pose:'bench', gloves:true, held:'vessel',
  text:() => 'Acid-cleaning the digestion vessels',
  done(){ S.vesselsDirty = false; log('ok', 'Acid-cleaned vessels: HNO₃ cleaning program at 200 °C, rinsed 3× with 18.2 MΩ·cm water, dried upside down'); },
  fails:[
    {w:2, emote:'Cloudy', text:() => `Vessel ${randi(2, 40)} cloudy and scratched. Retired it and pulled a spare (+2 min)`, apply:c => c.dur += 2},
    {w:1.5, emote:'Hot', text:() => 'Vessels still hot from the cleaning run. Let them cool before handling (+2 min)', apply:c => c.dur += 2}],
  goods:[{text:() => 'Found the long-lost vessel 11 behind the digester', apply:() => heal(3)}]
});
J('cavity', {station:'microwave', dur:5, pose:'bench', gloves:true, noRoll:true,
  text:() => 'Cleaning acid residue out of the digester cavity',
  done(){ S.cavityDirty = false; log('ok', 'Neutralized and wiped acid residue from the cavity; fitted a new rupture disk'); }});
J('mwRestart', {station:'microwave', dur:3, pose:'reach', noRoll:true,
  text:c => c.opt.why === 'spark' ? 'Replacing the frayed temperature probe' : c.opt.why === 'boom' ? 'Bolting the digester door back on' : 'Re-seating the temperature probe',
  done(c){
    if(S.rotorLoose){ log('warn', 'Digester ready, but the rotor is still loose somewhere in the lab'); return; }
    Object.assign(M.mw, {state:'run', t:0, fail:null});
    log('ok', c.opt.why === 'spark' ? 'Replaced the temperature probe and restarted the program from the top' : c.opt.why === 'boom' ? 'Door back on, new rupture disks, program restarted from the top' : 'Re-seated the temperature probe and restarted the program from the top'); }});
J('fixAS', {station:'autosampler', dur:4, pose:'bench', noRoll:true,
  text:() => 'Straightening the autosampler probe',
  done(){ M.as.why = ''; if(M.as.state === 'paused') M.as.state = 'run'; log('ok', 'Straightened and realigned the probe, re-taught rack positions. Run resumed'); }});

/* ---------- lunch: out to the car, an hour away while the digestion runs ---------- */
J('lunch', {station:'car', dur:60, pose:'idle', noRoll:true,
  walkText:() => 'Gloves and coat off, out to the car for lunch',
  text:c => `At lunch: ${c.food.n} (back in ${Math.max(1, Math.ceil(c.dur - c.t))} min)`,
  start(c){ c.food = pick(FOODS); S.away = true; S.lunched = true; setGloves(false); charRoot.visible = false; V.car.state = 'leave'; V.car.t = 0;
    log('event', `Lunch: hopped in the blue Subaru and drove off for ${c.food.n}. Digestion running, back in an hour`); banner('Out to lunch', 'event'); },
  tick(p, dt, c){ if(Math.random() < dt * .4) setStatus('idle', c.def.text(c)); if(c.dur - c.t < 2 && V.car.state === 'gone'){ V.car.state = 'arrive'; V.car.t = 0; } },
  done(c){ S.away = false; charRoot.visible = true; feed(100); S.stats.meals++; V.car.state = 'parked';
    log('ok', `Back from lunch (${c.food.n}). Hands washed, fresh gloves, coat back on`); emote('Back!', 'good'); }});
J('courier', {station:'door', dur:3, pose:'reach', noRoll:true,
  walkText:() => 'Courier at the door', text:() => 'Signing for a rush cooler',
  done(){ S.queue.push({id:'stash'}); log('ok', `Signed for ${randi(6, 12)} rush samples. Custody seals intact, cooler at ${fmt(rand(3, 5.5))} \u00b0C`); }});
J('stash', {station:'fridge', dur:2, pose:'reach', held:'tray', carry:true, noRoll:true,
  text:() => 'Logging the rush samples into the fridge',
  done(){ log('ok', 'Rush samples logged and shelved in the 4 \u00b0C fridge for the next batch'); }});
J('evacuate', {station:'assembly', dur:8, pose:'watch', noRoll:true,
  walkText:() => 'Fire alarm! Evacuating to the assembly point',
  text:() => 'At the assembly point, waiting for the all clear',
  done(c){ S.alarmUntil = 0; log('event', `All clear after 8 min: ${S.alarmCause || 'a drill'}. Back inside`); }});
J('sinkOff', {station:'sink', dur:2, pose:'reach', noRoll:true,
  walkText:() => 'Hurrying to the sink',
  text:() => 'Turning off the faucet',
  done(){ S.sinkOn = false; log('ok', 'Faucet off. Pulled the glove that was plugging the drain'); }});
J('showerOff', {station:'shower', dur:3, pose:'reach', noRoll:true,
  walkText:() => 'Splashing over to the safety shower',
  text:() => 'Shoving the shower pull rod closed',
  done(){ S.showerOn = false; log('ok', 'Shower valve closed. Tagged it out of service for facilities'); }});
J('spill', {station:null, dur:c => ({flood:14, sink:8, glass:4, jars:10, debris:7})[c.opt.spill.kind] || 5, pose:'crouch', gloves:true, noRoll:true,
  held:'', walkText:c => ({glass:'Getting the broom and dustpan', flood:'Grabbing the squeegee and every mop in the building', sink:'Grabbing the mop', jars:'Wheeling over a cart for 40 jars', debris:'Getting the broom for the digester pieces'})[c.opt.spill.kind] || 'Grabbing the spill kit',
  start(c){ if(['flood', 'sink', 'water'].includes(c.opt.spill.kind)){ setHeld('mop'); c.pose = 'mop'; } },
  tick(p, dt, c){ const s = c.opt.spill; if((s.kind === 'flood' || s.kind === 'sink') && Math.random() < dt * 8) emit(s.x + rand(-3, 3), .5, s.z + rand(-2, 2), 0x9fd8ff, rand(-1, 1), rand(1, 3), rand(-1, 1), .5, .4, 8); },
  text:c => ({jars:'Picking 40 sample jars up off the floor', debris:'Sweeping up digester door pieces', glass:'Sweeping up broken glass', water:'Mopping up the puddle', sink:'Mopping up the sink overflow', flood:'Squeegeeing the flood toward the floor drain', oil:'Degreasing the sticky oil spill', sugar:'Scraping up melted gummy goo'})[c.opt.spill.kind] || 'Neutralizing the acid spill',
  done(c){ const s = c.opt.spill; removeSpill(s); S.stats.cleanups++;
    log('ok', ({jars:'Every jar back on the cart, seals checked. Logged them as rush samples', debris:'Swept up the digester pieces; the door is back on its hinges', glass:'Swept the broken glass into the glass-only box', water:'Mopped up the puddle', sink:'Mopped up the sink overflow; nothing in the cabinet underneath got wet', flood:'Floor squeegeed dry. Wet-floor signs out until morning', oil:'Degreased the oil spill with ethanol wipes and bagged them', sugar:'Scraped up the gummy goo and wiped the bench with hot water'})[s.kind] || 'Neutralized the acid spill with sodium bicarbonate; pH paper reads 7, bagged as hazardous waste'); }});
J('watch', {station:null, dur:() => rand(2.5, 4), pose:'watch', noRoll:true,
  walkText:c => `Heading to the ${c.st.name}`,
  text:() => waitLabel(),
  tick(p, dt){ if(Math.random() < dt * .04) emote(pick(['…', 'Hmm', 'Tap tap', '♪']), 'neutral'); }});
