// MicClear's shared physics, numbers and 3D parts.
//
// Sources for the numbers used across the chapters:
//  - Speed of sound in air at 20 °C: 343 m/s. Characteristic impedance of air ρc ≈ 413 Pa·s/m at 20 °C.
//  - 0 dB SPL = 20 µPa rms (ISO 1683), so 94 dB SPL = 1 Pa: the pressure microphone sensitivities are quoted at.
//  - Dynamic stage microphone: Shure SM58 specification sheet: −54.5 dBV/Pa (1.85 mV/Pa), rated impedance
//    150 Ω (300 Ω actual), 50 Hz to 15 kHz, length 162 mm, head 51 mm across.
//  - Large condenser: Neumann U 87 Ai data sheet (cardioid): 28 mV/Pa, equivalent noise 12 dB-A,
//    maximum SPL 117 dB for 0.5 % THD (127 dB with the pad), 200 Ω.
//  - Ribbon: Royer R-121 specification (royerlabs.com/r-121): −47 dBV/Pa (4.47 mV/Pa), 2.5 µm aluminium ribbon,
//    300 Ω, maximum SPL above 135 dB.
//  - MEMS: TDK InvenSense ICS-40180 data sheet: −38 dBV/Pa (12.6 mV/Pa), SNR 65 dBA (so 29 dBA self-noise),
//    acoustic overload point 124 dB SPL, package 3.5 × 2.65 × 0.98 mm.
//  - Phantom power P48 (IEC 61938): 48 V through two matched 6.8 kΩ resistors, at most 10 mA.
//  - XLR pins (AES14-1992, IEC 60268-12): 1 shield, 2 positive ("hot"), 3 negative ("cold").
//  - First-order polar patterns: g(θ) = A + (1 − A)·cos θ (omni A = 1, cardioid 0.5, supercardioid 0.37,
//    hypercardioid 0.25, figure-8 A = 0). See Eargle, "The Microphone Book", ch. 5.
//  - Proximity effect: the pressure-gradient part of a spherical wave grows as (1 + 1/(jkr)), k = 2πf/c.
//  - Interference tube (shotgun): a line of length L has the response sinc(π·L·f·(1 − cos θ)/c).
import { THREE, M, rod, latheX, box, torus, sphere, canvasTexture, clamp } from './kit.js';
import { audio } from './ui.js';

export const TAU = Math.PI * 2;
export const C_AIR = 343;                 // m/s at 20 °C
export const RHO_C = 413;                 // Pa·s/m, air at 20 °C
export const P0 = 20e-6;                  // Pa rms, 0 dB SPL
export const P_ATM = 101325;              // Pa, one standard atmosphere
export const KB = 1.380649e-23;           // J/K
export const dbToPa = (L) => P0 * Math.pow(10, L / 20);
export const paToDb = (p) => 20 * Math.log10(Math.max(1e-12, p) / P0);
export const dBV = (v) => 20 * Math.log10(Math.max(1e-12, v));
export const dBu = (v) => 20 * Math.log10(Math.max(1e-12, v) / 0.7746);     // 0 dBu = 0.7746 V rms
export const undB = (d) => Math.pow(10, d / 20);
// Thermal (Johnson) noise voltage of a resistance R over bandwidth B at room temperature.
export const johnson = (R, B = 20000, T = 293) => Math.sqrt(4 * KB * T * R * B);

// The four kinds of microphone, each with one real, published example.
export const MICS = {
  dynamic: {
    name: 'Dynamic', long: 'Moving coil (dynamic)', like: 'Shure SM58', sens: 1.85e-3, z: 300, maxSpl: 150, power: 'none',
    how: 'A coil glued to the diaphragm moves in a magnet’s gap. Voltage = B × l × v.', color: '#ffb547',
  },
  condenser: {
    name: 'Condenser', long: 'Condenser (capacitor)', like: 'Neumann U 87 Ai', sens: 28e-3, z: 200, noise: 12, maxSpl: 117, power: '48 V phantom',
    how: 'A charged diaphragm and backplate form a capacitor. As the gap changes, so does the voltage.', color: '#8ef0ff',
  },
  ribbon: {
    name: 'Ribbon', long: 'Ribbon', like: "Royer R-121", sens: 4.47e-3, z: 300, maxSpl: 135, power: 'none',
    how: 'A strip of foil thinner than a hair hangs between magnets. The foil itself is the conductor.', color: '#c49bff',
  },
  mems: {
    name: 'MEMS', long: 'MEMS (silicon chip)', like: 'TDK ICS-40180', sens: 12.6e-3, z: 200, noise: 29, maxSpl: 124, power: '1.5 to 3.6 V',
    how: 'A condenser etched into silicon, with its amplifier chip in the same tiny package.', color: '#5ce1a9',
  },
};
// Self-noise as an equivalent sound level. Passive microphones have only the thermal noise of their
// own resistance; active ones publish an A-weighted figure.
export function selfNoise(id) {
  const m = MICS[id];
  return m.noise ?? paToDb(johnson(m.z) / m.sens);
}
export const micVolts = (id, spl) => MICS[id].sens * dbToPa(spl);

