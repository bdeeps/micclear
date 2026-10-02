// Chapter 3: four ways to turn a moving diaphragm into a voltage.
//   Dynamic:   EMF = B × l × v (Faraday induction): the voltage follows the coil's VELOCITY.
//   Ribbon:    the same law, but the diaphragm itself (a 2.5 µm aluminium foil) is the conductor.
//   Condenser: a charged capacitor, C = ε0·A/d. With the charge held, ΔV = V × Δd/d: the voltage follows
//              the diaphragm's DISPLACEMENT. Needs a polarising voltage (48 V phantom) or an electret.
//   MEMS:      a condenser etched in silicon, biased by a charge pump in its amplifier chip.
// Makers tune the diaphragm so that the output follows the sound pressure either way: a dynamic's
// diaphragm is damped so its velocity tracks pressure, a condenser's is stretched tight so its
// displacement tracks pressure (Eargle, The Microphone Book, ch. 3 and 4).
// Sensitivities, noise and maximum levels are the published figures listed in mic.js.
// Noise floor of the two passive types: thermal noise of their own resistance (300 Ω, 20 kHz, 20 °C).
import { THREE, M, box, rod, torus, tube, arrow, clamp, approach, lerp } from '../kit.js';
import { MICS, selfNoise, dbToPa, dBV, fmtV, fmtPa, TAU, airDots, rnd, cutX, halfTurn, boardMesh, panel, text, fitNarrow, compact, reelBoards, inReel } from '../mic.js';

const TYPES = ['dynamic', 'condenser', 'ribbon', 'mems'];
const POWERED = { condenser: true, mems: true };
const Y0 = 3.72;
const GAP_UM = 25;                         // a studio condenser's gap, of the order of 25 µm (typical 20 to 40)
const copperMat = () => M.metal(0xc8763a, { roughness: 0.35, emissive: new THREE.Color(0xff8a30), emissiveIntensity: 0 });

// ---------------------------------------------------------------- the four models
// Each is built around the origin with sound arriving along +x onto a diaphragm that faces −x.
function makeDynamic(stage) {
  const g = new THREE.Group(), iron = M.metal(0x7b828f, { roughness: 0.55 }), cu = copperMat();
  g.add(cutX([[1.05, 0], [1.05, 1.2], [-0.6, 1.2], [-0.6, 0.67], [-0.3, 0.67], [-0.3, 1.0], [0.8, 1.0], [0.8, 0]], iron));
  g.add(cutX([[-0.6, 0], [-0.6, 0.45], [0.2, 0.45], [0.2, 0]], M.metal(0x9aa1ad, { roughness: 0.5 })));
  g.add(cutX([[0.2, 0], [0.2, 0.45], [0.5, 0.45], [0.5, 0]], M.plastic(0xd9433b)));
  g.add(cutX([[0.5, 0], [0.5, 0.45], [0.8, 0.45], [0.8, 0]], M.plastic(0x4a78d6)));
  g.add(cutX([[-1.0, 1.15], [-1.0, 1.32], [-0.6, 1.32], [-0.6, 1.2], [-0.86, 1.2], [-0.86, 1.15]], M.plastic(0x1b1d22)));
  const mov = new THREE.Group(); g.add(mov);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push([-0.92 - 0.2 * Math.cos(a), 0.56 * Math.sin(a)]); }
  for (let i = 1; i <= 10; i++) { const k = i / 10; prof.push([-0.92 - 0.07 * Math.sin(k * Math.PI), 0.56 + 0.6 * k]); }
  const skin = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, r]) => new THREE.Vector2(r, x)), 40, Math.PI / 2, Math.PI).rotateZ(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xdfe9f5, roughness: 0.25, transparent: true, opacity: 0.8, side: THREE.DoubleSide, clearcoat: 0.6 }));
  mov.add(skin);
  for (let i = 0; i < 9; i++) { const t = halfTurn(0.56, 0.028, cu); t.position.x = -0.86 + i * 0.062; mov.add(t); }
  // Field across the gap, from the centre pole out to the ring.
  for (const sg of [1, -1]) for (const x of [-0.52, -0.38]) { const a = arrow(0x8ef0ff, 0.2, 0.08, 0.012); a.position.set(x, sg * 0.46, 0.02); if (sg < 0) a.rotation.z = Math.PI; g.add(a); }
  const labels = [
    stage.label('Diaphragm', [-1.5, 1.4, 0], g, 'hot'),
    stage.label('Voice coil in the gap', [-1.2, -1.45, 0], g, 'hot'),
    stage.label('Magnet', [0.5, 0, 0.1], g),
    stage.label('Iron cup', [1.6, 1.3, 0], g),
  ];
  return { g, labels, faceX: -1.2, rotY: -0.42, set(d, v) { mov.position.x = d * 0.12; cu.emissiveIntensity = Math.abs(v) * 1.8; } };
}

