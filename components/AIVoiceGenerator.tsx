import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Check, Loader2, Play, BrainCircuit, AlertCircle, Music2,
  ChevronRight, Info, RefreshCw, Undo2, Edit3,
  Download, Save, Clock, Trash2, Sparkles, UserRound, Wand2, Pause
} from 'lucide-react';
import { SessionData } from '../types';

// ── VOCES DISPONIBLES EN SPEECH SYNTHESIS ────────────────────────────────────
interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  style: 'calm' | 'deep' | 'whisper' | 'narrative' | 'meditative';
  voiceURI: string;
  lang: string;
}

const FALLBACK_VOICES: VoiceOption[] = [
  { id: 'es-mx-female', name: 'Español MX Femenina', gender: 'female', description: 'Voz femenina de español mexicano', style: 'calm', voiceURI: '', lang: 'es-MX' },
  { id: 'es-mx-male', name: 'Español MX Masculina', gender: 'male', description: 'Voz masculina de español mexicano', style: 'narrative', voiceURI: '', lang: 'es-MX' },
  { id: 'es-es-female', name: 'Español ES Femenina', gender: 'female', description: 'Voz femenina de España', style: 'calm', voiceURI: '', lang: 'es-ES' },
  { id: 'es-es-male', name: 'Español ES Masculina', gender: 'male', description: 'Voz masculina de España', style: 'deep', voiceURI: '', lang: 'es-ES' },
  { id: 'en-us-female', name: 'English US Femenina', gender: 'female', description: 'Voz femenina americana', style: 'calm', voiceURI: '', lang: 'en-US' },
  { id: 'en-us-male', name: 'English US Masculina', gender: 'male', description: 'Voz masculina americana', style: 'deep', voiceURI: '', lang: 'en-US' },
];

const MEDITATION_STYLES = [
  {
    id: 'hypnosis',
    name: 'Hipnosis Profunda',
    emoji: '🧿',
    systemPrompt: `Eres un hipnoterapeuta profesional con décadas de experiencia. Tu voz debe ser EXTREMADAMENTE calmada, profunda y monótona, pero nunca robótica.

TÉCNICA VOCAL:
- Habla un 40% más lento que una conversación normal
- Deja pausas de 2-3 segundos entre frases importantes
- Modula hacia abajo al final de cada frase (tono descendente)
- Respira audiblemente antes de comenzar cada párrafo (inhala... exhala...)
- Usa un volumen constante, sin subidas bruscas
- Alarga ligeramente las vocales en palabras clave (relaaaaajación, profuuuuundo)

ESTRUCTURA:
- Comienza con inducción de relajación progresiva
- Cuenta regresiva de 10 a 1 con pausas
- Sugestiones positivas en presente
- Cierre suave con retorno gradual`
  },
  {
    id: 'meditation',
    name: 'Meditación Guiada',
    emoji: '🧘',
    systemPrompt: `Eres un maestro de meditación con voz serena y presencia tranquilizadora. Guías a la persona hacia un estado de paz interior.

TÉCNICA VOCAL:
- Tono cálido y acogedor, como un amigo sabio
- Ritmo pausado pero con variaciones naturales
- Énfasis suave en palabras de calma: "paz", "serenidad", "suelta"
- Pequeñas pausas para que el oyente experimente las sensaciones
- Voz ligeramente sonriente (se nota en el timbre)

ESTRUCTURA:
- Enraizamiento: atención a la respiración y cuerpo
- Visualización: escena natural pacífica (bosque, playa, montaña)
- Integración: llevar la calma al día a día
- Cierre gradual con gratitud`
  },
  {
    id: 'sleep',
    name: 'Sueño Reparador',
    emoji: '🌙',
    systemPrompt: `Eres una presencia nocturna que arrulla hacia el sueño más profundo y restaurador. Tu voz es el equivalente sonoro de una manta cálida.

TÉCNICA VOCAL:
- Habla MUY lento, casi arrastrando las palabras
- Tono cada vez más bajo y suave conforme avanza
- Bostezos suaves ocasionales (contagiosos)
- Frases que se desvanecen al final
- Susurros parciales en palabras relajantes

ESTRUCTURA:
- Relajación muscular progresiva (pies a cabeza)
- Visualización de pesadez y hundimiento
- Imágenes oníricas: nubes, hamaca, flotar en agua tibia
- Las frases se hacen más cortas hacia el final
- Termina con silencio (no hay "despertar")`
  },
  {
    id: 'focus',
    name: 'Enfoque y Concentración',
    emoji: '🎯',
    systemPrompt: `Eres un coach de alto rendimiento mental. Tu voz es clara, definida y motivadora sin ser agresiva. Preparas la mente para un estado de flow.

TÉCNICA VOCAL:
- Tono firme pero cálido, con energía controlada
- Ritmo constante y medido, sin prisas
- Énfasis preciso en palabras de acción: "enfoca", "fluye", "crea"
- Pausas estratégicas para integrar instrucciones
- Claridad absoluta en cada palabra

ESTRUCTURA:
- Centramiento y grounding rápido (3 respiraciones)
- Anclaje a estado de rendimiento óptimo
- Visualización de la tarea fluyendo sin esfuerzo
- Afirmaciones de capacidad y claridad mental
- Cierre energético con sensación de preparación`
  },
  {
    id: 'healing',
    name: 'Sanación Interior',
    emoji: '💚',
    systemPrompt: `Eres un sanador compasivo con una voz que transmite aceptación incondicional. Guías procesos de liberación emocional y reconciliación interna.

TÉCNICA VOCAL:
- Voz excepcionalmente suave y vulnerable
- Tono que transmite "está bien sentir lo que sientes"
- Pausas largas para permitir que las emociones fluyan
- Variaciones de tono que reflejan empatía genuina
- Susurros ocasionales en partes de máximo cuidado

ESTRUCTURA:
- Creación de espacio seguro y sin juicio
- Conexión con partes heridas o bloqueadas
- Diálogo interno compasivo
- Liberación somática (atención al cuerpo)
- Integración con amor y aceptación`
  }
];

