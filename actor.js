"use strict";
/* ============ actor: the voxel scientist (same grid as the Blender model) ============ */
const COL = {Hair:0xf4d35e, HairDark:0xd9ac3f, Skin:0xf2c29a, Black:0x15151a, Shine:0xeef3ff, Coat:0xf3f3f6,
             Sleeve:0xdcdde8, Lapel:0xa9b3c6, Shirt:0x4b7bd1, Pants:0x3b4056, Shoe:0x5a3a1f, Frame:0xf7f7fb};
const GLOVE = 0x7b6cff;   // purple nitrile
const CH = new Map();     // blender-space "x,y,z" (y = depth, 0 = front) -> {p: part, c: colour, k: key}
function bx(p, k, x0,x1, y0,y1, z0,z1){ for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) for(let z=z0;z<=z1;z++) CH.set(x+','+y+','+z, {p, c:COL[k], k}); }
bx('legA','Shoe',2,4,1,4,0,0); bx('legA','Pants',2,4,2,4,1,4);
bx('legB','Shoe',7,9,1,4,0,0); bx('legB','Pants',7,9,2,4,1,4);
bx('body','Coat',1,10,1,5,5,13);
bx('body','Shirt',5,6,1,1,9,13);
bx('body','Lapel',4,4,1,1,8,12); bx('body','Lapel',7,7,1,1,8,12);
bx('body','Lapel',3,3,1,1,6,8);  bx('body','Lapel',8,8,1,1,6,8);
bx('body','Lapel',2,2,1,1,9,9);  bx('body','Lapel',9,9,1,1,9,9);
bx('body','Shirt',9,9,1,1,10,10);
bx('body','Skin',4,7,2,4,14,14); bx('body','Shirt',5,6,1,1,14,14);
bx('armR','Sleeve',0,0,2,4,7,13); bx('armR','Lapel',0,0,2,4,6,6); bx('armR','Skin',0,0,2,3,4,5);
bx('armL','Sleeve',11,11,2,4,7,13); bx('armL','Lapel',11,11,2,4,6,6); bx('armL','Skin',11,11,2,3,4,5);
bx('head','Skin',3,8,1,6,15,21);
bx('head','Black',5,6,1,1,16,16);
bx('head','Skin',5,6,0,0,17,17);
bx('head','Hair',3,8,1,6,23,23); bx('head','Hair',2,9,0,7,22,22); bx('head','Hair',4,7,0,0,21,21);
bx('head','Hair',2,3,0,0,20,21); bx('head','Hair',8,9,0,0,20,21);
bx('head','Hair',1,1,0,7,13,21); bx('head','Hair',10,10,0,7,13,21);
bx('head','Hair',2,2,1,7,14,21); bx('head','Hair',9,9,1,7,14,21);
bx('head','Hair',1,10,6,7,12,22);
// white-framed glasses: frame around each lens, eyes visible through them
bx('head','Frame',2,4,0,0,18,19); bx('head','Frame',7,9,0,0,18,19); bx('head','Frame',5,6,0,0,19,19);
bx('head','Black',3,3,0,0,18,18); bx('head','Black',8,8,0,0,18,18);
bx('head','Frame',1,1,1,3,19,19); bx('head','Frame',10,10,1,3,19,19);
for(let z=14;z<=20;z++){ bx('head', z%2 ? 'Hair':'HairDark', 1,1,0,0,z,z); bx('head', z%2 ? 'HairDark':'Hair', 10,10,0,0,z,z); }
for(const x of [2,5,8]) bx('head','HairDark',x,x,7,7,12,18);

