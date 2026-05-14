import { ProjectConfig } from '../types';
import * as lamejs from 'lamejs';
import { createOfflineAudioContext, AudioError } from './audioUtils';

// ── NOISE GATE (pre-procesamiento) ────────────────────────────────────────────
// Aplica un noise gate al buffer de voz antes de entrar a la cadena de efectos.
// Silencia señal por debajo del threshold con envolvente RMS y ataque/liberación suave.
const applyNoiseGate = (
  buffer: AudioBuffer,
  threshold: number = 0.005, // -46dB aprox
  attackMs: number = 1,
  releaseMs: number = 50
): AudioBuffer => {
  const sr = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const length = buffer.length;

  const attackCoef = Math.exp(-1000 / (attackMs * sr));
  const releaseCoef = Math.exp(-1000 / (releaseMs * sr));
  const rmsWindow = Math.ceil(sr * 0.005); // ventana 5ms para RMS

  const out = new Float32Array(channels * length);
  let env = 0;

  for (let i = 0; i < length; i++) {
    // RMS por muestra (promedio entre canales)
    let rms = 0;
    for (let c = 0; c < channels; c++) {
      rms += buffer.getChannelData(c)[i] * buffer.getChannelData(c)[i];
    }
    rms = Math.sqrt(rms / channels);

    // Envolvente suave
    const target = rms > threshold ? 1 : 0;
    const coef = target > env ? attackCoef : releaseCoef;
    env = target + coef * (env - target);

    // Aplicar ganancia a cada canal
    for (let c = 0; c < channels; c++) {
      out[c * length + i] = buffer.getChannelData(c)[i] * env;
    }
  }

  const gated = new AudioContext().createBuffer(channels, length, sr);
  for (let c = 0; c < channels; c++) {
    gated.getChannelData(c).set(out.subarray(c * length, (c + 1) * length));
  }
  return gated;
};

// ── PINK NOISE MEJORADO ───────────────────────────────────────────────────────
// Algoritmo multi-octava Voss-McCartney con refinamientos:
// - 8 etapas de filtrado para densidad espectral más precisa (-3dB/oct)
// - Normalización adaptativa para evitar picos
// - Anti-DC offset
export const createPinkNoiseBuffer = (ctx: BaseAudioContext, duration: number): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.ceil(sampleRate * duration);
  // Estéreo para espacialidad natural
  const buffer = ctx.createBuffer(2, bufferSize, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const output = buffer.getChannelData(ch);

    // Estado de las 8 etapas del filtro ladder
    const state = new Float64Array(8);
    let runningSum = 0;
    const normFactor = 1.0 / 12.0; // normalización empírica

    for (let i = 0; i < bufferSize; i++) {
      // Generar ruido blanco gaussiano (Box-Muller simplificado)
      const u1 = Math.random();
      const u2 = Math.random();
      const white = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);

      // Filtro ladder de 8 polos con actualización probabilística (Voss-McCartney)
      for (let stage = 0; stage < 8; stage++) {
        if ((i & ((1 << stage) - 1)) === 0 || stage === 0) {
          // Esta etapa se actualiza a su propia tasa
          const alpha = 1.0 / (1 << (stage + 1));
          state[stage] = state[stage] * (1 - alpha) + white * alpha;
        }
      }

      // Suma ponderada de todas las etapas
      let pink = 0;
      const weights = [1.0, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];
      for (let s = 0; s < 8; s++) {
        pink += state[s] * weights[s];
      }

      // Normalización y anti-DC
      pink *= normFactor;
      runningSum += pink;
      const dc = runningSum / (i + 1);
      output[i] = (pink - dc * 0.1) * 0.15; // nivel conservador
    }

    // Pequeña decorrelación entre canales: fase inicial diferente
    // (Math.random() ya garantiza secuencias distintas por canal)
    if (ch === 1) {
      // Atenuación sutil del segundo canal para evitar fase central
      for (let i = 0; i < bufferSize; i++) {
        output[i] *= 0.85;
      }
    }
  }

  return buffer;
};

