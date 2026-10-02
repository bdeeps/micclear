// Chapter 4: which way a microphone listens.
// First-order polar patterns: g(θ) = A + (1 − A)·cos θ, with A = 1 omni (pressure), 0.5 cardioid,
// 0.37 supercardioid, 0 figure-8 (pressure gradient). See Eargle, The Microphone Book, ch. 5.
// Shotgun: a supercardioid capsule behind an interference tube of length L = 0.2 m, modelled as a line
// receiver: sinc(π·L·f·(1 − cos θ)/c). It only narrows the beam above about c/(2L) ≈ 860 Hz.
// Close to a small source the wave is spherical, and the gradient part grows as (1 + 1/(jkr)):
// that is the proximity effect. Level also falls 6 dB for every doubling of distance.
import { THREE, M, rod, sphere, clamp, approach } from '../kit.js';
import { PATTERNS, patternResp, C_AIR, TAU, fmtHz, fmtM, sgn, makePerson, makeMicOnStand, ripples, boardMesh, panel, text, fitNarrow, compact, reelBoards, inReel } from '../mic.js';

const SC = 1.5;                            // scene units per metre for the people and the stand
const MIC_H = 1.5;                         // m: the microphone and the talker's mouth are level
const R_L = 1.6;                           // scene radius of the 0 dB ring of the floor plot
const D2R = Math.PI / 180;
// Response (linear) at angle θ, frequency f and distance r from a small source, relative to the same
// microphone on axis and far away at the same distance.
function resp(id, th, f, r) {
  const p = PATTERNS[id], c = Math.cos(th), kr = (TAU * f * r) / C_AIR;
  let g = Math.hypot(p.A + (1 - p.A) * c, ((1 - p.A) * c) / kr);
  if (p.tube) { const x = (Math.PI * p.tube * f * (1 - c)) / C_AIR; g *= x < 1e-6 ? 1 : Math.abs(Math.sin(x) / x); }
  return g;
}
const dB = (g) => 20 * Math.log10(Math.max(1e-4, g));
const visR = (r) => 2.0 + 0.9 * (Math.log(r / 0.05) / Math.log(40));         // where the talker stands in the picture