const FACES = [
  {n:[1,0,0],  c:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},
  {n:[-1,0,0], c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]},
  {n:[0,1,0],  c:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]},
  {n:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
  {n:[0,0,1],  c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]},
  {n:[0,0,-1], c:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]}
];
function voxGeometry(cells, ox, oy, oz){
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for(const [k, hex] of cells){
    const [x, y, z] = k.split(',').map(Number);
    c.setHex(hex);
    for(const f of FACES){
      if(cells.has((x+f.n[0])+','+(y+f.n[1])+','+(z+f.n[2]))) continue;
      const q = f.c.map(p => [x+p[0]-ox, y+p[1]-oy, z+p[2]-oz]);
      for(const i of [0,1,2,0,2,3]){ pos.push(...q[i]); nor.push(...f.n); col.push(c.r, c.g, c.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const voxMat = new THREE.MeshLambertMaterial({vertexColors:true});
const CENTER = [6, 0, -3.5];      // three-space: X = x, Y = z, Z = -y-1, so the front faces +Z
const SOOT = new THREE.Color(0x2b2530), sootTmp = new THREE.Color();
function partGeo(name, pivot, glove, soot){
  const cells = new Map();
  for(const [k, v] of CH){
    if(v.p !== name) continue;
    const [x, y, z] = k.split(',').map(Number);
    let c = glove && v.k === 'Skin' ? GLOVE : v.c;
    // soot: everything goes charcoal except the glasses, which stay comically clean
    if(soot && v.k !== 'Frame' && v.k !== 'Black') c = sootTmp.setHex(c).lerp(SOOT, v.k === 'Hair' || v.k === 'HairDark' ? .35 : .72).getHex();
    cells.set(x+','+z+','+(-y-1), c);
  }
  return voxGeometry(cells, ...pivot);
}
const charRoot = new THREE.Group(); scene.add(charRoot);
charRoot.rotation.order = 'YXZ';
const P = {}, ARMGEO = {}, SOOTGEO = {};
function makePart(name, pivot, parent, parentPivot){
  const geo = partGeo(name, pivot, false);
  const mesh = new THREE.Mesh(geo, voxMat); mesh.castShadow = true; mesh.receiveShadow = true;
  if(name === 'armR' || name === 'armL') ARMGEO[name] = {skin:geo, glove:partGeo(name, pivot, true), mesh};
  if(name === 'head' || name === 'body') SOOTGEO[name] = {clean:geo, soot:partGeo(name, pivot, false, true), mesh};
  const g = new THREE.Group(); g.add(mesh);
  g.position.set(pivot[0]-parentPivot[0], pivot[1]-parentPivot[1], pivot[2]-parentPivot[2]);
  parent.add(g); return g;
}
const BODY_P = [6, 5, -3.5];
P.legA = makePart('legA', [3.5, 5, -3.5], charRoot, CENTER);
P.legB = makePart('legB', [8.5, 5, -3.5], charRoot, CENTER);
P.body = makePart('body', BODY_P, charRoot, CENTER);
P.head = makePart('head', [6, 14, -3.5], P.body, BODY_P);
P.armR = makePart('armR', [0.5, 13.5, -3.5], P.body, BODY_P);
P.armL = makePart('armL', [11.5, 13.5, -3.5], P.body, BODY_P);
const hand = new THREE.Group(); hand.position.set(0, -8.6, 1.9); P.armR.add(hand);

function setGloves(on){
  if(S.gloves === on) return;
  S.gloves = on;
  for(const k of ['armR', 'armL']) ARMGEO[k].mesh.geometry = on ? ARMGEO[k].glove : ARMGEO[k].skin;
}

function setSoot(on){
  if(!!S.soot === on) return;
  S.soot = on;
  for(const k in SOOTGEO) SOOTGEO[k].mesh.geometry = on ? SOOTGEO[k].soot : SOOTGEO[k].clean;
}

/* ---------- held props ---------- */
const PROPS = {};
function prop(name, build){ const g = new THREE.Group(); build(g); g.visible = false; hand.add(g); PROPS[name] = g; }
prop('mug',    g => { box(g, 2, 2.2, 2, 0xff6b8b, -1, -1.1, -1); box(g, 1.6, 0.2, 1.6, 0x4a2a14, -0.8, 1, -0.8); box(g, 0.5, 1.2, 0.6, 0xff6b8b, 1, -0.6, -0.3); });
prop('bottle', g => { box(g, 1.8, 3, 1.8, 0xf5efd2, -0.9, -1.6, -0.9); box(g, 1, 0.8, 1, 0xffd25e, -0.5, 1.4, -0.5); });
prop('vessel', g => { box(g, 1.4, 2.8, 1.4, 0xf5f5f8, -0.7, -1.4, -0.7); box(g, 1.8, 0.7, 1.8, 0x5b8be0, -0.9, 1.4, -0.9); });
prop('tubes',  g => { box(g, 3, 0.6, 2, 0xe0e3ee, -1.5, -1.2, -1); for(let i = 0; i < 4; i++){ box(g, 0.6, 2, 0.6, 0xf3efe0, -1.3 + i * 0.75, -0.6, -0.3); box(g, 0.7, 0.4, 0.7, 0xff9f43, -1.35 + i * 0.75, 1.4, -0.35); } });
prop('tray',   g => { box(g, 3.6, 0.5, 2.6, 0x9aa0bb, -1.8, -1.2, -1.3); [0xc8a070,0x8a6a4a,0xe8e2d0].forEach((c, i) => box(g, 0.9, 1.6, 0.9, c, -1.4 + i * 1.1, -0.7, -0.45)); });
prop('food',   g => { box(g, 2.2, 0.5, 1.8, 0xe8c27a, -1.1, -0.6, -0.9); box(g, 2.3, 0.3, 1.9, 0x5fae5b, -1.15, -0.1, -0.95); box(g, 2.2, 0.5, 1.8, 0xe8c27a, -1.1, 0.2, -0.9); });
prop('mop',    g => { box(g, 0.4, 6, 0.4, 0xc8a070, -0.2, -3, -0.2); box(g, 2.2, 0.8, 1, 0x9fd8ff, -1.1, -3.6, -0.5); });
prop('wrench', g => { box(g, 0.5, 3.4, 0.5, 0x9aa0bb, -0.25, -1.7, -0.25); box(g, 1.2, 0.6, 0.6, 0x9aa0bb, -0.6, 1.5, -0.3); });
function setHeld(name){
  if(S.held === name) return;
  for(const k in PROPS) PROPS[k].visible = (k === name);
  S.held = name;
}

/* ---------- emote bubble ---------- */
const EMO = canvasTex(64, 24);
const emoSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:EMO.t, depthTest:false, transparent:true}));
emoSprite.scale.set(16, 6, 1); emoSprite.renderOrder = 10; emoSprite.visible = false; scene.add(emoSprite);
let emoT = 0;
function emote(text, kind){
  const g = EMO.g; g.clearRect(0, 0, 64, 24);
  g.fillStyle = '#14102a'; g.fillRect(1, 1, 62, 17); g.fillRect(28, 18, 8, 3); g.fillRect(30, 21, 4, 2);
  g.fillStyle = '#ffffff'; g.fillRect(2, 2, 60, 15); g.fillRect(29, 17, 6, 2); g.fillRect(31, 19, 2, 2);
  g.fillStyle = kind === 'bad' ? '#e8445a' : kind === 'good' ? '#1f9e5b' : '#2a2350';
  g.font = '600 11px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 32, 10);
  EMO.t.needsUpdate = true; emoSprite.visible = true; emoT = 2.4;
}

/* ---------- poses (targets for the part rotations) ---------- */
const POSES = {
  type:    (p,t) => ({armR:-1.38+Math.sin(t*22)*.07, armRz:.16, armL:-1.38+Math.sin(t*22+1.7)*.07, armLz:-.16, head:.16, body:.06}),
  bench:   (p,t) => ({armR:-1.32+Math.sin(t*2.6)*.08, armRz:.1, armL:-1.25+Math.sin(t*2.1+1)*.07, armLz:-.1, head:.42, body:.18}),
  pour:    (p,t) => ({armR:-1.25, armRz:.32, armL:-1.05, armLz:-.25, head:.38, body:.12}),
  reach:   (p,t) => ({armR:-1.55+Math.sin(t*3)*.08, armRz:.05, armL:-.2, head:.05, body:.04}),
  torque:  (p,t) => ({armR:-1.3+Math.sin(t*5)*.18, armRz:.25+Math.sin(t*5)*.15, armL:-1.2, armLz:-.2, head:.3, body:.12}),
  watch:   (p,t) => ({armR:-1.0, armRz:.62, armL:-1.0, armLz:-.62, head:.12, headY:Math.sin(t*.8)*.25}),
  eat:     (p,t) => { const k = Math.max(0, Math.sin(t*2.4)); return {armR:-1.5-k*.95, armRz:.15+k*.45, armL:-.25, head:.05-k*.08}; },
  sip:     (p,t) => { const k = Math.max(0, Math.sin(t*1.6)); return {armR:-1.4-k*1.05, armRz:.15+k*.45, armL:-.1, head:-k*.15}; },
  wash:    (p,t) => ({armR:-2.2+Math.sin(t*6)*.15, armRz:.55, armL:-2.2+Math.sin(t*6+1)*.15, armLz:-.55, head:.65, body:.55}),
  bandage: (p,t) => ({armR:-1.1+Math.sin(t*4)*.1, armRz:.5, armL:-1.3, armLz:-.35, head:.5, body:.15}),
  mop:     (p,t) => ({armR:-.9+Math.sin(t*5)*.35, armRz:.2, armL:-.9+Math.sin(t*5)*.35, armLz:-.3, head:.35, body:.3, headY:Math.sin(t*5)*.1}),
  crouch:  (p,t) => ({armR:-.75+Math.sin(t*5)*.2, armL:-.75+Math.sin(t*5+2)*.2, head:.5, body:.6}),
  idle:    (p,t) => ({head:Math.sin(t*1.3)*.05, armR:Math.sin(t*2)*.03, armL:-Math.sin(t*2)*.03}),
  cheer:   (p,t) => ({armR:-2.9+Math.sin(t*14)*.15, armRz:-.35, armL:-2.9+Math.sin(t*14+1)*.15, armLz:.35, head:-.25}),
  hurt:    (p,t) => ({armR:-.9, armRz:.7, armL:-.9, armLz:-.7, body:-.2, head:-.15, headY:Math.sin(t*28)*.18}),
  facepalm:(p,t) => ({armR:-2.5, armRz:.65, armL:-.15, head:.25, body:.05}),
  spray:   (p,t) => ({armR:-1.45+Math.sin(t*9)*.12, armRz:.1+Math.sin(t*4)*.2, armL:-1.3+Math.sin(t*9)*.1, armLz:-.15, head:.1, body:.08}),
  flail:   (p,t) => ({armR:-2.6+Math.sin(t*18)*.5, armRz:.4, armL:-2.6+Math.sin(t*18+2)*.5, armLz:-.4, head:-.3, body:-.15, headY:Math.sin(t*10)*.3}),
  ko:      () => ({armR:-.3, armL:-.3, head:-.2})
};
const pose = {legA:0, legB:0, armR:0, armRz:0, armL:0, armLz:0, head:0, headY:0, body:0};
function applyPose(target, dt){
  const k = 1 - Math.exp(-dt * 14);
  for(const key in pose) pose[key] += ((target[key] || 0) - pose[key]) * k;
  P.legA.rotation.x = pose.legA; P.legB.rotation.x = pose.legB;
  P.armR.rotation.x = pose.armR; P.armR.rotation.z = pose.armRz;
  P.armL.rotation.x = pose.armL; P.armL.rotation.z = pose.armLz;
  P.head.rotation.x = pose.head; P.head.rotation.y = pose.headY;
  P.body.rotation.x = pose.body;
  // keep held props upright while the arm swings
  const upright = -pose.armR - pose.body;
  for(const k2 in PROPS){ PROPS[k2].rotation.x = upright; PROPS[k2].rotation.z = -pose.armRz; }
}
function react(kind){ S.react = {pose:kind, t:1.3}; }
