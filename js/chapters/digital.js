// Chapter 6: into numbers (sampling, bit depth, clipping), and the howl of feedback.
// Sampling:
//   An analogue-to-digital converter measures the voltage fs times a second and rounds each measurement
//   to one of 2^bits levels. Anything above fs/2 (the Nyquist limit) folds back as a false, lower tone:
//   f_alias = |f − fs × round(f / fs)|. Ideal dynamic range ≈ 6.02 × bits + 1.76 dB.
//   CD audio: 44.1 kHz, 16 bits (Red Book, 1980). Film and video sound: 48 kHz. Phone calls: 8 kHz.
//   A signal bigger than full scale (0 dBFS) has its tops cut flat: clipping.
// Feedback:
//   Microphone → amplifier → loudspeaker → air → microphone is a loop. If the sound comes back louder
//   than it left (loop gain above 0 dB), each trip round makes it bigger and it howls. Sound from a
//   speaker falls 6 dB for each doubling of distance; a cardioid microphone's rejection follows
//   g(θ) = 0.5 + 0.5·cos θ. The loop can ring only where a whole number of waves fits the round trip,
//   so the candidate tones are multiples of c / d (the delay in the electronics is ignored here).
import { THREE, M, box, rod, tube, sphere, clamp, approach } from '../kit.js';
import { C_AIR, TAU, fmtHz, fmtM, sgn, patternResp, makePerson, makeSpeaker, makeMicOnStand, ripples, boardMesh, panel, text, fitNarrow, compact, reelBoards, inReel } from '../mic.js';

const RATES = [8000, 16000, 44100, 48000, 96000];
const RATE_NAME = { 8000: 'phone call', 16000: 'voice note', 44100: 'CD', 48000: 'film and video', 96000: 'studio' };
const SPAN = 2.9, XG = 0.7, WIN = 1;               // each side shows WIN = 1 ms of signal over SPAN units
const SM = 1.1;                                    // feedback scene: units per metre
const D2R = Math.PI / 180;
const alias = (f, fs) => Math.abs(f - fs * Math.round(f / fs));
const quant = (v, bits) => { const n = Math.pow(2, bits - 1); return clamp(Math.round(clamp(v, -1, 1) * n), -n, n - 1) / n; };
const loopGain = (s) => s.vol - 20 * Math.log10(s.dist) + 20 * Math.log10(Math.max(1e-3, Math.abs(patternResp('cardioid', s.aim * D2R))));