function makeCondenser(stage) {
  const g = new THREE.Group(), brass = M.metal(0xc9a24d, { roughness: 0.35 });
  g.add(cutX([[-0.42, 1.2], [-0.42, 1.36], [0.55, 1.36], [0.55, 1.2]], brass));
  g.add(cutX([[-0.3, 1.08], [-0.3, 1.2], [0.4, 1.2], [0.4, 1.08]], M.plastic(0xe9e4d6)));                 // insulating ring
  // Backplate: a thick metal disc drilled with holes (they show as slots in the cut face).
  const plate = new THREE.Group(); g.add(plate);
  const bm = M.metal(0xb9bec8, { roughness: 0.4 });
  for (const [a, b] of [[0, 0.16], [0.28, 0.5], [0.62, 0.84], [0.96, 1.08]]) plate.add(cutX([[-0.08, a], [-0.08, b], [0.26, b], [0.26, a]], bm));
  plate.add(cutX([[0.26, 0], [0.26, 1.08], [0.36, 1.08], [0.36, 0]], bm));
  // Diaphragm: gold-coated plastic film, a few thousandths of a millimetre thick.
  const SEG = 28, RINGS = 12, R = 1.2, pos = [], idx = [];
  for (let r = 0; r <= RINGS; r++) for (let a = 0; a <= SEG; a++) { const rr = (r / RINGS) * R, th = Math.PI / 2 + (a / SEG) * Math.PI; pos.push(-0.3, -rr * Math.sin(th), rr * Math.cos(th)); }
  for (let r = 0; r < RINGS; r++) for (let a = 0; a < SEG; a++) { const i0 = r * (SEG + 1) + a, i1 = i0 + 1, j0 = i0 + SEG + 1, j1 = j0 + 1; idx.push(i0, j0, i1, i1, j0, j1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const skin = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xffd98a, metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  g.add(skin);
  // Charges: + on the backplate, − on the diaphragm, drawn on the cut face.
  const plus = [], minus = [];
  for (const y of [-0.73, -0.39, -0.08, 0.08, 0.39, 0.73, 1.02, -1.02]) {
    const p = stage.label('+', [-0.02, y, 0.03], g); Object.assign(p.element.style, { padding: '0 4px', border: '0', background: 'none', color: '#ffd166', fontWeight: '700', fontSize: '15px' }); plus.push(p);
    const m = stage.label('−', [-0.42, y, 0.03], g); Object.assign(m.element.style, { padding: '0 4px', border: '0', background: 'none', color: '#8ef0ff', fontWeight: '700', fontSize: '15px' }); minus.push(m);
  }
  // The impedance converter: a small board with one transistor right behind the capsule.
  const pcb = box(0.08, 1.5, 1.0, M.plastic(0x1f6b4a)); pcb.position.set(1.05, 0, -0.5); g.add(pcb);
  const fet = box(0.22, 0.3, 0.3, M.plastic(0x15171c)); fet.position.set(0.9, 0.3, -0.3); g.add(fet);
  const wire = tube([[0.36, 0, -0.02], [0.6, 0.12, -0.1], [0.8, 0.3, -0.3]], 0.02, M.metal(0xe2b65a));
  g.add(wire);
  const labels = [
    stage.label('Diaphragm: gold on film', [-1.6, 1.35, 0], g, 'hot'),
    stage.label('Backplate with holes', [1.9, -0.75, 0], g, 'hot'),
    stage.label('Gap: 0.025 mm, drawn huge', [-1.2, -1.5, 0], g),
    stage.label('Amplifier', [1.9, 0.75, 0], g),
  ];
  const P = geo.attributes.position;
  return {
    g, labels, faceX: -0.55, rotY: -0.42,
    set(d, v, on) {
      for (let r = 0; r <= RINGS; r++) { const q = r / RINGS, x = -0.3 + d * 0.11 * (1 - q * q); for (let a = 0; a <= SEG; a++) P.setX(r * (SEG + 1) + a, x); }
      P.needsUpdate = true; geo.computeVertexNormals();
      plus.forEach((l) => { l.visible = on; }); minus.forEach((l, i) => { l.visible = on; l.position.x = -0.42 + d * 0.11 * (1 - (Math.abs([-0.73, -0.39, -0.08, 0.08, 0.39, 0.73, 1.02, -1.02][i]) / R) ** 2); });
    },
  };
}

function makeRibbon(stage) {
  const g = new THREE.Group(), H = 2.1, W = 0.34;
  // Two pole pieces, one each side of the ribbon: the field runs across it, from N to S.
  const n = box(0.5, H, 0.5, M.plastic(0xd9433b)), s = box(0.5, H, 0.5, M.plastic(0x4a78d6));
  n.position.z = -0.47; s.position.z = 0.47; g.add(n, s);
  for (const y of [-1, 1]) { const clamp1 = box(0.42, 0.16, 1.44, M.plastic(0x1b1d22)); clamp1.position.set(0, y * (H / 2 + 0.08), 0); g.add(clamp1); }
  const SEG = 90, pos = [], idx = [];
  for (let i = 0; i <= SEG; i++) for (const z of [-W / 2, W / 2]) pos.push(0, -H / 2 + (i / SEG) * H, z);
  for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const foil = new THREE.MeshStandardMaterial({ color: 0xe6ebf2, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide, emissive: new THREE.Color(0xff8a30), emissiveIntensity: 0 });
  g.add(new THREE.Mesh(geo, foil));
  for (const y of [-0.7, 0, 0.7]) { const a = arrow(0x8ef0ff, 0.42, 0.12, 0.012); a.rotation.x = Math.PI / 2; a.position.set(-0.3, y, -0.21); g.add(a); }
  // Step-up transformer below: the ribbon alone gives far too little voltage.
  const tr = box(0.5, 0.42, 0.6, M.metal(0x6d7380, { roughness: 0.6 })); tr.position.set(0, -H / 2 - 0.4, 0); g.add(tr);
  const wind = rod(-0.16, 0.16, 0.27, 0.27, copperMat(), 24); wind.position.copy(tr.position); g.add(wind);
  const labels = [
    stage.label('Ribbon: foil 2.5 µm thick', [0.4, H / 2 + 0.32, 1.2], g, 'hot'),
    stage.label('N', [0.27, 0.9, -0.47], g), stage.label('S', [0.27, 0.9, 0.47], g),
    stage.label('Field across the ribbon', [0.6, -0.2, 1.6], g),
    stage.label('Transformer', [0.4, -H / 2 - 0.5, 1.2], g),
  ];
  const P = geo.attributes.position;
  return {
    g, labels, faceX: -0.45, rotY: 1.0,
    set(d, v) {
      for (let i = 0; i <= SEG; i++) { const q = i / SEG, x = 0.035 * Math.sin(q * 62) + d * 0.2 * Math.sin(q * Math.PI); P.setX(i * 2, x); P.setX(i * 2 + 1, x); }
      P.needsUpdate = true; geo.computeVertexNormals();
      foil.emissiveIntensity = Math.abs(v) * 0.9;
    },
  };
}

function makeMems(stage) {
  // A bottom-port MEMS microphone, 3.5 × 2.65 × 0.98 mm, drawn about 1,000 times life size and cut open.
  const g = new THREE.Group(), gold = M.metal(0xe2b65a, { roughness: 0.3 }), si = M.metal(0x6f7c93, { roughness: 0.35, metalness: 0.6 });
  const pcb = M.plastic(0x1f6b4a);
  // Circuit-board base (standing upright here, so the sound hole faces the sound) with its port.
  for (const [y, h] of [[1.0, 1.2], [-0.95, 1.3]]) { const b = box(0.16, h, 2.2, pcb); b.position.set(-0.6, y, -1.1); g.add(b); }
  for (const [z, d] of [[-1.5, 1.4]]) { const b = box(0.16, 0.5, d, pcb); b.position.set(-0.6, 0.15, z); g.add(b); }
  const padM = [0.9, -0.3, -1.1].map((y) => { const p = box(0.03, 0.34, 0.5, gold); p.position.set(-0.69, y === -0.3 ? -1.2 : y, -0.6); g.add(p); return p; });
  void padM;
  // Metal lid, cut away at the front.
  const lidM = M.metal(0xb9bec8, { roughness: 0.3 });
  const back = box(1.05, 3.2, 0.05, lidM); back.position.set(0.0, 0, -2.2); g.add(back);
  const top = box(0.05, 3.2, 2.2, M.metal(0xb9bec8, { roughness: 0.3, transparent: true, opacity: 0.35, depthWrite: false })); top.position.set(0.52, 0, -1.1); g.add(top);
  for (const y of [-1.6, 1.6]) { const w = box(1.05, 0.05, 2.2, lidM); w.position.set(0, y, -1.1); g.add(w); }
  // The silicon die over the port: walls round an etched cavity, then backplate and diaphragm on top.
  const die = new THREE.Group(); die.position.set(-0.52, 0.15, 0); g.add(die);
  for (const y of [-0.4, 0.4]) { const w = box(0.5, 0.22, 0.9, si); w.position.set(0.25, y, -0.45); die.add(w); }
  const wb = box(0.5, 0.58, 0.2, si); wb.position.set(0.25, 0, -0.8); die.add(wb);
  const bp = new THREE.Group(); die.add(bp);
  for (const [a, b] of [[0, 0.06], [0.12, 0.2], [0.26, 0.31]]) bp.add(cutX([[0.36, a], [0.36, b], [0.4, b], [0.4, a]], M.metal(0x9aa1ad, { roughness: 0.4 }), { seg: 24 }));
  const SEG = 20, RINGS = 6, R = 0.3, pos = [], idx = [];
  for (let r = 0; r <= RINGS; r++) for (let a = 0; a <= SEG; a++) { const rr = (r / RINGS) * R, th = Math.PI / 2 + (a / SEG) * Math.PI; pos.push(0.49, -rr * Math.sin(th), rr * Math.cos(th)); }
  for (let r = 0; r < RINGS; r++) for (let a = 0; a < SEG; a++) { const i0 = r * (SEG + 1) + a, i1 = i0 + 1, j0 = i0 + SEG + 1, j1 = j0 + 1; idx.push(i0, j0, i1, i1, j0, j1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  die.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })));
  // The amplifier chip (ASIC) beside it, joined by gold bond wires.
  const asic = box(0.3, 0.7, 0.8, M.plastic(0x15171c)); asic.position.set(-0.37, -1.05, -0.5); g.add(asic);
  const glowW = M.metal(0xe2b65a, { roughness: 0.3, emissive: new THREE.Color(0xffc24a), emissiveIntensity: 0 });
  for (const z of [-0.3, -0.6]) g.add(tube([[-0.02, -0.25, z], [0.22, -0.5, z], [-0.05, -0.8, z], [-0.22, -0.85, z]], 0.014, glowW, false, 30));
  g.add(tube([[-0.22, -1.25, -0.4], [0.05, -1.4, -0.4], [-0.3, -1.52, -0.4], [-0.52, -1.5, -0.4]], 0.014, glowW, false, 30));
  const labels = [
    stage.label('Sound hole', [-1.3, 0.15, 0], g),
    stage.label('Silicon diaphragm, under 1 mm', [1.9, 0.35, 0], g, 'hot'),
    stage.label('Package: 3.5 mm long', [1.7, 1.35, 0], g),
    stage.label('Amplifier chip', [1.4, -1.05, 0], g),
  ];
  const P = geo.attributes.position;
  return {
    g, labels, faceX: -0.75, rotY: -0.5,
    set(d, v, on) {
      for (let r = 0; r <= RINGS; r++) { const q = r / RINGS, x = 0.49 + d * 0.05 * (1 - q * q); for (let a = 0; a <= SEG; a++) P.setX(r * (SEG + 1) + a, x); }
      P.needsUpdate = true; geo.computeVertexNormals();
      glowW.emissiveIntensity = on ? Math.abs(v) * 1.2 : 0;
    },
  };
}

