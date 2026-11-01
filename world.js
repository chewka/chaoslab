"use strict";
/* ============ world: room, stations, props (room spans X -48..48, Z -36..36; walkway to Z 48) ============ */
const V = {};   // handles to things that animate

/* ---------- floor, walls, exit ---------- */
{
  const F = canvasTex(96, 72);
  for(let y = 0; y < 72; y++) for(let x = 0; x < 96; x++){
    const odd = ((x >> 3) + (y >> 3)) & 1;
    px(F.g, x, y, odd ? [60,51,104] : [51,43,92], 3);
  }
  const floor = plane(scene, 96, 72, F.t, 0, 0, 0); floor.rotation.x = -PI / 2;
  floor.material.transparent = false;
  box(scene, 99, 4, 75, 0x2a2350, -50, -4, -38, {cast:false});
  box(scene, 20, 4, 12, 0x2a2350, -10, -4, 37, {cast:false});
  box(scene, 20, 0.2, 12, 0x5a5385, -10, 0, 36.5, {cast:false});
  for(let z = 38; z < 48; z += 3) box(scene, 1.2, 0.25, 1.6, 0xf2c94c, -0.6, 0, z, {cast:false});

  const wallTex = (w, h) => {
    const T = canvasTex(w, h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const wy = h - 1 - y; let c;
      if(wy < 2) c = [40,34,74];
      else if(wy < 16) c = (x % 4 === 0 || wy % 4 === 1) ? [100,112,150] : [132,148,182];
      else if(wy < 17) c = [92,98,142];
      else c = [84,74,136];
      px(T.g, x, y, c, 3);
    }
    T.t.needsUpdate = true; return T.t;
  };
  box(scene, 100, 44, 2, 0x2d2650, -50, 0, -38);
  box(scene, 2, 44, 74, 0x2d2650, -50, 0, -36);
  box(scene, 100, 1, 2, 0x8478c0, -50, 44, -38, {cast:false});
  box(scene, 2, 1, 74, 0x8478c0, -50, 44, -36, {cast:false});
  plane(scene, 96, 44, wallTex(96, 44), 0, 22, -35.98).material.transparent = false;
  plane(scene, 72, 44, wallTex(72, 44), -47.98, 22, 0, PI / 2).material.transparent = false;

  // exit door frame + assembly point
  box(scene, 1, 22, 1, 0x3a3360, -9, 0, 35.5); box(scene, 1, 22, 1, 0x3a3360, 8, 0, 35.5);
  box(scene, 18, 2.4, 1, 0x3a3360, -9, 22, 35.5);
  plane(scene, 7, 1.8, signTex(['EXIT'], 42, 11, '#16803f', '#eafff0', 9), 0, 23.2, 36.05, 0, true);
  box(scene, 0.6, 9, 0.6, 0x9aa0bb, 6, 0, 44);
  plane(scene, 6, 2.4, signTex(['ASSEMBLY', 'POINT'], 48, 20, '#16803f', '#eafff0', 8), 6.3, 9.6, 44.65, 0, true);

  // fire alarm strobe on the back wall
  V.strobeMat = new THREE.MeshLambertMaterial({color:0xff3040, emissive:0x200008});
  box(scene, 2, 2, 0.8, 0, -2, 38, -35.9, {material:V.strobeMat});
  box(scene, 2.4, 0.6, 1, 0xf3f3f6, -2.2, 37.4, -36);
}

/* ---------- bench helper (back wall, top surface at y = 11) ---------- */
function bench(g, x0, w){
  box(g, w, 10, 9.4, 0x5a5f8f, x0, 0, -36);
  box(g, w, 1, 10, 0xdde1ee, x0, 10, -36);
  for(let x = x0 + 6; x < x0 + w - 1; x += 6) box(g, 0.3, 8.6, 0.2, 0x3e4272, x, 0.8, -26.65, {cast:false});
  for(let x = x0 + 2; x < x0 + w - 2; x += 6) box(g, 2, 0.6, 0.5, 0xc6cbe0, x, 7.2, -26.7, {cast:false});
}