export default {
  id: 'digital',
  short: 'Into numbers',
  title: 'Into numbers',
  subtitle: 'Sampling, bits and clipping. And why a microphone near its own speaker howls.',
  view: { pos: [0.3, 4.7, 10.4], target: [0, 3.7, 0] },
  learn: `<p>A phone or computer cannot store a wiggling voltage. It stores <b>numbers</b>. So an <b>analogue-to-digital converter</b> measures the voltage again and again, very fast, and writes each measurement down. Each one is a <b>sample</b>.</p>
    <p>The <b>sample rate</b> is how many it takes each second. To catch a tone you need more than two samples per wave. So a rate of 48,000 a second can hold tones up to 24,000 Hz, a little past the top of human hearing. Feed it a higher tone and the samples trace out a false, lower one. That is <b>aliasing</b>, and a filter in front of the converter blocks it.</p>
    <p>The <b>bit depth</b> is how finely each sample is measured. 16 bits give 65,536 steps. Fewer bits mean coarser steps, which you hear as a gritty hiss.</p>
    <p>There is a largest number. A signal bigger than that gets its tops chopped flat. That is <b>clipping</b>, and it sounds harsh. So you set the preamp gain to leave some room. More in <a href="https://glassbox.how/filmsoundclear/">FilmSoundClear</a> and <a href="https://glassbox.how/synthclear/">SynthClear</a>.</p>
    <p><b>Feedback.</b> Put a microphone in front of the loudspeaker it feeds and you make a loop. Sound leaves the speaker, enters the microphone, gets amplified and leaves the speaker again. If it comes back louder each time round, it grows into a <b>howl</b> within a moment. To stop it: turn down, move the microphone away, or point its deaf side at the speaker. See <a href="https://glassbox.how/speakerclear/">SpeakerClear</a>.</p>
    <p class="tip"><b>Try it:</b> drop to 4 bits and look at the steps. Push the tone past half the sample rate. Then switch to feedback and turn the volume up until it howls.</p>`,
  terms: [
    { t: 'Sample', d: 'One measurement of the signal’s voltage at one instant, stored as a number.' },
    { t: 'Sample rate', d: 'How many samples are taken each second. CDs use 44,100, video uses 48,000.' },
    { t: 'Bit depth', d: 'How many binary digits each sample has. Every extra bit doubles the number of steps.' },
    { t: 'Nyquist limit', d: 'Half the sample rate: the highest frequency that sampling can capture correctly.' },
    { t: 'Aliasing', d: 'A tone above the Nyquist limit showing up as a false lower tone.' },
    { t: 'Clipping', d: 'Flattened wave tops when a signal is bigger than the largest value the system can hold.' },
    { t: 'Feedback', d: 'A loop where a microphone hears its own loudspeaker. If the loop gain is above 1, it howls.' },
  ],
  defaults: { show: 'sample', rate: 48000, bits: 16, level: -6, freq: 2000, vol: -8, dist: 3, aim: 0 },
  controls: [
    { key: 'show', type: 'seg', label: 'Show', options: [{ v: 'sample', label: 'Sampling' }, { v: 'howl', label: 'Feedback howl' }] },
    { key: 'rate', type: 'seg', label: 'Sampling: samples per second', options: RATES.map((v) => ({ v, label: v === 44100 ? '44.1k' : v / 1000 + 'k' })), fmt: (v) => RATE_NAME[v] },
    { key: 'bits', type: 'range', label: 'Sampling: bit depth', min: 1, max: 24, step: 1, ends: ['1 bit', '24 bits'], fmt: (v) => v + ' bits = ' + Math.pow(2, v).toLocaleString('en') + ' steps' },
    { key: 'level', type: 'range', label: 'Sampling: signal size', min: -40, max: 12, step: 1, ends: ['small', 'too big'], fmt: (v) => sgn(v, 0) + ' dB of full scale' },
    { key: 'freq', type: 'log', label: 'Sampling: tone', min: 500, max: 30000, ends: ['500 Hz', '30 kHz'], fmt: (v) => fmtHz(v) },
    { key: 'vol', type: 'range', label: 'Feedback: speaker volume', min: -20, max: 16, step: 1, ends: ['low', 'loud'], fmt: (v) => sgn(v, 0) + ' dB' },
    { key: 'dist', type: 'log', label: 'Feedback: microphone to speaker', min: 0.5, max: 6, ends: ['0.5 m', '6 m'], fmt: (v) => fmtM(v) },
    { key: 'aim', type: 'range', label: 'Feedback: microphone turned away by', min: 0, max: 180, step: 1, ends: ['faces speaker', 'back to it'], fmt: (v) => v + '°' },
    { key: 'clap', type: 'buttons', label: 'Feedback', items: [{ label: 'Tap the microphone', act: (s, inst) => inst?.tap?.() }] },
  ],
  quiz: [
    { q: 'A recording uses 48,000 samples a second. What is the highest tone it can capture correctly?', options: ['48,000 Hz', '24,000 Hz', '96,000 Hz', '4,800 Hz'], answer: 1, why: 'You need more than two samples for each wave, so the limit is half the sample rate: 24,000 Hz.' },
    { q: 'What does going from 16 bits to 8 bits do?', options: ['Halves the highest pitch', 'Makes each sample much coarser: 256 steps instead of 65,536, heard as gritty noise', 'Makes the file louder', 'Nothing you could hear'], answer: 1, why: 'Bit depth sets how finely each sample is measured. Each bit fewer halves the number of steps and adds about 6 dB of noise.' },
    { q: 'A microphone on stage starts to howl. Which of these will NOT help?', options: ['Turning the volume down', 'Moving the microphone further from the speaker', 'Pointing the back of a cardioid microphone at the speaker', 'Moving the microphone closer to the speaker'], answer: 3, why: 'Closer means the speaker’s sound arrives louder, which raises the loop gain. The other three all lower it.' },
  ],
  reel: [
    { ms: 5400, caption: 'A converter measures the signal 48,000 times a second and stores each measurement as a number.', set: { show: 'sample', rate: 48000, level: -3, freq: 2000 }, anim: { bits: [16, 3] }, view: { pos: [0.2, 4.9, 7.4], target: [0.2, 4.9, 0] }, spin: 0 },
    { ms: 5600, caption: 'A microphone that hears its own loudspeaker makes a loop, and past the tipping point it howls.', set: { show: 'howl', dist: 2, aim: 0 }, anim: { vol: [5, 16] }, act: (s, inst) => inst?.tap?.(), view: { pos: [0, 5.4, 7.0], target: [0, 4.6, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ================================================= sampling
    const A = new THREE.Group(); root.add(A);
    const rig = new THREE.Group(); rig.position.set(0.2, 3.5, 0); A.add(rig);
    const ND = 420, dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), M.glow(0xffb547), ND); dots.frustumCulled = false; rig.add(dots);
    const NBAR = 110, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), NBAR); bars.frustumCulled = false; rig.add(bars);
    const o = new THREE.Object3D(), colOk = new THREE.Color(0x8ef0ff), colClip = new THREE.Color(0xff5a8a);
    // The converter chip, and lines marking full scale.
    const chip = new THREE.Group(); rig.add(chip);
    chip.add(box(1.0, 0.36, 1.0, M.plastic(0x15171c)));
    for (let i = 0; i < 6; i++) for (const z of [-1, 1]) { const leg = box(0.07, 0.06, 0.16, M.metal(0xc9ced6)); leg.position.set(-0.375 + i * 0.15, -0.15, z * 0.56); chip.add(leg); }
    const fsM = M.ghost(0xffffff, 0.35);
    for (const y of [-1, 1]) for (const [xa, xb] of [[-XG - SPAN, -XG], [XG, XG + SPAN]]) { const l = rod(xa, xb, 0.008, 0.008, fsM, 6); l.position.y = y; rig.add(l); }
    const zero = rod(-XG - SPAN, XG + SPAN, 0.006, 0.006, M.ghost(0xffffff, 0.2), 6); rig.add(zero);
    const lIn = stage.label('Analogue: a smooth voltage', [-XG - SPAN / 2, 1.28, 0], rig);
    const lOut = stage.label('Digital: one number per sample', [XG + SPAN / 2, 1.28, 0], rig, 'hot');
    const lChip = stage.label('Converter', [0, -0.55, 0], rig);
    const lFs = stage.label('Full scale', [XG + SPAN + 0.1, -1.0, 0], rig);

    let S = s0, T = 0;
    const play = boardMesh(1000, 360, (c, w, h) => {
      const fa = alias(S.freq, S.rate), over = S.freq > S.rate / 2, amp = Math.pow(10, S.level / 20);
      panel(c, w, h, 'What plays back', over ? `a false tone of ${fmtHz(fa)} instead of ${fmtHz(S.freq)}` : amp > 1 ? 'tops cut flat: clipping' : S.bits < 8 ? 'coarse steps add gritty noise' : 'the same tone you put in');
      const x0 = 30, x1 = w - 30, yA = 90, yB = h - 30, ym = (yA + yB) / 2, H = (yB - yA) / 2 * 0.9, Tw = 2e-3;
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, ym); c.lineTo(x1, ym); c.stroke();
      c.setLineDash([6, 6]); for (const sgy of [-1, 1]) { c.beginPath(); c.moveTo(x0, ym + sgy * H); c.lineTo(x1, ym + sgy * H); c.stroke(); } c.setLineDash([]);
      const base = T * 1e-3;
      c.strokeStyle = 'rgba(255,181,71,.55)'; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= 700; i++) { const tt = base + (i / 700) * Tw, y = ym - H * clamp(amp * Math.sin(TAU * S.freq * tt), -1.15, 1.15), x = x0 + (i / 700) * (x1 - x0); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      // Playback: the tone the samples really describe (the alias when above the limit), rounded to the bit depth.
      // At every sample instant a tone f and the tone f − fs·round(f/fs) have exactly the same value.
      const n0 = Math.ceil(base * S.rate), fp = S.freq - S.rate * Math.round(S.freq / S.rate), ph0 = 0;
      c.strokeStyle = over || amp > 1 ? '#ff5a8a' : '#8ef0ff'; c.lineWidth = 4; c.beginPath();
      for (let i = 0; i <= 700; i++) { const tt = base + (i / 700) * Tw, v = quant(amp * Math.sin(TAU * fp * tt + ph0), Math.min(S.bits, 12)), y = ym - H * v, x = x0 + (i / 700) * (x1 - x0); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      c.fillStyle = '#fff';
      for (let n = n0; n / S.rate < base + Tw; n++) { const tt = n / S.rate, v = quant(amp * Math.sin(TAU * S.freq * tt), S.bits), x = x0 + ((tt - base) / Tw) * (x1 - x0); c.beginPath(); c.arc(x, ym - H * v, S.rate > 50000 ? 2.5 : 4, 0, TAU); c.fill(); }
      text(c, 'orange: what went in · dots: samples', x1, 40, { font: '17px sans-serif', align: 'right' });
    }, 6.0);
    play.mesh.position.set(0.3, 1.2, 0.9); A.add(play.mesh);

    // ================================================= feedback
    const B = new THREE.Group(); root.add(B);
    const sc = new THREE.Group(); sc.scale.setScalar(SM); sc.position.set(-3.0, 0, 0); B.add(sc);
    const singer = makePerson({ shirt: 0x8a5cd6 }); singer.position.set(-0.55, 0, 0); sc.add(singer);
    const mic = makeMicOnStand(1.45); mic.head.scale.setScalar(2.4); sc.add(mic);
    const spk = makeSpeaker(); spk.rotation.y = Math.PI; sc.add(spk);
    const pole = rod(0, 1, 0.02, 0.02, M.metal(0x8f96a3), 10); pole.rotation.z = Math.PI / 2; sc.add(pole);
    const cableM = M.plastic(0x23262d, { emissive: new THREE.Color(0xff5a8a), emissiveIntensity: 0 });
    let cable = null;
    const amp = box(0.5, 0.18, 0.4, M.plastic(0x2b2f38)); sc.add(amp);
    const ampLed = sphere(0.03, M.glow(0x5ce1a9), 10); ampLed.position.set(0, 0.06, 0.21); amp.add(ampLed);
    const waves = ripples(sc, 6, 0xff8aa8);
    const lLoop = stage.label('', [0, 2.2, 0], sc, 'hot');
    const lMic = stage.label('Microphone', [0.1, 0.35, 0.45], sc), lSpk = stage.label('Loudspeaker', [0, 0, 0], sc), lAmp = stage.label('Amplifier', [0, 0, 0], sc);
    let level = -30, dKey = -1, hist = new Array(240).fill(-60), hAcc = 0, auto = 0, howlT = 0;
    const histB = boardMesh(1000, 390, (c, w, h) => {
      const g = loopGain(S);
      panel(c, w, h, 'How loud the ringing is', g >= 0 ? 'each trip round the loop makes it bigger' : 'each trip round the loop makes it smaller');
      const x0 = 80, x1 = w - 30, yA = 92, yB = h - 36, Y = (L) => yB - ((clamp(L, -60, 40) + 60) / 100) * (yB - yA);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (const L of [-60, -40, -20, 0, 20, 40]) { c.beginPath(); c.moveTo(x0, Y(L)); c.lineTo(x1, Y(L)); c.stroke(); text(c, sgn(L, 0), x0 - 10, Y(L) + 5, { font: '15px sans-serif', align: 'right' }); }
      text(c, 'dB', 16, yA + 4, { font: '15px sans-serif' });
      c.fillStyle = 'rgba(255,90,138,.16)'; c.fillRect(x0, Y(40), x1 - x0, Y(34) - Y(40));
      text(c, 'amplifier flat out', x1 - 8, Y(40) + 20, { font: '16px sans-serif', col: '#ff8aa8', align: 'right' });
      c.strokeStyle = g >= 0 ? '#ff5a8a' : '#8ef0ff'; c.lineWidth = 4; c.beginPath();
      hist.forEach((L, i) => { const x = x0 + (i / (hist.length - 1)) * (x1 - x0), y = Y(L); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }, 4.4);
    histB.mesh.position.set(1.9, 3.5, -0.4); B.add(histB.mesh);

    const api = { tap() { level = Math.max(level, 0); auto = 0; } };
    let acc = 0;
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        const narrow = fitNarrow(stage, [lChip, lFs, lAmp]);
        lIn.element.textContent = narrow ? 'Analogue' : 'Analogue: a smooth voltage'; lOut.element.textContent = narrow ? 'Digital' : 'Digital: one number per sample';
        const smp = s.show === 'sample';
        A.visible = smp; B.visible = !smp;
        [lIn, lOut, lChip, lFs].forEach((l) => { l.visible = smp && !(narrow && (l === lChip || l === lFs)); });
        [lLoop, lMic, lSpk, lAmp].forEach((l) => { l.visible = !smp && !(narrow && l === lAmp); });
        reelBoards([[play, [0.2, 6.7, 0], 1.0], [histB, [-1.92, 3.52, 0], 1.16]]);
        rig.position.y = inReel() ? 4.3 : 3.5;
        B.position.set(inReel() ? 2.4 : 0, inReel() ? 2.2 : 0, 0); B.scale.setScalar(inReel() ? 1.25 : 1);
        if (smp) {
          T += dt * 0.12;                                                     // milliseconds of signal per second of watching
          const ampl = Math.pow(10, s.level / 20), Ts = 1000 / s.rate, f = s.freq * 1e-3;       // per ms
          for (let i = 0; i < ND; i++) { const u = i / (ND - 1) * WIN, v = clamp(ampl * Math.sin(TAU * f * (T + u)), -1.25, 1.25); o.position.set(-XG - (u / WIN) * SPAN, v, 0); o.scale.setScalar(1); o.updateMatrix(); dots.setMatrixAt(i, o.matrix); }
          dots.instanceMatrix.needsUpdate = true;
          const n1 = Math.floor(T / Ts), wBar = Math.min(0.2, (Ts / WIN) * SPAN * 0.62);
          for (let i = 0; i < NBAR; i++) {
            const n = n1 - i, u = T - n * Ts;
            if (u > WIN) { o.position.set(0, -50, 0); o.scale.setScalar(0.001); }
            else {
              const raw = ampl * Math.sin(TAU * f * n * Ts), v = quant(raw, s.bits), hgt = Math.max(0.012, Math.abs(v));
              o.position.set(XG + (u / WIN) * SPAN, v / 2, 0); o.scale.set(wBar, hgt, 0.3);
              bars.setColorAt(i, Math.abs(raw) > 1 ? colClip : colOk);
            }
            o.updateMatrix(); bars.setMatrixAt(i, o.matrix);
          }
          bars.instanceMatrix.needsUpdate = true; if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
        } else {
          const d = s.dist, g = loopGain(s), tau = d / C_AIR;
          if (Math.abs(d - dKey) > 1e-4) {
            dKey = d;
            spk.position.set(d + 0.19, 1.45 + 0.13, 0); pole.position.set(d + 0.19, 0.6, 0); pole.scale.x = 1.2;
            amp.position.set(d * 0.5, 0.09, 0.9);
            if (cable) { sc.remove(cable); cable.geometry.dispose(); }
            cable = tube([[0, 0.02, 0], [0.15, 0.02, 0.5], [d * 0.5 - 0.3, 0.02, 0.9], [d * 0.5 + 0.3, 0.02, 0.9], [d, 0.02, 0.45], [d + 0.19, 0.02, 0]], 0.02, cableM, false, 80); sc.add(cable);
            lSpk.position.set(d + 0.3, 2.35, 0); lAmp.position.set(d * 0.5, 0.5, 0.9); lLoop.position.set(d * 0.5, 2.05, 0);
          }
          mic.head.rotation.y = -s.aim * D2R;
          // Slowed 100 times: the level changes by the loop gain on every round trip (d / c seconds).
          level += (g / tau) * dt / 100;
          level = clamp(level, -60, 40);
          if (!inReel()) { auto += dt; if (level <= -58 && auto > 2.5) api.tap(); }
          howlT += dt;
          const lin = clamp((level + 45) / 85, 0, 1);
          waves.rings.forEach((m) => { m.position.set(d, 1.45 + 0.02, 0); });
          waves.step(howlT * 0.6, 0.15, Math.max(0.3, d), 0.25 + 0.95 * lin);
          waves.rings.forEach((m) => { m.scale.setScalar(Math.max(0.05, m.scale.x)); });
          cableM.emissiveIntensity = lin * 1.6;
          spk.cone.position.x = spk.front - 0.004 + 0.03 * lin * Math.sin(howlT * 40);
          ampLed.material.color.setHex(level > 30 ? 0xff5a8a : 0x5ce1a9);
          lLoop.element.textContent = g >= 0 ? `Loop gain ${sgn(g, 1)} dB: it howls` : `Loop gain ${sgn(g, 1)} dB: it dies away`;
          lLoop.element.style.color = g >= 0 ? '#ff5a8a' : ''; lLoop.element.style.borderColor = g >= 0 ? '#ff5a8a' : '';
          hAcc += dt; if (hAcc > 0.04 || inReel()) { hAcc = 0; hist.push(level); hist.shift(); }
        }
        acc += dt; if (acc > 0.06) { acc = 0; (smp ? play : histB).redraw(); }
      },
      readout: (s) => {
        if (s.show === 'sample') {
          const over = s.freq > s.rate / 2, clip = s.level > 0, kbps = (s.rate * s.bits) / 1000, dr = 6.02 * s.bits + 1.76;
          const n = Math.pow(2, s.bits - 1), q = Math.round(clamp(Math.pow(10, s.level / 20) * Math.sin(TAU * s.freq * 1e-3 * Math.floor(T / (1000 / s.rate)) * (1000 / s.rate)), -1, 1) * (n - 1));
          const bin = s.bits <= 16 ? ((q + 2 * n) % (2 * n)).toString(2).padStart(s.bits, '0').replace(/(.{4})(?=.)/g, '$1 ') : q.toLocaleString('en');
          return compact(`<div class="big">${(s.rate / 1000).toLocaleString('en')} kHz, ${s.bits} bits${clip ? ': clipping' : over ? ': aliasing' : ''}</div>
            <div class="row"><span>Highest tone it can hold</span><b>${fmtHz(s.rate / 2)}</b></div>
            <div class="row"><span>Your tone of ${fmtHz(s.freq)}</span><b class="${over ? 'no' : 'ok'}">${over ? 'comes out as ' + fmtHz(alias(s.freq, s.rate)) : 'captured'}</b></div>
            <div class="row"><span>Loudest to quietest</span><b>about ${Math.round(dr)} dB</b></div>
            <div class="row"><span>Data</span><b>${kbps >= 1000 ? (kbps / 1000).toFixed(2) + ' Mbit/s' : Math.round(kbps) + ' kbit/s'}, ${((kbps * 60) / 8 / 1000).toFixed(1)} MB a minute</b></div>
            <div class="row"><span>Latest sample</span><b>${bin}</b></div>
            <small>One channel, uncompressed. The picture shows a thousandth of a second on each side of the converter.</small>`, stage);
        }
        const g = loopGain(s), pat = 20 * Math.log10(Math.max(1e-3, Math.abs(patternResp('cardioid', s.aim * D2R))));
        return compact(`<div class="big">${g >= 0 ? 'Howl' : 'Stable'}: loop gain ${sgn(g, 1)} dB</div>
          <div class="row"><span>Speaker volume</span><b>${sgn(s.vol, 0)} dB</b></div>
          <div class="row"><span>Distance, ${fmtM(s.dist)}</span><b>${sgn(-20 * Math.log10(s.dist), 1)} dB</b></div>
          <div class="row"><span>Cardioid turned ${s.aim}° away</span><b>${pat <= -59 ? 'deaf to it' : sgn(pat, 1) + ' dB'}</b></div>
          <div class="row"><span>Round trip through the air</span><b>${(s.dist / C_AIR * 1000).toFixed(1)} ms</b></div>
          <div class="row"><span>It can ring at multiples of</span><b>${fmtHz(C_AIR / s.dist)}</b></div>
          <small>Volume is set so that 0 dB just howls at 1 m, facing the speaker. Growth is slowed 100 times.</small>`, stage);
      },
    };
  },
};
