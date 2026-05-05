/**
 * ZENMIX v3 Audio Engine — NexusCore ⚡
 * Web Audio API puro. Sin dependencias. Sin servidor.
 *
 * window.ZENMIX.audio = {
 *   loadFile, processVoice, startBinaural, stopBinaural,
 *   generateAmbience, createMixerTrack, exportMix,
 *   onPlay, onStop, onProgress
 * }
 */

(function () {
  'use strict';

  // ─── ZENMIX Namespace ────────────────────────────────────────────────
  window.ZENMIX = window.ZENMIX || {};
  const ZA = {}; // internal
  window.ZENMIX.audio = ZA;

  // ─── Observables ─────────────────────────────────────────────────────
  ZA._listeners = { play: [], stop: [], progress: [], error: [] };
  function _emit(ev, data) { (ZA._listeners[ev] || []).forEach(cb => { try { cb(data); } catch (e) { console.warn(e); } }); }
  ZA.onPlay     = cb => ZA._listeners.play.push(cb);
  ZA.onStop     = cb => ZA._listeners.stop.push(cb);
  ZA.onProgress = cb => ZA._listeners.progress.push(cb);
  ZA.onError    = cb => ZA._listeners.error.push(cb);

  // ─── Global AudioContext ─────────────────────────────────────────────
  let _ctx = null;
  function ctx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // ─── AudioWorklet availability ──────────────────────────────────────
  let _workletReady = false;
  let _useWorklet = false;

  // ─── Utility: dB ↔ linear ───────────────────────────────────────────
  function dBToGain(db)  { return Math.pow(10, db / 20); }
  function gainToDb(gain) { return 20 * Math.log10(Math.max(gain, 1e-9)); }

  // ─── Utility: seconds → time string ────────────────────────────────
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // =====================================================================
  //  1. PROCESADOR DE AUDIO (con AudioWorklet + fallback ScriptProcessor)
  // =====================================================================

  // -- AudioWorklet processor code (inlined as string) --
  const WORKLET_CODE = `
    class ZenmixProcessor extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        return [
          { name: 'noiseGateThreshold', defaultValue: 0.01, min: 0, max: 1 },
          { name: 'compressorThreshold', defaultValue: -24, min: -60, max: 0 },
          { name: 'compressorRatio',     defaultValue: 4,   min: 1,   max: 20 },
          { name: 'compressorGain',      defaultValue: 6,   min: 0,   max: 24 },
          { name: 'eqLowGain',           defaultValue: 3,   min: -12, max: 12 },
          { name: 'eqMidGain',           defaultValue: 0,   min: -12, max: 12 },
          { name: 'eqHighGain',          defaultValue: -2,  min: -12, max: 12 },
          { name: 'speed',               defaultValue: 1,   min: 0.25,max: 4 },
          { name: 'pitchShift',          defaultValue: 0,   min: -12, max: 12 },
          { name: 'wetDry',              defaultValue: 1,   min: 0,   max: 1 },
          { name: 'bypass',              defaultValue: 0,   min: 0,   max: 1 },
        ];
      }

      constructor() {
        super();
        // IIR biquad coefs for 80Hz high-pass (Q=0.71)
        this.hpB0 = 0;
        this.hpB1 = 0;
        this.hpB2 = 0;
        this.hpA1 = 0;
        this.hpA2 = 0;
        this._designHP(80, 0.71);

        // low-pass 12kHz (Q=0.71)
        this.lpB0 = 0;
        this.lpB1 = 0;
        this.lpB2 = 0;
        this.lpA1 = 0;
        this.lpA2 = 0;
        this._designLP(12000, 0.71);

        // state buffers
        this.hpX1 = 0; this.hpX2 = 0; this.hpY1 = 0; this.hpY2 = 0;
        this.lpX1 = 0; this.lpX2 = 0; this.lpY1 = 0; this.lpY2 = 0;

        // compressor envelope
        this.env = 0;
      }

      _designHP(fc, Q) {
        const w0 = 2 * Math.PI * fc / sampleRate;
        const cosW = Math.cos(w0);
        const alpha = Math.sin(w0) / (2 * Q);
        const a0 = 1 + alpha;
        this.hpB0 = (1 + cosW) / 2 / a0;
        this.hpB1 = -(1 + cosW) / a0;
        this.hpB2 = (1 + cosW) / 2 / a0;
        this.hpA1 = -2 * cosW / a0;
        this.hpA2 = (1 - alpha) / a0;
      }

      _designLP(fc, Q) {
        const w0 = 2 * Math.PI * fc / sampleRate;
        const cosW = Math.cos(w0);
        const alpha = Math.sin(w0) / (2 * Q);
        const a0 = 1 + alpha;
        const tmp = (1 - cosW) / 2;
        this.lpB0 = tmp / a0;
        this.lpB1 = 2 * tmp / a0;
        this.lpB2 = tmp / a0;
        this.lpA1 = -2 * cosW / a0;
        this.lpA2 = (1 - alpha) / a0;
      }

      process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !output) return true;

        const chIn  = input[0];
        const chOut = output[0];
        if (!chIn || !chOut) return true;

        const bypass  = parameters.bypass[0] > 0.5;
        const gateThr = parameters.noiseGateThreshold[0];
        const compThr = dBToLin(parameters.compressorThreshold[0]);
        const compRat = parameters.compressorRatio[0];
        const compGain= dBToLin(parameters.compressorGain[0]);
        const eqLow   = dBToLin(parameters.eqLowGain[0]);
        const eqMid   = dBToLin(parameters.eqMidGain[0]);
        const eqHigh  = dBToLin(parameters.eqHighGain[0]);
        const wetDry  = parameters.wetDry[0];

        for (let i = 0; i < chIn.length; i++) {
          let x = chIn[i];
          let dryX = x;

          if (!bypass) {
            // HP + LP noise gate
            let hpY = this.hpB0 * x + this.hpB1 * this.hpX1 + this.hpB2 * this.hpX2 - this.hpA1 * this.hpY1 - this.hpA2 * this.hpY2;
            let lpY = this.lpB0 * hpY + this.lpB1 * this.lpX1 + this.lpB2 * this.lpX2 - this.lpA1 * this.lpY1 - this.lpA2 * this.lpY2;
            x = lpY;

            // noise gate (simple)
            if (Math.abs(x) < gateThr) x *= 0.1;

            // compressor envelope (RMS)
            const rms = Math.sqrt(this.env);
            this.env = 0.9995 * this.env + 0.0005 * (x * x);
            let compG = 1;
            if (rms > compThr) {
              compG = compThr + (rms - compThr) / compRat;
              compG /= rms;
            }
            x *= compG * compGain;

            // simple 3-band EQ shelving (boost mid-magic: 200-400Hz)
            // approximated with biquad-like magic
            x *= eqLow * 0.5 + eqMid * 1.0 + eqHigh * 0.5;

            // shift registers
            this.hpX2 = this.hpX1; this.hpX1 = chIn[i];
            this.hpY2 = this.hpY1; this.hpY1 = hpY;
            this.lpX2 = this.lpX1; this.lpX1 = hpY;
            this.lpY2 = this.lpY1; this.lpY1 = lpY;
          }

          chOut[i] = dryX * (1 - wetDry) + x * wetDry;
        }
        return true;
      }
    }

    function dBToLin(db) { return Math.pow(10, db / 20); }

    registerProcessor('zenmix-processor', ZenmixProcessor);
  `;

  // Register AudioWorklet
  async function ensureWorklet() {
    if (_workletReady) return _useWorklet;
    try {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await ctx().audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      _useWorklet = true;
    } catch (e) {
      console.warn('AudioWorklet not available, falling back to ScriptProcessor', e);
      _useWorklet = false;
    }
    _workletReady = true;
    return _useWorklet;
  }

  // =====================================================================
  //  1a. loadFile(file) → AudioBuffer
  // =====================================================================
  ZA.loadFile = async function (file) {
    const arrayBuf = await file.arrayBuffer();
    const audioBuf = await ctx().decodeAudioData(arrayBuf);
    _emit('progress', { type: 'loaded', file: file.name, duration: audioBuf.duration });
    return audioBuf;
  };

  // =====================================================================
  //  1b. processVoice(buffer, settings) → AudioBuffer (processed)
  // =====================================================================
  ZA.processVoice = async function (buffer, settings = {}) {
    const s = {
      noiseGateThreshold: settings.noiseGateThreshold ?? 0.01,
      compressorThreshold: settings.compressorThreshold ?? -24,
      compressorRatio: settings.compressorRatio ?? 4,
      compressorGain: settings.compressorGain ?? 6,
      eqLowGain: settings.eqLowGain ?? 3,       // boost 200-400Hz warmth
      eqMidGain: settings.eqMidGain ?? 0,
      eqHighGain: settings.eqHighGain ?? -2,     // cut harsh highs
      speed: settings.speed ?? 1,
      pitchShift: settings.pitchShift ?? 0,       // semitones
      fadeIn: settings.fadeIn ?? 0,
      fadeOut: settings.fadeOut ?? 0,
      trimStart: settings.trimStart ?? 0,
      trimEnd: settings.trimEnd ?? 0,
      wetDry: settings.wetDry ?? 1,
    };

    const totalTrim = s.trimStart + s.trimEnd;
    const origLen = buffer.length;
    const origSR = buffer.sampleRate;
    const adjustedLen = origLen - Math.floor(totalTrim * origSR);
    if (adjustedLen <= 0) throw new Error('Trim demasiado agresivo — buffer vacío');

    // Apply speed (preserve pitch → just stretch/squash duration via sampleRate trick)
    const exportSR = origSR / s.speed;
    const exportLen = Math.floor(adjustedLen * s.speed);

    // Pitch shift: adjust playback rate after speed
    const pitchFactor = Math.pow(2, s.pitchShift / 12);
    const finalLen = Math.floor(exportLen / pitchFactor);

    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels, Math.max(finalLen, 1), exportSR
    );

    // Source
    const src = offlineCtx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pitchFactor;
    // trim by offset
    src.detune.value = 0;

    // Gain for fade + trim (start offset simulated via scheduling)
    const fadeGain = offlineCtx.createGain();
    fadeGain.gain.setValueAtTime(0, 0);
    // fade in
    if (s.fadeIn > 0) {
      fadeGain.gain.linearRampToValueAtTime(1, s.fadeIn);
    } else {
      fadeGain.gain.setValueAtTime(1, 0);
    }
    // fade out near end
    const dur = adjustedLen / origSR;
    if (s.fadeOut > 0) {
      fadeGain.gain.setValueAtTime(1, dur - s.fadeOut);
      fadeGain.gain.linearRampToValueAtTime(0, dur);
    }

    // Processing via ScriptProcessor (reliable offline)
    const processor = offlineCtx.createScriptProcessor(256, buffer.numberOfChannels, buffer.numberOfChannels);
    processor.onaudioprocess = function (e) {
      const ib = e.inputBuffer;
      const ob = e.outputBuffer;
      const thr = s.noiseGateThreshold;

      for (let ch = 0; ch < ib.numberOfChannels; ch++) {
        const id = ib.getChannelData(ch);
        const od = ob.getChannelData(ch);
        for (let i = 0; i < id.length; i++) {
          let v = id[i];
          // Noise gate (HP+LP already handled by pre-filter; simple gate here)
          if (Math.abs(v) < thr) v *= 0.05;
          od[i] = v;
        }
      }
    };

    // Compressor + EQ via DynamicsCompressorNode + BiquadFilter
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = s.compressorThreshold;
    comp.ratio.value = s.compressorRatio;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    const eqLow = offlineCtx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 300;
    eqLow.gain.value = s.eqLowGain;

    const eqHigh = offlineCtx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 6000;
    eqHigh.gain.value = s.eqHighGain;

    // HP filter for noise removal (80Hz)
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    hp.Q.value = 0.71;

    // LP filter (12kHz)
    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 12000;
    lp.Q.value = 0.71;

    // Chain
    src.connect(hp);
    hp.connect(lp);
    lp.connect(fadeGain);
    fadeGain.connect(processor);
    processor.connect(comp);
    comp.connect(eqLow);
    eqLow.connect(eqHigh);
    eqHigh.connect(offlineCtx.destination);

    // Start with trim offset
    src.start(0, s.trimStart, dur - s.trimEnd - s.trimStart);

    _emit('progress', { type: 'processing', phase: 'voice' });
    const result = await offlineCtx.startRendering();
    _emit('progress', { type: 'processed', phase: 'voice', duration: result.duration });
    return result;
  };

  // =====================================================================
  //  1c. Reverb (algorithmic) — crea un nodo de reverb convolution-simulado
  // =====================================================================
  ZA.createReverb = function (type = 'medium') {
    const c = ctx();
    const presets = {
      small:  { delay: 0.3, decay: 0.5, mix: 0.3 },
      medium: { delay: 0.6, decay: 1.2, mix: 0.4 },
      large:  { delay: 1.0, decay: 2.5, mix: 0.5 },
      cathedral: { delay: 1.5, decay: 5.0, mix: 0.6 },
    };
    const p = presets[type] || presets.medium;

    const dryGain = c.createGain();
    dryGain.gain.value = 1 - p.mix;
    const wetGain = c.createGain();
    wetGain.gain.value = p.mix;

    const delay = c.createDelay(Math.max(p.delay + 1, 2));
    delay.delayTime.value = p.delay;

    const feedback = c.createGain();
    feedback.gain.value = p.decay / (p.delay * 2);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4000;

    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 200;

    delay.connect(feedback);
    feedback.connect(lp);
    lp.connect(hp);
    hp.connect(delay);

    // Return a wrapper with input/dry/wet
    const inNode = c.createGain();
    inNode.gain.value = 1;

    const outNode = c.createGain();
    outNode.gain.value = 1;

    inNode.connect(dryGain);
    dryGain.connect(outNode);
    inNode.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(outNode);

    return {
      input: inNode,
      output: outNode,
      set mix(v) { wetGain.gain.value = v; dryGain.gain.value = 1 - v; },
      get mix() { return wetGain.gain.value; },
      set decay(v) { feedback.gain.value = v / (p.delay * 2); },
      set time(v)  { delay.delayTime.value = v; },
      disconnect() {
        inNode.disconnect(); outNode.disconnect();
        delay.disconnect(); feedback.disconnect();
        lp.disconnect(); hp.disconnect();
      }
    };
  };

  // =====================================================================
  //  1d. Delay / Echo sincronizado
  // =====================================================================
  ZA.createDelay = function (timeSec = 0.3, feedbackAmt = 0.4, mix = 0.5) {
    const c = ctx();
    const dry = c.createGain();
    dry.gain.value = 1 - mix;
    const wet = c.createGain();
    wet.gain.value = mix;
    const delay = c.createDelay(2);
    delay.delayTime.value = timeSec;
    const fb = c.createGain();
    fb.gain.value = feedbackAmt;

    const input = c.createGain();
    const output = c.createGain();

    input.connect(dry);
    dry.connect(output);
    input.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(output);

    return {
      input, output,
      set time(v) { delay.delayTime.value = v; },
      set feedback(v) { fb.gain.value = v; },
      set mix(v) { wet.gain.value = v; dry.gain.value = 1 - v; },
      disconnect() { input.disconnect(); output.disconnect(); }
    };
  };

  // =====================================================================
  //  2. MOTOR BINAURAL
  // =====================================================================

  const BINAURAL_MODES = {
    delta:  { min: 0.5, max: 4,   label: 'Delta (sueño profundo)',   carrier: 144 },
    theta:  { min: 4,   max: 8,   label: 'Theta (meditación)',       carrier: 180 },
    alpha:  { min: 8,   max: 13,  label: 'Alpha (relajación)',       carrier: 220 },
    sigma:  { min: 12,  max: 16,  label: 'Sigma (SMR/foco)',         carrier: 240 },
    beta:   { min: 16,  max: 30,  label: 'Beta (concentración)',     carrier: 280 },
    gamma:  { min: 30,  max: 100, label: 'Gamma (peak cognition)',   carrier: 340 },
  };

  let _binauralState = {
    active: false,
    mode: 'alpha',
    leftOsc: null,
    rightOsc: null,
    pannerL: null,
    pannerR: null,
    gain: null,
    wetGain: null,
    dryGain: null,
    analyzer: null,
    beatFreq: 10,
    carrierBase: 220,
    volume: 0.3,
    pan: 0,
    wetDry: 0.8,
    fadeInterval: null,
  };

  ZA._getBinauralState = () => _binauralState;
  ZA.getBinauralModes = () => BINAURAL_MODES;

  ZA.startBinaural = function (mode = 'alpha', volume = 0.3, settings = {}) {
    const c = ctx();
    const info = BINAURAL_MODES[mode] || BINAURAL_MODES.alpha;
    stopBinauralInternal(true);

    const carrier = settings.carrierBase || info.carrier;
    const beatFreq = settings.beatFreq || ((info.min + info.max) / 2);

    // Left osc = carrier Hz
    const leftOsc = c.createOscillator();
    leftOsc.type = 'sine';
    leftOsc.frequency.value = carrier;

    // Right osc = carrier + beat (creates binaural beat)
    const rightOsc = c.createOscillator();
    rightOsc.type = 'sine';
    rightOsc.frequency.value = carrier + beatFreq;

    const pannerL = c.createStereoPanner();
    pannerL.pan.value = -1; // hard left

    const pannerR = c.createStereoPanner();
    pannerR.pan.value = 1;  // hard right

    // Wet/dry
    const wetGain = c.createGain();
    wetGain.gain.value = settings.wetDry ?? 0.8;
    const dryGain = c.createGain();
    dryGain.gain.value = 1 - (settings.wetDry ?? 0.8);

    // Master gain (fade in)
    const gain = c.createGain();
    gain.gain.value = 0;

    // VU analyzer
    const analyzer = c.createAnalyser();
    analyzer.fftSize = 256;

    leftOsc.connect(pannerL);
    pannerL.connect(wetGain);
    rightOsc.connect(pannerR);
    pannerR.connect(wetGain);
    wetGain.connect(gain);
    gain.connect(analyzer);
    analyzer.connect(c.destination);

    leftOsc.start();
    rightOsc.start();

    // fade in smoothly
    gain.gain.setTargetAtTime(volume, c.currentTime + 0.05, 0.5);

    _binauralState = {
      active: true, mode, leftOsc, rightOsc,
      pannerL, pannerR, gain, wetGain, dryGain, analyzer,
      beatFreq, carrierBase: carrier, volume, pan: 0,
      wetDry: settings.wetDry ?? 0.8,
      fadeInterval: null,
    };

    _emit('play', { type: 'binaural', mode, beatFreq });
    return _binauralState;
  };

  function stopBinauralInternal(fast = false) {
    const bs = _binauralState;
    if (!bs.active) return;
    const c = ctx();
    if (fast) {
      try { bs.leftOsc?.stop(); } catch (e) { /* */ }
      try { bs.rightOsc?.stop(); } catch (e) { /* */ }
      bs.gain?.disconnect();
    } else {
      // Fade out
      if (bs.gain) {
        bs.gain.gain.setTargetAtTime(0, c.currentTime + 0.05, 0.3);
        setTimeout(() => {
          try { bs.leftOsc?.stop(); } catch (e) { /* */ }
          try { bs.rightOsc?.stop(); } catch (e) { /* */ }
          bs.gain?.disconnect();
        }, 300);
      }
    }
    _binauralState.active = false;
    _emit('stop', { type: 'binaural' });
  }

  ZA.stopBinaural = () => stopBinauralInternal(false);

  ZA.setBinauralMode = function (mode) {
    const info = BINAURAL_MODES[mode];
    if (!info || !_binauralState.active) return;
    const beatFreq = (info.min + info.max) / 2;
    _binauralState.beatFreq = beatFreq;
    _binauralState.mode = mode;
    if (_binauralState.leftOsc) _binauralState.leftOsc.frequency.setTargetAtTime(info.carrier, ctx().currentTime + 0.05, 0.5);
    if (_binauralState.rightOsc) _binauralState.rightOsc.frequency.setTargetAtTime(info.carrier + beatFreq, ctx().currentTime + 0.05, 0.5);
  };

  ZA.setBinauralVolume = function (v) {
    if (_binauralState.active && _binauralState.gain) {
      _binauralState.volume = Math.max(0, Math.min(1, v));
      _binauralState.gain.gain.setTargetAtTime(_binauralState.volume, ctx().currentTime + 0.02, 0.3);
    }
  };

  ZA.setBinauralBeatFreq = function (hz) {
    if (!_binauralState.active || !_binauralState.rightOsc) return;
    _binauralState.beatFreq = hz;
    _binauralState.rightOsc.frequency.setTargetAtTime(_binauralState.carrierBase + hz, ctx().currentTime + 0.05, 0.5);
  };

  // =====================================================================
  //  3. GENERADOR DE AMBIENTE PROCEDURAL
  // =====================================================================

  // Pink noise (for rain, ocean bases)
  function createPinkNoiseNode() {
    const c = ctx();
    const bufSize = 4096;
    const buffer = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  ZA.generateAmbience = function (type = 'rain') {
    const c = ctx();
    const ambGain = c.createGain();
    ambGain.gain.value = 0.5;

    const ambAnalyzer = c.createAnalyser();
    ambAnalyzer.fftSize = 256;

    let sourceNode = null;
    let filter = null;

    const ambObj = {
      type,
      gain: ambGain,
      analyzer: ambAnalyzer,
      output: c.createGain(), // final destination node
      _nodes: [],
      set volume(v) { ambGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), c.currentTime + 0.05, 0.3); },
      stop() { this._nodes.forEach(n => { try { n.stop(); } catch(e) {} n.disconnect(); }); },
      connect(dest) { this.output.connect(dest); },
      disconnect() { this.output.disconnect(); },
    };

    // Route: source → filter → gain → analyzer → output
    ambGain.connect(ambAnalyzer).connect(ambObj.output);

    switch (type) {
      case 'rain':
        sourceNode = createPinkNoiseNode();
        filter = c.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3000;
        filter.Q.value = 0.5;
        sourceNode.connect(filter);
        filter.connect(ambGain);
        sourceNode.start();
        ambObj._nodes.push(sourceNode);
        break;

      case 'ocean':
        sourceNode = createPinkNoiseNode();
        // Low frequency rumble with LFO on gain for wave effect
        filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        const lfo = c.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // slow wave
        const lfoGain = c.createGain();
        lfoGain.gain.value = 0.2;
        lfo.connect(lfoGain);
        lfoGain.connect(ambGain.gain);
        lfo.start();
        sourceNode.connect(filter);
        filter.connect(ambGain);
        sourceNode.start();
        ambObj._nodes.push(sourceNode, lfo);
        break;

      case 'forest':
        // Mix of pink noise (wind) + crackles
        sourceNode = createPinkNoiseNode();
        const forestFilter = c.createBiquadFilter();
        forestFilter.type = 'bandpass';
        forestFilter.frequency.value = 1800;
        forestFilter.Q.value = 0.3;
        const forestGain = c.createGain();
        forestGain.gain.value = 0.6;
        sourceNode.connect(forestFilter);
        forestFilter.connect(forestGain);
        forestGain.connect(ambGain);
        sourceNode.start();
        // Add occasional chirps/birds with random osc bursts
        ambObj._nodes.push(sourceNode);

        // Random bird sounds
        let birdInterval = setInterval(() => {
          if (!ambObj.output) { clearInterval(birdInterval); return; }
          if (Math.random() > 0.6) {
            const birdOsc = c.createOscillator();
            birdOsc.type = 'sine';
            birdOsc.frequency.value = 800 + Math.random() * 2000;
            const birdG = c.createGain();
            birdG.gain.setValueAtTime(0, c.currentTime);
            birdG.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.05);
            birdG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
            birdOsc.connect(birdG);
            birdG.connect(ambGain);
            birdOsc.start();
            birdOsc.stop(c.currentTime + 0.4);
            ambObj._nodes.push(birdOsc);
          }
        }, 3000);
        ambObj._birdInterval = birdInterval;
        break;

      case 'fire':
        // Crackling fire = high-pass pink noise + random pops
        sourceNode = createPinkNoiseNode();
        const fireFilter = c.createBiquadFilter();
        fireFilter.type = 'highpass';
        fireFilter.frequency.value = 1500;
        const fireGain = c.createGain();
        fireGain.gain.value = 0.5;
        // Crackle LFO
        const crackleLfo = c.createOscillator();
        crackleLfo.type = 'sawtooth';
        crackleLfo.frequency.value = 12;
        const crackleMod = c.createGain();
        crackleMod.gain.value = 0.3;
        crackleLfo.connect(crackleMod);
        crackleMod.connect(fireGain.gain);
        crackleLfo.start();
        sourceNode.connect(fireFilter);
        fireFilter.connect(fireGain);
        fireGain.connect(ambGain);
        sourceNode.start();
        ambObj._nodes.push(sourceNode, crackleLfo);
        break;

      case 'night':
        // Crickets + soft wind
        sourceNode = createPinkNoiseNode();
        const nightFilter = c.createBiquadFilter();
        nightFilter.type = 'lowpass';
        nightFilter.frequency.value = 400;
        const nightGain = c.createGain();
        nightGain.gain.value = 0.25;
        sourceNode.connect(nightFilter);
        nightFilter.connect(nightGain);
        nightGain.connect(ambGain);
        sourceNode.start();
        ambObj._nodes.push(sourceNode);

        // Cricket tones
        let cricketInterval = setInterval(() => {
          if (!ambObj.output) { clearInterval(cricketInterval); return; }
          const co = c.createOscillator();
          co.type = 'square';
          co.frequency.value = 4500 + Math.random() * 500;
          const cg = c.createGain();
          cg.gain.setValueAtTime(0, c.currentTime);
          cg.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.02);
          cg.gain.setValueAtTime(0.08, c.currentTime + 0.04);
          cg.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
          co.connect(cg);
          cg.connect(ambGain);
          co.start();
          co.stop(c.currentTime + 0.15);
          ambObj._nodes.push(co);
        }, 500 + Math.random() * 2000);
        ambObj._cricketInterval = cricketInterval;
        break;

      default:
        throw new Error('Tipo de ambiente no soportado: ' + type);
    }

    return ambObj;
  };

  // =====================================================================
  //  4. MEZCLADOR MULTICANAL
  // =====================================================================

  let _tracks = [];
  let _trackIdCounter = 0;
  let _masterGain = null;
  let _masterAnalyzer = null;

  function ensureMaster() {
    if (_masterGain) return;
    const c = ctx();
    _masterGain = c.createGain();
    _masterGain.gain.value = 0.8;
    _masterAnalyzer = c.createAnalyser();
    _masterAnalyzer.fftSize = 2048;
    _masterGain.connect(_masterAnalyzer);
    _masterAnalyzer.connect(c.destination);
  }

  ZA.createMixerTrack = function (name, buffer = null) {
    ensureMaster();
    const c = ctx();
    const id = ++_trackIdCounter;

    // Track chain
    const gainNode = c.createGain();
    gainNode.gain.value = 0.8;

    const panNode = c.createStereoPanner();
    panNode.pan.value = 0;

    const muteNode = c.createGain();
    muteNode.gain.value = 1; // 0 = muted, 1 = unmuted

    const soloNode = c.createGain();
    soloNode.gain.value = 1;

    const analyzer = c.createAnalyser();
    analyzer.fftSize = 512;

    // Effects insert chain
    const fxInput = c.createGain();
    const fxOutput = c.createGain();

    // Route: gain → pan → mute → solo → [fx send/insert] → analyzer → master
    gainNode.connect(panNode);
    panNode.connect(muteNode);
    muteNode.connect(soloNode);
    soloNode.connect(fxInput);
    fxInput.connect(fxOutput);
    fxOutput.connect(analyzer);
    analyzer.connect(_masterGain);

    const track = {
      id,
      name: name || `Track ${id}`,
      gain: gainNode,
      pan: panNode,
      mute: muteNode,
      solo: soloNode,
      analyzer,
      fxInput,
      fxOutput,
      buffer,
      _muted: false,
      _solo: false,
      _activeSources: [],
      _effects: [],

      set volume(v) { gainNode.gain.setTargetAtTime(Math.max(0, Math.min(2, v)), c.currentTime + 0.02, 0.3); },
      get volume() { return gainNode.gain.value; },
      set panVal(v) { panNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, v)), c.currentTime + 0.02, 0.3); },
      get panVal() { return panNode.pan.value; },

      toggleMute() {
        this._muted = !this._muted;
        muteNode.gain.setTargetAtTime(this._muted ? 0 : 1, c.currentTime + 0.02, 0.1);
      },
      setMuted(m) {
        this._muted = m;
        muteNode.gain.setTargetAtTime(m ? 0 : 1, c.currentTime + 0.02, 0.1);
      },
      toggleSolo() {
        this._solo = !this._solo;
        _updateSoloStates();
      },
      setSolo(s) {
        this._solo = s;
        _updateSoloStates();
      },

      addEffect(effectFn) {
        // effectFn should return { input, output, bypass }
        // Rechain: fxInput → effect → fxOutput
        const effect = effectFn(c);
        this._effects.push(effect);

        // Disconnect current direct path
        fxInput.disconnect();
        fxInput.connect(effect.input);
        effect.output.connect(fxOutput);
      },

      removeEffects() {
        this._effects.forEach(e => {
          try { e.input?.disconnect(); } catch (ex) { /* */ }
          try { e.output?.disconnect(); } catch (ex) { /* */ }
        });
        this._effects = [];
        fxInput.disconnect();
        fxInput.connect(fxOutput); // restore direct path
      },

      play(when = 0, offset = 0, duration) {
        if (!this.buffer) return null;
        const src = c.createBufferSource();
        src.buffer = this.buffer;
        src.connect(gainNode);
        src.start(c.currentTime + when, offset, duration);
        this._activeSources.push(src);
        src.onended = () => {
          const idx = this._activeSources.indexOf(src);
          if (idx >= 0) this._activeSources.splice(idx, 1);
        };
        _emit('play', { type: 'track', trackId: id, name: this.name });
        return src;
      },

      stop() {
        this._activeSources.forEach(s => {
          try { s.stop(); } catch (e) { /* */ }
        });
        this._activeSources = [];
        _emit('stop', { type: 'track', trackId: id, name: this.name });
      },

      destroy() {
        this.stop();
        gainNode.disconnect();
        panNode.disconnect();
        muteNode.disconnect();
        soloNode.disconnect();
        fxInput.disconnect();
        fxOutput.disconnect();
        analyzer.disconnect();
        const idx = _tracks.indexOf(this);
        if (idx >= 0) _tracks.splice(idx, 1);
      },
    };

    _tracks.push(track);

    // Auto-play if buffer provided
    if (buffer) {
      track.play(0);
    }

    return track;
  };

  function _updateSoloStates() {
    const anySolo = _tracks.some(t => t._solo);
    _tracks.forEach(t => {
      if (anySolo) {
        t.soloNode.gain.setTargetAtTime(t._solo ? 1 : 0, ctx().currentTime + 0.02, 0.1);
      } else {
        t.soloNode.gain.setTargetAtTime(1, ctx().currentTime + 0.02, 0.1);
      }
    });
  }

  ZA.getTracks = () => _tracks;
  ZA.getMasterAnalyser = () => _masterAnalyzer;

  ZA.setMasterVolume = function (v) {
    ensureMaster();
    _masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx().currentTime + 0.02, 0.3);
  };

  // =====================================================================
  //  5. TIMELINE & EXPORT
  // =====================================================================

  let _timelineClips = [];

  ZA.addTimelineClip = function (trackId, buffer, startTime = 0, offset = 0, duration = null) {
    const clip = {
      id: Date.now() + Math.random(),
      trackId,
      buffer,
      startTime,
      offset,
      duration: duration ?? (buffer.duration - offset),
      durationFull: duration ?? (buffer.duration - offset),
    };
    _timelineClips.push(clip);
    return clip;
  };

  ZA.removeTimelineClip = function (clipId) {
    _timelineClips = _timelineClips.filter(c => c.id !== clipId);
  };

  ZA.getTimelineClips = () => _timelineClips;

  ZA.moveTimelineClip = function (clipId, newStartTime, newTrackId) {
    const clip = _timelineClips.find(c => c.id === clipId);
    if (!clip) return;
    clip.startTime = Math.max(0, newStartTime);
    if (newTrackId != null) clip.trackId = newTrackId;
  };

  ZA.resizeTimelineClip = function (clipId, newDuration) {
    const clip = _timelineClips.find(c => c.id === clipId);
    if (!clip) return;
    clip.duration = Math.min(newDuration, clip.durationFull);
  };

  // Play timeline live
  let _timelineStartTime = 0;
  let _timelinePlaying = false;

  ZA.playTimeline = function () {
    if (_timelinePlaying) return;
    _timelinePlaying = true;
    _timelineStartTime = ctx().currentTime;

    _timelineClips.forEach(clip => {
      const track = _tracks.find(t => t.id === clip.trackId);
      if (!track) return;
      const src = ctx().createBufferSource();
      src.buffer = clip.buffer;
      src.connect(track.gain);
      const schedTime = _timelineStartTime + clip.startTime;
      src.start(schedTime, clip.offset, clip.duration);
      track._activeSources.push(src);
    });
    _emit('play', { type: 'timeline' });
  };

  ZA.stopTimeline = function () {
    if (!_timelinePlaying) return;
    _tracks.forEach(t => {
      t._activeSources.forEach(s => {
        try { s.stop(); } catch (e) { /* */ }
      });
      t._activeSources = [];
    });
    _timelinePlaying = false;
    _emit('stop', { type: 'timeline' });
  };

  // ─── Export Mix ─────────────────────────────────────────────────────
  /**
   * Renderiza el timeline completo offline y devuelve WAV blob.
   * Opcional: format='wav'|'mp3buffer' (WAV siempre, MP3 con lamejs si disponible)
   */
  ZA.exportMix = async function (format = 'wav') {
    _emit('progress', { type: 'export', phase: 'start', format });

    // Calculate total duration
    let maxEnd = 0;
    _timelineClips.forEach(c => {
      const end = c.startTime + c.duration;
      if (end > maxEnd) maxEnd = end;
    });
    if (maxEnd <= 0) throw new Error('No clips to export');

    const sampleRate = 44100;
    const channels = 2;
    const totalSamples = Math.ceil(maxEnd * sampleRate);

    const offlineCtx = new OfflineAudioContext(channels, totalSamples, sampleRate);
    const masterOut = offlineCtx.createGain();
    masterOut.gain.value = 0.8;

    // Gather all clips grouped by track
    // Each clip → its own source with gain/pan
    const trackMap = {};
    _timelineClips.forEach(c => {
      if (!trackMap[c.trackId]) trackMap[c.trackId] = [];
      trackMap[c.trackId].push(c);
    });

    const trackCfgs = {};
    _tracks.forEach(t => {
      if (trackMap[t.id]) {
        trackCfgs[t.id] = { volume: t.gain.gain.value, pan: t.panNode.pan.value, muted: t._muted };
      }
    });

    Object.keys(trackMap).forEach(trackId => {
      const cfg = trackCfgs[Number(trackId)];
      if (cfg?.muted) return; // skip muted tracks
      const trackGain = offlineCtx.createGain();
      trackGain.gain.value = cfg ? cfg.volume : 1;

      const trackPan = offlineCtx.createStereoPanner();
      trackPan.pan.value = cfg ? cfg.pan : 0;

      trackGain.connect(trackPan);
      trackPan.connect(masterOut);

      const clips = trackMap[trackId];
      // Sort by startTime for crossfade calculation
      clips.sort((a, b) => a.startTime - b.startTime);

      clips.forEach((clip, idx) => {
        const src = offlineCtx.createBufferSource();
        src.buffer = clip.buffer;
        src.connect(trackGain);

        // Crossfade: if next clip overlaps, apply fade out
        let fadeOutStart = clip.startTime + clip.duration;
        const nextClip = clips[idx + 1];
        let hasOverlap = false;
        if (nextClip && nextClip.startTime < fadeOutStart) {
          hasOverlap = true;
          fadeOutStart = nextClip.startTime - 0.01; // slight overlap
        }

        if (hasOverlap) {
          const clipGain = offlineCtx.createGain();
          src.connect(clipGain);
          clipGain.connect(trackGain);
          // Fade out at overlap
          clipGain.gain.setValueAtTime(1, fadeOutStart - 0.02);
          clipGain.gain.linearRampToValueAtTime(0, fadeOutStart);
        }

        src.start(clip.startTime, clip.offset, clip.duration);
      });
    });

    masterOut.connect(offlineCtx.destination);

    _emit('progress', { type: 'export', phase: 'rendering', duration: maxEnd });
    const rendered = await offlineCtx.startRendering();
    _emit('progress', { type: 'export', phase: 'done', duration: maxEnd });

    if (format === 'mp3' && window.Lame) {
      _emit('progress', { type: 'export', phase: 'mp3-encoding' });
      const wavBlob = audioBufferToWav(rendered);
      const wavArrayBuf = await wavBlob.arrayBuffer();
      const wavData = new Uint8Array(wavArrayBuf);
      const mp3Data = window.Lame.encode(wavData);
      _emit('progress', { type: 'export', phase: 'complete', format: 'mp3' });
      return new Blob([mp3Data], { type: 'audio/mpeg' });
    }

    _emit('progress', { type: 'export', phase: 'complete', format: 'wav' });
    return audioBufferToWav(rendered);
  };

  // Convert AudioBuffer → WAV Blob
  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    const bytesPerSample = 2;
    const dataLen = length * numChannels * bytesPerSample;
    const headerLen = 44;
    const totalLen = headerLen + dataLen;
    const ab = new ArrayBuffer(totalLen);
    const dv = new DataView(ab);

    // RIFF header
    writeString(dv, 0, 'RIFF');
    dv.setUint32(4, totalLen - 8, true);
    writeString(dv, 8, 'WAVE');
    writeString(dv, 12, 'fmt ');
    dv.setUint32(16, 16, true); // PCM
    dv.setUint16(20, 1, true);
    dv.setUint16(22, numChannels, true);
    dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    dv.setUint16(32, numChannels * bytesPerSample, true);
    dv.setUint16(34, 16, true);
    writeString(dv, 36, 'data');
    dv.setUint32(40, dataLen, true);

    let offset = 44;
    const chData = [];
    for (let ch = 0; ch < numChannels; ch++) {
      chData.push(buffer.getChannelData(ch));
    }

    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = Math.max(-1, Math.min(1, chData[ch][i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        dv.setInt16(offset, sample, true);
        offset += 2;
      }
    }

    return new Blob([ab], { type: 'audio/wav' });
  }

  function writeString(dv, offset, str) {
    for (let i = 0; i < str.length; i++) {
      dv.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // ─── Download helper ────────────────────────────────────────────────
  ZA.downloadBlob = function (blob, filename = 'zenmix-export.wav') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // =====================================================================
  //  6. VU METER utilities ──────────────────────────────────────────────
  // =====================================================================
  ZA.getVUData = function (analyserNode) {
    if (!analyserNode) return { left: 0, right: 0, freqs: [] };
    const fftSize = analyserNode.fftSize;
    const bufLen = analyserNode.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    // Time domain for L/R average
    analyserNode.getByteTimeDomainData(data);
    let rmsL = 0, rmsR = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = (data[i] - 128) / 128;
      if (i < bufLen / 2) rmsL += v * v;
      else rmsR += v * v;
    }
    rmsL = Math.sqrt(rmsL / (bufLen / 2));
    rmsR = Math.sqrt(rmsR / (bufLen / 2));

    // Frequency data
    const freqData = new Uint8Array(bufLen);
    analyserNode.getByteFrequencyData(freqData);

    return {
      left: rmsL,
      right: rmsR,
      freqs: Array.from(freqData),
      peakL: rmsL,
      peakR: rmsR,
    };
  };

  // =====================================================================
  //  7. UTILITY: getContext, resume, helpers ────────────────────────────
  // =====================================================================
  ZA.getContext = () => ctx();
  ZA.resume = () => { ctx().resume(); };

  // =====================================================================
  //  8. FULL STOP / DISPOSE ─────────────────────────────────────────────
  // =====================================================================
  ZA.stopAll = function () {
    stopBinauralInternal(true);
    _tracks.forEach(t => t.stop());
    _timelinePlaying = false;
    _emit('stop', { type: 'global' });
  };

  ZA.dispose = function () {
    ZA.stopAll();
    _tracks.forEach(t => t.destroy());
    _tracks = [];
    _timelineClips = [];
    if (_ctx) { _ctx.close(); _ctx = null; }
    _workletReady = false;
  };

  // =====================================================================
  //  LAUNCH SEQUENCE — try to register worklet early
  // =====================================================================
  // Deferred: ctx() lazy creates; worklet registered on first use

  console.log('%c🎛️  ZENMIX v3 Audio Engine ready %c| NexusCore ⚡',
    'color:#00ff88;font-weight:bold', 'color:#aaa');
  console.log('%c   window.ZENMIX.audio %c← your API surface',
    'color:#00ccff', 'color:#aaa');

})();
