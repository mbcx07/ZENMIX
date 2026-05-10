import React, { useState, useRef, useCallback } from 'react';
import {
  Check, Loader2, Play, BrainCircuit, AlertCircle, Music2,
  ChevronRight, Info, RefreshCw, Undo2, Edit3,
  Download, Save, Clock, Trash2, Sparkles, UserRound, Wand2, Pause
} from 'lucide-react';
import { SessionData } from '../types';
import { EDGE_VOICES, synthethizeEdgeTTS } from '../services/edgeTtsService';

// ── ESTILOS DE MEDITACIÓN ─────────────────────────────────────────────────────
const MEDITATION_STYLES = [
  {
    id: 'hypnosis',
    name: 'Hipnosis Profunda',
    emoji: '🧿',
    desc: 'Voz lenta y modulada, pausas terapéuticas, sugestión hipnótica',
    rate: 0.6,
    pitch: -15,
    sampleText: `Cierra los ojos... respira profundamente...
Cada parte de tu cuerpo se relaja más y más...
Desde la cabeza hasta los pies... una ola de calma te envuelve...
10... más profundo... 9... más relajado... 8... suelta todo...
7... cada pensamiento se disuelve... 6... solo existe este momento...
5... 4... 3... 2... 1... completamente presente...`
  },
  {
    id: 'meditation',
    name: 'Meditación Guiada',
    emoji: '🧘',
    desc: 'Voz cálida y pausada, visualizaciones serenas, tono acogedor',
    rate: 0.7,
    pitch: -5,
    sampleText: `Siéntate cómodamente... siente el peso de tu cuerpo...
Observa tu respiración sin juzgarla...
Inhala paz... exhala tensión...
Imagina un lugar tranquilo... un bosque bañado por la luz del sol...
Cada paso que das en ese bosque te lleva más profundo... a un estado de serenidad absoluta...`
  },
  {
    id: 'sleep',
    name: 'Sueño Reparador',
    emoji: '🌙',
    desc: 'Voz muy lenta, casi susurrante, arrullo hipnótico',
    rate: 0.5,
    pitch: -20,
    sampleText: `Deja que tus párpados se vuelvan pesados... muy pesados...
Cada respiración te hunde más profundamente en el sueño...
Tus brazos... pesados... tus piernas... pesadas...
Flotas... ingrávido... envuelto en una suave oscuridad...
No hay prisa... no hay tiempo... solo descanso... paz... sueño...`
  },
  {
    id: 'focus',
    name: 'Enfoque y Concentración',
    emoji: '🎯',
    desc: 'Voz clara y firme, ritmo constante, energía controlada',
    rate: 0.8,
    pitch: 0,
    sampleText: `Centra tu atención en este momento...
Tres respiraciones profundas... inhala... exhala...
Tu mente se aclara como un lago en calma...
Cada pensamiento encuentra su lugar...
Estás aquí... presente... listo... enfocado...`
  },
  {
    id: 'healing',
    name: 'Sanación Interior',
    emoji: '💚',
    desc: 'Voz suave y compasiva, ritmo lento, tono vulnerable y empático',
    rate: 0.65,
    pitch: -10,
    sampleText: `Con amor y compasión... te invito a conectar con tu interior...
Donde hay tensión... permites que se disuelva...
Donde hay dolor... envías luz sanadora...
Donde hay resistencia... pones atención consciente...
Te aceptas exactamente como eres... completo... entero... sanado...`
  }
];

interface AudioBlock {
  id: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  url: string | null;
  errorMsg?: string;
}

interface AIVoiceGeneratorProps {
  onGenerationComplete: (data: SessionData) => void;
}