// ── REVERB POR CONVOLUCIÓN CON IMPULSO NATURAL ─────────────────────────────────
// Genera una respuesta al impulso que simula una sala real con:
// - Early reflections discretas (primera ola)
// - Late reflections densas (cola difusa)
// - Decaimiento exponencial con damping frecuencial (highs decaen más rápido)
const createNaturalReverbImpulse = (
  ctx: BaseAudioContext,
  duration: number = 2.8,
  rt60: number = 1.5 // tiempo de reverberación en segundos
): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);

    // Parámetros por canal (asimetría para imagen estéreo natural)
    const earlyReflections = ch === 0 ? 12 : 14;
    const erStart = 0.005; // segundos
    const erEnd = 0.060;   // segundos

    // Early reflections — picos discretos con espaciado pseudo-aleatorio
    for (let e = 0; e < earlyReflections; e++) {
      const t = erStart + (erEnd - erStart) * (e / earlyReflections);
      // Jitter temporal para romper periodicidad
      const jitter = (Math.random() - 0.5) * 0.003;
      const idx = Math.floor((t + jitter) * sampleRate);
      if (idx >= 0 && idx < length) {
        // Amplitud decae con el tiempo
        const amp = (1 - e / earlyReflections) * 0.35 * (0.7 + Math.random() * 0.3);
        // Polaridad alternante
        const polarity = e % 2 === 0 ? 1 : -1;
        data[idx] = amp * polarity;
      }
    }

    // Late reflections — ruido filtrado con envolvente exponencial
    const lateStart = Math.floor(erEnd * sampleRate);
    let b0 = 0, b1 = 0; // filtro lowpass simple de 1 polo para el ruido

    for (let i = lateStart; i < length; i++) {
      const t = i / sampleRate;

      // Envolvente: decaimiento exponencial con damping frecuencial
      const envDecay = Math.exp(-3 * t / rt60); // RT60 → -60dB en rt60 segundos

      // Ruido suave + filtrado paso-bajo con cutoff decreciente
      const noise = (Math.random() * 2 - 1) * 0.3;
      const cutoff = 12000 * Math.exp(-t * 3); // highs decaen más rápido
      const alpha = Math.exp(-2 * Math.PI * cutoff / sampleRate);
      b0 = b0 + alpha * (noise - b0);
      b1 = b1 + alpha * (b0 - b1);

      data[i] = b1 * envDecay * 0.6;
    }
  }

  return impulse;
};

// ── SOFT CLIPPER / LIMITER (post-procesamiento) ───────────────────────────────
// Lookahead limiter con soft-clipping para prevenir distorsión digital.
// Brick-wall a -0.5dB para evitar intersample peaks en la conversión a MP3.
const applySoftClipLimiter = (
  buffer: AudioBuffer,
  ceiling: number = 0.944 // -0.5dB
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const sr = buffer.sampleRate;

  // Lookahead de 1ms para anticipar picos
  const lookaheadSamples = Math.ceil(sr * 0.001);
  const out = new AudioContext().createBuffer(channels, length, sr);

  for (let ch = 0; ch < channels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = out.getChannelData(ch);
    let gainReduction = 1.0; // ganancia actual del limiter
    const releaseCoef = Math.exp(-1000 / (sr * 0.015)); // release 15ms

    for (let i = 0; i < length; i++) {
      // Encontrar pico máximo en la ventana de lookahead
      let peak = 0;
      const windowEnd = Math.min(i + lookaheadSamples, length);
      for (let j = i; j < windowEnd; j++) {
        const abs = Math.abs(input[j]);
        if (abs > peak) peak = abs;
      }

      // Calcular ganancia necesaria
      const targetGain = peak > ceiling ? ceiling / peak : 1.0;

      // Suavizar cambios de ganancia (attack instantáneo, release suave)
      if (targetGain < gainReduction) {
        gainReduction = targetGain; // attack instantáneo
      } else {
        gainReduction = targetGain + releaseCoef * (gainReduction - targetGain);
      }

      // Soft-clip adicional para transitorios extremos
      let sample = input[i] * gainReduction;
      if (Math.abs(sample) > ceiling * 0.9) {
        // Soft knee: tanh suave en la zona alta
        const x = sample / ceiling;
        sample = ceiling * (x / (1 + Math.abs(x) * 0.15));
      }

      output[i] = sample;
    }
  }

  return out;
};

// ── MERGE AUDIO BUFFERS ───────────────────────────────────────────────────────
export const mergeAudioBuffers = (ctx: BaseAudioContext, buffers: AudioBuffer[]): AudioBuffer => {
  if (buffers.length === 1) return buffers[0];

  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const out = ctx.createBuffer(
    Math.max(...buffers.map(b => b.numberOfChannels)),
    totalLength,
    buffers[0].sampleRate
  );

  let offset = 0;
  buffers.forEach(buffer => {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      out.getChannelData(channel).set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length;
  });

  return out;
};

