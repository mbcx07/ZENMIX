// ── EDGE TTS SERVICE ──────────────────────────────────────────────────────────
// Conexión directa al WebSocket de Microsoft Edge TTS (gratuito).
// Usa las mismas voces neuronales que Microsoft Edge "Read Aloud".
// Protocolo: WSS con framing binario personalizado.
// ──────────────────────────────────────────────────────────────────────────────

// Voces neuronales disponibles (Microsoft TTS)
export const EDGE_VOICES = [
  // 🇲🇽 Español Mexicano
  { id: 'es-MX-DaliaNeural', name: 'Dalia (MX)', gender: 'female', lang: 'es-MX', description: 'Voz femenina mexicana, cálida y natural', style: 'calm' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge (MX)', gender: 'male', lang: 'es-MX', description: 'Voz masculina mexicana, profunda y serena', style: 'deep' },
  { id: 'es-MX-CecilioNeural', name: 'Cecilio (MX)', gender: 'male', lang: 'es-MX', description: 'Voz masculina mexicana, narrativa y pausada', style: 'narrative' },
  // 🇪🇸 Español España
  { id: 'es-ES-ElviraNeural', name: 'Elvira (ES)', gender: 'female', lang: 'es-ES', description: 'Voz femenina española, melodiosa', style: 'meditative' },
  { id: 'es-ES-AlvaroNeural', name: 'Álvaro (ES)', gender: 'male', lang: 'es-ES', description: 'Voz masculina española, cálida y envolvente', style: 'narrative' },
  { id: 'es-ES-AbrilNeural', name: 'Abril (ES)', gender: 'female', lang: 'es-ES', description: 'Voz femenina española, suave y serena', style: 'calm' },
  // 🇺🇸 Inglés US (para hipnosis bilingüe)
  { id: 'en-US-AriaNeural', name: 'Aria (US)', gender: 'female', lang: 'en-US', description: 'Voz americana, versátil y expresiva', style: 'narrative' },
  { id: 'en-US-GuyNeural', name: 'Guy (US)', gender: 'male', lang: 'en-US', description: 'Voz masculina americana, profunda y calmada', style: 'deep' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US)', gender: 'female', lang: 'en-US', description: 'Voz americana, muy natural y amigable', style: 'calm' },
];

export interface TTSOptions {
  text: string;
  voice: string; // e.g., 'es-MX-DaliaNeural'
  rate: number;  // 0.5 - 2.0
  pitch: number; // -50 to +50
  volume?: number;
}

interface AudioChunk {
  type: 'metadata' | 'audio';
  data: ArrayBuffer | string;
}

// ── Generar SSML con estilo hipnótico ─────────────────────────────────────────
function buildSSML(options: TTSOptions): string {
  const { text, voice, rate, pitch } = options;

  // Formatear con pausas y respiraciones para hipnosis
  // Reemplazar marcadores de pausa con SSML breaks
  let processed = text
    .replace(/\.\.\./g, '<break time="2.5s"/>')
    .replace(/\(pausa\)/gi, '<break time="2s"/>')
    .replace(/\(respira\)/gi, '<break time="1s"/>')
    .replace(/\(pausa corta\)/gi, '<break time="1s"/>')
    .replace(/\(pausa media\)/gi, '<break time="2s"/>')
    .replace(/\(pausa larga\)/gi, '<break time="3.5s"/>')
    .replace(/\(suspiro\)/gi, '<mstts:audiosilence value="500"/><mstts:breath type="soft"/><mstts:audiosilence value="300"/>')
    .replace(/\(inhala\)/gi, '<mstts:audiosilence value="400"/><mstts:breath type="soft"/>')
    .replace(/\(exhala\)/gi, '<mstts:breath type="soft"/><mstts:audiosilence value="400"/>')
    .replace(/\(énfasis\)(.*?)\(énfasis\)/gi, '<emphasis level="strong">$1</emphasis>')
    .replace(/\(susurro\)(.*?)\(susurro\)/gi, '<prosody volume="x-soft" pitch="+2st">$1</prosody>')
    .replace(/\n{2,}/g, '<break time="1.5s"/>')
    .replace(/\n/g, '<break time="0.5s"/>')
    .trim();

  // Velocidad y tono — ajuste fino para hipnosis
  const rateStr = `${((rate - 1) * 100).toFixed(0)}%`;
  const pitchStr = `${pitch > 0 ? '+' : ''}${pitch}Hz`;

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">
    <voice name="${voice}">
      <prosody rate="${rateStr}" pitch="${pitchStr}" volume="loud">
        ${processed}
      </prosody>
    </voice>
  </speak>`;
}

// ── Generar UUID v4 ───────────────────────────────────────────────────────────
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Decodificar mensaje WebSocket (framing edge-tts) ──────────────────────────
// Formato:
// - Text: 0x00 <path> \r\n <body>
// - Binary: 0x01 <path> \r\n <binary_data>
function decodeMessage(data: ArrayBuffer): { path: string; body: ArrayBuffer; isBinary: boolean } {
  const bytes = new Uint8Array(data);

  // Primer byte: tipo
  const isBinary = bytes[0] === 0x01;

  // Buscar el \r\n que separa path de body
  let headerEnd = -1;
  for (let i = 1; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) {
      headerEnd = i;
      break;
    }
  }

  if (headerEnd === -1) {
    return { path: '', body: new ArrayBuffer(0), isBinary };
  }

  // Path está entre el primer byte y \r\n
  const pathDecoder = new TextDecoder('utf-8');
  const path = pathDecoder.decode(bytes.slice(1, headerEnd));

  // Body está después de \r\n
  const bodyStart = headerEnd + 2;
  const body = data.slice(bodyStart);

  return { path, body, isBinary };
}

// ── Sintetizar texto con Edge TTS ─────────────────────────────────────────────
export function synthethizeEdgeTTS(options: TTSOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const connectionId = uuidv4();
    const requestId = uuidv4();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientHeader=1&ConnectionId=${connectionId}`;

    const ws = new WebSocket(wsUrl);
    const audioChunks: ArrayBuffer[] = [];
    let timeoutId: number | null = null;
    let isResolved = false;

    const safeResolve = (blob: Blob) => {
      if (!isResolved) {
        isResolved = true;
        resolve(blob);
      }
    };
    const safeReject = (err: Error) => {
      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    };

    // Timeout de seguridad (30s)
    timeoutId = window.setTimeout(() => {
      ws.close();
      safeReject(new Error('Timeout: Edge TTS no respondió en 30s'));
    }, 30000);

    ws.onopen = () => {
      // ── Enviar configuración de síntesis ──
      const configMsg = new TextEncoder().encode(
        `X-Timestamp:${Date.now()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      );
      ws.send(configMsg);

      // ── Enviar SSML ──
      const ssml = buildSSML(options);
      const ssmlMsg = new TextEncoder().encode(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`
      );
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;

      const decoded = decodeMessage(event.data);

      if (decoded.isBinary) {
        // Audio data
        audioChunks.push(decoded.body);
      } else {
        // Metadata — check for end of turn
        const text = new TextDecoder('utf-8').decode(decoded.body);
        if (decoded.path === 'turn.end') {
          // Audio completo recibido
          if (timeoutId) window.clearTimeout(timeoutId);

          // Concatenar chunks de audio
          const totalLen = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const chunk of audioChunks) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          // Crear blob MP3
          const blob = new Blob([merged], { type: 'audio/mpeg' });
          ws.close();
          safeResolve(blob);
        }
      }
    };

    ws.onerror = (err) => {
      if (timeoutId) window.clearTimeout(timeoutId);
      safeReject(new Error('WebSocket error: ' + (err?.toString() || 'desconocido')));
    };

    ws.onclose = (event) => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (!isResolved && audioChunks.length > 0) {
        // Si se cerró pero tenemos datos, intentar usarlos
        const totalLen = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        if (totalLen > 1000) {
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const chunk of audioChunks) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }
          safeResolve(new Blob([merged], { type: 'audio/mpeg' }));
        } else {
          safeReject(new Error(`Conexión cerrada (code: ${event.code}) con poco audio`));
        }
      } else if (!isResolved) {
        safeReject(new Error(`Conexión cerrada (code: ${event.code})`));
      }
    };
  });
}

// ── Obtener audio como Blob WAV (transcode desde MP3) ─────────────────────────
// Edge TTS devuelve MP3. Si necesitamos WAV, usamos AudioContext para convertir.
export async function edgeTtsToWav(options: TTSOptions): Promise<Blob> {
  const mp3Blob = await synthethizeEdgeTTS(options);

  // Decodificar MP3 a AudioBuffer y re-exportar como WAV
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuf = await mp3Blob.arrayBuffer();
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  audioCtx.close();

  return audioBufferToWav(audioBuf);
}

// ── AudioBuffer → WAV Blob ────────────────────────────────────────────────────
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuf = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuf);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);       // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = buffer.getChannelData(0);
  let offset = headerSize;
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuf], { type: 'audio/wav' });
}