interface AudioBlock {
  id: string;
  text: string;
  status: 'pending' | 'completed' | 'error';
  url: string | null;
}

interface AIVoiceGeneratorProps {
  onGenerationComplete: (data: SessionData) => void;
}

const AIVoiceGenerator: React.FC<AIVoiceGeneratorProps> = ({ onGenerationComplete }) => {
  const [inputText, setInputText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(MEDITATION_STYLES[0]);
  const [speed, setSpeed] = useState(0.75);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);

  const [blocks, setBlocks] = useState<AudioBlock[]>([]);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [masterBlob, setMasterBlob] = useState<Blob | null>(null);
  const [masterDuration, setMasterDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  // ── Cargar voces disponibles ────────────────────────────────────────────────
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Preferir español, poner al inicio
        const sorted = [...voices].sort((a, b) => {
          const aES = a.lang.startsWith('es') ? 0 : 1;
          const bES = b.lang.startsWith('es') ? 0 : 1;
          return aES - bES;
        });
        setAvailableVoices(sorted);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Dividir texto en bloques ────────────────────────────────────────────────
  const prepareBlocks = () => {
    if (!inputText.trim()) return;
    if (inputText.length > 100000) {
      alert("Texto demasiado largo. Máximo 100,000 caracteres.");
      return;
    }

    const sentences = inputText.match(/[^.!?]+[.!?]+/g) || [inputText];
    const newBlocks: AudioBlock[] = [];
    let currentChunk = '';

    sentences.forEach((s) => {
      const chunkLen = (currentChunk + s).length;
      if (chunkLen > 2000) {
        // Limitar cada bloque a ~2000 chars para no saturar SpeechSynthesis
        if (currentChunk) {
          newBlocks.push({
            id: `b-${Date.now()}-${newBlocks.length}`,
            text: currentChunk.trim(),
            status: 'pending',
            url: null,
          });
        }
        currentChunk = s;
      } else {
        currentChunk += s;
      }
    });

    if (currentChunk) {
      newBlocks.push({
        id: `b-${Date.now()}-${newBlocks.length}`,
        text: currentChunk.trim(),
        status: 'pending',
        url: null,
      });
    }

    if (newBlocks.length === 0) {
      newBlocks.push({
        id: `b-${Date.now()}-0`,
        text: inputText.trim(),
        status: 'pending',
        url: null,
      });
    }

    setBlocks(newBlocks);
    setActiveStep(2);
  };

  // ── Generar un bloque como WAV usando SpeechSynthesis + MediaRecorder ───────
  const synthesizeBlock = (text: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        // Usar MediaRecorder para capturar la salida de SpeechSynthesis
        // Necesitamos un AudioContext + destino para capturar
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          audioCtx.close();
          resolve(blob);
        };

        // Crear utterance
        const utterance = new SpeechSynthesisUtterance(text);

        // Configurar voz
        if (availableVoices.length > 0 && selectedVoiceIndex < availableVoices.length) {
          utterance.voice = availableVoices[selectedVoiceIndex];
        }

        // Configurar velocidad según estilo
        switch (selectedStyle.id) {
          case 'hypnosis':
            utterance.rate = speed * 0.65; // Muy lento
            break;
          case 'sleep':
            utterance.rate = speed * 0.55; // Lentísimo
            break;
          case 'meditation':
            utterance.rate = speed * 0.8; // Pausado
            break;
          case 'healing':
            utterance.rate = speed * 0.75; // Suave
            break;
          case 'focus':
            utterance.rate = speed * 0.85; // Moderado
            break;
          default:
            utterance.rate = speed * 0.75;
        }

        utterance.pitch = selectedStyle.id === 'deep' || selectedStyle.id === 'hypnosis' ? 0.8 : 1.0;
        utterance.volume = 1;

        // Conectar a la salida
        const sourceNode = audioCtx.createOscillator(); // dummy solo para activar el contexto
        sourceNode.connect(dest);
        sourceNode.start();

        // Cuando termina de hablar, parar la grabación
        utterance.onend = () => {
          setTimeout(() => {
            mediaRecorder.stop();
          }, 300); // pequeño buffer para no cortar
        };

        utterance.onerror = (e) => {
          console.error('SpeechSynthesis error:', e);
          mediaRecorder.stop();
          resolve(null);
        };

        // Iniciar grabación
        mediaRecorder.start();
        window.speechSynthesis.speak(utterance);

        // Timeout de seguridad (60s por bloque)
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 60000);

      } catch (err) {
        console.error('Error en síntesis:', err);
        resolve(null);
      }
    });
  };

  // ── Generar un bloque como WAV alternativo (MediaRecorder) ──────────────────
  const generateBlockAudio = async (text: string): Promise<Blob | null> => {
    // Intentar con MediaRecorder + SpeechSynthesis
    const blob = await synthesizeBlock(text);
    if (blob && blob.size > 1000) return blob;

    // Fallback: codificar a PCM manual y crear WAV
    // (este método es más lento pero más confiable)
    return await synthesizeBlockFallback(text);
  };

  const synthesizeBlockFallback = (text: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sampleRate = audioCtx.sampleRate;
        const dest = audioCtx.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codec=opus' });
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          audioCtx.close();
          resolve(blob);
        };

        // Usar un oscilador dummy para activar el stream
        const osc = audioCtx.createOscillator();
        osc.frequency.value = 0;
        osc.connect(dest);
        osc.start();

        const utterance = new SpeechSynthesisUtterance(text);
        if (availableVoices.length > 0 && selectedVoiceIndex < availableVoices.length) {
          utterance.voice = availableVoices[selectedVoiceIndex];
        }
        utterance.rate = selectedStyle.id === 'sleep' ? speed * 0.55 : speed * 0.75;
        utterance.volume = 1;

        mediaRecorder.start();
        window.speechSynthesis.speak(utterance);

        utterance.onend = () => {
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 500);
        };

        utterance.onerror = () => {
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
          resolve(null);
        };

        setTimeout(() => {
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        }, 120000);
      } catch (err) {
        console.error(err);
        resolve(null);
      }
    });
  };

  // ── Procesar cola de bloques ────────────────────────────────────────────────
  const processQueue = async () => {
    if (blocks.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);
    window.speechSynthesis.cancel(); // limpiar estado previo

    // Primera pasada: generar todos los bloques en serie
    for (let i = 0; i < blocks.length; i++) {
      setProgressMsg(`Generando bloque ${i + 1} de ${blocks.length}...`);

      const blob = await generateBlockAudio(blocks[i].text);
      const url = blob ? URL.createObjectURL(blob) : null;

      setBlocks(prev => prev.map((b, idx) =>
        idx === i ? { ...b, status: blob ? 'completed' : 'error', url } : b
      ));

      // Pequeña pausa entre bloques para no saturar SpeechSynthesis
      if (i < blocks.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setProgressMsg('¡Todos los bloques generados!');
    setIsProcessing(false);
  };

  // ── Finalizar: concatenar todos los bloques en un archivo master ────────────
  const finalize = async () => {
    const completed = blocks.filter(b => b.status === 'completed' && b.url);
    if (completed.length === 0) {
      setErrorMsg('No hay bloques completados para unir.');
      return;
    }

    setProgressMsg('Uniendo bloques...');

    try {
      // Descargar todos los blobs y concatenarlos
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffers: AudioBuffer[] = [];

      for (const block of completed) {
        const resp = await fetch(block.url!);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        buffers.push(audioBuf);
      }

      // Concatenar
      const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
      const masterBuf = audioCtx.createBuffer(1, totalLen, audioCtx.sampleRate);
      const data = masterBuf.getChannelData(0);
      let offset = 0;
      for (const buf of buffers) {
        data.set(buf.getChannelData(0), offset);
        offset += buf.length;
      }

      // Convertir a WAV
      const wavBlob = audioBufferToWav(masterBuf);
      const masterUrl = URL.createObjectURL(wavBlob);
      const duration = masterBuf.length / masterBuf.sampleRate;

      setMasterBlob(wavBlob);
      setMasterUrl(masterUrl);
      setMasterDuration(duration);
      setActiveStep(3);

      audioCtx.close();

    } catch (err) {
      console.error('Error al unir:', err);
      setErrorMsg('Error al unir los bloques. Intenta de nuevo.');
    }
  };

  // ── Función global: AudioBuffer → WAV Blob ──────────────────────────────────
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
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
    view.setUint16(20, format, true);
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
  };

  // ── Reproducir preview ─────────────────────────────────────────────────────
  const previewAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 animate-in fade-in max-w-5xl mx-auto w-full">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-sage-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sage-600 rounded-2xl text-white shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-sage-800 tracking-tight">Narración IA Hipnótica</h3>
            <p className="text-[10px] uppercase font-bold text-sage-400 tracking-widest">
              Speech Synthesis • 100% Gratis • {availableVoices.length} voces detectadas
            </p>
          </div>
        </div>
        {activeStep > 1 && !isProcessing && (
          <button
            onClick={() => setActiveStep(1)}
            className="p-3 text-sage-400 hover:text-sage-600 transition-colors flex items-center gap-2 text-xs font-bold uppercase"
          >
            <Undo2 size={16} /> Editar Texto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar: Configuración */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-sage-100 shadow-sm sticky top-28">
            <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-6">
              🆓 Generación Local (Sin Costo)
            </h4>

            {/* Selector de voz */}
            <div className="mb-6">
              <label className="text-[9px] font-bold text-sage-300 uppercase block mb-3">Voz</label>
              {availableVoices.length > 0 ? (
                <select
                  value={selectedVoiceIndex}
                  onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                  disabled={activeStep !== 1}
                  className="w-full p-3 rounded-xl border border-sand-200 bg-sand-50 text-sage-800 text-xs font-medium outline-none focus:ring-2 focus:ring-sage-300"
                >
                  {availableVoices.map((v, i) => (
                    <option key={`${v.name}-${i}`} value={i}>
                      {v.name} ({v.lang}) {v.localService ? '📦' : '☁️'}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-sage-400 italic">Cargando voces del sistema...</p>
              )}
              <p className="text-[9px] text-sage-300 mt-2">
                {availableVoices.length} voces disponibles en tu sistema
              </p>
            </div>

            {/* Velocidad */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <label className="text-[9px] font-bold text-sage-300 uppercase">Velocidad base</label>
                <span className="text-[10px] font-bold text-sage-600">{speed}x</span>
              </div>
              <input
                type="range" min="0.5" max="1.5" step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                disabled={activeStep !== 1}
                className="w-full h-2 bg-sand-200 rounded-full appearance-none cursor-pointer accent-sage-600"
              />
              <div className="flex justify-between mt-1 text-[8px] font-bold text-sage-300">
                <span>Lento</span><span>Normal</span><span>Rápido</span>
              </div>
            </div>

            {/* Estilos */}
            <div className="pt-4 border-t border-sand-100">
              <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3">Estilo de Meditación</h4>
              <div className="space-y-2">
                {MEDITATION_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => activeStep === 1 && setSelectedStyle(style)}
                    disabled={activeStep !== 1}
                    className={`w-full p-3 rounded-xl border text-left transition-all text-xs ${
                      selectedStyle.id === style.id
                        ? 'bg-sage-600 border-sage-600 text-white shadow-md'
                        : 'bg-sand-50 border-sand-200 text-sage-700 hover:bg-white disabled:opacity-50'
                    }`}
                  >
                    <span className="mr-2">{style.emoji}</span>
                    <span className="font-bold">{style.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info de gratis */}
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
              <p className="text-[10px] font-bold text-green-700 uppercase mb-1">✅ 100% Gratuito</p>
              <p className="text-[9px] text-green-600 leading-relaxed">
                Usa el sintetizador de voz de tu navegador. Sin API key, sin límites, sin costos. 
                Las voces dependen de tu sistema operativo.
              </p>
            </div>
          </div>
        </div>

        {/* Main: Editor de texto y bloques */}
        <div className="lg:col-span-8">
          {activeStep === 1 && (
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-sage-100 space-y-6">
              <div className="p-5 bg-sage-50 rounded-[1.5rem] border border-sage-100 text-[11px] text-sage-600 leading-relaxed italic">
                <Info size={14} className="inline mr-2 mb-1" />
                El sistema divide automáticamente el texto en bloques. Sin límite de caracteres, sin costos.
                Selecciona voz y estilo para el tono adecuado.
              </div>
              <textarea
                className="w-full min-h-[500px] p-8 bg-sand-50 border border-sand-200 rounded-[2.5rem] outline-none text-sage-800 text-sm leading-relaxed shadow-inner"
                placeholder="Pega tu guion de meditación aquí..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="flex justify-between items-center px-4">
                <span className="text-[10px] font-bold text-sage-300 uppercase">{inputText.length} caracteres</span>
                <button
                  onClick={prepareBlocks}
                  disabled={!inputText.trim()}
                  className="px-10 py-5 bg-sage-700 text-white rounded-[1.8rem] font-bold text-lg shadow-xl hover:bg-sage-800 transition-all active:scale-95 disabled:bg-sand-200"
                >
                  Preparar Bloques <ChevronRight size={20} className="inline ml-2" />
                </button>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-10">
              <div className="bg-sage-600 p-8 rounded-[2.5rem] text-white shadow-xl flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedStyle.emoji}</span>
                    <h4 className="font-bold text-lg">{selectedStyle.name}</h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase opacity-70">
                    {progressMsg || `${blocks.length} bloques`}
                  </span>
                </div>
                {!isProcessing ? (
                  <button
                    onClick={processQueue}
                    className="px-8 py-3 bg-white text-sage-700 rounded-xl text-xs font-bold uppercase shadow-lg hover:scale-105 transition-all"
                  >
                    {blocks.some(b => b.status === 'completed') ? 'Continuar' : 'Iniciar Generación'}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-xl">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Procesando...</span>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-5 bg-red-50 border-2 border-red-200 rounded-[1.5rem] flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                {blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className={`p-5 bg-white rounded-[1.8rem] border flex items-center gap-4 transition-all ${
                      block.status === 'completed'
                        ? 'border-sage-200 bg-sage-50/20'
                        : block.status === 'error'
                          ? 'border-red-200'
                          : 'border-sand-100 opacity-60'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-sand-300 w-8">{idx + 1}</span>
                    <p className="text-[11px] text-sage-800 italic flex-1 truncate">"{block.text.slice(0, 80)}{block.text.length > 80 ? '...' : ''}"</p>
                    <div className="flex items-center gap-2">
                      {block.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => block.url && previewAudio(block.url)}
                            className="p-2 text-sage-600 hover:bg-sage-100 rounded-lg"
                          >
                            <Play size={14} />
                          </button>
                          <div className="p-1.5 bg-sage-600 text-white rounded-full">
                            <Check size={12} />
                          </div>
                        </div>
                      )}
                      {block.status === 'error' && (
                        <span className="text-[9px] font-bold text-red-500 uppercase">Error</span>
                      )}
                      {block.status === 'pending' && (
                        <span className="text-[9px] font-bold text-sand-300 uppercase">Pendiente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {blocks.some(b => b.status === 'completed') && !isProcessing && (
                <button
                  onClick={finalize}
                  className="w-full py-8 bg-sage-800 text-white rounded-[2.5rem] font-bold text-xl shadow-2xl hover:bg-black transition-all"
                >
                  Unir y Crear Archivo Final
                </button>
              )}
            </div>
          )}

          {activeStep === 3 && masterUrl && (
            <div className="bg-white p-16 rounded-[4rem] shadow-2xl border border-sage-100 flex flex-col items-center gap-10 animate-in zoom-in">
              <div className="w-24 h-24 bg-sage-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                <Music2 size={48} />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-sage-800 tracking-tight">Narración Lista</h2>
                <p className="text-sage-400 text-sm font-medium">
                  Estilo: {selectedStyle.emoji} {selectedStyle.name}
                </p>
                <p className="text-sage-400 text-sm font-medium">
                  {blocks.filter(b => b.status === 'completed').length} bloques • {Math.floor(masterDuration / 60)}m {Math.floor(masterDuration % 60)}s
                </p>
                <p className="text-[10px] font-bold text-green-600 uppercase mt-2">✅ Sin costo de API</p>
              </div>
              <audio src={masterUrl} controls className="w-full max-w-md" />
              <button
                onClick={() => onGenerationComplete({ voiceBlob: masterBlob, voiceUrl: masterUrl, duration: masterDuration })}
                className="w-full py-6 bg-sage-700 text-white rounded-[2rem] font-bold text-xl shadow-xl hover:bg-sage-800 transition-all"
              >
                Importar al Mezclador
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AIVoiceGenerator;