const MAKERS = { dynamic: makeDynamic, condenser: makeCondenser, ribbon: makeRibbon, mems: makeMems };
const LAW = { dynamic: 'follows the coil’s speed', ribbon: 'follows the ribbon’s speed', condenser: 'follows the gap', mems: 'follows the gap' };

export default {
  id: 'transducers',
  short: 'Four ways',
  title: 'Four ways to make a voltage',
  subtitle: 'Dynamic, condenser, ribbon and MEMS: same job, four different tricks.',
  view: { pos: [0.3, 4.7, 10.4], target: [0, 3.7, 0] },
  learn: `<p>Every microphone has a diaphragm. The clever part is turning its movement into electricity. There are four common ways.</p>
    <p><b>Dynamic.</b> A coil on the diaphragm moves in a magnet's gap. A wire moving through a magnetic field gets a voltage: that is <a href="https://glassbox.how/faradayclear/">Faraday's law</a>. It is tough, cheap and needs no power, so it rules the stage. <a href="https://glassbox.how/speakerclear/">A loudspeaker</a> is the same thing run backwards.</p>
    <p><b>Condenser.</b> A film coated with gold sits a hair's width from a metal <b>backplate</b>. Together they are a <b>capacitor</b> holding an electric charge. When sound moves the film, the gap changes and so does the voltage. The film is far lighter than a coil, so it catches fine detail. But it needs power: usually <b>48 volts</b> sent up the cable, called phantom power. An <b>electret</b> condenser has its charge frozen into the plastic for life, which is why tiny lapel mics can run from a small battery.</p>
    <p><b>Ribbon.</b> A strip of crinkled aluminium foil, thinner than a hair, hangs between two magnets. The foil is both the diaphragm and the wire. Its output is tiny, so a transformer steps it up. Ribbons sound smooth and hear equally from front and back.</p>
    <p><b>MEMS.</b> A condenser carved out of silicon, the way computer chips are made. The diaphragm is under a millimetre wide. An amplifier chip sits beside it in a metal box a few millimetres long. Every phone has three or more: one for your voice and the others to cancel noise.</p>
    <p>Long before these came the <b>carbon microphone</b> of the first telephones: sound squeezed carbon grains and changed how well they carried current. See <a href="https://glassbox.how/telephoneclear/">TelephoneClear</a>.</p>
    <p class="tip"><b>Try it:</b> switch the power off on the condenser. Then turn the sound up until each microphone starts to distort. Which one gives up first?</p>`,
  terms: [
    { t: 'Dynamic microphone', d: 'A microphone that makes its voltage with a coil moving in a magnetic field.' },
    { t: 'Condenser microphone', d: 'A microphone whose diaphragm is one plate of a charged capacitor. Condenser is an old word for capacitor.' },
    { t: 'Electret', d: 'A plastic that holds an electric charge permanently, the way a magnet holds magnetism.' },
    { t: 'Ribbon microphone', d: 'A microphone whose diaphragm is a thin metal foil hanging in a magnetic field.' },
    { t: 'MEMS', d: 'Micro-electro-mechanical system: a tiny moving machine etched out of silicon.' },
    { t: 'Sensitivity', d: 'How many millivolts a microphone gives for one pascal of sound pressure.' },
    { t: 'Self-noise', d: 'The faint hiss a microphone makes on its own, given as the sound level that would make the same signal.' },
  ],
  defaults: { type: 'dynamic', spl: 94, power: true },
  controls: [
    { key: 'type', type: 'seg', label: 'Kind of microphone', options: TYPES.map((v) => ({ v, label: MICS[v].name })) },
    { key: 'spl', type: 'range', label: 'Sound level', min: 10, max: 150, step: 1, ends: ['silence', 'jet engine'], fmt: (v) => v + ' dB SPL' },
    { key: 'power', type: 'toggle', label: 'Power to the microphone', hint: 'Only the condenser and the MEMS chip need it.' },
  ],
  quiz: [
    { q: 'Which two kinds of microphone work by a conductor moving in a magnetic field?', options: ['Condenser and MEMS', 'Dynamic and ribbon', 'Dynamic and condenser', 'Ribbon and MEMS'], answer: 1, why: 'A dynamic moves a coil and a ribbon moves a strip of foil, both in a magnet’s field. The other two are capacitors.' },
    { q: 'Why does a condenser microphone need power?', options: ['To heat the diaphragm', 'To put a charge on its capacitor and run its small amplifier', 'To spin a motor', 'It does not: no microphone needs power'], answer: 1, why: 'Without a charge on the plates, a changing gap makes no voltage. An electret keeps its charge for life but still needs power for its amplifier.' },
    { q: 'What kind of microphone is inside a phone?', options: ['Ribbon', 'Carbon', 'MEMS: a condenser etched in silicon', 'A big moving coil'], answer: 2, why: 'MEMS microphones are a few millimetres long, cheap by the billion, and survive the heat of soldering.' },
  ],
  reel: [
    { ms: 5200, caption: 'In a dynamic microphone, a coil moving in a magnet’s gap generates the signal.', set: { type: 'dynamic', spl: 104, power: true }, view: { pos: [0, 4.9, 6.6], target: [0, 4.9, 0] }, spin: 0 },
    { ms: 5200, caption: 'A condenser is a charged film a hair’s width from a metal plate: move the film and the voltage changes.', set: { type: 'condenser', spl: 104, power: true }, view: { pos: [0, 4.9, 6.6], target: [0, 4.9, 0] }, spin: 0 },
    { ms: 5000, caption: 'A MEMS microphone is the same idea etched in silicon, 3.5 mm long, and every phone has several.', set: { type: 'mems', spl: 104, power: true }, view: { pos: [0, 4.9, 6.6], target: [0, 4.9, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const rig = new THREE.Group(); rig.position.set(0.6, Y0, 0); root.add(rig);
    const models = {};
    TYPES.forEach((id) => { const m = MAKERS[id](stage); m.g.visible = false; rig.add(m.g); models[id] = m; });
    // Air in front of the diaphragm.
    const N = 520;
    const air = airDots(rig, N, (i) => new THREE.Vector3(-3.3 + rnd(i) * 2.6, -0.85 + rnd(i + 900) * 1.7, -0.85 + rnd(i + 1900) * 1.7), 0x9fc0ff, 0.026);
    const lOff = stage.label('No power: no charge, no signal', [0, 0.2, 1.4], rig, 'hot');
    lOff.element.style.borderColor = '#ff5a8a'; lOff.element.style.color = '#ff5a8a';

    let S = s0, ph = 0, amp = 0, seed = 1;
    const noiseAt = (i) => { const x = Math.sin((i + seed) * 91.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
    const scope = boardMesh(1000, 360, (c, w, h) => {
      const id = S.type, m = MICS[id], on = !POWERED[id] || S.power;
      panel(c, w, h, 'Signal out: ' + m.long, 'voltage ' + LAW[id]);
      const x0 = 30, x1 = 610, yA = 96, yB = h - 40, ym = (yA + yB) / 2;
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (let k = 0; k <= 8; k++) { const x = x0 + (k / 8) * (x1 - x0); c.beginPath(); c.moveTo(x, yA); c.lineTo(x, yB); c.stroke(); }
      c.beginPath(); c.moveTo(x0, ym); c.lineTo(x1, ym); c.stroke();
      const nz = selfNoise(id), over = S.spl - m.maxSpl;
      const a = on ? clamp((S.spl - 10) / 130, 0, 1) * (yB - yA) / 2 : 0;
      const na = on ? clamp((nz - 10) / 130, 0, 1) * (yB - yA) / 2 * 0.5 : 0;
      c.lineWidth = 4; c.strokeStyle = m.color; c.beginPath();
      for (let i = 0; i <= 290; i++) {
        let v = Math.sin((i / 290) * TAU * 3 - ph);
        if (over > 0) v = clamp(v * (1 + over * 0.25), -1, 1);                  // overload: the tops flatten
        const y = ym - a * v - na * noiseAt(i), x = x0 + (i / 290) * (x1 - x0);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      const vp = on ? m.sens * dbToPa(S.spl) * Math.SQRT2 : 0;
      text(c, on ? 'peak ± ' + fmtV(vp) : 'no signal', x1, yA - 8, { font: '600 21px sans-serif', col: '#ffb547', align: 'right' });
      if (on && over > 0) text(c, 'overloaded: distorting', x0 + 6, yB - 8, { font: '600 20px sans-serif', col: '#ff5a8a' });
      else if (on && S.spl < nz) text(c, 'quieter than its own hiss', x0 + 6, yB - 8, { font: '600 20px sans-serif', col: '#ff5a8a' });
      // The working range of all four, from hiss to overload.
      const bx = 660, bw = (w - bx - 24) / 4, top = 96, bot = h - 62, yOf = (L) => bot - (clamp(L, 0, 160) / 160) * (bot - top);
      text(c, 'Working range, dB SPL', bx, 40, { font: '600 20px sans-serif', col: '#e8eef8' });
      c.strokeStyle = 'rgba(255,255,255,.12)';
      for (const L of [0, 40, 80, 120, 160]) { c.beginPath(); c.moveTo(bx, yOf(L)); c.lineTo(w - 20, yOf(L)); c.stroke(); text(c, String(L), bx - 6, yOf(L) + 5, { font: '14px sans-serif', align: 'right', col: 'rgba(255,255,255,.5)' }); }
      TYPES.forEach((t, i) => {
        const mm = MICS[t], x = bx + i * bw + 8, yl = yOf(selfNoise(t)), yh = yOf(mm.maxSpl);
        c.globalAlpha = t === id ? 1 : 0.35; c.fillStyle = mm.color; c.fillRect(x, yh, bw - 16, yl - yh); c.globalAlpha = 1;
        text(c, mm.name.slice(0, 5) + (mm.name.length > 5 ? '.' : ''), x + (bw - 16) / 2, bot + 22, { font: '15px sans-serif', align: 'center', col: t === id ? '#fff' : 'rgba(255,255,255,.5)' });
      });
      const yN = yOf(S.spl); c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(bx, yN); c.lineTo(w - 20, yN); c.stroke(); c.setLineDash([]);
      text(c, 'now', w - 22, yN - 5, { font: '14px sans-serif', align: 'right', col: '#fff' });
    }, 6.0);
    scope.mesh.position.set(0.3, 1.2, 0.9); root.add(scope.mesh);

    let acc = 0, shown = null, rot = models[s0.type].rotY;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        const narrow = fitNarrow(stage, []);
        reelBoards([[scope, [0, 7.3, 0], 1.0]]);
        rig.position.set(inReel() ? 0.9 : 0.6, inReel() ? 4.0 : Y0, 0);
        rig.scale.setScalar(inReel() ? 1.25 : 0.9);
        const cur = models[s.type], on = !POWERED[s.type] || s.power;
        if (shown !== s.type) { shown = s.type; TYPES.forEach((id) => { models[id].g.visible = id === s.type; models[id].labels.forEach((l) => { l.visible = id === s.type; }); }); }
        cur.labels.forEach((l, i) => { l.visible = !narrow || i < 2; });
        rot = approach(rot, cur.rotY, 5, dt); rig.rotation.y = rot;
        ph += TAU * 0.7 * dt;
        amp = approach(amp, clamp((s.spl - 10) / 120, 0.03, 1), 6, dt);
        // Pressure at the diaphragm is sin(ph). A dynamic or ribbon is damped so its VELOCITY follows the
        // pressure (so displacement lags a quarter cycle); a condenser's DISPLACEMENT follows the pressure.
        const vel = s.type === 'dynamic' || s.type === 'ribbon';
        const d = amp * (vel ? -Math.cos(ph) : Math.sin(ph)), v = amp * Math.sin(ph);
        cur.set(d, v, on);
        const k = 3.2, face = cur.faceX;
        air.step((hm) => ({ x: face + 0.55 - 0.13 * amp * Math.cos(k * (hm.x + 0.7) - ph) }));
        lOff.visible = !on;
        seed = (seed + 1) % 1000;
        acc += dt; if (acc > 0.05) { acc = 0; scope.redraw(); }
      },
      readout: (s) => {
        const m = MICS[s.type], on = !POWERED[s.type] || s.power, p = dbToPa(s.spl), v = on ? m.sens * p : 0, nz = selfNoise(s.type);
        const state = !on ? '<b class="no">switched off</b>' : s.spl > m.maxSpl ? '<b class="no">overloaded</b>' : s.spl < nz ? '<b class="no">lost in hiss</b>' : '<b class="ok">clean</b>';
        const gap = s.type === 'condenser' && on ? `<div class="row"><span>Gap changes by about</span><b>${(m.sens * p * Math.SQRT2 / 48 * GAP_UM * 1000).toFixed(m.sens * p > 0.01 ? 0 : 1)} nm of ${(GAP_UM * 1000).toLocaleString('en')}</b></div>` : '';
        return compact(`<div class="big">${m.name}: ${on ? fmtV(v) : 'no signal'}</div>
          <div class="row"><span>Signal at ${s.spl} dB SPL (${fmtPa(p)})</span>${state}</div>
          <div class="row"><span>Sensitivity</span><b>${(m.sens * 1000).toFixed(m.sens < 0.01 ? 2 : 1)} mV/Pa (${dBV(m.sens).toFixed(1)} dBV)</b></div>
          <div class="row"><span>Hiss to overload</span><b>${Math.round(nz)} to ${s.type === 'dynamic' ? 'over ' : ''}${m.maxSpl} dB SPL</b></div>
          <div class="row"><span>Power needed</span><b>${m.power}</b></div>${gap}
          <small>Figures from a real example: ${m.like}.</small>`, stage);
      },
    };
  },
};
void torus; void lerp;