const AIVoiceGenerator: React.FC<AIVoiceGeneratorProps> = ({ onGenerationComplete }) => {
  const [inputText, setInputText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(MEDITATION_STYLES[0]);
  const [selectedVoice, setSelectedVoice] = useState(EDGE_VOICES[0]); // DaliaMX por defecto
  const [customRate, setCustomRate] = useState(0);
  const [customPitch, setCustomPitch] = useState(0);

  const [blocks, setBlocks] = useState<AudioBlock[]>([]);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [masterBlob, setMasterBlob] = useState<Blob | null>(null);
  const [masterDuration, setMasterDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortRef = useRef(false);

  // ── Rate/pitch efectivos ────────────────────────────────────────────────────
  const effectiveRate = selectedStyle.rate + customRate;
  const effectivePitch = selectedStyle.pitch + customPitch;

  // ── Dividir texto en bloques ────────────────────────────────────────────────
  const prepareBlocks = () => {
    if (!inputText.trim()) return;
    if (inputText.length > 200000) {
      alert("Texto demasiado largo. Máximo 200,000 caracteres.");
      return;
    }

    // Dividir por párrafos o por ~3000 caracteres si son muy largos
    const paragraphs = inputText.split(/\n\s*\n/);
    const newBlocks: AudioBlock[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (trimmed.length <= 3000) {
        newBlocks.push({
          id: `b-${Date.now()}-${newBlocks.length}`,
          text: trimmed,
          status: 'pending',
          url: null,
        });
      } else {
        // Dividir párrafo largo en chunks de ~2500 caracteres por oración
        const sentences = trimmed.match(/[^.!?\n]+[.!?\n]*/g) || [trimmed];
        let chunk = '';
        for (const s of sentences) {
          if ((chunk + s).length > 2500 && chunk) {
            newBlocks.push({
              id: `b-${Date.now()}-${newBlocks.length}`,
              text: chunk.trim(),
              status: 'pending',
              url: null,
            });
            chunk = s;
          } else {
            chunk += s;
          }
        }
        if (chunk.trim()) {
          newBlocks.push({
            id: `b-${Date.now()}-${newBlocks.length}`,
            text: chunk.trim(),
            status: 'pending',
            url: null,
          });
        }
      }
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

  // ── Generar un bloque ───────────────────────────────────────────────────────
  const generateBlock = async (block: AudioBlock): Promise<Blob | null> => {
    try {
      const blob = await synthethizeEdgeTTS({
        text: block.text,
        voice: selectedVoice.id,
        rate: effectiveRate,
        pitch: effectivePitch,
      });
      return blob;
    } catch (err: any) {
      console.error('Edge TTS error:', err);
      return null;
    }
  };

  // ── Procesar cola ───────────────────────────────────────────────────────────
  const processQueue = async () => {
    if (blocks.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);
    abortRef.current = false;

    for (let i = 0; i < blocks.length; i++) {
      if (abortRef.current) break;

      const block = blocks[i];
      if (block.status === 'completed') continue;

      setProgressMsg(`Generando bloque ${i + 1} de ${blocks.length}... (${selectedVoice.name})`);
      setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'processing' } : b));

      try {
        const blob = await generateBlock(block);
        const url = blob ? URL.createObjectURL(blob) : null;

        setBlocks(prev => prev.map((b, idx) =>
          idx === i ? {
            ...b,
            status: blob ? 'completed' : 'error',
            url,
            errorMsg: blob ? undefined : 'No se pudo generar'
          } : b
        ));

        // Pausa entre bloques para no saturar
        if (i < blocks.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err: any) {
        setBlocks(prev => prev.map((b, idx) =>
          idx === i ? { ...b, status: 'error', errorMsg: err.message } : b
        ));
      }
    }

    setProgressMsg(abortRef.current ? '⏹️ Cancelado' : '✅ Todos generados');
    setIsProcessing(false);
  };

  // ── Cancelar ────────────────────────────────────────────────────────────────
  const cancelGeneration = () => {
    abortRef.current = true;
  };

  // ── Preview bloque ──────────────────────────────────────────────────────────
  const previewBlock = useCallback((url: string) => {
    const audio = new Audio(url);
    audio.play();
  }, []);

  // ─── PREVIEW DE VOZ RÁPIDA ──────────────────────────────────────────────────
  const previewVoice = async () => {
    const previewText = "Esta es mi voz. Escúchame con atención... relájate profundamente...";
    try {
      const blob = await synthethizeEdgeTTS({
        text: previewText,
        voice: selectedVoice.id,
        rate: effectiveRate,
        pitch: effectivePitch,
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      // Silencio
    }
  };

  // ── Finalizar: concatenar bloques ───────────────────────────────────────────
  const finalize = async () => {
    const completed = blocks.filter(b => b.status === 'completed' && b.url);
    if (completed.length === 0) {
      setErrorMsg('No hay bloques completados para unir.');
      return;
    }

    setProgressMsg('Uniendo bloques...');

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffers: AudioBuffer[] = [];

      for (const block of completed) {
        const resp = await fetch(block.url!);
        const arrayBuf = await resp.arrayBuffer();
        // Intentar decodificar como MP3
        try {
          const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
          buffers.push(audioBuf);
        } catch {
          // Si falla, intentar como raw
          console.warn('No se pudo decodificar bloque, se omite');
        }
      }

      if (buffers.length === 0) {
        throw new Error('No se pudo decodificar ningún bloque de audio');
      }

      // Concatenar
      const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
      const sampleRate = Math.max(...buffers.map(b => b.sampleRate));
      const masterBuf = audioCtx.createBuffer(2, totalLen, sampleRate);

      let offset = 0;
      for (const buf of buffers) {
        // Mezclar (mono → estéreo)
        for (let ch = 0; ch < Math.min(2, buf.numberOfChannels); ch++) {
          const srcData = buf.getChannelData(ch);
          const dstData = masterBuf.getChannelData(ch);
          dstData.set(srcData, offset);
        }
        offset += buf.length;
      }

      // Convertir a WAV
      const wavBlob = audioBufferToWav(masterBuf);
      const url = URL.createObjectURL(wavBlob);
      const duration = masterBuf.length / masterBuf.sampleRate;

      setMasterBlob(wavBlob);
      setMasterUrl(url);
      setMasterDuration(duration);
      setActiveStep(3);
      audioCtx.close();

    } catch (err: any) {
      setErrorMsg('Error al unir: ' + err.message);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 animate-in fade-in max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-sage-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sage-600 rounded-2xl text-white shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-sage-800 tracking-tight">Narración IA Profesional</h3>
            <p className="text-[10px] uppercase font-bold text-sage-400 tracking-widest">
              Microsoft Edge TTS • Voces Neuronales • 100% Gratis
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
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-sage-100 shadow-sm sticky top-28">
            <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-6">
              🆓 Edge TTS — Voces Neuronales
            </h4>

            {/* Selector de voz */}
            <div className="mb-6">
              <label className="text-[9px] font-bold text-sage-300 uppercase block mb-3">Voz Neural</label>
              <select
                value={selectedVoice.id}
                onChange={(e) => {
                  const v = EDGE_VOICES.find(v => v.id === e.target.value) || EDGE_VOICES[0];
                  setSelectedVoice(v);
                }}
                disabled={activeStep !== 1}
                className="w-full p-3 rounded-xl border border-sand-200 bg-sand-50 text-sage-800 text-xs font-medium outline-none focus:ring-2 focus:ring-sage-300"
              >
                {EDGE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.description}
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-sage-300 mt-2">{selectedVoice.description}</p>
            </div>

            {/* Preview rápido */}
            <button
              onClick={previewVoice}
              disabled={activeStep !== 1}
              className="w-full mb-6 p-3 bg-sage-100 text-sage-700 rounded-xl text-[10px] font-bold uppercase hover:bg-sage-200 transition-all disabled:opacity-50"
            >
              🎧 Escuchar Preview de Voz
            </button>

            {/* Ajustes finos */}
            <div className="mb-6 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[9px] font-bold text-sage-300 uppercase">Velocidad</label>
                  <span className="text-[10px] font-bold text-sage-600">
                    {effectiveRate.toFixed(2)}x
                    {customRate !== 0 && <span className="text-sage-400 ml-1">({customRate > 0 ? '+' : ''}{customRate.toFixed(2)})</span>}
                  </span>
                </div>
                <input
                  type="range" min="-0.3" max="0.3" step="0.05"
                  value={customRate}
                  onChange={(e) => setCustomRate(parseFloat(e.target.value))}
                  disabled={activeStep !== 1}
                  className="w-full h-2 bg-sand-200 rounded-full appearance-none cursor-pointer accent-sage-600"
                />
                <div className="flex justify-between mt-1 text-[8px] font-bold text-sage-300">
                  <span>Más lento</span><span>Base</span><span>Más rápido</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[9px] font-bold text-sage-300 uppercase">Tono</label>
                  <span className="text-[10px] font-bold text-sage-600">
                    {effectivePitch > 0 ? '+' : ''}{effectivePitch}Hz
                  </span>
                </div>
                <input
                  type="range" min="-30" max="30" step="5"
                  value={customPitch}
                  onChange={(e) => setCustomPitch(parseInt(e.target.value))}
                  disabled={activeStep !== 1}
                  className="w-full h-2 bg-sand-200 rounded-full appearance-none cursor-pointer accent-sage-600"
                />
                <div className="flex justify-between mt-1 text-[8px] font-bold text-sage-300">
                  <span>Más grave</span><span>Base</span><span>Más agudo</span>
                </div>
              </div>
            </div>

            {/* Estilos */}
            <div className="pt-4 border-t border-sand-100">
              <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3">
                Estilo de Hipnosis
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {MEDITATION_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => activeStep === 1 && setSelectedStyle(style)}
                    disabled={activeStep !== 1}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      selectedStyle.id === style.id
                        ? 'bg-sage-600 border-sage-600 text-white shadow-md'
                        : 'bg-sand-50 border-sand-200 text-sage-700 hover:bg-white disabled:opacity-50'
                    }`}
                  >
                    <span className="text-sm mr-2">{style.emoji}</span>
                    <span className="font-bold text-xs">{style.name}</span>
                    <p className="text-[9px] mt-1 opacity-70">{style.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
              <p className="text-[10px] font-bold text-green-700 uppercase mb-1">✅ Voces Neuronales Reales</p>
              <p className="text-[9px] text-green-600 leading-relaxed">
                Microsoft Edge TTS — las mismas voces que usa el navegador Edge en "Leer en voz alta".
                Respiración natural, entonación, emociones. 100% gratis, sin API key, sin límites.
              </p>
              <p className="text-[9px] text-green-500 mt-2">
                Soporta SSML: pausas, respiraciones, énfasis, susurros — todo para hipnosis profesional.
              </p>
            </div>
          </div>
        </div>

        {/* Main: Editor y bloques */}
        <div className="lg:col-span-8">
          {activeStep === 1 && (
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-sage-100 space-y-6">
              <div className="p-5 bg-sage-50 rounded-[1.5rem] border border-sage-100 text-[11px] text-sage-600 leading-relaxed italic">
                <Info size={14} className="inline mr-2 mb-1" />
                Escribe o pega tu guion de hipnosis. Usa <code className="bg-sage-200 px-1 rounded text-[10px]">...</code> para pausas,
                {' '}<code className="bg-sage-200 px-1 rounded text-[10px]">(respira)</code> para respiración,
                {' '}<code className="bg-sage-200 px-1 rounded text-[10px]">(énfasis)texto(énfasis)</code> para destacar,
                {' '}<code className="bg-sage-200 px-1 rounded text-[10px]">(susurro)texto(susurro)</code> para susurro.
              </div>

              {/* Ejemplos rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MEDITATION_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyle(style);
                      if (!inputText) {
                        setInputText(style.sampleText);
                      } else {
                        setInputText(prev => prev + '\n\n' + style.sampleText);
                      }
                    }}
                    className="p-3 bg-sand-50 border border-sand-200 rounded-xl text-[10px] font-bold text-sage-600 hover:bg-sage-100 transition-all text-center"
                  >
                    {style.emoji} {style.name}
                  </button>
                ))}
              </div>

              <textarea
                className="w-full min-h-[400px] p-8 bg-sand-50 border border-sand-200 rounded-[2.5rem] outline-none text-sage-800 text-sm leading-relaxed shadow-inner"
                placeholder={`Pega tu guion de hipnosis aquí...

Usa ... para pausas largas
Usa (respira) para indicar respiración
Usa (énfasis)texto(énfasis) para énfasis
Usa (susurro)texto(susurro) para susurro`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="flex justify-between items-center px-4 flex-wrap gap-4">
                <span className="text-[10px] font-bold text-sage-300 uppercase">{inputText.length} caracteres</span>
                {inputText.trim() && (
                  <button
                    onClick={() => setInputText('')}
                    className="text-[10px] font-bold text-sage-400 hover:text-red-400 uppercase"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <button
                onClick={prepareBlocks}
                disabled={!inputText.trim()}
                className="w-full py-6 bg-sage-700 text-white rounded-[2rem] font-bold text-xl shadow-xl hover:bg-sage-800 transition-all active:scale-95 disabled:bg-sand-200 disabled:cursor-not-allowed"
              >
                Generar con {selectedVoice.name.split(' ')[0]} • Estilo {selectedStyle.emoji} {selectedStyle.name}
                <ChevronRight size={20} className="inline ml-2" />
              </button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-10">
              <div className="bg-sage-600 p-8 rounded-[2.5rem] text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{selectedStyle.emoji}</span>
                      <h4 className="font-bold text-lg">{selectedStyle.name}</h4>
                      <span className="text-[9px] bg-white/20 px-2 py-1 rounded-lg uppercase tracking-wider">
                        {selectedVoice.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase opacity-70">
                      {progressMsg || `${blocks.length} bloques`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!isProcessing ? (
                      blocks.some(b => b.status === 'completed') ? (
                        <>
                          <button
                            onClick={cancelGeneration}
                            className="px-4 py-2 bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-white/30"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => setActiveStep(1)}
                            className="px-4 py-2 bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-white/30"
                          >
                            Editar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={processQueue}
                          className="px-8 py-3 bg-white text-sage-700 rounded-xl text-xs font-bold uppercase shadow-lg hover:scale-105 transition-all"
                        >
                          Iniciar Generación
                        </button>
                      )
                    ) : (
                      <button
                        onClick={cancelGeneration}
                        className="px-6 py-3 bg-red-500 text-white rounded-xl text-xs font-bold uppercase shadow-lg hover:bg-red-600 transition-all"
                      >
                        ⏹ Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Barra de progreso */}
                {isProcessing && (
                  <div className="mt-4">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-500"
                        style={{
                          width: `${(blocks.filter(b => b.status === 'completed' || b.status === 'error').length / Math.max(blocks.length, 1)) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-[9px] mt-2 opacity-60">
                      {blocks.filter(b => b.status === 'completed').length} de {blocks.length} bloques generados
                    </p>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-5 bg-red-50 border-2 border-red-200 rounded-[1.5rem] flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
                {blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className={`p-5 bg-white rounded-[1.8rem] border flex items-center gap-4 transition-all ${
                      block.status === 'completed'
                        ? 'border-sage-200 bg-sage-50/20'
                        : block.status === 'error'
                          ? 'border-red-200'
                          : block.status === 'processing'
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-sand-100 opacity-60'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-sand-300 w-8">{idx + 1}</span>
                    <p className="text-[11px] text-sage-800 italic flex-1 truncate">
                      "{block.text.slice(0, 120)}{block.text.length > 120 ? '...' : ''}"
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {block.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => block.url && previewBlock(block.url)}
                            className="p-2 text-sage-600 hover:bg-sage-100 rounded-lg"
                            title="Reproducir"
                          >
                            <Play size={14} />
                          </button>
                          <div className="p-1.5 bg-sage-600 text-white rounded-full">
                            <Check size={12} />
                          </div>
                        </div>
                      )}
                      {block.status === 'processing' && (
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-amber-500" />
                          <span className="text-[8px] font-bold text-amber-500 uppercase">Generando</span>
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
                <div className="flex gap-4">
                  <button
                    onClick={processQueue}
                    className="flex-1 py-5 bg-sage-200 text-sage-700 rounded-[2rem] font-bold text-sm shadow-lg hover:bg-sage-300 transition-all"
                  >
                    Regenerar Faltantes
                  </button>
                  <button
                    onClick={finalize}
                    className="flex-1 py-5 bg-sage-800 text-white rounded-[2rem] font-bold text-xl shadow-2xl hover:bg-black transition-all"
                  >
                    Unir y Exportar
                  </button>
                </div>
              )}
            </div>
          )}

          {activeStep === 3 && masterUrl && (
            <div className="bg-white p-16 rounded-[4rem] shadow-2xl border border-sage-100 flex flex-col items-center gap-10 animate-in zoom-in">
              <div className="w-24 h-24 bg-sage-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                <Music2 size={48} />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-sage-800 tracking-tight">Narración Lista 🎧</h2>
                <p className="text-sage-400 text-sm font-medium">
                  {selectedVoice.name} • {selectedStyle.emoji} {selectedStyle.name}
                </p>
                <p className="text-sage-400 text-sm font-medium">
                  {blocks.filter(b => b.status === 'completed').length} bloques • {Math.floor(masterDuration / 60)}m {Math.floor(masterDuration % 60)}s
                </p>
                <p className="text-[10px] font-bold text-green-600 uppercase mt-2">
                  ✅ Voz Neural Microsoft • Sin costo de API
                </p>
              </div>
              <audio src={masterUrl} controls className="w-full max-w-md" />
              <button
                onClick={() => onGenerationComplete({
                  voiceBlob: masterBlob,
                  voiceUrl: masterUrl,
                  duration: masterDuration
                })}
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

// ── Helper: AudioBuffer → WAV ─────────────────────────────────────────────────
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
  const w = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  w(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);       // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  w(36, 'data');
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

export default AIVoiceGenerator;