/* ---------- fume hood (X -47..-27) ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  box(g, 20, 10, 9.4, 0x4f5488, -47, 0, -36);
  box(g, 20, 1, 10, 0xbfc3d4, -47, 10, -36);
  box(g, 1, 21, 10, 0xe3e5ee, -47, 11, -36); box(g, 1, 21, 10, 0xe3e5ee, -28, 11, -36);
  box(g, 20, 5, 10, 0xe3e5ee, -47, 27, -36);
  box(g, 18, 16, 0.6, 0xa9adc2, -46, 11, -36);
  box(g, 18, 0.4, 1, 0xfff8e0, -46, 26.4, -35, {emissive:0x5a5640, cast:false});
  box(g, 18, 8, 0.4, 0xbfe6ff, -46, 19, -26.6, {opacity:0.26});
  box(g, 18, 0.7, 0.7, 0xe3e5ee, -46, 18.6, -26.8);
  box(g, 0.3, 8.6, 0.2, 0x2f3360, -37.15, 0.8, -26.65, {cast:false});
  plane(g, 6, 2.2, signTex(['CORROSIVES'], 54, 20, '#ffd25e', '#1b1631', 9), -42, 6.5, -26.55);
  plane(g, 6, 2.2, signTex(['ACID WASTE'], 54, 20, '#ff9f43', '#1b1631', 9), -32, 6.5, -26.55);
  // bottle-top dispensers: HNO3, HCl, H2O2, HF
  [[-45.5,0xf5efd2,0xe8eaf2],[-43,0xf5efd2,0xffd25e],[-40.5,0xf5efd2,0x6fb7ff],[-37,0xe8f4ff,0xe8445a]].forEach(([x,c,cap]) => {
    box(g, 2, 4.5, 2, c, x, 11, -34.5); box(g, 1.2, 1.4, 1.2, cap, x + 0.4, 15.5, -34.1); box(g, 0.4, 0.4, 1.6, cap, x + 0.8, 16.3, -33.2);
  });
  box(g, 0.9, 2, 0.9, 0xff9f43, -29.5, 11, -28.5);           // calcium gluconate gel
  box(g, 7.4, 0.4, 3.6, 0x9aa0bb, -35, 11, -31);              // vessel rack
  for(let i = 0; i < 10; i++) box(g, 1.1, 2.6, 1.1, 0xf5f5f8, -34.6 + (i % 5) * 1.4, 11.4, -30.6 + Math.floor(i / 5) * 1.6);
  V.hoodMon = canvasTex(32, 12);
  plane(g, 4, 1.5, V.hoodMon.t, -31, 29.5, -25.95, 0, true);
  V.hfSign = plane(g, 5, 1.6, signTex(['HF IN USE'], 50, 16, '#e8445a', '#ffffff', 9), -40, 29.5, -25.95, 0, true);
  V.hoodFume = [-37, 16, -30];
}

/* ---------- microwave digester (bench X -24..-6) ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  V.mwGroup = g;
  bench(g, -24, 18);
  box(g, 12, 13, 4.5, 0xe8eaf2, -21, 11, -35);
  box(g, 1, 13, 4.5, 0xe8eaf2, -21, 11, -30.5);
  box(g, 3.4, 13, 4.5, 0xd8dbe6, -12.4, 11, -30.5);
  box(g, 8.6, 1.2, 4.5, 0xe8eaf2, -20, 22.8, -30.5);
  box(g, 8.6, 1.4, 4.5, 0xe8eaf2, -20, 11, -30.5);
  V.mwGlowMat = new THREE.MeshLambertMaterial({color:0x3a3550, emissive:0x000000});
  box(g, 8.6, 10.4, 0.3, 0, -20, 12.4, -30.6, {material:V.mwGlowMat});
  V.rotor = new THREE.Group(); V.rotor.position.set(-15.7, 12.6, -28.3); g.add(V.rotor);
  V.rotorHome = V.rotor.position.clone();
  box(V.rotor, 5.6, 0.4, 3.8, 0xb9bdd0, -2.8, 0, -1.9);
  for(let i = 0; i < 8; i++){
    const a = i / 8 * PI * 2, x = Math.cos(a) * 2.1, z = Math.sin(a) * 1.4;
    box(V.rotor, 0.9, 2.6, 0.9, 0xf5f5f8, x - 0.45, 0.4, z - 0.45); box(V.rotor, 1.1, 0.5, 1.1, 0x5b8be0, x - 0.55, 3, z - 0.55);
  }
  box(g, 8.6, 0.8, 0.5, 0x2b2f45, -20, 22, -26.3); box(g, 8.6, 1, 0.5, 0x2b2f45, -20, 11.4, -26.3);
  box(g, 0.6, 11.4, 0.5, 0x2b2f45, -20.6, 11.4, -26.3); box(g, 0.6, 11.4, 0.5, 0x2b2f45, -12.6, 11.4, -26.3);
  box(g, 7.4, 9.4, 0.2, 0x6a7aa8, -19.8, 12.4, -26.2, {opacity:0.22});
  box(g, 0.6, 3, 0.8, 0x9aa0bb, -13.2, 16, -25.8);
  V.mwDisp = canvasTex(32, 48);
  plane(g, 2.6, 3.9, V.mwDisp.t, -10.7, 18.6, -25.95, 0, true);
  V.mwLed = new THREE.MeshLambertMaterial({color:0x5fe39a, emissive:0x104020});
  box(g, 0.7, 0.7, 0.2, 0, -11.1, 13.6, -26, {material:V.mwLed});
  box(g, 3, 3, 3, 0x9aa0bb, -7.5, 11, -33);                  // torque station
  V.mwPos = [-15.7, 18, -26];
}

/* ---------- lab sink (X -4.4..0, between the digester bench and the ICP-MS) ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  box(g, 4.4, 10, 8.6, 0x4f5488, -4.4, 0, -36);
  box(g, 4.6, 1, 9.2, 0xc9cede, -4.5, 10, -36);
  box(g, 3.2, 0.3, 5.4, 0x2b3050, -3.8, 10.8, -33.6, {cast:false});          // basin
  box(g, 0.6, 5, 0.6, 0xb9bdd0, -2.5, 11, -35.4);                           // faucet neck
  box(g, 0.6, 0.6, 2.4, 0xb9bdd0, -2.5, 15.4, -35.2);
  box(g, 0.5, 0.8, 0.5, 0xb9bdd0, -2.45, 14.6, -33.1);
  box(g, 1.4, 0.5, 0.5, 0xe8445a, -4, 12.2, -35.5); box(g, 1.4, 0.5, 0.5, 0x5b8be0, -1.8, 12.2, -35.5);
  box(g, 1.2, 1.8, 1.2, 0xe8eaf2, -1.6, 11, -28.6);                         // squirt bottle
  plane(g, 3.6, 1.2, signTex(['SINK'], 30, 10, '#2a2350', '#efeaff', 8), -2.2, 7, -26.75);
  V.sinkPos = [-2.2, 14.5, -32.8];
}

/* ---------- ICP-MS + autosampler + argon (X 0..32) ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  box(g, 24, 15, 12, 0xe9ebf2, 0, 0, -36);
  box(g, 24, 1, 12, 0xc7cbe0, 0, 15, -36);
  box(g, 24, 1.2, 0.3, 0x2b2f45, 0, 3, -24.1, {cast:false});
  box(g, 7.4, 6.4, 0.4, 0x2b2f45, 12.8, 7.8, -24.3);
  // plasma window: a drawn torch, tinted by state
  const T = canvasTex(20, 16);
  T.g.fillStyle = '#120f1e'; T.g.fillRect(0, 0, 20, 16);
  [['#7a3cff',7,6],['#d98cff',5,4.6],['#fff2ff',3,3]].forEach(([c,rx,ry]) => { T.g.fillStyle = c; T.g.beginPath(); T.g.ellipse(10, 8.5, rx, ry, 0, 0, 7); T.g.fill(); });
  T.g.fillStyle = '#b9bdd0'; T.g.fillRect(0, 7, 3, 3);
  T.t.needsUpdate = true;
  V.torchMat = new THREE.MeshBasicMaterial({map:T.t, color:0x2a2540});
  const tw = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.8), V.torchMat); tw.position.set(16.5, 11, -23.85); g.add(tw);
  for(let i = 0; i < 6; i++) box(g, 0.4, 3, 0.2, 0xb9bdd0, 2 + i * 1.3, 11, -24.1, {cast:false});
  plane(g, 6, 1.4, signTex(['ICP-MS'], 42, 10, '#e9ebf2', '#2a2350', 9), 20.5, 14, -23.95);
  V.icpLed = new THREE.MeshLambertMaterial({color:0xff4040, emissive:0x601010});
  box(g, 3, 0.6, 0.2, 0, 19.5, 5.5, -24, {material:V.icpLed});
  box(g, 3, 2, 1.4, 0x2b2f45, 9.5, 9.5, -25.3);                // peristaltic pump
  V.pump = box(g, 1.4, 1.4, 0.4, 0xffd25e, 10.3, 9.8, -24.0);
  box(g, 3, 28, 3, 0xa8adc4, 18, 16, -35);                     // exhaust duct
  box(g, 4, 1, 4, 0x8a90ab, 17.5, 16, -35.5);
  // autosampler cart + rack
  box(g, 9, 9, 7, 0x5a5f8f, 0, 0, -24);
  box(g, 9, 0.6, 7, 0xd8dce8, 0, 9, -24);
  const caps = [0xe8445a,0x5fe39a,0xffd25e,0x6fb7ff,0xf5f5f8,0xff9f43];
  V.tubes = [];
  for(let j = 0; j < 3; j++) for(let i = 0; i < 6; i++){
    const x = 0.9 + i * 1.3, z = -22.9 + j * 1.9;
    box(g, 0.8, 2, 0.8, 0xf1ead2, x, 9.6, z); box(g, 0.9, 0.4, 0.9, caps[(i + j) % 6], x - 0.05, 11.6, z - 0.05);
    V.tubes.push([x + 0.4, z + 0.4]);
  }
  box(g, 0.8, 7, 0.8, 0x2b2f45, 8.2, 9.6, -23.9);
  box(g, 9, 0.6, 0.6, 0x2b2f45, 0, 16.2, -23.9);
  V.asArm = new THREE.Group(); V.asArm.position.set(8, 15.6, -20); g.add(V.asArm);
  box(V.asArm, 1.2, 1, 1.2, 0x3b3f66, -0.6, 0, -0.6);
  V.probe = box(V.asArm, 0.25, 3, 0.25, 0xd8dce8, -0.12, -3, -0.12);
  // argon dewar + helium cylinder
  box(g, 4, 16, 4, 0xc9ced9, 26, 0, -35);
  box(g, 3, 1.5, 3, 0x9aa0bb, 26.5, 16, -34.5);
  box(g, 1, 1.2, 1, 0x5b8be0, 27.5, 17.5, -34);
  V.argGauge = canvasTex(12, 20);
  plane(g, 1.8, 3, V.argGauge.t, 28, 11, -30.95, 0, true);
  plane(g, 3.4, 1.2, signTex(['LIQUID Ar'], 40, 14, '#2a2350', '#efeaff', 8), 28, 7, -30.95);
  box(g, 1.8, 15, 1.8, 0x6b7a8f, 30.6, 0, -35); box(g, 1.2, 1.2, 1.2, 0x9aa0bb, 30.9, 15, -34.7);
  plane(g, 1.6, 1, signTex(['He'], 16, 10, '#6b7a8f', '#ffffff', 8), 31.5, 10, -33.15);
  V.torchPos = [16.5, 11, -23];
}

/* ---------- workstation desk: LIMS + instrument software (X 34..47) ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  box(g, 13, 10, 7.4, 0x5a5f8f, 34, 0, -36);
  box(g, 13, 1, 8, 0xdde1ee, 34, 10, -36);
  box(g, 0.8, 1.6, 0.8, 0x2a2a3a, 37.6, 11, -34); box(g, 0.8, 1.6, 0.8, 0x2a2a3a, 43.4, 11, -34);
  box(g, 5.6, 4.2, 0.6, 0x262638, 35, 12.6, -34.2); box(g, 5.6, 4.2, 0.6, 0x262638, 41, 12.6, -34.2);
  V.limsScr = canvasTex(48, 30); V.icpScr = canvasTex(48, 30);
  plane(g, 5, 3.6, V.limsScr.t, 37.8, 14.7, -33.55, 0, true);
  plane(g, 5, 3.6, V.icpScr.t, 43.8, 14.7, -33.55, 0, true);
  box(g, 5, 0.5, 1.8, 0x30303f, 37.5, 11, -31);
  box(g, 0.8, 1.6, 0.8, 0xffd25e, 45.8, 11, -31);
  box(g, 2, 1.4, 2, 0xe8eaf2, 34.4, 11, -31.6);
  box(g, 12, 0.6, 3, 0x8a6a4a, 34.5, 24, -36);
  [0xe8445a,0x5b8be0,0x5fe39a,0xffd25e,0xb48cff,0x5b8be0,0xff9f43].forEach((c, i) => box(g, 1.2, 3.6, 2.4, c, 35 + i * 1.6, 24.6, -35.7));
  plane(g, 5, 1.2, signTex(['SOPs'], 40, 10, '#8a6a4a', '#efeaff', 8), 40.5, 22.8, -32.95);
}

/* ---------- left wall: water purifier, balance, sample fridge, first aid, eyewash ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  // ultrapure water (Z -20..-8)
  box(g, 7.4, 10, 12, 0x5a5f8f, -48, 0, -20);
  box(g, 8, 1, 12, 0xdde1ee, -48, 10, -20);
  box(g, 2.4, 12, 6, 0xe8eaf2, -48, 14, -17);
  V.waterDisp = canvasTex(40, 16);
  plane(g, 4, 1.6, V.waterDisp.t, -45.55, 23, -14, PI / 2, true);
  box(g, 5, 0.8, 0.8, 0xcfd3e2, -46, 18, -14.4); box(g, 0.6, 1.6, 0.6, 0x9aa0bb, -41.6, 16.4, -14.3);
  box(g, 3, 5, 3, 0xd8ecff, -47, 11, -11.5, {opacity:0.5});
  box(g, 4, 1.2, 5, 0xe0e3ee, -45, 11, -19.5);
  for(let i = 0; i < 8; i++){ const x = -44.6 + (i % 2) * 1.6, z = -19.1 + Math.floor(i / 2) * 1.2; box(g, 0.9, 3, 0.9, 0xf3efe0, x, 12.2, z); box(g, 1, 0.5, 1, 0xff9f43, x - 0.05, 15.2, z - 0.05); }
  // balance on a marble table (Z -3..9)
  [[-47.5,-2.5],[-41,-2.5],[-47.5,8],[-41,8]].forEach(([x,z]) => box(g, 1, 10, 1, 0x3e4272, x, 0, z));
  box(g, 8, 1.5, 12, 0x9c97b6, -48, 10, -3);
  box(g, 3.6, 1.2, 4, 0xe9e9f2, -46.5, 11.5, 1);
  box(g, 3.2, 3.5, 3.2, 0xcfeaff, -46.3, 12.7, 1.4, {opacity:0.25});
  box(g, 1, 0.8, 2, 0x1d2a20, -42.9, 11.6, 2, {emissive:0x1f7a44});
  box(g, 1.4, 0.3, 1.4, 0xd8dce8, -45, 11.5, 6);
  // sample fridge, 4 \u00b0C (Z 13..22)
  box(g, 8, 26, 9, 0xe8eaf2, -48, 0, 13);
  const FR = canvasTex(32, 88);
  FR.g.fillStyle = '#1e2a44'; FR.g.fillRect(0, 0, 32, 88);
  for(let s = 0; s < 4; s++){
    FR.g.fillStyle = '#9aa0bb'; FR.g.fillRect(0, 20 + s * 20, 32, 2);
    for(let j = 0; j < 5; j++){ FR.g.fillStyle = pick(['#c8a070','#8a6a4a','#e8e2d0','#6b5a40','#ffd25e']); FR.g.fillRect(2 + j * 6, 10 + s * 20, 4, 10); FR.g.fillStyle = '#efeaff'; FR.g.fillRect(2 + j * 6, 9 + s * 20, 4, 2); }
  }
  FR.t.needsUpdate = true;
  plane(g, 8, 22, FR.t, -39.95, 12, 17.5, PI / 2, true);
  box(g, 0.6, 6, 0.6, 0x9aa0bb, -39.7, 10, 13.6);
  V.fridgeDisp = canvasTex(28, 10);
  plane(g, 3, 1.1, V.fridgeDisp.t, -39.94, 24.4, 17.5, PI / 2, true);
  // first aid cabinet
  box(g, 1, 5, 3.5, 0xf3f3f6, -48, 16, 23);
  const FA = canvasTex(12, 12); FA.g.fillStyle = '#f3f3f6'; FA.g.fillRect(0, 0, 12, 12); FA.g.fillStyle = '#e8445a'; FA.g.fillRect(4, 1, 4, 10); FA.g.fillRect(1, 4, 10, 4); FA.t.needsUpdate = true;
  plane(g, 3, 3, FA.t, -46.95, 18.5, 24.75, PI / 2, true);
  // eyewash + safety shower
  box(g, 0.8, 32, 0.8, 0xf2c94c, -47.6, 0, 31.6);
  box(g, 4, 0.8, 3, 0x2f9e5b, -47.6, 31, 30);
  box(g, 0.2, 6, 0.2, 0x2f9e5b, -44.4, 25, 31.4); box(g, 1.4, 0.3, 0.3, 0x2f9e5b, -45, 25, 31.3);
  box(g, 0.8, 11, 0.8, 0xf2c94c, -46.4, 0, 29.6);
  box(g, 3.4, 1.2, 3, 0x2f9e5b, -47.6, 11, 28.5);
  plane(g, 6, 2.6, signTex(['EYEWASH', 'SHOWER'], 48, 20, '#16803f', '#eafff0', 8), -47.95, 36, 30, PI / 2, true);
  V.eyewashPos = [-45.5, 13, 30];
  V.showerPos = [-45.6, 30.4, 31.5];
}

/* ---------- back corner: flammables cabinet + acid waste cart (no food in the lab) ---------- */
{
  const g = new THREE.Group(); scene.add(g);
  box(g, 7, 16, 6, 0xf2c94c, 40, 0, 26);
  box(g, 0.3, 14, 0.2, 0x8a6a1a, 43.35, 1, 32, {cast:false});
  plane(g, 5, 2.2, signTex(['FLAMMABLE', 'KEEP FIRE AWAY'], 50, 22, '#f2c94c', '#c0392b', 7), 43.5, 11, 32.05);
  box(g, 7, 1, 5, 0x5a5f8f, 40, 3, 14); box(g, 7, 0.6, 5, 0x5a5f8f, 40, 0.4, 14);
  [[40.6,14.5],[43.6,14.5]].forEach(([x,z]) => { box(g, 2.6, 5, 2.6, 0xe9e4d0, x, 4, z, {opacity:.85}); box(g, 1, .8, 1, 0xff9f43, x + .8, 9, z + .8); });
  plane(g, 5, 1.4, signTex(['ACID WASTE'], 50, 14, '#ff9f43', '#1b1631', 8), 43.5, 2.6, 19.05);
  plane(g, 5, 4, signTex(['NO FOOD', 'OR DRINK', 'IN THE LAB'], 40, 32, '#e8445a', '#ffffff', 7.5), -47.95, 24, 3, PI / 2, true);
}