// ── RENDER FINAL MIX ──────────────────────────────────────────────────────────
// Cadena completa de masterización a 48kHz:
// noise-gate → highpass → compressor → bass → treble → dry/wet(reverb) → limiter
export const renderFinalMix = async (
  config: ProjectConfig,
  voiceBuffer: AudioBuffer
): Promise<AudioBuffer> => {
  const sampleRate = 48000; // Calidad de estudio
  const totalDuration = config.preRollDuration + voiceBuffer.duration + config.postRollDuration;

  // ── Pre-procesar voz con noise gate ──
  const gatedVoiceBuffer = applyNoiseGate(
    voiceBuffer,
    config.voiceEnhance ? 0.004 : 0.001, // más agresivo si enhance activo
    1,   // attack 1ms
    50   // release 50ms
  );

  const offlineCtx = createOfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
  const voiceStartTime = config.preRollDuration;

  // ═══════════════════════════════════════════════════════════
  // CADENA BINAURAL
  // ═══════════════════════════════════════════════════════════
  const leftOsc = offlineCtx.createOscillator();
  const rightOsc = offlineCtx.createOscillator();
  const leftGain = offlineCtx.createGain();
  const rightGain = offlineCtx.createGain();
  const merger = offlineCtx.createChannelMerger(2);
  const masterBinauralGain = offlineCtx.createGain();

  leftOsc.type = 'sine';
  rightOsc.type = 'sine';
  leftOsc.frequency.value = config.carrierFreq - config.beatFreq / 2;
  rightOsc.frequency.value = config.carrierFreq + config.beatFreq / 2;

  leftOsc.connect(leftGain);
  rightOsc.connect(rightGain);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  merger.connect(masterBinauralGain);
  masterBinauralGain.connect(offlineCtx.destination);

  const binVol = config.binauralVolume;
  const duckedVol = binVol * (1 - config.duckingAmount);
  const fadeInSec = Math.min(config.fadeDuration / 1000, 2.0);
  const fadeOutSec = Math.min(config.fadeDuration / 1000, 3.0);

  // ── Crossfade binaural: entrada suave ──
  masterBinauralGain.gain.setValueAtTime(0, 0);
  masterBinauralGain.gain.linearRampToValueAtTime(binVol, fadeInSec);

  // ── Ducking durante la voz con crossfade extendido (1.5s en vez de 0.5s) ──
  if (voiceBuffer.duration > 0 && config.duckingAmount > 0) {
    const duckStart = Math.max(0, voiceStartTime - 1.5);
    const duckEnd = voiceStartTime + voiceBuffer.duration + 1.5;

    masterBinauralGain.gain.setValueAtTime(binVol, duckStart);
    masterBinauralGain.gain.linearRampToValueAtTime(duckedVol, voiceStartTime);
    masterBinauralGain.gain.setValueAtTime(duckedVol, voiceStartTime + voiceBuffer.duration);
    masterBinauralGain.gain.linearRampToValueAtTime(binVol, duckEnd);
  }

  // ── Fade out final ──
  const fadeOutStart = totalDuration - fadeOutSec;
  masterBinauralGain.gain.setValueAtTime(masterBinauralGain.gain.value, fadeOutStart);
  masterBinauralGain.gain.linearRampToValueAtTime(0, totalDuration);

  leftOsc.start(0);
  rightOsc.start(0);
  leftOsc.stop(totalDuration);
  rightOsc.stop(totalDuration);

  // ═══════════════════════════════════════════════════════════
  // PINK NOISE (ATMOSFÉRICO)
  // ═══════════════════════════════════════════════════════════
  if (config.usePinkNoise && config.noiseLevel > 0) {
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = createPinkNoiseBuffer(offlineCtx, totalDuration);

    // Filtro paso-bajo para suavizar el ruido (más envolvente)
    const noiseSmooth = offlineCtx.createBiquadFilter();
    noiseSmooth.type = 'lowpass';
    noiseSmooth.frequency.value = 8000;
    noiseSmooth.Q.value = 0.5;

    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.value = config.noiseLevel * 0.22;

    // Fade in/out del noise sincronizado con la mezcla
    noiseGain.gain.setValueAtTime(0, 0);
    noiseGain.gain.linearRampToValueAtTime(config.noiseLevel * 0.22, fadeInSec);
    noiseGain.gain.setValueAtTime(config.noiseLevel * 0.22, fadeOutStart);
    noiseGain.gain.linearRampToValueAtTime(0, totalDuration);

    noiseSource.connect(noiseSmooth);
    noiseSmooth.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);
    noiseSource.start(0);
    noiseSource.stop(totalDuration);
  }

  // ═══════════════════════════════════════════════════════════
  // CADENA DE VOZ CON SMART ENHANCE
  // ═══════════════════════════════════════════════════════════
  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = gatedVoiceBuffer;

  // Highpass filter (elimina rumble subsónico)
  const enhanceFilter = offlineCtx.createBiquadFilter();
  enhanceFilter.type = 'highpass';
  enhanceFilter.frequency.value = config.voiceEnhance ? 90 : 30;
  enhanceFilter.Q.value = 0.7;

  // Compressor (nivelación de dinámica)
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = config.voiceEnhance ? -28 : -6;
  compressor.ratio.value = config.voiceEnhance ? 5 : 2;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.2;
  compressor.knee.value = 8;

  // EQ: Graves (lowshelf)
  const bassFilter = offlineCtx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 220;
  bassFilter.gain.value = config.voiceBass;

  // EQ: Agudos (highshelf)
  const trebleFilter = offlineCtx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 3200;
  trebleFilter.gain.value = config.voiceTreble;

  // Reverb por convolución con impulso natural
  const reverb = offlineCtx.createConvolver();
  reverb.buffer = createNaturalReverbImpulse(offlineCtx, 2.8, 1.5);
  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = config.voiceReverb * 1.15;

  // Dry/Wet mix
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 1.0 - (config.voiceReverb * 0.35);

  // Master de voz
  const voiceMasterGain = offlineCtx.createGain();
  voiceMasterGain.gain.value = config.voiceVolume;

  // ── Conexiones ──
  voiceSource.connect(enhanceFilter);
  enhanceFilter.connect(compressor);
  compressor.connect(bassFilter);
  bassFilter.connect(trebleFilter);

  // Split dry/wet
  trebleFilter.connect(dryGain);
  trebleFilter.connect(reverb);
  reverb.connect(reverbGain);

  dryGain.connect(voiceMasterGain);
  reverbGain.connect(voiceMasterGain);
  voiceMasterGain.connect(offlineCtx.destination);

  // ── Crossfade de entrada para la voz (1s) ──
  const voiceFadeIn = Math.min(1.0, voiceBuffer.duration * 0.1);
  voiceMasterGain.gain.setValueAtTime(0, voiceStartTime);
  voiceMasterGain.gain.linearRampToValueAtTime(config.voiceVolume, voiceStartTime + voiceFadeIn);

  // ── Crossfade de salida para la voz (1.5s) ──
  const voiceFadeOut = Math.min(1.5, voiceBuffer.duration * 0.15);
  const voiceEnd = voiceStartTime + voiceBuffer.duration;
  voiceMasterGain.gain.setValueAtTime(config.voiceVolume, voiceEnd - voiceFadeOut);
  voiceMasterGain.gain.linearRampToValueAtTime(0, voiceEnd);

  voiceSource.start(voiceStartTime);
  voiceSource.stop(voiceEnd);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const renderedBuffer = await offlineCtx.startRendering();

  // ── Post-procesar con soft-clip limiter ──
  return applySoftClipLimiter(renderedBuffer, 0.944); // -0.5dB ceiling
};

