// Chapter 2: sound is a pressure wave, and a diaphragm rides it.
// Physics (plane wave in air at 20 °C):
//   wavelength λ = c / f, c = 343 m/s
//   pressure p (Pa rms) from level L: p = 20 µPa × 10^(L/20)   (ISO 1683)
//   air particle velocity u = p / (ρc), ρc = 413 Pa·s/m; particle displacement ξ = u / (2πf)
//   force on a diaphragm of area A: F = p × A
// The scene shows 1.7 m of air, so the wavelengths drawn are to scale. Time is slowed a lot.
import { THREE, M, rod, torus, clamp, approach } from '../kit.js';
import { C_AIR, RHO_C, P_ATM, TAU, dbToPa, fmtHz, fmtPa, fmtM, airDots, rnd, boardMesh, panel, text, fitNarrow, compact, reelBoards, tone, loudLike } from '../mic.js';

const U = 4;                              // scene units per metre
const X0 = -3.6, X1 = 3.2;                // the stretch of air shown (1.7 m)
const DIA_MM = 25;                        // a one-inch diaphragm
const AREA = Math.PI * (DIA_MM / 2000) ** 2;
const visHz = (f) => 0.35 + 0.5 * Math.log10(f / 100);        // how fast the picture cycles, in Hz

export default {
  id: 'diaphragm',
  short: 'Sound moves it',
  title: 'Sound moves a diaphragm',
  subtitle: 'Sound is air pressure going up and down. A thin skin follows it.',
  view: { pos: [0.4, 4.7, 10.4], target: [0, 3.7, 0] },
  learn: `<p><b>Sound</b> is a <b>pressure wave</b>. A voice or a tabla pushes the air next to it. That air pushes the air beyond it, and the push travels outwards at about <b>343 metres per second</b>. The air itself does not travel. Each bit of air only shivers back and forth.</p>
    <p>Where the air is squeezed, the pressure is a little higher than normal. Where it is stretched, a little lower. How many squeezes pass each second is the <b>frequency</b>, in hertz: low for a bass note, high for a whistle. The distance from one squeeze to the next is the <b>wavelength</b>. See <a href="https://glassbox.how/waveclear/">WaveClear</a> for more on waves.</p>
    <p>How big the pressure swing is decides the <b>loudness</b>. The swings are tiny. Normal talking changes the air pressure by about one part in ten million. Your eardrum feels it anyway (see <a href="https://glassbox.how/earclear/">EarClear</a>), and so does a microphone's <b>diaphragm</b>.</p>
    <p>The diaphragm is very light, so the changing pressure pushes it in and out in step with the wave. Every microphone starts this way. What differs is how the movement becomes electricity.</p>
    <p class="tip"><b>Try it:</b> raise the frequency and watch the squeezes bunch closer. Then raise the loudness: the wave gets taller but not faster.</p>`,
  terms: [
    { t: 'Pressure wave', d: 'A travelling pattern of squeezed and stretched air. That is what sound is.' },
    { t: 'Frequency', d: 'How many waves pass each second, in hertz (Hz). It sets the pitch.' },
    { t: 'Wavelength', d: 'The distance between one squeeze and the next. Speed of sound divided by frequency.' },
    { t: 'Pascal (Pa)', d: 'The unit of pressure. Normal air pressure is about 101,325 Pa. Loud speech is under 1 Pa.' },
    { t: 'Decibel (dB SPL)', d: 'A scale for sound pressure. Every 20 dB more means ten times the pressure. 94 dB SPL is 1 Pa.' },
  ],
  defaults: { freq: 400, spl: 94 },
  controls: [
    { key: 'freq', type: 'log', label: 'Frequency (pitch)', min: 100, max: 2000, ends: ['low', 'high'], fmt: (v) => fmtHz(v) },
    { key: 'spl', type: 'range', label: 'Loudness at the microphone', min: 40, max: 130, step: 1, ends: ['quiet', 'painful'], fmt: (v) => v + ' dB SPL' },
    { key: 'hear', type: 'buttons', label: 'Listen', items: [{ label: '♪ Hear this pitch', act: (s) => tone.play(s.freq) }] },
  ],
  quiz: [
    { q: 'What actually travels from a singer to a microphone?', options: ['A stream of air blown from the mouth', 'A wave of pressure, passed along from one bit of air to the next', 'Tiny particles of sound', 'Electricity'], answer: 1, why: 'The air only shivers in place. The pattern of squeezes moves on at about 343 m/s.' },
    { q: 'The frequency doubles. What happens to the wavelength?', options: ['It doubles', 'It halves', 'It stays the same', 'It becomes zero'], answer: 1, why: 'Wavelength = speed ÷ frequency. The speed of sound stays the same, so twice the frequency means half the wavelength.' },
    { q: 'A sound gets 20 dB louder. The pressure swing becomes:', options: ['20 times bigger', '10 times bigger', 'Twice as big', '100 times bigger'], answer: 1, why: 'Every 20 dB is ten times the pressure. 94 dB SPL is 1 Pa and 114 dB SPL is 10 Pa.' },
  ],
  reel: [
    { ms: 5200, caption: 'Sound is a wave of air pressure that pushes a thin diaphragm in and out.', set: { spl: 104 }, anim: { freq: [200, 900, true] }, view: { pos: [0, 4.9, 7.8], target: [0, 4.9, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const Y = 3.6;
    // The source: a small loudspeaker cone at the left (it stands in for a voice).
    const src = new THREE.Group(); src.position.set(X0 - 0.35, Y, 0); root.add(src);
    src.add(rod(-0.5, -0.1, 0.5, 0.62, M.matte(0x22252b), 36));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.3, 36, 1, true), M.matte(0x3a3f49, { side: THREE.DoubleSide })); cone.rotation.z = -Math.PI / 2; cone.position.x = 0.05; src.add(cone);
    const lSrc = stage.label('A sound source', [X0 - 0.3, Y - 1.0, 0], root);

    // The air: dots that shiver along x. Their bunching shows the squeezes.
    const N = 2600;
    const air = airDots(root, N, (i) => new THREE.Vector3(X0 + rnd(i) * (X1 - X0), Y - 0.75 + rnd(i + 7000) * 1.5, -0.75 + rnd(i + 15000) * 1.5), 0x9fc0ff, 0.026);

    // The diaphragm in its ring, facing the wave.
    const cap = new THREE.Group(); cap.position.set(X1 + 0.25, Y, 0); root.add(cap);
    const ring = torus(0.82, 0.07, M.metal(0xb9bec8), 56); ring.rotation.y = Math.PI / 2; cap.add(ring);
    const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xffd98a, metalness: 0.5, roughness: 0.25, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const SEG = 40, RINGS = 14;
    const skinGeo = new THREE.CircleGeometry(0.8, SEG, 0, TAU);
    // Rebuild as a polar grid so it can bulge like a drum skin.
    const pos = [], idx = [];
    for (let r = 0; r <= RINGS; r++) for (let a = 0; a < SEG; a++) { const R = (r / RINGS) * 0.8, th = (a / SEG) * TAU; pos.push(0, R * Math.cos(th), R * Math.sin(th)); }
    for (let r = 0; r < RINGS; r++) for (let a = 0; a < SEG; a++) { const i0 = r * SEG + a, i1 = r * SEG + (a + 1) % SEG, j0 = i0 + SEG, j1 = i1 + SEG; idx.push(i0, j0, i1, i1, j0, j1); }
    skinGeo.dispose();
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setIndex(idx); g2.computeVertexNormals();
    const skin = new THREE.Mesh(g2, skinMat); cap.add(skin);
    cap.add(rod(0.25, 0.6, 0.84, 0.84, M.matte(0x22252b), 40, true));
    const lDia = stage.label('Diaphragm', [X1 + 0.3, Y + 1.15, 0], root, 'hot');
    // Wavelength marker under the air.
    const mk = new THREE.Group(); root.add(mk);
    const bar = rod(0, 1, 0.012, 0.012, M.glow(0xffb547), 8); mk.add(bar);
    const e0 = rod(-0.01, 0.01, 0.08, 0.08, M.glow(0xffb547), 8), e1 = e0.clone(); mk.add(e0, e1);
    const lLam = stage.label('', [0, 0, 0], mk);

    // The scope: pressure at the diaphragm against real time.
    let S = s0, phase = 0, amp = 0;
    const scope = boardMesh(900, 420, (c, w, h) => {
      panel(c, w, h, 'Air pressure at the diaphragm', '10 thousandths of a second of real time');
      const x0 = 70, x1 = w - 30, yA = 96, yB = h - 46, ym = (yA + yB) / 2, T = 0.01;
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (let k = 0; k <= 10; k++) { const x = x0 + (k / 10) * (x1 - x0); c.beginPath(); c.moveTo(x, yA); c.lineTo(x, yB); c.stroke(); }
      c.beginPath(); c.moveTo(x0, ym); c.lineTo(x1, ym); c.stroke();
      text(c, 'normal', 8, ym - 4, { font: '16px sans-serif' }); text(c, 'pressure', 8, ym + 14, { font: '16px sans-serif' });
      text(c, '0 ms', x0, yB + 26, { font: '17px sans-serif' }); text(c, '10 ms', x1, yB + 26, { font: '17px sans-serif', align: 'right' });
      const a = clamp((S.spl - 30) / 100, 0.05, 1) * (yB - yA) / 2;
      c.lineWidth = 4; c.strokeStyle = '#8ef0ff'; c.beginPath();
      for (let i = 0; i <= 500; i++) { const tt = (i / 500) * T, y = ym - a * Math.sin(TAU * S.freq * tt - phase), x = x0 + (i / 500) * (x1 - x0); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      const pk = dbToPa(S.spl) * Math.SQRT2;
      text(c, 'peak ± ' + fmtPa(pk), x1, yA - 6, { font: '600 20px sans-serif', col: '#ffb547', align: 'right' });
    }, 5.4);
    scope.mesh.position.set(0, 1.35, 0.9); root.add(scope.mesh);

    let acc = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        const narrow = fitNarrow(stage, [lSrc]);
        reelBoards([[scope, [0, 6.9, 0], 1.25]]);
        const lam = (C_AIR / s.freq) * U, k = TAU / lam;
        phase += TAU * visHz(s.freq) * dt;
        amp = approach(amp, clamp((s.spl - 30) / 100, 0.04, 1), 6, dt);
        const A = Math.min(0.42, 0.62 / k) * amp;                 // drawn shiver, kept below the point where dots would cross
        air.step((h) => A * Math.sin(k * (h.x - X0) - phase));
        const ph0 = -phase, phD = k * (X1 - X0) - phase;
        cone.position.x = 0.05 + 0.1 * amp * Math.sin(ph0);
        // The diaphragm bulges with the pressure (a squeeze pushes it away from the source).
        const d = -0.2 * amp * Math.cos(phD), P = g2.attributes.position;
        for (let r = 0; r <= RINGS; r++) { const q = r / RINGS, x = d * (1 - q * q); for (let a = 0; a < SEG; a++) P.setX(r * SEG + a, x); }
        P.needsUpdate = true; g2.computeVertexNormals();
        // Mark one wavelength between two squeezes.
        const lamShow = Math.min(lam, X1 - X0);
        mk.position.set(X0 + 0.2, Y + 0.98, 0); bar.scale.x = lamShow; bar.position.x = lamShow / 2; e1.position.x = lamShow;
        lLam.position.set(Math.max(1.0, lamShow / 2), 0.26, 0);
        lLam.element.textContent = lam > X1 - X0 + 0.01 ? `Wavelength ${fmtM(C_AIR / s.freq)}: longer than this picture` : `One wavelength: ${fmtM(C_AIR / s.freq)}`;
        lDia.visible = !narrow;
        acc += dt; if (acc > 0.05) { acc = 0; scope.redraw(); }
      },
      readout: (s) => {
        const p = dbToPa(s.spl), u = p / RHO_C, xi = u / (TAU * s.freq) * Math.SQRT2, F = p * AREA;
        return compact(`<div class="big">${fmtHz(s.freq)} · wavelength ${fmtM(C_AIR / s.freq)}</div>
          <div class="row"><span>Pressure swing</span><b>${fmtPa(p)} (${loudLike(s.spl)})</b></div>
          <div class="row"><span>Compared with the air around us</span><b>1 part in ${Math.round(P_ATM / p).toLocaleString('en')}</b></div>
          <div class="row"><span>Each bit of air shivers by</span><b>± ${fmtM(xi)}</b></div>
          <div class="row"><span>Push on a ${DIA_MM} mm diaphragm</span><b>${(F * 1e6 >= 1000 ? (F * 1e3).toFixed(1) + ' mN' : (F * 1e6).toFixed(F * 1e6 >= 10 ? 0 : 1) + ' µN')}</b></div>
          <small>The picture shows 1.7 m of air, slowed about ${Math.round(s.freq / visHz(s.freq)).toLocaleString('en')} times. The shiver is drawn far bigger than life.</small>`, stage);
      },
      dispose() { tone.stop(); },
    };
  },
};
