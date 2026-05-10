// ── ZENMIX TTS SERVICE ──────────────────────────────────────────────────────
// Captura de Web Speech API mediante MediaRecorder.
// 100% gratis, sin API keys, sin límites, offline.
// ─────────────────────────────────────────────────────────────────────────────

export interface ZenVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  lang: string;
  description: string;
  defaultRate?: number;
  defaultPitch?: number;
}

// ── Cargar voces desde SpeechSynthesis ───────────────────────────────────────
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices());
      };
      // timeout de seguridad
      setTimeout(() => resolve(window.speechSynthesis.getVoices()), 3000);
    }
  });
}

// ── Convertir voces del sistema a ZenVoice[] ──────────────────────────────────
export function mapToZenVoices(voices: SpeechSynthesisVoice[]): ZenVoice[] {
  // Español primero
  const sorted = [...voices].sort((a, b) => {
    const aES = a.lang.startsWith('es') ? 0 : 1;
    const bES = b.lang.startsWith('es') ? 0 : 1;
    return aES - bES;
  });

  return sorted.map((v, i) => ({
    id: `${v.name}-${v.lang}`,
    name: `${v.name} (${v.lang})`,
    gender: v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('dalia') || v.name.toLowerCase().includes('elvira') ? 'female' as const : 'male' as const,
    lang: v.lang,
    description: v.localService ? '📦 Local' : '☁️ Sistema',
    defaultRate: 0.85,
    defaultPitch: v.lang.startsWith('es') ? 1.0 : 1.0,
  }));
}

// ── Sintetizar y capturar como Blob ──────────────────────────────────────────
// Usa SpeechSynthesis para hablar + MediaRecorder para capturar.
export function synthesizeWithCapture(
  text: string,
  voice: SpeechSynthesisVoice,
  rate: number,
  pitch: number,
  volume: number = 1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        audioCtx.close();
        if (blob.size > 500) {
          resolve(blob);
        } else {
          reject(new Error('Audio generado muy pequeño'));
        }
      };

      mediaRecorder.onerror = () => {
        audioCtx.close();
        reject(new Error('Error en MediaRecorder'));
      };

      // Crear oscilador dummy para activar el stream
      const osc = audioCtx.createOscillator();
      osc.frequency.value = 0;
      osc.connect(dest);
      osc.start();

      // Configurar utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Iniciar grabación
      mediaRecorder.start();

      // Hablar
      window.speechSynthesis.speak(utterance);

      // Cuando termina de hablar, parar grabación
      utterance.onend = () => {
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 500);
      };

      utterance.onerror = (e) => {
        console.error('SpeechSynthesis error:', e);
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        reject(new Error(`Error al sintetizar: ${e.error || 'desconocido'}`));
      };

      // Timeout de seguridad
      const wordsPerSecond = 3;
      const estimatedSeconds = (text.split(' ').length / wordsPerSecond / rate) + 5;
      const timeoutMs = Math.max(30000, estimatedSeconds * 1000);

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.warn('Timeout, forzando stop');
          window.speechSynthesis.cancel();
          mediaRecorder.stop();
        }
      }, timeoutMs);

    } catch (err: any) {
      reject(new Error(`Error al iniciar captura: ${err.message}`));
    }
  });
}

// ── Preview simple (sin grabación, solo reproducir) ──────────────────────────
export function previewVoiceSimple(
  text: string,
  voice: SpeechSynthesisVoice,
  rate: number,
  pitch: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(`Preview error: ${e.error}`));

    window.speechSynthesis.speak(utterance);

    // Timeout
    setTimeout(() => {
      window.speechSynthesis.cancel();
      resolve();
    }, 15000);
  });
}

// ── AudioBuffer → WAV (para exportar) ────────────────────────────────────────
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const w = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  w(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  w(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let ch = 0; ch < numChannels; ch++) {
    const data = ch < buffer.numberOfChannels ? buffer.getChannelData(ch) : buffer.getChannelData(0);
    let offset = headerSize + ch * 2;
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += blockAlign;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}

// ── WebM Blob → AudioBuffer ──────────────────────────────────────────────────
export async function webmToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuf = await blob.arrayBuffer();
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  audioCtx.close();
  return audioBuf;
}