/* ---------- parking lot + Ada's blue Subaru (outside the exit) ---------- */
{
  const L = canvasTex(56, 20);
  for(let y = 0; y < 20; y++) for(let x = 0; x < 56; x++) px(L.g, x, y, (x % 10 === 0 && y > 3) ? [220,220,200] : [58,58,70], 4);
  L.t.needsUpdate = true;
  const lot = plane(scene, 56, 20, L.t, 14, 0.02, 57); lot.rotation.x = -PI / 2; lot.material.transparent = false;
  box(scene, 56, 4, 20, 0x23202e, -14, -4.02, 47, {cast:false});
  const car = new THREE.Group(); scene.add(car); car.position.set(21, 0, 57.5);
  const blue = 0x2f5fb8, dark = 0x1d2433, glass = 0x9fc6e8;
  box(car, 15, 4, 7, blue, -7.5, 1.6, -3.5);                  // body
  box(car, 10, 3.6, 6.6, blue, -6.2, 5.6, -3.3);               // wagon cabin, long roof
  box(car, 0.4, 3, 6.2, glass, 3.6, 5.9, -3.1);                // windshield
  box(car, 9.4, 2.6, 0.3, glass, -5.9, 6.1, -3.45); box(car, 9.4, 2.6, 0.3, glass, -5.9, 6.1, 3.15);
  box(car, 0.4, 2.6, 6, glass, -6.4, 6.1, -3);                 // rear glass
  box(car, 0.3, 2.8, 0.3, blue, -1.3, 6, -3.5); box(car, 0.3, 2.8, 0.3, blue, -1.3, 6, 3.2);
  box(car, 9, 0.4, 0.4, 0x9aa0bb, -5.8, 9.2, -2.6); box(car, 9, 0.4, 0.4, 0x9aa0bb, -5.8, 9.2, 2.2);   // roof rails
  box(car, 0.6, 0.8, 1.6, 0xfff2b0, 7.3, 3.6, -3.1, {emissive:0x403810}); box(car, 0.6, 0.8, 1.6, 0xfff2b0, 7.3, 3.6, 1.5, {emissive:0x403810});
  box(car, 0.4, 0.8, 1.4, 0xe8445a, -7.8, 4, -3.1); box(car, 0.4, 0.8, 1.4, 0xe8445a, -7.8, 4, 1.7);
  box(car, 15.4, 1, 7.4, dark, -7.7, 1.2, -3.7);               // bumpers / cladding
  [[-5,-3.9],[3,-3.9],[-5,2.9],[3,2.9]].forEach(([x,z]) => box(car, 3, 3, 1, 0x15151a, x, 0, z));
  V.car = {g:car, state:'parked', t:0, home:21};
}

