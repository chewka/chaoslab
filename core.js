"use strict";
/* ============ core: utilities, renderer, helpers, particles, state ============ */
const $ = s => document.querySelector(s);
const PI = Math.PI;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const fmt = (v, d = 1) => Number(v).toFixed(d);
const fmtv = v => v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
function wpick(list){
  const ws = list.map(x => typeof x.w === 'function' ? x.w() : (x.w ?? 1));
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for(let i = 0; i < list.length; i++){ r -= ws[i]; if(r <= 0) return list[i]; }
  return list[list.length - 1];
}

/* ---------- renderer / camera ---------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:false});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1631);

const HOME_ZOOM = 1.22;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
camera.position.set(100, 92, 126);
camera.zoom = HOME_ZOOM;
const controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(-2, 8, 4);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.3;
controls.minAzimuthAngle = 0.08; controls.maxAzimuthAngle = 1.48;
controls.minZoom = 0.6; controls.maxZoom = 4.5;
controls.screenSpacePanning = true;

let pixelSize = 3;
function resize(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(Math.max(1, Math.floor(w / pixelSize)), Math.max(1, Math.floor(h / pixelSize)), false);
  const aspect = w / h;
  const vert = aspect < 1 ? 160 / aspect : Math.max(125, 215 / aspect);
  camera.left = -vert * aspect / 2; camera.right = vert * aspect / 2;
  camera.top = vert / 2; camera.bottom = -vert / 2;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xc4bbff, 0x2a2142, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 0.72);
sun.position.set(55, 110, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {left:-85, right:85, top:85, bottom:-85, near:1, far:330});
sun.shadow.bias = -0.0008;
scene.add(sun);
const plasmaLight = new THREE.PointLight(0xd9b8ff, 0, 30); plasmaLight.position.set(16.5, 11, -19); scene.add(plasmaLight);
const mwLight = new THREE.PointLight(0xff8a3d, 0, 24); mwLight.position.set(-15.5, 17, -22); scene.add(mwLight);
const alarmLight = new THREE.PointLight(0xff3040, 0, 90); alarmLight.position.set(-1, 38, -28); scene.add(alarmLight);
const screenGlow = new THREE.PointLight(0x6fd0ff, 0.4, 26); screenGlow.position.set(40.5, 16, -26); scene.add(screenGlow);

/* ---------- mesh helpers ---------- */
const geoCache = new Map(), matCache = new Map();
function mat(hex, o = {}){
  const key = hex + '|' + (o.opacity ?? 1) + '|' + (o.emissive ?? 0) + '|' + !!o.basic;
  if(!matCache.has(key)){
    const p = {color:hex};
    if(o.opacity != null){ p.transparent = true; p.opacity = o.opacity; p.depthWrite = false; }
    matCache.set(key, o.basic ? new THREE.MeshBasicMaterial(p) : new THREE.MeshLambertMaterial(Object.assign(p, {emissive:o.emissive ?? 0})));
  }
  return matCache.get(key);
}
// box positioned by its min corner, in voxel units
function box(parent, w, h, d, hex, x, y, z, o = {}){
  const k = w + '|' + h + '|' + d;
  if(!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  const m = new THREE.Mesh(geoCache.get(k), o.material || mat(hex, o));
  m.position.set(x + w / 2, y + h / 2, z + d / 2);
  m.castShadow = o.cast !== false && o.opacity == null; m.receiveShadow = true;
  parent.add(m); return m;
}
function canvasTex(w, h){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return {c, g:c.getContext('2d'), t};
}
function plane(parent, w, h, tex, x, y, z, ry = 0, basic = false){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    basic ? new THREE.MeshBasicMaterial({map:tex, transparent:true}) : new THREE.MeshLambertMaterial({map:tex, transparent:true}));
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = !basic;
  parent.add(m); return m;
}
function px(g, x, y, rgb, j = 0){
  const n = j ? ((Math.random() * 2 - 1) * j) | 0 : 0;
  g.fillStyle = `rgb(${rgb[0] + n},${rgb[1] + n},${rgb[2] + n})`; g.fillRect(x, y, 1, 1);
}
const signs = [];
function signTex(lines, w, h, bg, fg, size){
  const T = canvasTex(w, h);
  const draw = () => {
    const g = T.g; g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = `700 ${size}px "IBM Plex Mono", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = h / lines.length;
    lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.5) + 0.5));
    T.t.needsUpdate = true;
  };
  draw(); signs.push(draw);
  return T.t;
}

/* ---------- particles ---------- */
const pGeo = new THREE.BoxGeometry(1, 1, 1);
const parts = [];
for(let i = 0; i < 320; i++){
  const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, depthWrite:false}));
  m.visible = false; scene.add(m); parts.push({m, life:0, max:1, size:1, grav:0, v:new THREE.Vector3()});
}
function emit(x, y, z, color, vx, vy, vz, life, size, grav = 0){
  const p = parts.find(q => q.life <= 0); if(!p) return;
  p.m.position.set(x, y, z); p.m.material.color.setHex(color); p.v.set(vx, vy, vz);
  p.life = p.max = life; p.size = size; p.grav = grav; p.m.visible = true;
}
function burst(x, y, z, color, n, speed, grav = 0){
  for(let i = 0; i < n; i++) emit(x, y, z, color, rand(-speed, speed), rand(0.2, 1.2) * speed, rand(-speed, speed), rand(0.5, 1.1), rand(0.4, 0.8), grav);
}
function updateParticles(dt){
  for(const p of parts){
    if(p.life <= 0) continue;
    p.life -= dt;
    if(p.life <= 0){ p.m.visible = false; continue; }
    p.v.y -= p.grav * dt * (S.gravMul ?? 1);
    p.m.position.addScaledVector(p.v, dt);
    const k = p.life / p.max;
    p.m.scale.setScalar(p.size * (0.45 + 0.55 * k));
    p.m.material.opacity = Math.min(1, k * 1.6);
  }
}

/* ---------- simulation state ---------- */
const SHIFT_LEN = 600;        // 21:00 \u2192 07:00, one sim minute per real second at 1\u00d7
const GOOD_CHANCE = 0.08;
const S = {};
const M = {};
let batch = null;
let cur = null;               // the job the scientist is doing right now

/* ---------- cannabis matrices: As, Cd, Hg, Pb by closed-vessel microwave + ICP-MS (results in \u00b5g/g) ---------- */
// el: [symbol, isotope, typical level, action limit, LOQ]
const LIM_INH = {As:0.2, Cd:0.2, Hg:0.1, Pb:0.5};    // inhalable products
const LIM_ORAL = {As:1.5, Cd:0.5, Hg:3.0, Pb:0.5};   // edibles, tinctures, topicals
const LOQ = {As:0.02, Cd:0.01, Hg:0.01, Pb:0.02};
const elList = (typ, lim) => ['As','Cd','Hg','Pb'].map(e => [e, {As:75, Cd:111, Hg:202, Pb:208}[e], typ[e], lim[e], LOQ[e]]);
const MATRICES = [
  {key:'flower', name:'Cannabis flower', inhal:true, method:'SOP HM-001 closed-vessel MW', acids:'2 mL DI water + 2 mL HNO\u2083 + 2 mL H\u2082O\u2082',
   temp:200, ramp:20, hold:20, cool:20, mass:0.500, organic:true, hf:false, hcl:true,
   names:['Indoor flower','Outdoor flower','Pre-roll','Smalls','Trim','Shake','Greenhouse flower'],
   el:elList({As:0.03, Cd:0.05, Hg:0.004, Pb:0.06}, LIM_INH), digest:'clear pale yellow'},
  {key:'conc', name:'Concentrates + vape oil', inhal:true, method:'SOP HM-002 closed-vessel MW', acids:'2 mL DI water + 2 mL HNO\u2083 + 2 mL H\u2082O\u2082',
   temp:210, ramp:20, hold:20, cool:20, mass:0.250, organic:true, hf:false, hcl:true,
   names:['Badder','Budder','Live Rosin','Distillate','Live resin','Shatter','Vape cart'],
   el:elList({As:0.02, Cd:0.02, Hg:0.003, Pb:0.09}, LIM_INH), digest:'clear golden yellow'}
];
// samples per digestion log; + Blank X or Y + one _dup = 24 vessels (outer ring), 32 or 41 (full rotor)
const BATCH_SIZES = [22, 30, 39];
const FOODS = [
  {n:'tacos from the late-night truck'}, {n:'a drive-thru burger'}, {n:'pho from the 24-hour place'}, {n:'leftovers eaten in the car with the seat back'},
  {n:'a burrito the size of a forearm'}, {n:'diner pancakes'}, {n:'teriyaki from the strip mall'}, {n:'a gas-station sandwich and a quiet parking lot'}
];