// ── BUFFER → WAV ───────────────────────────────────────────────────────────────
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // chunk size
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt "
  setUint32(16); // PCM
  setUint16(1); // PCM format
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // data chunk size

  for (let i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
};

// ── BUFFER → MP3 (192kbps) ─────────────────────────────────────────────────────
export const audioBufferToMp3 = async (buffer: AudioBuffer): Promise<Blob> => {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;

  // Sanitize: replace NaN/Infinity with 0
  const sanitize = (data: Float32Array) => {
    for (let i = 0; i < data.length; i++) {
      if (!isFinite(data[i])) data[i] = 0;
    }
  };

  const left = buffer.getChannelData(0);
  sanitize(left);
  let right: Float32Array;
  if (channels > 1) {
    right = buffer.getChannelData(1);
    sanitize(right);
  } else {
    right = left;
  }

  const Mp3Encoder = (lamejs as any).Mp3Encoder || (window as any).lamejs?.Mp3Encoder;
  if (!Mp3Encoder) throw new Error('Lamejs not found');

  const mp3encoder = new Mp3Encoder(channels, sampleRate, 192);
  const mp3Data: Uint8Array[] = [];

  // If buffer is empty, throw early
  if (left.length === 0) throw new Error('Audio buffer vacío');

  const l = new Int16Array(left.length);
  const r = new Int16Array(right.length);

  for (let i = 0; i < left.length; i++) {
    const s = Math.max(-1, Math.min(1, left[i]));
    l[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    const t = Math.max(-1, Math.min(1, right[i]));
    r[i] = t < 0 ? t * 0x8000 : t * 0x7fff;
  }

  const sampleBlockSize = 1152;
  for (let i = 0; i < l.length; i += sampleBlockSize) {
    const leftChunk = l.subarray(i, i + sampleBlockSize);
    const rightChunk = r.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
  }

  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(new Uint8Array(end));

  return new Blob(mp3Data, { type: 'audio/mp3' });
};
