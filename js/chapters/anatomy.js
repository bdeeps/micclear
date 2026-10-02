// Chapter 1: take a stage microphone apart.
// The model is a generic handheld dynamic microphone at the size of a typical stage vocal mic
// (162 mm long, 51 mm ball). Numbers in the readout use the Shure SM58 specification sheet as the
// real-world example: 1.85 mV/Pa (−54.5 dBV/Pa), rated impedance 150 Ω, 50 Hz to 15 kHz.
import { THREE, M, exploder, approach, clamp, lerp, smooth } from '../kit.js';
import { makeStageMic, MICS, dbToPa, dBV, fmtV, fmtPa, loudLike, fitNarrow, compact, inReel } from '../mic.js';

const SENS = MICS.dynamic.sens;

export default {
  id: 'anatomy',
  short: 'Inside a mic',
  title: 'Inside a stage microphone',
  subtitle: 'A grille, a thin diaphragm, a coil, a magnet and three pins.',
  view: { pos: [1.0, 4.4, 11.5], target: [0, 3.3, 0] },
  learn: `<p>A microphone is a <b>transducer</b>: it turns one kind of energy into another. Sound goes in as tiny pushes of air. A copy of it comes out as a tiny, wiggling <b>voltage</b>.</p>
    <p>This is the kind you see at every concert, wedding and school function: a <b>dynamic</b> microphone. Behind the steel <b>ball grille</b> and a layer of <b>foam</b> sits the <b>diaphragm</b>, a dome of plastic film thinner than a hair. Glued to its back is the <b>voice coil</b>, a ring of very fine copper wire. The coil hangs in a narrow gap in a strong <b>magnet</b>.</p>
    <p>Sound pushes the diaphragm, the coil moves in the magnet's field, and that movement makes a voltage in the wire. No battery is needed. A small <b>transformer</b> in the handle passes the signal to the three pins of the <b>XLR connector</b>. It is a loudspeaker run backwards: see <a href="https://glassbox.how/speakerclear/">SpeakerClear</a>.</p>
    <p>The signal is very small. Singing right at the grille gives only a few thousandths of a volt.</p>
    <p class="tip"><b>Try it:</b> take the microphone apart, then sing louder and watch the output. How loud must you be to reach 10 mV?</p>`,
  terms: [
    { t: 'Transducer', d: 'A device that turns one kind of energy into another. A microphone turns sound into electricity.' },
    { t: 'Diaphragm', d: 'A thin, light skin that sound can push back and forth.' },
    { t: 'Voice coil', d: 'A small coil of fine wire fixed to the diaphragm. It sits in the gap of a magnet.' },
    { t: 'Capsule', d: 'The working heart of a microphone: diaphragm, coil and magnet together. Also called the cartridge.' },
    { t: 'Pop filter', d: 'Foam or mesh that slows the burst of breath from sounds like P and B before it hits the diaphragm.' },
    { t: 'XLR connector', d: 'The three-pin plug used on professional microphones: pin 1 shield, pin 2 and pin 3 the signal.' },
  ],
  defaults: { explode: 0, spl: 94, xray: false },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'spl', type: 'range', label: 'How loud you sing', min: 60, max: 130, step: 1, ends: ['soft', 'very loud'], fmt: (v) => v + ' dB SPL' },
    { key: 'xray', type: 'toggle', label: 'See-through handle and grille' },
  ],
  quiz: [
    { q: 'What does the voice coil do?', options: ['It blocks wind', 'It moves with the diaphragm inside a magnet’s field, which makes a voltage', 'It stores the sound', 'It heats the microphone'], answer: 1, why: 'A wire moving through a magnetic field gets a voltage across it. The coil is glued to the diaphragm, so the voltage copies the sound.' },
    { q: 'Why does a dynamic microphone need no battery?', options: ['It has a hidden battery in the handle', 'The moving coil generates its own voltage', 'It takes power from the singer’s breath as heat', 'It only works when plugged into mains'], answer: 1, why: 'It is a tiny generator. The sound itself supplies the energy that moves the coil.' },
    { q: 'A sound of 94 dB SPL is a pressure of 1 pascal. About how much voltage does this microphone give?', options: ['About 2 volts', 'About 2 thousandths of a volt', 'About 230 volts', 'Exactly zero'], answer: 1, why: 'Its sensitivity is 1.85 millivolts for each pascal. That is why a microphone always needs an amplifier.' },
  ],
  reel: [
    { ms: 5600, caption: 'A stage microphone is a grille, a thin diaphragm, a copper coil and a magnet.', set: { spl: 100, xray: false }, anim: { explode: [0, 1] }, view: { pos: [0.5, 6.4, 7.4], target: [0, 5.6, 0] }, spin: 0.4 },
  ],

  build({ stage }) {
    const f = makeStageMic();
    const pivot = new THREE.Group(); stage.root.add(pivot); pivot.add(f.group);
    const setExplode = exploder([
      { obj: f.xlr, off: [-4.0, 0, 0] },
      { obj: f.handle, off: [-2.6, 0, 0] },
      { obj: f.mount, off: [0.3, 0, 0] },
      { obj: f.magnet, off: [1.5, 0, 0] },
      { obj: f.coil, off: [2.9, 0, 0] },
      { obj: f.dia, off: [4.2, 0, 0] },
      { obj: f.foam, off: [5.6, 0, 0] },
      { obj: f.grille, off: [7.6, 0, 0] },
    ]);
    // Sound arriving at the grille: rings that travel down the axis.
    const waves = [];
    for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.02, 8, 48), M.ghost(0x8ef0ff, 0.5)); w.rotation.y = Math.PI / 2; f.group.add(w); waves.push(w); }

    const L = (t, obj, pos, cls) => stage.label(t, pos, obj, cls);
    const outer = [
      L('Ball grille', f.grille, [5.6, 1.7, 0]),
      L('Handle', f.handle, [2.6, -1.3, 0]),
      L('XLR connector', f.xlr, [0.2, 1.5, 0]),
    ];
    const inner = [
      L('Foam pop filter', f.foam, [5.7, -1.7, 0]),
      L('Diaphragm', f.dia, [5.3, 2.6, 0], 'hot'),
      L('Voice coil', f.coil, [5.16, -2.7, 0], 'hot'),
      L('Magnet and iron cup', f.magnet, [4.95, 1.5, 0]),
      L('Rubber shock mount', f.mount, [4.5, -1.6, 0]),
      L('Transformer', f.trafo, [0, 1.6, 0]),
    ];
    const pinLbl = L('Pin 1 shield · 2 hot · 3 cold', f.xlr, [0.3, -1.6, 0]);

    let t = 0, level = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        const k = smooth(s.explode), narrow = fitNarrow(stage, []);
        setExplode(s.explode);
        // Lay the microphone flatter and shrink it as it comes apart, so the whole row stays in view.
        const tilt = lerp(0.52, narrow && !inReel() ? 0.9 : 0.2, k), c = lerp(3.25, 5.05, k), sc = inReel() ? lerp(1.45, 0.6, k) : lerp(1, narrow ? 0.4 : 0.56, k);
        if (inReel()) { pivot.rotation.z = lerp(0.9, 1.25, k); } else pivot.rotation.z = tilt;
        pivot.scale.setScalar(sc);
        const a = pivot.rotation.z;
        pivot.position.set((inReel() ? 0 : lerp(0.9, 0.35, k)) - c * sc * Math.cos(a), (inReel() ? 5.6 : lerp(2.5, 2.1, k)) - c * sc * Math.sin(a), 0);
        const open = s.explode > 0.3 || s.xray;
        inner.forEach((l) => { l.visible = open && !(narrow && s.explode < 0.3); });
        pinLbl.visible = s.explode > 0.3;
        outer.forEach((l) => { l.visible = !narrow || s.explode < 0.3; });
        const see = s.xray || s.explode > 0.05;
        f.bodyMat.opacity = approach(f.bodyMat.opacity, s.xray ? 0.22 : 1, 8, dt); f.bodyMat.depthWrite = f.bodyMat.opacity > 0.9;
        f.ball.material.opacity = s.xray ? 0.25 : 1; f.ball.material.transparent = s.xray;
        f.foamMat.opacity = see ? 0.35 : 0.55;
        // The diaphragm and its coil move together. Real travel is far too small to see, so it is exaggerated.
        level = approach(level, clamp((s.spl - 50) / 80, 0, 1), 6, dt);
        const ph = t * 9, x = Math.sin(ph) * 0.05 * level;
        f.dia.position.x = f.dia.userData.home.x + 4.2 * k + x;
        f.coil.position.x = f.coil.userData.home.x + 2.9 * k + x;
        f.copper.emissiveIntensity = Math.abs(Math.cos(ph)) * level * 1.4;
        waves.forEach((w, i) => {
          const u = ((t * 0.45 + i / waves.length) % 1);
          w.position.x = 9.6 - u * 3.0; w.scale.setScalar(1.25 - 0.4 * u);
          w.material.opacity = (1 - k) * level * 0.7 * Math.sin(u * Math.PI);
          w.visible = k < 0.98;
        });
      },
      readout: (s) => {
        const p = dbToPa(s.spl), v = SENS * p;
        return compact(`<div class="big">Output ≈ ${fmtV(v)}</div>
          <div class="row"><span>Sound at the grille</span><b>${s.spl} dB SPL = ${fmtPa(p)}</b></div>
          <div class="row"><span>That is like</span><b>${loudLike(s.spl)}</b></div>
          <div class="row"><span>Sensitivity</span><b>1.85 mV per pascal</b></div>
          <div class="row"><span>Signal level</span><b>${dBV(v).toFixed(0)} dBV</b></div>
          <div class="row"><span>Size</span><b>162 mm long, 51 mm ball</b></div>
          <small>Example figures: a classic stage vocal microphone, 150 Ω, 50 Hz to 15 kHz. Diaphragm travel is drawn far bigger than life.</small>`, stage);
      },
    };
  },
};