// ---------------------------------------------------------------- polar patterns
export const TUBE_L = 0.2;                 // m, a short shotgun's interference tube
export const PATTERNS = {
  omni: { A: 1, name: 'Omni', build: 'Sealed back: it feels pressure only.' },
  cardioid: { A: 0.5, name: 'Cardioid', build: 'Rear ports with a small delay: pressure plus gradient.' },
  super: { A: 0.37, name: 'Supercardioid', build: 'A little more gradient: tighter front, small rear lobe.' },
  fig8: { A: 0, name: 'Figure-8', build: 'Open on both sides: pressure gradient only.' },
  shotgun: { A: 0.37, name: 'Shotgun', build: 'A slotted tube in front: off-axis sound cancels itself.', tube: TUBE_L },
};
// Signed response of a pattern at angle θ (radians from the front) and frequency f.
export function patternResp(id, theta, f = 1000) {
  const p = PATTERNS[id];
  let g = p.A + (1 - p.A) * Math.cos(theta);
  if (p.tube) {
    const x = (Math.PI * p.tube * f * (1 - Math.cos(theta))) / C_AIR;
    g *= x < 1e-6 ? 1 : Math.sin(x) / x;
  }
  return g;
}
export const patternDb = (id, theta, f) => Math.max(-40, 20 * Math.log10(Math.max(1e-4, Math.abs(patternResp(id, theta, f)))));
// Bass boost of a directional microphone close to a small source (on axis), in dB.
export function proximityDb(id, f, r) {
  const A = PATTERNS[id].A, kr = (TAU * f * r) / C_AIR;
  return 10 * Math.log10(1 + ((1 - A) / kr) ** 2);
}

// ---------------------------------------------------------------- small helpers
export const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const fmtHz = (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 9950 ? 0 : 1).replace(/\.0$/, '') + ' kHz' : Math.round(f) + ' Hz');
export const fmtV = (v) => {
  const a = Math.abs(v);
  if (a >= 1) return v.toFixed(2) + ' V';
  if (a >= 1e-3) return (v * 1e3).toFixed(a >= 0.1 ? 0 : a >= 0.01 ? 1 : 2) + ' mV';
  if (a >= 1e-6) return (v * 1e6).toFixed(a >= 1e-4 ? 0 : 1) + ' µV';
  return (v * 1e9).toFixed(0) + ' nV';
};
export const fmtPa = (p) => (p >= 1 ? p.toFixed(p >= 10 ? 0 : 1) + ' Pa' : p >= 1e-3 ? (p * 1e3).toFixed(p >= 0.1 ? 0 : 1) + ' mPa' : (p * 1e6).toFixed(0) + ' µPa');
export const fmtM = (m) => (m >= 1 ? m.toFixed(2) + ' m' : m >= 0.01 ? (m * 100).toFixed(m >= 0.1 ? 0 : 1) + ' cm' : m >= 1e-3 ? (m * 1e3).toFixed(1) + ' mm' : m >= 1e-6 ? (m * 1e6).toFixed(m >= 1e-5 ? 0 : 2) + ' µm' : (m * 1e9).toFixed(m >= 1e-8 ? 0 : 1) + ' nm');
export const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
// How loud is that? A rough everyday scale (typical published levels).
export function loudLike(L) {
  if (L < 35) return 'a whisper';
  if (L < 55) return 'a quiet room';
  if (L < 70) return 'talking at 1 m';
  if (L < 85) return 'a busy street';
  if (L < 100) return 'singing right at the grille';
  if (L < 115) return 'a shout at the grille';
  if (L < 130) return 'inside a kick drum';
  return 'beside a jet engine';
}

