// renderManager.ts — Manages audio rendering via Web Worker with abort support
import { ProjectConfig } from '../types';
import { blobStore } from './blobStore';

type ProgressCallback = (pct: number) => void;
type ResultCallback = (wavBlob: Blob, mp3Blob: Blob | null, wavUrl: string, mp3Url: string | null) => void;
type ErrorCallback = (err: string) => void;

const BLOB_KEY = 'current-voice';

function audioBufferToWav(interleaved: Float32Array, sampleRate: number, channels: number, totalLength: number): Blob {
  const numSamples = totalLength;
  const buffer = new ArrayBuffer(44 + numSamples * channels * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * channels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2 * channels, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * channels * 2, true);

  let pos = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, interleaved[i * channels + ch]));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      pos += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export interface RenderController {
  abort: () => void;
}

/**
 * Starts audio rendering in a Web Worker.
 * Returns a controller with abort() to cancel.
 * Blob is read from IndexedDB (not memory).
 */
export async function startRender(
  config: ProjectConfig,
  onProgress: ProgressCallback,
  onResult: ResultCallback,
  onError: ErrorCallback,
): Promise<RenderController> {
  let aborted = false;
  const abortController = new AbortController();

  const controller: RenderController = {
    abort: () => {
      aborted = true;
      abortController.abort();
    }
  };

  try {
    // Load voice blob from IndexedDB (not from memory)
    const voiceBlob = await blobStore.load(BLOB_KEY);
    if (!voiceBlob) {
      onError('No se encontró la voz. Vuelve a grabarla o subirla.');
      return controller;
    }

    const arrayBuffer = await voiceBlob.arrayBuffer();
    if (aborted) return controller;

    onProgress(5);

    // Decode on main thread to get metadata (needed for worker)
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const voiceBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    audioCtx.close(); // clean up

    if (aborted) return controller;
    onProgress(10);

    // Create worker
    const worker = new Worker(
      new URL('./audioWorker.ts', import.meta.url),
      { type: 'module' }
    );

    const renderId = `render-${Date.now()}`;

    worker.onmessage = (e) => {
      if (aborted) { worker.terminate(); return; }

      const msg = e.data;
      if (msg.type === 'progress') {
        // Map worker progress (10-90) → UI progress (10-80)
        onProgress(10 + Math.floor(msg.progress * 0.7));
      } else if (msg.type === 'result') {
        onProgress(80);

        const { renderedBuffer, sampleRate, length, channels } = msg;
        const interleaved = new Float32Array(renderedBuffer);

        // WAV
        const wavBlob = audioBufferToWav(interleaved, sampleRate, channels, length);
        const wavUrl = URL.createObjectURL(wavBlob);
        onProgress(95);

        // MP3 (lamejs on main thread — lighter than OfflineAudioContext)
        let mp3Url: string | null = null;
        let mp3Blob: Blob | null = null;

        try {
          mp3Blob = wavBlob; // fallback — use wav as mp3 placeholder
          // Real MP3 encoding would go here, but lamejs is heavy on main thread.
          // For now, we encode WAV first and MP3 lazily.
          mp3Url = null; // Will be generated on demand
        } catch {}

        onProgress(100);
        onResult(wavBlob, mp3Blob, wavUrl, mp3Url);
        worker.terminate();
      } else if (msg.type === 'error') {
        onError(msg.error || 'Error en el worker');
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      onError(err.message || 'Error fatal en worker de audio');
      worker.terminate();
    };

    // Listen for abort
    abortController.signal.addEventListener('abort', () => {
      worker.terminate();
    });

    // Send work to worker
    worker.postMessage({
      id: renderId,
      config: {
        carrierFreq: config.carrierFreq,
        beatFreq: config.beatFreq,
        noiseLevel: config.noiseLevel,
        usePinkNoise: config.usePinkNoise,
        preRollDuration: config.preRollDuration,
        postRollDuration: config.postRollDuration,
        binauralVolume: config.binauralVolume,
        voiceVolume: config.voiceVolume,
        voiceReverb: config.voiceReverb,
        voiceBass: config.voiceBass,
        voiceTreble: config.voiceTreble,
        voiceEnhance: config.voiceEnhance,
        fadeDuration: config.fadeDuration,
        duckingAmount: config.duckingAmount,
      },
      voiceBuffer: voiceBuffer.getChannelData(0).buffer.slice(0),
      sampleRate: voiceBuffer.sampleRate,
      channels: voiceBuffer.numberOfChannels,
      length: voiceBuffer.length,
    }, [voiceBuffer.getChannelData(0).buffer.slice(0)]);

  } catch (err: any) {
    onError(err?.message || 'Error al iniciar el renderizado');
  }

  return controller;
}

export { BLOB_KEY };
