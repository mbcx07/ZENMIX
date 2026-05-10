import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Check, Loader2, Play, BrainCircuit, AlertCircle, Music2,
  ChevronRight, Info, Undo2
} from 'lucide-react';
import { SessionData } from '../types';
import {
  getAvailableVoices, mapToZenVoices, ZenVoice,
  synthesizeWithCapture, previewVoiceSimple, audioBufferToWav, webmToAudioBuffer
} from '../services/zenmixTtsService';

const MEDITATION_STYLES = [
  {
    id: 'hypnosis', name: 'Hipnosis Profunda', emoji: '🧿',
    desc: 'Voz lenta, pausas terapéuticas, sugestión hipnótica',
    rate: 0.55, pitch: 0.8,
    sampleText: `Cierra los ojos... respira profundamente...\nCada parte de tu cuerpo se relaja más y más...\n10... más profundo... 9... más relajado... 8... suelta todo...\n7... cada pensamiento se disuelve... 6... solo existe este momento...`
  },
  {
    id: 'meditation', name: 'Meditación Guiada', emoji: '🧘',
    desc: 'Voz cálida y pausada, visualizaciones serenas',
    rate: 0.7, pitch: 1.0,
    sampleText: `Siéntate cómodamente... siente el peso de tu cuerpo...\nObserva tu respiración sin juzgarla...\nInhala paz... exhala tensión...`
  },
  {
    id: 'sleep', name: 'Sueño Reparador', emoji: '🌙',
    desc: 'Voz muy lenta, arrullo hipnótico',
    rate: 0.45, pitch: 0.7,
    sampleText: `Deja que tus párpados se vuelvan pesados...\nCada respiración te hunde más profundamente...\nFlotas... ingrávido... envuelto en una suave oscuridad...`
  },
  {
    id: 'focus', name: 'Enfoque', emoji: '🎯',
    desc: 'Voz clara y firme, ritmo constante',
    rate: 0.75, pitch: 1.0,
    sampleText: `Centra tu atención en este momento...\nTres respiraciones profundas...\nTu mente se aclara como un lago en calma...`
  },
  {
    id: 'healing', name: 'Sanación Interior', emoji: '💚',
    desc: 'Voz suave y compasiva, ritmo lento',
    rate: 0.6, pitch: 0.9,
    sampleText: `Con amor y compasión... te invito a conectar con tu interior...\nDonde hay tensión... permites que se disuelva...`
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
  const [voices, setVoices] = useState<ZenVoice[]>([]);
  const [rawVoices, setRawVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);

  const [blocks, setBlocks] = useState<AudioBlock[]>([]);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [masterBlob, setMasterBlob] = useState<Blob | null>(null);
  const [masterDuration, setMasterDuration] = useState(0);

  const abortRef = useRef(false);
  const previewingRef = useRef(false);

  // ── Cargar voces ───────────────────────────────────────────────────────────
  useEffect(() => {
    getAvailableVoices().then((sysVoices) => {
      setRawVoices(sysVoices);
      setVoices(mapToZenVoices(sysVoices));
    });
  }, []);

  const selectedVoice = rawVoices[selectedVoiceIdx];
  const effectiveRate = selectedStyle.rate;
  const effectivePitch = selectedStyle.pitch;

  // ── Preview de voz ─────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!selectedVoice || previewingRef.current) return;
    previewingRef.current = true;
    try {
      await previewVoiceSimple(
        `Hola, soy ${selectedVoice.name}. Escúchame con atención...`,
        selectedVoice,
        effectiveRate,
        effectivePitch
      );
    } catch (err: any) {
      setErrorMsg(`Preview: ${err.message}`);
    }
    previewingRef.current = false;
  };

  // ── Dividir texto ───────────────────────────────────────────────────────────
  const prepareBlocks = () => {
    if (!inputText.trim()) return;
    if (inputText.length > 200000) { alert("Texto demasiado largo."); return; }

    // Dividir por párrafos, máx ~2000 chars por bloque para evitar cortes
    const paragraphs = inputText.split(/\n\s*\n/);
    const newBlocks: AudioBlock[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      if (trimmed.length <= 2000) {
        newBlocks.push({ id: `b-${Date.now()}-${newBlocks.length}`, text: trimmed, status: 'pending', url: null });
      } else {
        const sentences = trimmed.match(/[^.!?\n]+[.!?\n]*/g) || [trimmed];
        let chunk = '';
        for (const s of sentences) {
          if ((chunk + s).length > 2000 && chunk) {
            newBlocks.push({ id: `b-${Date.now()}-${newBlocks.length}`, text: chunk.trim(), status: 'pending', url: null });
            chunk = s;
          } else { chunk += s; }
        }
        if (chunk.trim()) {
          newBlocks.push({ id: `b-${Date.now()}-${newBlocks.length}`, text: chunk.trim(), status: 'pending', url: null });
        }
      }
    }

    if (newBlocks.length === 0) {
      newBlocks.push({ id: `b-${Date.now()}-0`, text: inputText.trim(), status: 'pending', url: null });
    }

    setBlocks(newBlocks);
    setActiveStep(2);
  };

  // ── Generar un bloque ──────────────────────────────────────────────────────
  const generateBlock = async (text: string): Promise<Blob | null> => {
    if (!selectedVoice) {
      throw new Error('No hay voz seleccionada');
    }
    return await synthesizeWithCapture(text, selectedVoice, effectiveRate, effectivePitch);
  };

  // ── Producir cola ──────────────────────────────────────────────────────────
  const processQueue = async () => {
    if (blocks.length === 0 || !selectedVoice) return;
    setIsProcessing(true);
    setErrorMsg(null);
    abortRef.current = false;

    for (let i = 0; i < blocks.length; i++) {
      if (abortRef.current) break;
      const block = blocks[i];
      if (block.status === 'completed') continue;

      setProgressMsg(`Generando bloque ${i + 1} de ${blocks.length}...`);
      setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'processing' } : b));

      try {
        const blob = await generateBlock(block.text);
        const url = blob ? URL.createObjectURL(blob) : null;
        setBlocks(prev => prev.map((b, idx) =>
          idx === i ? { ...b, status: blob ? 'completed' : 'error', url, errorMsg: blob ? undefined : 'Audio vacío' } : b
        ));
        // Pausa para no saturar
        if (i < blocks.length - 1 && blob) {
          // Esperar duración estimada del audio + buffer
          const wordCount = block.text.split(' ').length;
          const estimatedDuration = (wordCount / (180 * effectiveRate)) * 1000 + 1500;
          await new Promise(r => setTimeout(r, estimatedDuration));
        }
      } catch (err: any) {
        setBlocks(prev => prev.map((b, idx) =>
          idx === i ? { ...b, status: 'error', errorMsg: err.message || 'Error desconocido' } : b
        ));
      }
    }

    setProgressMsg(abortRef.current ? '⏹ Cancelado' : '✅ Finalizado');
    setIsProcessing(false);
  };

  const cancelGeneration = () => {
    abortRef.current = true;
    window.speechSynthesis.cancel();
  };

  // ── Preview bloque ─────────────────────────────────────────────────────────
  const previewBlock = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  // ── Unir ───────────────────────────────────────────────────────────────────
  const finalize = async () => {
    const completed = blocks.filter(b => b.status === 'completed' && b.url);
    if (completed.length === 0) {
      setErrorMsg('No hay bloques completados para unir.');
      return;
    }

    setProgressMsg('Uniendo bloques...');

    try {
      const buffers: AudioBuffer[] = [];
      let sampleRate = 48000;

      for (const block of completed) {
        const resp = await fetch(block.url!);
        const arrayBuf = await resp.arrayBuffer();
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
          sampleRate = audioBuf.sampleRate;
          buffers.push(audioBuf);
          audioCtx.close();
        } catch {
          // Intentar como raw
          console.warn('Skip bloque no decodificable');
        }
      }

      if (buffers.length === 0) throw new Error('No se pudo decodificar ningún bloque');

      const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
      const masterCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const masterBuf = masterCtx.createBuffer(2, totalLen, sampleRate);

      let offset = 0;
      for (const buf of buffers) {
        for (let ch = 0; ch < Math.min(2, buf.numberOfChannels); ch++) {
          masterBuf.getChannelData(ch).set(buf.getChannelData(ch), offset);
        }
        offset += buf.length;
      }

      const wavBlob = audioBufferToWav(masterBuf);
      const url = URL.createObjectURL(wavBlob);
      const duration = masterBuf.length / masterBuf.sampleRate;

      setMasterBlob(wavBlob);
      setMasterUrl(url);
      setMasterDuration(duration);
      setActiveStep(3);
      masterCtx.close();
    } catch (err: any) {
      setErrorMsg('Error al unir: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in max-w-5xl mx-auto w-full">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-sage-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sage-600 rounded-2xl text-white shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-sage-800 tracking-tight">Narrador de Meditación</h3>
            <p className="text-[10px] uppercase font-bold text-sage-400 tracking-widest">
              Voz Local del Sistema • 100% Gratis • Offline
            </p>
          </div>
        </div>
        {activeStep > 1 && !isProcessing && (
          <button onClick={() => setActiveStep(1)} className="p-3 text-sage-400 hover:text-sage-600 flex items-center gap-2 text-xs font-bold uppercase">
            <Undo2 size={16} /> Editar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-sage-100 shadow-sm sticky top-28">
            <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-4">
              🎤 Voz Local
            </h4>

            <div className="mb-4">
              <label className="text-[9px] font-bold text-sage-300 uppercase block mb-2">Voz del sistema ({voices.length} disponibles)</label>
              <select
                value={selectedVoiceIdx}
                onChange={(e) => setSelectedVoiceIdx(parseInt(e.target.value))}
                disabled={isProcessing}
                className="w-full p-3 rounded-xl border border-sand-200 bg-sand-50 text-sage-800 text-xs font-medium mb-1"
              >
                {voices.map((v, i) => (
                  <option key={v.id} value={i}>{v.name} {v.description}</option>
                ))}
              </select>
              {selectedVoice && (
                <p className="text-[9px] text-sage-400">{selectedVoice.lang} {selectedVoice.localService ? '📦 Local' : '☁️'}</p>
              )}
            </div>

            <button
              onClick={handlePreview}
              disabled={!selectedVoice || isProcessing || previewingRef.current}
              className="w-full mb-6 p-3 bg-sage-100 text-sage-700 rounded-xl text-[10px] font-bold uppercase hover:bg-sage-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play size={14} /> {previewingRef.current ? 'Reproduciendo...' : '🎧 Escuchar Preview'}
            </button>

            <div className="pt-4 border-t border-sand-100">
              <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-3">Estilo de Hipnosis</h4>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
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

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
              <p className="text-[10px] font-bold text-green-700 uppercase mb-1">✅ 100% Gratuito</p>
              <p className="text-[9px] text-green-600 leading-relaxed">
                Usa el sintetizador de voz nativo de tu dispositivo. Sin API keys, sin cuentas, sin límites. Funciona offline.
              </p>
              <p className="text-[9px] text-amber-600 mt-2">
                💡 Para mejor calidad, instala voces premium en la configuración de accesibilidad de tu sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-8">
          {activeStep === 1 && (
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-sage-100 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MEDITATION_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyle(style);
                      setInputText(prev => prev ? prev + '\n\n' + style.sampleText : style.sampleText);
                    }}
                    className="p-3 bg-sand-50 border border-sand-200 rounded-xl text-[10px] font-bold text-sage-600 hover:bg-sage-100 text-center"
                  >
                    {style.emoji} {style.name}
                  </button>
                ))}
              </div>

              <textarea
                className="w-full min-h-[400px] p-8 bg-sand-50 border border-sand-200 rounded-[2.5rem] outline-none text-sage-800 text-sm leading-relaxed shadow-inner"
                placeholder="Pega tu guion de meditación aquí..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="flex justify-between items-center px-4">
                <span className="text-[10px] font-bold text-sage-300 uppercase">{inputText.length} caracteres</span>
                {inputText.trim() && (
                  <button onClick={() => setInputText('')} className="text-[10px] font-bold text-sage-400 hover:text-red-400 uppercase">
                    Limpiar
                  </button>
                )}
              </div>
              {!selectedVoice && voices.length === 0 && (
                <p className="text-xs text-amber-600 text-center">
                  ⏳ Cargando voces del sistema...
                </p>
              )}
              <button
                onClick={prepareBlocks}
                disabled={!inputText.trim() || !selectedVoice}
                className="w-full py-6 bg-sage-700 text-white rounded-[2rem] font-bold text-xl shadow-xl hover:bg-sage-800 disabled:bg-sand-200"
              >
                Generar Narración
                <ChevronRight size={20} className="inline ml-2" />
              </button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-10">
              <div className="bg-sage-600 p-8 rounded-[2.5rem] text-white shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{selectedStyle.emoji}</span>
                      <h4 className="font-bold text-lg">{selectedStyle.name}</h4>
                      <span className="text-[9px] bg-white/20 px-2 py-1 rounded-lg uppercase">
                        {selectedVoice?.name || 'Voz'}
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
                          <button onClick={() => setActiveStep(1)} className="px-4 py-2 bg-white/20 rounded-xl text-[10px] font-bold uppercase hover:bg-white/30">
                            Editar
                          </button>
                          <button onClick={processQueue} className="px-6 py-2 bg-white text-sage-700 rounded-xl text-[10px] font-bold uppercase shadow-lg hover:scale-105">
                            Continuar
                          </button>
                        </>
                      ) : (
                        <button onClick={processQueue} className="px-8 py-3 bg-white text-sage-700 rounded-xl text-xs font-bold uppercase shadow-lg hover:scale-105">
                          {blocks.length > 0 ? 'Iniciar Generación' : 'No hay bloques'}
                        </button>
                      )
                    ) : (
                      <button onClick={cancelGeneration} className="px-6 py-3 bg-red-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-red-600">
                        ⏹ Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {isProcessing && (
                  <div className="mt-4">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${(blocks.filter(b => b.status === 'completed' || b.status === 'error').length / Math.max(blocks.length, 1)) * 100}%` }}
                      />
                    </div>
                    <p className="text-[9px] mt-2 opacity-60">
                      {blocks.filter(b => b.status === 'completed').length} de {blocks.length} bloques
                    </p>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-5 bg-red-50 border-2 border-red-200 rounded-[1.5rem] flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
                    {errorMsg.includes('conexión') && (
                      <p className="text-[10px] text-red-500 mt-1">Verifica tu conexión a internet e intenta de nuevo.</p>
                    )}
                    {errorMsg.includes('voz') && (
                      <p className="text-[10px] text-red-500 mt-1">Prueba seleccionando otra voz del sistema.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-3">
                {blocks.map((block, idx) => (
                  <div key={block.id} className={`p-5 bg-white rounded-[1.8rem] border flex items-center gap-4 ${
                    block.status === 'completed' ? 'border-sage-200' :
                    block.status === 'error' ? 'border-red-200' :
                    block.status === 'processing' ? 'border-amber-200 bg-amber-50/30' :
                    'border-sand-100 opacity-60'
                  }`}>
                    <span className="text-[10px] font-bold text-sand-300 w-6 shrink-0">{idx + 1}</span>
                    <p className="text-[11px] text-sage-800 italic flex-1 truncate">
                      "{block.text.slice(0, 100)}{block.text.length > 100 ? '...' : ''}"
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
                          <Check size={14} className="text-sage-600" />
                        </div>
                      )}
                      {block.status === 'processing' && (
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-amber-500" />
                          <span className="text-[8px] font-bold text-amber-500 uppercase">Generando</span>
                        </div>
                      )}
                      {block.status === 'error' && (
                        <span className="text-[9px] font-bold text-red-500 uppercase" title={block.errorMsg}>
                          Error {block.errorMsg ? '⚠' : ''}
                        </span>
                      )}
                      {block.status === 'pending' && (
                        <span className="text-[9px] font-bold text-sand-300 uppercase">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {blocks.some(b => b.status === 'completed') && !isProcessing && (
                <button onClick={finalize} className="w-full py-5 bg-sage-800 text-white rounded-[2rem] font-bold text-xl shadow-2xl hover:bg-black transition-all">
                  Unir y Exportar ({blocks.filter(b => b.status === 'completed').length} bloques)
                </button>
              )}
            </div>
          )}

          {activeStep === 3 && masterUrl && (
            <div className="bg-white p-16 rounded-[4rem] shadow-2xl border border-sage-100 flex flex-col items-center gap-10">
              <div className="w-24 h-24 bg-sage-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                <Music2 size={48} />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-sage-800">Narración Lista 🎧</h2>
                <p className="text-sage-400 text-sm">
                  {selectedStyle.emoji} {selectedStyle.name}
                </p>
                <p className="text-sage-400 text-sm">
                  {blocks.filter(b => b.status === 'completed').length} bloques • {Math.floor(masterDuration / 60)}m {Math.floor(masterDuration % 60)}s
                </p>
                <p className="text-[10px] font-bold text-green-600 uppercase mt-2">✅ Sin costo</p>
              </div>
              <audio src={masterUrl} controls className="w-full max-w-md" />
              <button
                onClick={() => onGenerationComplete({
                  voiceBlob: masterBlob,
                  voiceUrl: masterUrl,
                  duration: masterDuration
                })}
                className="w-full py-6 bg-sage-700 text-white rounded-[2rem] font-bold text-xl shadow-xl hover:bg-sage-800"
              >
                Importar al Mezclador
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIVoiceGenerator;
