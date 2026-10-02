// Chapter 5: down the cable. Microphone level, preamp gain, balanced lines and phantom power.
//   Microphone level at 94 dB SPL (1 Pa): 1.85 mV from a dynamic, 28 mV from a studio condenser (mic.js).
//   Line level: +4 dBu = 1.228 V rms (0 dBu = 0.7746 V). A preamp gives up to about 60 to 70 dB of gain.
//   Balanced line: the signal travels as +v on pin 2 and −v on pin 3. Interference lands equally on both
//   twisted wires (common mode). The preamp takes pin 2 minus pin 3: signal doubles, hum cancels.
//   How well it cancels is the common-mode rejection ratio; 60 dB is the data-sheet minimum of a common
//   preamp chip (THAT 1510) and is used here.
//   Phantom power P48 (IEC 61938): 48 V fed to pins 2 and 3 through matched 6.8 kΩ resistors, returning
//   on pin 1, at most 10 mA. Both pins sit at the same voltage, so a dynamic's coil sees no current.
//   The amount of hum a cable picks up depends on the room: the figure here (0.1 mV per metre next to
//   mains wiring at full strength) is illustrative, not a standard.
//   Preamp output clips at +24 dBu here, a typical professional maximum.
import { THREE, M, box, rod, tube, clamp, approach } from '../kit.js';
import { MICS, dbToPa, dBu, undB, fmtV, sgn, TAU, makeStageMic, boardMesh, panel, text, fitNarrow, compact, reelBoards, inReel } from '../mic.js';

const SPL = 94, LINE_DBU = 4, CLIP_DBU = 24, CMRR = 60, HUM_PER_M = 0.1e-3;
const Y0 = 3.75, XA = -2.3, XB = 1.9, XH = -0.3;
const dead = (s) => s.mic === 'condenser' && (!s.phantom || s.cable !== 'bal');      // a condenser needs phantom power, which needs a balanced cable
const sig = (s) => MICS[s.mic].sens * dbToPa(SPL) * (dead(s) ? 0 : 1);
const humIn = (s) => HUM_PER_M * s.len * s.hum;                               // V rms on each wire
const humOut = (s) => (s.cable === 'bal' ? humIn(s) * undB(-CMRR) : humIn(s));     // after the input stage, before gain
function niceMax(v) { const e = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9)))); const m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }

export default {
  id: 'cable',
  short: 'Down the cable',
  title: 'Down the cable',
  subtitle: 'A whisper of a signal, a noisy world, and the trick that keeps it clean.',
  view: { pos: [0.3, 4.7, 10.4], target: [0, 3.7, 0] },
  learn: `<p>A microphone's signal is tiny: a few <b>millivolts</b>. Before anything else can use it, a <b>preamp</b> must make it hundreds of times bigger, up to <b>line level</b>, about 1.2 volts. That boost is called <b>gain</b>.</p>
    <p>The danger is on the way there. A cable is a long aerial. Mains wiring, dimmers and phone chargers all push a little <b>hum</b> and buzz into it. If that lands on a signal of 2 millivolts and then gets boosted 600 times, you hear it.</p>
    <p>The fix is the <b>balanced line</b>. An XLR cable has two signal wires, twisted together inside a shield. The microphone sends its signal up one wire and an upside-down copy up the other. Hum lands on both wires <b>the same way up</b>. At the far end the preamp <b>subtracts</b> one wire from the other. The two copies of the signal add up. The hum, being equal on both, cancels.</p>
    <p>The same two wires can carry power. <b>Phantom power</b> puts 48 volts on both signal wires at once. A condenser microphone drinks it. A dynamic microphone never notices, because both ends of its coil sit at the same voltage, so no current flows through it.</p>
    <p class="tip"><b>Try it:</b> turn the hum up, then switch between balanced and unbalanced. Make the cable longer. Then pick the condenser and switch phantom power off.</p>`,
  terms: [
    { t: 'Preamp', d: 'The first amplifier a microphone meets. It lifts millivolts up to about a volt.' },
    { t: 'Gain', d: 'How much an amplifier multiplies a signal. 20 dB is 10 times, 40 dB is 100 times, 60 dB is 1,000 times.' },
    { t: 'Line level', d: 'The standard signal size between pieces of audio gear: +4 dBu, about 1.23 volts.' },
    { t: 'Balanced line', d: 'Two signal wires carrying opposite copies of the signal, so that interference can be subtracted out.' },
    { t: 'Common-mode rejection', d: 'How well an input ignores a voltage that is the same on both wires. 60 dB means a thousand times smaller.' },
    { t: 'Phantom power', d: '48 volts sent up both signal wires of a microphone cable to power condenser microphones.' },
    { t: 'Hum', d: 'A low buzz at the mains frequency: 50 Hz in India and Europe, 60 Hz in the Americas.' },
  ],
  defaults: { cable: 'bal', hum: 0.6, len: 10, gain: 56, mic: 'dynamic', phantom: true },
  controls: [
    { key: 'cable', type: 'seg', label: 'Cable', options: [{ v: 'bal', label: 'Balanced (XLR)' }, { v: 'unbal', label: 'Unbalanced' }] },
    { key: 'hum', type: 'range', label: 'Hum from mains wiring nearby', min: 0, max: 1, step: 0.01, ends: ['none', 'strong'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'len', type: 'log', label: 'Cable length', min: 1, max: 100, ends: ['1 m', '100 m'], fmt: (v) => Math.round(v) + ' m' },
    { key: 'gain', type: 'range', label: 'Preamp gain', min: 0, max: 70, step: 1, ends: ['0 dB', '70 dB'], fmt: (v) => v + ' dB (×' + Math.round(undB(v)).toLocaleString('en') + ')' },
    { key: 'mic', type: 'seg', label: 'Microphone', options: [{ v: 'dynamic', label: 'Dynamic' }, { v: 'condenser', label: 'Condenser' }] },
    { key: 'phantom', type: 'toggle', label: '48 V phantom power' },
  ],
  quiz: [
    { q: 'How does a balanced cable get rid of hum?', options: ['It has thicker rubber', 'Hum lands equally on both signal wires, and the preamp subtracts one wire from the other', 'It filters out all low notes', 'It sends the signal as light'], answer: 1, why: 'The signal is opposite on the two wires, so subtracting doubles it. The hum is the same on both, so subtracting removes it.' },
    { q: 'A dynamic microphone gives 2 mV. About how much gain lifts it to line level, 1.2 V?', options: ['About 6 dB (2 times)', 'About 20 dB (10 times)', 'About 56 dB (600 times)', 'About 120 dB (a million times)'], answer: 2, why: '1.2 V ÷ 0.002 V is about 600 times, which is about 56 dB.' },
    { q: 'Why does phantom power not harm a dynamic microphone on a balanced cable?', options: ['Dynamic mics have a fuse', 'Both signal wires carry the same 48 V, so there is no voltage across the coil', 'The power is too weak to feel', 'It does harm them every time'], answer: 1, why: 'Current only flows when there is a voltage difference. Both ends of the coil are at 48 V, so the difference is zero.' },
  ],
  reel: [
    { ms: 5600, caption: 'A balanced cable carries the signal twice, one copy upside down, so hum cancels when they are subtracted.', set: { cable: 'bal', len: 20, gain: 50, mic: 'dynamic', phantom: false }, anim: { hum: [0, 1] }, view: { pos: [0.2, 4.9, 7.8], target: [0.2, 4.9, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const rig = new THREE.Group(); rig.position.set(0.25, Y0, 0); root.add(rig);
    // The microphone, tail to the cable.
    const mic = makeStageMic(); mic.group.scale.setScalar(0.24); mic.group.rotation.y = Math.PI; mic.group.position.x = XA; rig.add(mic.group);
    // The cable: two twisted signal wires inside a braided shield (drawn see-through).
    const R = 0.15, PITCH = 0.62, kx = TAU / PITCH;
    const helix = (ph) => { const pts = []; for (let i = 0; i <= 160; i++) { const x = XA + (i / 160) * (XB - XA); pts.push(new THREE.Vector3(x, R * Math.cos(kx * x + ph), R * Math.sin(kx * x + ph))); } return pts; };
    const hotM = M.plastic(0xe0524a, { emissive: new THREE.Color(0xffd166), emissiveIntensity: 0 }), coldM = M.plastic(0x4a78d6, { emissive: new THREE.Color(0xffd166), emissiveIntensity: 0 });
    const hot = tube(helix(0), 0.05, hotM, false, 320), cold = tube(helix(Math.PI), 0.05, coldM, false, 320);
    const solo = rod(XA, XB, 0.06, 0.06, hotM, 12);
    const shield = rod(XA, XB, 0.3, 0.3, new THREE.MeshStandardMaterial({ color: 0xb9bec8, metalness: 0.8, roughness: 0.4, wireframe: true, transparent: true, opacity: 0.35 }), 18, true);
    shield.geometry.dispose(); shield.geometry = new THREE.CylinderGeometry(0.3, 0.3, XB - XA, 14, 40, true).rotateZ(-Math.PI / 2);
    rig.add(hot, cold, solo, shield);
    // Beads on the wires swell and shrink with the voltage at that point.
    const NB = 34, beadG = new THREE.SphereGeometry(0.075, 10, 8);
    const mk = (color) => { const m = new THREE.InstancedMesh(beadG, M.glow(color), NB); m.frustumCulled = false; rig.add(m); return m; };
    const bHot = mk(0xffa59e), bCold = mk(0x9fc0ff), o = new THREE.Object3D();
    // The mains cable underneath, crossing at right angles, with its magnetic field circling it.
    const mains = rod(-1.6, 1.6, 0.09, 0.09, M.matte(0x111216), 12); mains.rotation.y = Math.PI / 2; mains.position.set(XH, -0.85, 0); rig.add(mains);
    const rings = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 56), M.ghost(0xff5a8a, 0.5)); m.position.set(XH, -0.85, 0); rig.add(m); rings.push(m); }
    // The preamp: input socket, two 6.8 kΩ phantom resistors, gain knob and a level meter.
    const pre = new THREE.Group(); pre.position.set(XB + 0.85, 0, 0); rig.add(pre);
    pre.add(box(1.7, 1.3, 1.2, M.plastic(0x23262d, { transparent: true, opacity: 0.55, depthWrite: false })));
    pre.add(rod(-0.9, -0.8, 0.34, 0.34, M.metal(0x8f96a3), 24));
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 24), M.plastic(0xd9dde4)); knob.rotation.x = Math.PI / 2; knob.position.set(-0.35, -0.3, 0.66); pre.add(knob);
    const tick = box(0.03, 0.16, 0.02, M.glow(0xffb547)); tick.position.set(0, 0, 0); const knobTop = new THREE.Group(); knobTop.position.set(-0.35, -0.3, 0.74); knobTop.add(tick); tick.position.y = 0.1; pre.add(knobTop);
    const leds = [];
    for (let i = 0; i < 10; i++) { const l = box(0.09, 0.09, 0.03, M.glow(i < 6 ? 0x5ce1a9 : i < 8 ? 0xffd166 : 0xff5a8a, { transparent: true, opacity: 0.15 })); l.position.set(0.05 + i * 0.07, -0.3 + i * 0.0, 0.62); l.position.x = 0.02 + i * 0.075; pre.add(l); leds.push(l); }
    const resM = M.plastic(0xd9b98a, { emissive: new THREE.Color(0xffd166), emissiveIntensity: 0 });
    const rail = rod(-0.6, 0.1, 0.02, 0.02, resM, 8); rail.position.y = 0.48; pre.add(rail);
    const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12), resM), r2 = r1.clone(); r1.position.set(-0.55, 0.27, 0.1); r2.position.set(-0.4, 0.27, -0.1); pre.add(r1, r2);
    const outW = rod(0.85, 1.5, 0.05, 0.05, M.plastic(0x5ce1a9, { emissive: new THREE.Color(0x5ce1a9), emissiveIntensity: 0.3 }), 10); pre.add(outW);

    const lHot = stage.label('Pin 2: signal', [XA + 0.9, 0.62, 0], rig), lCold = stage.label('Pin 3: signal upside down', [XA + 1.3, -0.62, 0], rig);
    const lShield = stage.label('Shield (pin 1)', [XB - 0.7, 0.62, 0], rig);
    const lMains = stage.label('Mains cable: 50 Hz field', [XH - 1.5, -1.0, 0], rig); lMains.element.style.color = '#ff8aa8';
    const lPre = stage.label('Preamp: pin 2 minus pin 3', [XB + 0.85, 0.98, 0], rig, 'hot');
    const lPh = stage.label('+48 V through two 6.8 kΩ', [XB + 0.3, -1.0, 0], rig);

    let S = s0, t = 0;
    const scope = boardMesh(1000, 400, (c, w, h) => {
      const bal = S.cable === 'bal';
      panel(c, w, h, bal ? 'Balanced: what each wire carries' : 'Unbalanced: one signal wire and the shield', '40 thousandths of a second');
      const x0 = 220, x1 = w - 26, rows = [[96, 176], [190, 270], [290, 384]];
      const a = sig(S) * Math.SQRT2, hm = humIn(S) * Math.SQRT2, ho = humOut(S) * Math.SQRT2, g = undB(S.gain), clipV = 0.7746 * undB(CLIP_DBU) * Math.SQRT2;
      const fs = 400, fh = 50, T = 0.04;
      const s1 = (tt) => Math.sin(TAU * fs * (tt + t * 0.004)), h1 = (tt) => Math.sin(TAU * fh * (tt + t * 0.004)) + 0.3 * Math.sin(TAU * 3 * fh * (tt + t * 0.004));
      const k = bal ? 1 : 1;
      const defs = [
        { name: bal ? 'Pin 2 (hot)' : 'Signal wire', col: '#ff8a80', f: (tt) => (bal ? a / 2 : a) * s1(tt) + hm * h1(tt), max: niceMax((bal ? a / 2 : a) + hm * 1.3) },
        { name: bal ? 'Pin 3 (cold)' : 'Shield', col: '#8fb0ff', f: (tt) => (bal ? -a / 2 * s1(tt) + hm * h1(tt) : 0), max: niceMax((bal ? a / 2 : a) + hm * 1.3) },
        { name: 'After the preamp', col: '#5ce1a9', f: (tt) => clamp(g * (a * s1(tt) + ho * h1(tt)) * k, -clipV, clipV), max: niceMax(Math.min(clipV, g * (a + ho * 1.3))) },
      ];
      defs.forEach((d, i) => {
        const [yA, yB] = rows[i], ym = (yA + yB) / 2;
        c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, ym); c.lineTo(x1, ym); c.stroke();
        text(c, d.name, 24, ym - 4, { font: '600 20px sans-serif', col: d.col });
        text(c, '± ' + fmtV(d.max) + ' full height', 24, ym + 20, { font: '15px sans-serif' });
        c.strokeStyle = d.col; c.lineWidth = 3; c.beginPath();
        for (let j = 0; j <= 480; j++) { const tt = (j / 480) * T, y = ym - clamp(d.f(tt) / d.max, -1, 1) * (yB - yA) / 2, x = x0 + (j / 480) * (x1 - x0); j ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      });
      c.strokeStyle = 'rgba(255,255,255,.2)'; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(20, 280); c.lineTo(w - 20, 280); c.stroke(); c.setLineDash([]);
    }, 6.0);
    scope.mesh.position.set(0.3, 1.3, 0.9); root.add(scope.mesh);

    let acc = 0, lit = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s; t += dt;
        const narrow = fitNarrow(stage, [lShield, lPh, lCold]);
        reelBoards([[scope, [0.2, 6.6, 0], 1.0]]);
        rig.position.y = inReel() ? 4.3 : Y0;
        const bal = s.cable === 'bal', a = sig(s), hm = humIn(s);
        hot.visible = cold.visible = bCold.visible = bal; solo.visible = !bal;
        lHot.element.textContent = bal ? 'Pin 2: signal' : 'One signal wire'; lCold.visible = bal && !narrow;
        lShield.element.textContent = bal ? 'Shield (pin 1)' : 'Shield is the return wire';
        // Beads: the signal runs opposite on the two wires; the hum, once past the mains cable, runs the same on both.
        const ref = Math.max(a, 1e-4), sv = a > 0 ? 1 : 0, hv = clamp(hm / ref, 0, 2.5);
        for (let i = 0; i < NB; i++) {
          const x = XA + ((i + 0.5) / NB) * (XB - XA), ps = Math.sin(5.2 * x - t * 6.5), hh = Math.abs(x - XH) < 0.2 ? 0.5 : x > XH ? 1 : 0;
          const hu = hv * hh * Math.sin(t * 2.2);
          const put = (mesh, y, z, v) => { o.position.set(x, y, z); o.scale.setScalar(clamp(1 + 0.75 * v, 0.2, 3)); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); };
          if (bal) { put(bHot, R * Math.cos(kx * x), R * Math.sin(kx * x), 0.55 * sv * ps + 0.6 * hu); put(bCold, -R * Math.cos(kx * x), -R * Math.sin(kx * x), -0.55 * sv * ps + 0.6 * hu); }
          else put(bHot, 0, 0, 0.55 * sv * ps + 0.6 * hu);
        }
        bHot.instanceMatrix.needsUpdate = true; bCold.instanceMatrix.needsUpdate = true;
        rings.forEach((m, i) => { const u = (t * 0.35 + i / rings.length) % 1; m.scale.setScalar(0.15 + 1.25 * u); m.material.opacity = 0.7 * s.hum * (1 - u); m.visible = s.hum > 0.01; });
        lMains.visible = s.hum > 0.01 && !narrow;
        // Phantom power: both wires (and the resistors) glow together.
        const ph = s.phantom ? 0.45 : 0;
        hotM.emissiveIntensity = approach(hotM.emissiveIntensity, ph, 6, dt); coldM.emissiveIntensity = hotM.emissiveIntensity; resM.emissiveIntensity = hotM.emissiveIntensity * 2;
        lPh.visible = s.phantom && !narrow;
        lPh.element.textContent = bal ? '+48 V on both wires: 0 V between them' : '+48 V needs a balanced cable';
        lPre.element.textContent = bal ? 'Preamp: pin 2 minus pin 3' : 'Preamp: amplifies hum and all';
        // Knob and meter.
        knobTop.rotation.z = (0.75 - (s.gain / 70) * 1.5) * Math.PI;
        const out = dBu(undB(s.gain) * Math.hypot(a, humOut(s)));
        lit = approach(lit, clamp((out + 30) / 54, 0, 1) * 10, 8, dt);
        leds.forEach((l, i) => { l.material.opacity = i < lit ? 1 : 0.15; });
        acc += dt; if (acc > 0.06) { acc = 0; scope.redraw(); }
      },
      readout: (s) => {
        const a = sig(s), g = undB(s.gain), ho = humOut(s), out = g * a, outDb = dBu(Math.hypot(out, g * ho));
        const snr = a > 0 ? 20 * Math.log10(a / Math.max(ho, 1e-12)) : -Infinity;
        const need = a > 0 ? LINE_DBU - dBu(a) : null;
        const head = dead(s) ? 'No power: the condenser is silent' : outDb > CLIP_DBU ? 'Clipping: too much gain' : `Out: ${fmtV(out)} (${sgn(dBu(out), 0)} dBu)`;
        return compact(`<div class="big">${head}</div>
          <div class="row"><span>From the microphone</span><b>${a > 0 ? fmtV(a) + ' (' + sgn(dBu(a), 0) + ' dBu)' : 'nothing'}</b></div>
          <div class="row"><span>Hum under the voice</span>${s.hum < 0.005 ? '<b>none</b>' : `<b class="${snr > 40 ? 'ok' : 'no'}">${snr === -Infinity ? 'only hum' : snr > 0 ? Math.round(snr) + ' dB quieter' : Math.round(-snr) + ' dB louder'}</b>`}</div>
          <div class="row"><span>Hum on each wire</span><b>${fmtV(humIn(s))}${s.cable === 'bal' && s.hum > 0.005 ? ', ' + fmtV(ho) + ' left' : ''}</b></div>
          <div class="row"><span>Gain to reach line level</span><b>${need === null ? 'no signal' : Math.round(need) + ' dB (now ' + s.gain + ')'}</b></div>
          <div class="row"><span>Phantom power</span><b>${s.phantom ? (s.cable === 'bal' ? '48 V on pins 2 and 3' : 'not possible unbalanced') : 'off'}</b></div>
          <small>Sound: 94 dB SPL (1 Pa) at the microphone. Rejection of 60 dB is a real preamp chip’s figure. Hum per metre is illustrative.</small>`, stage);
      },
    };
  },
};