// ---------------------------------------------------------------- layout
export const inReel = () => document.body.classList.contains('gb-reel');
export const recording = () => inReel() || /[?&]reel=1/.test(location.search);
// On a phone-width stage: hide minor labels and nudge the picture down, clear of the readout.
export function fitNarrow(stage, minor = [], y0 = -0.14) {
  const narrow = stage.host.clientWidth < 560;
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const y = narrow && !inReel() ? y0 : 0;
  if (!stage.shift || stage.shift[1] !== y) stage.setShift(0, y);
  return narrow;
}
// On a phone the readout sits over the model, so keep its headline and first rows only.
export function compact(html, stage, rows = 2) {
  if (stage.host.clientWidth >= 560) return html;
  let k = 0;
  return html.replace(/<small>[\s\S]*?<\/small>/g, '').replace(/<div class="row">[\s\S]*?<\/div>/g, (m) => (++k <= rows ? m : ''));
}
// A flat board with a live canvas chart, `width` scene units wide.
export function boardMesh(w, h, draw, width) {
  const b = canvasTexture(w, h, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * h) / w), new THREE.MeshBasicMaterial({ map: b.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
  m.renderOrder = 2;
  return { mesh: m, redraw: b.redraw };
}
export function panel(g, w, h, title, sub = '') {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(8,10,15,.9)'; g.beginPath(); g.roundRect ? g.roundRect(1, 1, w - 2, h - 2, 20) : g.rect(0, 0, w, h); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'left';
  if (title) { g.fillStyle = '#e8eef8'; g.font = '600 26px sans-serif'; g.fillText(title, 24, 40); }
  if (sub) { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '18px sans-serif'; g.fillText(sub, 24, 66); }
}
export function text(g, s, x, y, { font = '18px sans-serif', col = 'rgba(255,255,255,.75)', align = 'left' } = {}) { g.font = font; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; }
// Boards sit beside the model on a wide screen. In the tall reel video they move to a second place.
export function reelBoards(list) {
  const r = inReel();
  list.forEach(([b, pos, scale = 1, rotY = 0]) => {
    if (!b.home) b.home = { p: b.mesh.position.clone(), r: b.mesh.rotation.clone(), s: b.mesh.scale.x };
    if (r) { b.mesh.position.set(...pos); b.mesh.scale.setScalar(scale); b.mesh.rotation.set(0, rotY, 0); }
    else { b.mesh.position.copy(b.home.p); b.mesh.scale.setScalar(b.home.s); b.mesh.rotation.copy(b.home.r); }
  });
}

// ---------------------------------------------------------------- sound (optional, quiet)
// One soft sine tone, only after a tap, never while recording, and silent when the box is muted.
let ctx = null, voice = null;
export const tone = {
  play(f, sec = 1.2, level = 0.08) {
    if (audio.muted || recording()) return false;
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      this.stop();
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = clamp(f, 20, 18000);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.04);
      g.gain.setValueAtTime(level, t + sec - 0.1); g.gain.linearRampToValueAtTime(0, t + sec);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + sec + 0.05);
      voice = { o, g };
      return true;
    } catch { return false; }
  },
  stop() { try { voice?.o.stop(); } catch { /* already stopped */ } voice = null; },
};

