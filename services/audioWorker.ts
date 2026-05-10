// audioWorker.ts — Web Worker for offline audio rendering
// Runs OfflineAudioContext on a background thread so the UI never freezes

export interface WorkerRequest {
  id: string;
  config: {
    carrierFreq: number;
    beatFreq: number;
    noiseLevel: number;
    usePinkNoise: boolean;
    preRollDuration: number;
    postRollDuration: number;
    binauralVolume: number;
    voiceVolume: number;
    voiceReverb: number;
    voiceBass: number;
    voiceTreble: number;
    voiceEnhance: boolean;
    fadeDuration: number;
    duckingAmount: number;
  };
  voiceBuffer: ArrayBuffer;
  sampleRate: number;
  channels: number;
  length: number;
}

export interface WorkerResponse {
  id: string;
  type: 'progress' | 'result' | 'error';
  progress?: number;
  renderedBuffer?: ArrayBuffer;
  sampleRate?: number;
  length?: number;
  channels?: number;
  error?: string;
}

// Pink noise generator (identical to main-thread version)
function createPinkNoiseBuffer(ctx: OfflineAudioContext, duration: number): AudioBuffer {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

function createReverbImpulse(ctx: OfflineAudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let i = 0; i < 2; i++) {
    const channel = impulse.getChannelData(i);
    for (let j = 0; j < length; j++) {
      channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
    }
  }
  return impulse;
}

async function renderMix(
  config: WorkerRequest['config'],
  voiceArrayBuffer: ArrayBuffer,
  voiceSampleRate: number,
  voiceChannels: number,
  voiceLength: number
): Promise<AudioBuffer> {
  // Reconstruct voice AudioBuffer in the worker
  const offlineCtx = new OfflineAudioContext(1, voiceLength, voiceSampleRate);
  const voiceBuffer = await offlineCtx.decodeAudioData(voiceArrayBuffer.slice(0));

  const sampleRate = 44100;
  const totalDuration = config.preRollDuration + voiceBuffer.duration + config.postRollDuration;
  const ctx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  const voiceStartTime = config.preRollDuration;

  // Binaural oscillators
  const leftOsc = ctx.createOscillator();
  const rightOsc = ctx.createOscillator();
  const leftGain = ctx.createGain();
  const rightGain = ctx.createGain();
  const merger = ctx.createChannelMerger(2);
  const masterBinauralGain = ctx.createGain();

  leftOsc.frequency.value = config.carrierFreq - config.beatFreq / 2;
  rightOsc.frequency.value = config.carrierFreq + config.beatFreq / 2;

  leftOsc.connect(leftGain);
  rightOsc.connect(rightGain);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  merger.connect(masterBinauralGain);
  masterBinauralGain.connect(ctx.destination);

  const binVol = config.binauralVolume;
  const duckedVol = binVol * (1 - config.duckingAmount);
  const fadeS = config.fadeDuration / 1000;

  masterBinauralGain.gain.setValueAtTime(0, 0);
  masterBinauralGain.gain.linearRampToValueAtTime(binVol, fadeS);

  if (voiceBuffer.duration > 0) {
    masterBinauralGain.gain.setValueAtTime(binVol, voiceStartTime - 0.5);
    masterBinauralGain.gain.linearRampToValueAtTime(duckedVol, voiceStartTime);
    masterBinauralGain.gain.setValueAtTime(duckedVol, voiceStartTime + voiceBuffer.duration);
    masterBinauralGain.gain.linearRampToValueAtTime(binVol, voiceStartTime + voiceBuffer.duration + 0.5);
  }

  masterBinauralGain.gain.setValueAtTime(binVol, totalDuration - fadeS);
  masterBinauralGain.gain.linearRampToValueAtTime(0, totalDuration);

  leftOsc.start(0);
  rightOsc.start(0);

  // Pink noise
  if (config.usePinkNoise) {
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = createPinkNoiseBuffer(ctx, totalDuration);
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = config.noiseLevel * 0.25;
    noiseSource.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(0);
  }

  // Voice chain
  const voiceSource = ctx.createBufferSource();
  voiceSource.buffer = voiceBuffer;

  const enhanceFilter = ctx.createBiquadFilter();
  enhanceFilter.type = 'highpass';
  enhanceFilter.frequency.value = config.voiceEnhance ? 100 : 20;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = config.voiceEnhance ? -24 : 0;
  compressor.ratio.value = config.voiceEnhance ? 4 : 1;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 250;
  bassFilter.gain.value = config.voiceBass;

  const trebleFilter = ctx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 3500;
  trebleFilter.gain.value = config.voiceTreble;

  const reverb = ctx.createConvolver();
  reverb.buffer = createReverbImpulse(ctx, 2.5, 1.2);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = config.voiceReverb * 1.2;

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1.0 - (config.voiceReverb * 0.3);

  const voiceMasterGain = ctx.createGain();
  voiceMasterGain.gain.value = config.voiceVolume;

  voiceSource.connect(enhanceFilter);
  enhanceFilter.connect(compressor);
  compressor.connect(bassFilter);
  bassFilter.connect(trebleFilter);
  trebleFilter.connect(dryGain);
  trebleFilter.connect(reverb);
  reverb.connect(reverbGain);
  dryGain.connect(voiceMasterGain);
  reverbGain.connect(voiceMasterGain);
  voiceMasterGain.connect(ctx.destination);

  voiceMasterGain.gain.setValueAtTime(0, voiceStartTime);
  voiceMasterGain.gain.linearRampToValueAtTime(config.voiceVolume, voiceStartTime + 0.3);
  voiceMasterGain.gain.setValueAtTime(config.voiceVolume, voiceStartTime + voiceBuffer.duration - 0.3);
  voiceMasterGain.gain.linearRampToValueAtTime(0, voiceStartTime + voiceBuffer.duration);

  voiceSource.start(voiceStartTime);

  return await ctx.startRendering();
}

// Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, config, voiceBuffer, sampleRate, channels, length } = e.data;

  try {
    // Send progress: started
    self.postMessage({ id, type: 'progress', progress: 10 } satisfies WorkerResponse);

    const rendered = await renderMix(config, voiceBuffer, sampleRate, channels, length);

    self.postMessage({ id, type: 'progress', progress: 90 } satisfies WorkerResponse);

    // Transfer the rendered buffer back to main thread
    const renderedArrayBuffer = rendered.getChannelData(0).buffer.slice(0);
    // Create interleaved stereo buffer
    const numChannels = rendered.numberOfChannels;
    const totalSamples = rendered.length * numChannels;
    const interleaved = new Float32Array(totalSamples);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = rendered.getChannelData(ch);
      for (let i = 0; i < rendered.length; i++) {
        interleaved[i * numChannels + ch] = channelData[i];
      }
    }

    const transferList: Transferable[] = [interleaved.buffer];
    (self as any).postMessage({
      id,
      type: 'result',
      renderedBuffer: interleaved.buffer,
      sampleRate: rendered.sampleRate,
      length: rendered.length,
      channels: numChannels,
      progress: 100,
    } as WorkerResponse, transferList);
  } catch (err: any) {
    self.postMessage({
      id,
      type: 'error',
      error: err?.message || 'Render failed in worker',
    } satisfies WorkerResponse);
  }
};
