
import { ProjectConfig } from '../types';
import * as lamejs from 'lamejs';

export const createPinkNoiseBuffer = (ctx: BaseAudioContext, duration: number): AudioBuffer => {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  let b0, b1, b2, b3, b4, b5, b6;
  b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    output[i] *= 0.11; 
    b6 = white * 0.115926;
  }
  return buffer;
};

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

const createReverbImpulse = (ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer => {
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
};

export const renderFinalMix = async (
  config: ProjectConfig,
  voiceBuffer: AudioBuffer
): Promise<AudioBuffer> => {
  const sampleRate = 44100;
  const totalDuration = config.preRollDuration + voiceBuffer.duration + config.postRollDuration;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  const voiceStartTime = config.preRollDuration;

  // Binaural Chain
  const leftOsc = offlineCtx.createOscillator();
  const rightOsc = offlineCtx.createOscillator();
  const leftGain = offlineCtx.createGain();
  const rightGain = offlineCtx.createGain();
  const merger = offlineCtx.createChannelMerger(2);
  const masterBinauralGain = offlineCtx.createGain();

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

  // Pink Noise
  if (config.usePinkNoise) {
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = createPinkNoiseBuffer(offlineCtx, totalDuration);
    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.value = config.noiseLevel * 0.25;
    noiseSource.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);
    noiseSource.start(0);
  }

  // Voice Chain con Smart Enhance
  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = voiceBuffer;
  
  const enhanceFilter = offlineCtx.createBiquadFilter();
  enhanceFilter.type = 'highpass';
  enhanceFilter.frequency.value = config.voiceEnhance ? 100 : 20;

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = config.voiceEnhance ? -24 : 0;
  compressor.ratio.value = config.voiceEnhance ? 4 : 1;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  const bassFilter = offlineCtx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 250;
  bassFilter.gain.value = config.voiceBass;

  const trebleFilter = offlineCtx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 3500;
  trebleFilter.gain.value = config.voiceTreble;

  const reverb = offlineCtx.createConvolver();
  reverb.buffer = createReverbImpulse(offlineCtx, 2.5, 1.2);
  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = config.voiceReverb * 1.2;

  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 1.0 - (config.voiceReverb * 0.3);

  const voiceMasterGain = offlineCtx.createGain();
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
  voiceMasterGain.connect(offlineCtx.destination);

  voiceMasterGain.gain.setValueAtTime(0, voiceStartTime);
  voiceMasterGain.gain.linearRampToValueAtTime(config.voiceVolume, voiceStartTime + 0.3);
  voiceMasterGain.gain.setValueAtTime(config.voiceVolume, voiceStartTime + voiceBuffer.duration - 0.3);
  voiceMasterGain.gain.linearRampToValueAtTime(0, voiceStartTime + voiceBuffer.duration);

  voiceSource.start(voiceStartTime);

  return await offlineCtx.startRendering();
};

export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i, sample, offset = 0, pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); 
  setUint32(length - 8); 
  setUint32(0x45564157); 

  setUint32(0x20746d66); 
  setUint32(16);         
  setUint16(1);          
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); 
  setUint16(numOfChan * 2); 
  setUint16(16);         

  setUint32(0x61746164); 
  setUint32(length - pos - 4); 

  for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
};

export const audioBufferToMp3 = async (buffer: AudioBuffer): Promise<Blob> => {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  
  const Mp3Encoder = (lamejs as any).Mp3Encoder || (window as any).lamejs?.Mp3Encoder;
  if (!Mp3Encoder) throw new Error("Lamejs not found");

  const mp3encoder = new Mp3Encoder(channels, sampleRate, 192);
  const mp3Data: Uint8Array[] = [];

  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;
  
  const l = new Int16Array(left.length);
  const r = new Int16Array(right.length);
  
  for (let i = 0; i < left.length; i++) {
    l[i] = left[i] < 0 ? left[i] * 0x8000 : left[i] * 0x7FFF;
    r[i] = right[i] < 0 ? right[i] * 0x8000 : right[i] * 0x7FFF;
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