// ---------------------------------------------------------------- air
// Air molecules for a longitudinal sound wave: dots that swing back and forth around home positions.
export function airDots(parent, n, homeFn, color = 0x9fc0ff, r = 0.03) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), M.glow(color, { transparent: true, opacity: 0.85 }), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; parent.add(mesh);
  const home = [];
  for (let i = 0; i < n; i++) home.push(homeFn(i, n));
  const o = new THREE.Object3D();
  return {
    mesh, home,
    step(shift) {
      for (let i = 0; i < n; i++) { const h = home[i], d = shift(h, i); o.position.set(h.x + (d.x ?? d), h.y + (d.y ?? 0), h.z + (d.z ?? 0)); o.scale.setScalar(d.s ?? 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
// Expanding wavefront rings (flat, in the XZ plane) from a point: the classic top-down ripple.
export function ripples(parent, n = 6, color = 0x8ef0ff) {
  const rings = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72), M.ghost(color, 0.5));
    m.rotation.x = -Math.PI / 2; parent.add(m); rings.push(m);
  }
  // phase 0→1 moves each ring from r0 out to r1; amp fades them.
  return {
    rings,
    step(phase, r0, r1, amp = 1, arc = null) {
      rings.forEach((m, i) => {
        const k = ((phase + i / n) % 1 + 1) % 1, r = r0 + (r1 - r0) * k;
        m.scale.setScalar(r); m.material.opacity = 0.55 * amp * (1 - k) * Math.min(1, k * 8);
        if (arc) m.visible = true;
      });
    },
  };
}

// ---------------------------------------------------------------- props
// A faceless mannequin, feet at the origin, facing +x. 1 unit = 1 m when s = 1; the mouth is at 1.52 m.
export function makePerson({ shirt = 0xe0774a, pants = 0x2b3242, skin = 0xc99a72, hair = 0x1c1512, s = 1 } = {}) {
  const g = new THREE.Group();
  const cloth = M.matte(shirt), jeans = M.matte(pants), sk = M.matte(skin, { roughness: 0.6 });
  const cap = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 12), mat); m.castShadow = true; return m; };
  const torso = cap(0.15 * s, 0.62 * s, cloth); torso.position.y = 1.16 * s; torso.scale.z = 1.25; g.add(torso);
  const neck = cap(0.045 * s, 0.12 * s, sk); neck.position.y = 1.48 * s; g.add(neck);
  const head = sphere(0.105 * s, sk, 24); head.scale.set(0.95, 1.12, 0.95); head.position.y = 1.6 * s; g.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.112 * s, 20, 10, 0, TAU, 0, 1.4), M.matte(hair)); hm.position.set(-0.012 * s, 1.612 * s, 0); hm.rotation.z = 0.35; g.add(hm);
  const nose = sphere(0.018 * s, sk, 10); nose.position.set(0.1 * s, 1.59 * s, 0); g.add(nose);
  const mouth = box(0.01 * s, 0.012 * s, 0.045 * s, M.matte(0x7a3b34)); mouth.position.set(0.096 * s, 1.535 * s, 0); g.add(mouth);
  for (const z of [-1, 1]) {
    const arm = cap(0.045 * s, 0.6 * s, cloth); arm.position.set(0.02 * s, 1.12 * s, z * 0.23 * s); arm.rotation.x = z * 0.1; g.add(arm);
    const hand = sphere(0.045 * s, sk, 10); hand.position.set(0.02 * s, 0.8 * s, z * 0.26 * s); g.add(hand);
    const leg = cap(0.065 * s, 0.86 * s, jeans); leg.position.set(0, 0.45 * s, z * 0.09 * s); g.add(leg);
    const shoe = box(0.22 * s, 0.07 * s, 0.1 * s, M.matte(0x1b1d22)); shoe.position.set(0.05 * s, 0.035 * s, z * 0.09 * s); g.add(shoe);
  }
  g.mouthY = 1.535 * s; g.mouthX = 0.1 * s; g.head = head; g.mouth = mouth;
  return g;
}
// A plain PA speaker cabinet facing +x: a box, a woofer and a horn. Width w, height h, depth d.
export function makeSpeaker(w = 0.45, h = 0.75, d = 0.38, color = 0x1b1e25) {
  const g = new THREE.Group();
  const cab = box(d, h, w, M.matte(color)); g.add(cab);
  const ring = new THREE.Mesh(new THREE.RingGeometry(w * 0.3, w * 0.37, 36), M.matte(0x40454f)); ring.rotation.y = Math.PI / 2; ring.position.set(d / 2 + 0.003, -h * 0.17, 0); g.add(ring);
  const cone = latheX([[-0.07, 0.05], [0, w * 0.31]], M.matte(0x2a2e36, { side: THREE.DoubleSide }), { seg: 36 }); cone.position.set(d / 2 - 0.004, -h * 0.17, 0); g.add(cone);
  const cap = sphere(0.055, M.matte(0x4a4f5a), 16); cap.scale.x = 0.5; cap.position.set(d / 2 - 0.07, -h * 0.17, 0); g.add(cap);
  const horn = box(0.02, h * 0.16, w * 0.62, M.matte(0x30343d)); horn.position.set(d / 2 + 0.006, h * 0.29, 0); g.add(horn);
  g.cone = cone; g.capDome = cap; g.cabinet = cab; g.woofY = -h * 0.17; g.front = d / 2;
  return g;
}