/* ---------- stations: where she stands and which way she faces ---------- */
const ST = {
  hood:        {stand:[-37,-19],   face:PI,     name:'fume hood'},
  microwave:   {stand:[-15.5,-19], face:PI,     name:'microwave digester'},
  icp:         {stand:[16.5,-17],  face:PI,     name:'ICP-MS torch box'},
  autosampler: {stand:[4.5,-10],   face:PI,     name:'autosampler'},
  argon:       {stand:[28.5,-23],  face:PI,     name:'argon dewar'},
  pc:          {stand:[40.5,-21],  face:PI,     name:'LIMS workstation'},
  sink:        {stand:[-7.5,-19],  face:2.74,   name:'lab sink'},
  shower:      {stand:[-39.5,31],  face:-PI/2,  name:'safety shower valve'},
  water:       {stand:[-33,-14],   face:-PI/2,  name:'ultrapure water system'},
  balance:     {stand:[-33,3],     face:-PI/2,  name:'analytical balance'},
  fridge:      {stand:[-33,17.5],  face:-PI/2,  name:'4 \u00b0C sample fridge'},
  aid:         {stand:[-39.5,24.8],face:-PI/2,  name:'first aid kit'},
  eyewash:     {stand:[-39.5,30],  face:-PI/2,  name:'eyewash station'},
  door:        {stand:[0,41],      face:0,      name:'exit door'},
  car:         {stand:[17,50],     face:0,      name:'parking lot'},
  assembly:    {stand:[0,43],      face:0,      name:'assembly point'}
};
// footprints [x0, z0, x1, z1] for path planning
const OBST = [
  [-47,-36,-27,-26], [-24,-36,-6,-26], [-4.4,-36,0,-27], [0,-36,24,-24], [0,-24,9,-17], [26,-35,32.4,-30], [34,-36,47,-28],
  [-48,-20,-40,-8], [-48,-3,-40,9], [-48,13,-40,22], [-48,28,-44,32],
  [40,26,47,32], [40,14,47,19], [13.5,53.5,28.5,61.5],
  [-9,35.5,-8,36.5], [8,35.5,9,36.5]
];