export default {
  id: 'patterns',
  short: 'Which way it listens',
  title: 'Which way it listens',
  subtitle: 'Omni, figure-8, cardioid and shotgun: the shape of a microphone’s hearing.',
  view: { pos: [0.6, 7.8, 9.6], target: [0.6, 2.1, -0.5] },
  learn: `<p>A microphone does not hear equally in every direction. Its <b>polar pattern</b> is a map of how well it hears from each side. Around the microphone here is that map: the further the curve reaches, the louder it hears from that direction. Where the map turns pink, the signal comes out upside down.</p>
    <p><b>Omni.</b> Seal the back of the capsule and only the front of the diaphragm meets the air. It feels <b>pressure</b>, which has no direction, so it hears all round.</p>
    <p><b>Figure-8.</b> Leave both sides open, like a ribbon. Now the diaphragm only moves when the pressure on the two sides differs. Sound from the side reaches both faces together and cancels. Front and back are heard, the sides are deaf.</p>
    <p><b>Cardioid.</b> Add the two together and you get a heart shape: full at the front, nothing at the back. Real cardioids do it with small <b>rear ports</b> that let sound reach the back of the diaphragm a moment late. This is the pattern of most stage microphones, because it ignores the loudspeakers behind it.</p>
    <p><b>Shotgun.</b> A long slotted tube in front of the capsule. Sound from the side enters through many slots, travels different distances, and cancels itself. It works best for high notes. Film crews hold one on a pole just out of shot: see <a href="https://glassbox.how/filmsoundclear/">FilmSoundClear</a>.</p>
    <p>Directional microphones have a quirk called the <b>proximity effect</b>: get very close and the bass gets much stronger. Radio hosts use it for a deep, warm voice.</p>
    <p class="tip"><b>Try it:</b> pick cardioid and walk the talker round to the back. Then pick figure-8 and stand at the side. Last, come within 5 cm and watch the bass rise.</p>`,
  terms: [
    { t: 'Polar pattern', d: 'A map of how sensitive a microphone is to sound from each direction.' },
    { t: 'Omnidirectional', d: 'Hearing equally from all directions.' },
    { t: 'Cardioid', d: 'A heart-shaped pattern: most sensitive at the front, deaf at the back.' },
    { t: 'Figure-8', d: 'Hearing from the front and the back but not the sides. Also called bidirectional.' },
    { t: 'Pressure gradient', d: 'The difference in pressure between the two faces of a diaphragm. It depends on direction.' },
    { t: 'Proximity effect', d: 'The boost in bass when a directional microphone is very close to the source.' },
    { t: 'Off-axis', d: 'Not straight in front of the microphone.' },
  ],
  defaults: { pattern: 'cardioid', angle: 0, walk: false, dist: 0.3, freq: 1000 },
  controls: [
    { key: 'pattern', type: 'seg', label: 'Pattern', options: [{ v: 'omni', label: 'Omni' }, { v: 'cardioid', label: 'Cardioid' }, { v: 'super', label: 'Super' }, { v: 'fig8', label: 'Fig-8' }, { v: 'shotgun', label: 'Shotgun' }] },
    { key: 'angle', type: 'range', label: 'Walk round the microphone', min: 0, max: 360, step: 1, ends: ['front', 'all the way round'], fmt: (v) => Math.round(v) + '°' },
    { key: 'walk', type: 'toggle', label: 'Keep walking' },
    { key: 'dist', type: 'log', label: 'Distance from the microphone', min: 0.05, max: 2, ends: ['5 cm', '2 m'], fmt: (v) => fmtM(v) },
    { key: 'freq', type: 'log', label: 'Pitch of the sound', min: 100, max: 10000, ends: ['bass', 'treble'], fmt: (v) => fmtHz(v) },
  ],
  quiz: [
    { q: 'A singer has a loud monitor speaker on the floor pointing up at them. Which pattern, aimed at the singer, ignores that speaker best?', options: ['Omni', 'Cardioid, with its back to the speaker', 'Figure-8, with its back to the speaker', 'Any: pattern makes no difference'], answer: 1, why: 'A cardioid is deaf at the back, so the monitor’s sound is hardly picked up. A figure-8 hears the back as well as the front.' },
    { q: 'Why is a figure-8 microphone deaf at the sides?', options: ['The sides are covered in foam', 'Sound from the side reaches both faces of the diaphragm at the same moment, so there is no difference to push it', 'Sound cannot travel sideways', 'Its magnet blocks the sound'], answer: 1, why: 'It responds to the pressure difference between its two faces. From the side, both faces feel the same pressure.' },
    { q: 'What is the proximity effect?', options: ['Microphones break when touched', 'Bass gets stronger when a directional microphone is very close to the source', 'Treble gets stronger far away', 'Omni microphones turn into cardioids'], answer: 1, why: 'Close to a small source the pressure difference across the diaphragm grows at low frequencies. Omni microphones do not have it.' },
  ],
  reel: [
    { ms: 5600, caption: 'A cardioid microphone hears the front and is deaf at the back.', set: { pattern: 'cardioid', dist: 0.5, freq: 1000, walk: false }, anim: { angle: [0, 180] }, view: { pos: [0.6, 7.7, 4.5], target: [0.6, 3.3, 0] }, spin: 0 },
    { ms: 5200, caption: 'A shotgun’s slotted tube makes sound from the side cancel itself.', set: { pattern: 'shotgun', dist: 1, freq: 4000, walk: false }, anim: { angle: [0, 120] }, view: { pos: [0.6, 7.7, 4.5], target: [0.6, 3.3, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); root.position.x = 0.6; stage.root.add(root);
    const HY = MIC_H * SC;
    // The microphone, drawn three times life size so it can be seen.
    const mic = makeMicOnStand(MIC_H); mic.scale.setScalar(SC); root.add(mic);
    mic.head.scale.setScalar(3);
    const glow = sphere(0.06, M.glow(0x8ef0ff, { transparent: true, opacity: 0.5 }), 16); glow.position.set(0.1, 0, 0); mic.head.add(glow);
    // The floor plot: rings and spokes at microphone height, then the pattern itself.
    const plot = new THREE.Group(); plot.position.y = HY - 0.02; root.add(plot);
    const ringM = M.ghost(0xffffff, 0.16);
    [1, 0.5, 0.25].forEach((k) => { const m = new THREE.Mesh(new THREE.RingGeometry(R_L * k - 0.012, R_L * k + 0.012, 96), ringM); m.rotation.x = -Math.PI / 2; plot.add(m); });
    for (let a = 0; a < 12; a++) { const m = rod(0, R_L * 1.08, 0.006, 0.006, ringM, 6); m.rotation.y = a * 30 * D2R; plot.add(m); }
    const NSEG = 180, pos = new Float32Array((NSEG + 2) * 3), col = new Float32Array((NSEG + 2) * 3), idx = [];
    for (let i = 0; i < NSEG; i++) idx.push(0, i + 2, i + 1);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    const lobe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    lobe.position.y = 0.01; plot.add(lobe);
    const edge = new THREE.Group(); plot.add(edge);
    const edgeDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 5), M.glow(0xffffff), NSEG); edgeDots.frustumCulled = false; edge.add(edgeDots);
    const spoke = rod(0, 1, 0.014, 0.014, M.glow(0xffb547), 8); plot.add(spoke);
    const dot = sphere(0.07, M.glow(0xffb547), 16); plot.add(dot);
    const lab = (t, a, k = 1.2, cls = '') => stage.label(t, [R_L * k * Math.cos(a * D2R), 0.05, R_L * k * Math.sin(a * D2R)], plot, cls);
    const minor = [lab('−6 dB', 235, 0.5)];
    lab('Front 0°', 0, 1.22, 'hot'); lab('Back 180°', 180, 1.24);

    // The talker.
    const who = makePerson(); who.scale.setScalar(SC); root.add(who);
    const waves = ripples(root, 5, 0x8ef0ff);
    const lWho = stage.label('', [0, 1.95, 0], who, 'hot');

    // What the microphone hears across the whole range of pitch.
    let S = s0;
    const chart = boardMesh(1000, 330, (c, w, h) => {
      panel(c, w, h, 'What the microphone hears from here', 'level at each pitch, against the same voice in front and far away');
      const x0 = 70, x1 = w - 30, yA = 92, yB = h - 44, f0 = 50, f1 = 16000, lo = -30, hi = 24;
      const X = (f) => x0 + (Math.log(f / f0) / Math.log(f1 / f0)) * (x1 - x0), Y = (d) => yB - ((clamp(d, lo, hi) - lo) / (hi - lo)) * (yB - yA);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (const f of [100, 1000, 10000]) { c.beginPath(); c.moveTo(X(f), yA); c.lineTo(X(f), yB); c.stroke(); text(c, fmtHz(f), X(f), yB + 24, { font: '16px sans-serif', align: 'center' }); }
      for (const d of [-24, -12, 0, 12, 24]) { c.beginPath(); c.moveTo(x0, Y(d)); c.lineTo(x1, Y(d)); c.stroke(); text(c, (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d), x0 - 8, Y(d) + 5, { font: '15px sans-serif', align: 'right' }); }
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(x0, Y(0)); c.lineTo(x1, Y(0)); c.stroke();
      const th = S.angle * D2R;
      c.lineWidth = 4; c.strokeStyle = '#8ef0ff'; c.beginPath();
      for (let i = 0; i <= 160; i++) { const f = f0 * Math.pow(f1 / f0, i / 160), y = Y(dB(resp(S.pattern, th, f, S.dist))), x = X(f); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      c.fillStyle = '#ffb547'; c.beginPath(); c.arc(X(S.freq), Y(dB(resp(S.pattern, th, S.freq, S.dist))), 9, 0, TAU); c.fill();
      text(c, 'dB', 14, yA + 4, { font: '15px sans-serif' });
    }, 6.2);
    chart.mesh.position.set(0, 1.0, 3.5); chart.mesh.rotation.x = -0.5; root.add(chart.mesh);

    const o = new THREE.Object3D();
    let ang = s0.angle, level = 0, t = 0, key = '', acc = 0;
    const drawLobe = (s) => {
      pos[0] = pos[1] = pos[2] = 0; col[0] = col[1] = col[2] = 0.6;
      for (let i = 0; i <= NSEG; i++) {
        const th = (i / NSEG) * TAU, g = patternResp(s.pattern, th, s.freq), r = R_L * Math.min(1, Math.abs(g)), j = (i + 1) * 3;
        pos[j] = r * Math.cos(th); pos[j + 1] = 0; pos[j + 2] = r * Math.sin(th);
        const neg = g < 0; col[j] = neg ? 1.0 : 0.35; col[j + 1] = neg ? 0.45 : 0.9; col[j + 2] = neg ? 0.6 : 1.0;
        if (i < NSEG) { o.position.set(pos[j], 0.012, pos[j + 2]); o.updateMatrix(); edgeDots.setMatrixAt(i, o.matrix); }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; edgeDots.instanceMatrix.needsUpdate = true;
    };
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s; t += dt;
        const narrow = fitNarrow(stage, minor);
        reelBoards([[chart, [0, 6.3, -2.4], 0.92]]);
        if (inReel()) chart.mesh.rotation.x = -0.25;
        if (s.walk && !inReel()) { s.angle = (s.angle + 28 * dt) % 360; }
        // Turn towards the slider's angle the short way round.
        let d = ((s.angle - ang + 540) % 360) - 180; if (Math.abs(d) > 179.5 && s.angle >= 359) d = s.angle - ang;
        ang = s.walk ? s.angle : ang + d * (1 - Math.exp(-10 * dt));
        const th = ang * D2R, r = visR(s.dist);
        who.position.set(r * Math.cos(th), 0, r * Math.sin(th)); who.rotation.y = Math.PI - th;
        mic.setTube(s.pattern === 'shotgun');
        const k = `${s.pattern}|${Math.round(s.freq)}`; if (k !== key) { key = k; drawLobe(s); }
        const g = patternResp(s.pattern, th, s.freq), rr = R_L * Math.min(1, Math.abs(g));
        spoke.scale.x = Math.max(0.001, rr); spoke.rotation.y = -th; dot.position.set(rr * Math.cos(th), 0.02, rr * Math.sin(th));
        // Sound rings leave the talker's mouth; the capsule glows with what it picks up.
        const mx = (r - 0.16 * SC) * Math.cos(th), mz = (r - 0.16 * SC) * Math.sin(th);
        waves.rings.forEach((m) => { m.position.set(mx, HY + 0.03, mz); });
        waves.step(t * 0.55, 0.1, 1.6, 0.9);
        level = approach(level, clamp(Math.abs(g), 0, 1), 8, dt);
        glow.material.opacity = 0.15 + 0.75 * level; glow.scale.setScalar(0.6 + 1.6 * level);
        lWho.element.textContent = `${Math.round(((ang % 360) + 360) % 360)}° · ${fmtM(s.dist)} away`;
        acc += dt; if (acc > 0.08) { acc = 0; chart.redraw(); }
      },
      readout: (s) => {
        const th = s.angle * D2R, p = PATTERNS[s.pattern];
        const gp = dB(Math.abs(patternResp(s.pattern, th, s.freq))), dist = -20 * Math.log10(s.dist / 1);
        const bass = dB(resp(s.pattern, 0, 100, s.dist)), rear = dB(Math.abs(patternResp(s.pattern, Math.PI, s.freq))), side = dB(Math.abs(patternResp(s.pattern, Math.PI / 2, s.freq)));
        const near = (v) => (v <= -39 ? 'silent' : sgn(v, 1) + ' dB');
        return compact(`<div class="big">${p.name}: ${gp <= -39 ? 'silent here' : sgn(gp, 1) + ' dB'}</div>
          <div class="row"><span>Talker at</span><b>${Math.round(s.angle % 360)}°, ${fmtM(s.dist)} (${sgn(dist, 0)} dB vs 1 m)</b></div>
          <div class="row"><span>Side · back, at ${fmtHz(s.freq)}</span><b>${near(side)} · ${near(rear)}</b></div>
          <div class="row"><span>Bass boost at 100 Hz, in front</span><b>${bass < 0.5 ? 'none' : '+' + bass.toFixed(0) + ' dB'}</b></div>`, stage, 3);
      },
    };
  },
};