// A small pencil-style microphone on a floor stand, pointing along +x. 1 unit = 1 m. Returns the group
// and the capsule position. `tube` adds a slotted interference tube (a shotgun).
export function makeMicOnStand(h = 1.5) {
  const g = new THREE.Group(), steel = M.metal(0x8f96a3, { roughness: 0.4 }), dark = M.matte(0x1b1d22);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.025, 32), dark); base.position.y = 0.012; base.castShadow = true; g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, h - 0.05, 12), steel); pole.position.y = (h - 0.05) / 2; pole.castShadow = true; g.add(pole);
  const clip = box(0.07, 0.035, 0.04, dark); clip.position.set(0, h - 0.03, 0); g.add(clip);
  const head = new THREE.Group(); head.position.y = h; g.add(head);
  const body = rod(-0.09, 0.07, 0.0125, 0.0125, M.metal(0x3b4049, { roughness: 0.45 }), 20); head.add(body);
  const capsule = rod(0.07, 0.1, 0.0125, 0.0125, M.metal(0xc9ced6, { roughness: 0.3 }), 20); head.add(capsule);
  const tubeM = rod(0.1, 0.1 + TUBE_L, 0.011, 0.011, M.metal(0x4a505b, { roughness: 0.5 }), 16); head.add(tubeM);
  const slots = new THREE.Group(); head.add(slots);
  for (let i = 0; i < 9; i++) for (const z of [-1, 1]) { const sl = box(0.012, 0.006, 0.002, M.matte(0x07080c)); sl.position.set(0.118 + i * 0.02, 0, z * 0.0112); slots.add(sl); }
  g.head = head; g.tube = tubeM; g.slots = slots; g.capsule = capsule; g.micBody = body;
  g.setTube = (on) => { tubeM.visible = on; slots.visible = on; };
  g.setTube(false);
  return g;
}

// ---------------------------------------------------------------- the stage microphone (chapter 1)
// A generic handheld dynamic microphone, built along +x with the connector at x = 0 and the ball grille
// at the far end. 1 unit = 25 mm, so it is 6.5 units (162 mm) long with a 51 mm ball: the size of a
// typical stage vocal microphone. No maker's shapes or marks.
export const MIC_U = 0.025;               // metres per unit
export function makeStageMic() {
  const g = new THREE.Group();
  const bodyMat = M.metal(0x4a4f59, { roughness: 0.5, metalness: 0.75, transparent: true, opacity: 1 });
  const gold = M.metal(0xe2b65a, { roughness: 0.3 });
  const copper = M.metal(0xc8763a, { roughness: 0.35, emissive: new THREE.Color(0xff8a30), emissiveIntensity: 0 });

  // Handle: a die-cast tapered tube.
  const handle = new THREE.Group(); g.add(handle);
  const shell = latheX([[0, 0.36], [0.06, 0.4], [3.3, 0.5], [4.15, 0.6], [4.42, 0.74], [4.5, 0.74], [4.5, 0.66], [4.2, 0.54], [3.3, 0.44], [0.06, 0.34], [0, 0.34]], bodyMat, { seg: 56 });
  shell.material.side = THREE.DoubleSide; handle.add(shell);

  // XLR insert: an insulating disc and three pins pointing out of the tail.
  const xlr = new THREE.Group(); g.add(xlr);
  xlr.add(rod(0.3, 0.5, 0.335, 0.335, M.plastic(0x15171c), 32));
  const pins = [];
  [[0.16, 0.0], [-0.1, 0.15], [-0.1, -0.15]].forEach(([y, z], i) => {
    const p = rod(-0.02, 0.5, 0.045, 0.045, gold, 12); p.position.y = y; p.position.z = z; xlr.add(p); pins.push(p);
    p.userData.n = i + 1;
  });
  xlr.add(rod(0.5, 0.56, 0.3, 0.3, M.metal(0x8f96a3), 32));

  // Output transformer: an iron core with a copper winding, about half way up the handle.
  const trafo = new THREE.Group(); trafo.position.x = 2.35; g.add(trafo);
  const core = box(0.62, 0.5, 0.44, M.metal(0x6d7380, { roughness: 0.6 })); trafo.add(core);
  const hole = box(0.3, 0.2, 0.46, M.matte(0x101216)); trafo.add(hole);
  const wind = rod(-0.17, 0.17, 0.3, 0.3, copper.clone(), 28); wind.scale.set(1, 0.72, 1.0); trafo.add(wind);
  for (const z of [-0.08, 0.08]) { const w1 = rod(-1.75, -0.31, 0.02, 0.02, M.plastic(z < 0 ? 0xd9433b : 0x4a78d6), 8); w1.position.z = z; w1.position.y = 0.05; trafo.add(w1); }

  // Capsule ("cartridge"): rubber shock mount, pot magnet, voice coil and diaphragm.
  const mount = new THREE.Group(); g.add(mount);
  mount.add(latheX([[4.2, 0.2], [4.25, 0.55], [4.7, 0.6], [4.95, 0.56], [4.95, 0.5], [4.7, 0.52], [4.3, 0.48], [4.28, 0.2]], M.matte(0x22252b, { side: THREE.DoubleSide }), { seg: 40 }));
  const magnet = new THREE.Group(); g.add(magnet);
  // Soft-iron cup with a ring-shaped gap, and the magnet as its centre pole.
  magnet.add(latheX([[4.72, 0.0], [4.72, 0.48], [5.2, 0.48], [5.2, 0.33], [4.9, 0.33], [4.9, 0.0]], M.metal(0x7b828f, { roughness: 0.5 }), { seg: 40 }));
  const poleS = rod(4.9, 5.05, 0.25, 0.25, M.plastic(0x4a78d6), 28), poleN = rod(5.05, 5.2, 0.25, 0.25, M.plastic(0xd9433b), 28);
  magnet.add(poleS, poleN);
  const coil = new THREE.Group(); g.add(coil);
  for (let i = 0; i < 5; i++) { const t = torus(0.29, 0.02, copper, 40); t.rotation.y = Math.PI / 2; t.position.x = 5.08 + i * 0.04; coil.add(t); }
  const dia = new THREE.Group(); g.add(dia);
  const mylar = new THREE.MeshPhysicalMaterial({ color: 0xdfe9f5, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.8, side: THREE.DoubleSide, clearcoat: 0.6 });
  const prof = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push([5.3 + 0.1 * Math.cos(a), 0.29 * Math.sin(a)]); }       // the dome
  for (let i = 1; i <= 8; i++) { const k = i / 8; prof.push([5.3 + 0.035 * Math.sin(k * Math.PI), 0.29 + 0.21 * k]); }                   // the rolled surround
  dia.add(latheX(prof, mylar, { seg: 48 }));
  dia.add(torus(0.5, 0.025, M.plastic(0x15171c), 48).rotateY(Math.PI / 2).translateZ(0));
  dia.children[1].position.x = 5.3;

  // Foam pop filter lining the inside of the ball.
  const foamMat = M.matte(0x34373d, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const foamMesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 36, 20, 0, TAU, 0, Math.PI * 0.6), foamMat);
  foamMesh.rotation.z = -Math.PI / 2; foamMesh.position.x = 5.5;
  const foam = new THREE.Group(); foam.add(foamMesh); g.add(foam);

  // Ball grille: steel mesh with a band round its middle and a threaded ring at its base.
  const grille = new THREE.Group(); g.add(grille);
  const meshMat = new THREE.MeshStandardMaterial({ color: 0xc8ced8, metalness: 0.85, roughness: 0.35, wireframe: true });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.02, 44, 30, 0, TAU, 0, Math.PI * 0.76), meshMat);
  ball.rotation.z = -Math.PI / 2; ball.position.x = 5.5; grille.add(ball);
  const band = torus(1.03, 0.045, M.metal(0xb9bec8), 64); band.rotation.y = Math.PI / 2; band.position.x = 5.5; grille.add(band);
  grille.add(latheX([[4.5, 0.74], [4.52, 0.78], [4.76, 0.8], [4.78, 0.74]], M.metal(0xb9bec8), { seg: 48 }));

  return { group: g, handle, shell, bodyMat, xlr, pins, trafo, mount, magnet, coil, dia, foam, foamMat, grille, copper, ball };
}

// ---------------------------------------------------------------- cut-away solids
// Half of a solid of revolution about the x axis (the half away from the viewer, z ≤ 0), with flat
// caps on the cut face so it reads as a sliced solid. profile: closed outline as [x, r] pairs.
export function cutX(profile, mat, { seg = 40, cap = true } = {}) {
  const g = new THREE.Group();
  const closed = [...profile, profile[0]];
  const side = latheX(closed, mat, { seg, phiStart: Math.PI / 2, phiLength: Math.PI });
  side.material.side = THREE.DoubleSide; g.add(side);
  if (cap) for (const sg of [1, -1]) {
    const sh = new THREE.Shape(profile.map(([x, r]) => new THREE.Vector2(x, sg * r)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); m.castShadow = true; g.add(m);
  }
  return g;
}
// Half a ring of wire around the x axis (z ≤ 0), for coils shown in a cut-away.
export function halfTurn(R, r, mat) {
  const geo = new THREE.TorusGeometry(R, r, 8, 28, Math.PI); geo.rotateX(-Math.PI / 2); geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
}
