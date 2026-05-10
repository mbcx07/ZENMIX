
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Check, Loader2, Play, BrainCircuit, AlertCircle, Music2, 
  ChevronRight, Info, RefreshCw, Undo2, Edit3, 
  Download, ListChecks, ArrowRight, Save, Clock, Trash2
} from 'lucide-react';
import { SessionData } from '../types';

interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Kore', name: 'Femenina Calmada (Kore)', gender: 'female' },
  { id: 'Zephyr', name: 'Masculina Susurro (Zephyr)', gender: 'male' },
  { id: 'Charon', name: 'Masculina Profunda (Charon)', gender: 'male' },
  { id: 'Puck', name: 'Grave Abismal (Puck)', gender: 'male' },
];

interface AudioBlock {
  id: string;
  originalText: string;
  cleanText: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  pcm: Uint8Array | null;
  url: string | null;
  errorCount: number;
}

interface AIVoiceGeneratorProps {
  onGenerationComplete: (data: SessionData) => void;
}

const AIVoiceGenerator: React.FC<AIVoiceGeneratorProps> = ({ onGenerationComplete }) => {
  const [inputText, setInputText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS[0]);
  const [speed, setSpeed] = useState(0.88);
  
  const [blocks, setBlocks] = useState<AudioBlock[]>([]);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [masterBlob, setMasterBlob] = useState<Blob | null>(null);
  const [masterDuration, setMasterDuration] = useState(0);

  // --- AUDIO UTILS ---
  const decodeBase64 = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const createWavBlob = (pcmData: Uint8Array, sampleRate: number): Blob => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeString = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); 
    view.setUint16(32, 2, true); 
    view.setUint16(34, 16, true); 
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);
    return new Blob([header, pcmData], { type: 'audio/wav' });
  };

  // --- LOGIC ---
  const deepSanitize = (text: string): string => {
    return text
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos (opcional pero estable)
      .replace(/\[.*?\]/g, ' ') 
      .replace(/\(pausa.*?\)/gi, '...')
      .replace(/\(respira.*?\)/gi, '...')
      .replace(/pausa corta|pausa media|pausa larga/gi, '...')
      .replace(/[^a-zA-Z0-9\s.,!?]/g, ' ') // Eliminar caracteres especiales raros
      .replace(/\s+/g, ' ')
      .trim();
  };

  const prepareBlocks = () => {
    if (!inputText.trim()) return;
    if (inputText.length > 60000) {
      alert("Texto demasiado largo. El límite es de 60,000 caracteres.");
      return;
    }

    const cleanMaster = deepSanitize(inputText);
    // Segmentación por frases para no cortar ideas
    const sentences = cleanMaster.match(/[^.!?]+[.!?]+/g) || [cleanMaster];
    const newBlocks: AudioBlock[] = [];
    let currentChunk = "";
    
    sentences.forEach((s) => {
      // Intentamos bloques de ~60 palabras para máxima estabilidad del servidor
      if ((currentChunk + s).split(' ').length > 60) {
        if (currentChunk) {
          newBlocks.push({
            id: `b-${Date.now()}-${newBlocks.length}`,
            originalText: currentChunk.trim(),
            cleanText: currentChunk.trim() + "...",
            status: 'pending', pcm: null, url: null, errorCount: 0
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
        originalText: currentChunk.trim(),
        cleanText: currentChunk.trim() + ".",
        status: 'pending', pcm: null, url: null, errorCount: 0
      });
    }

    setBlocks(newBlocks);
    setActiveStep(2);
  };

  const callTTS = async (index: number, retry = 0): Promise<boolean> => {
    const block = blocks[index];
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, status: 'processing', errorCount: retry } : b));

    try {
      // IMPORTANTE: Crear instancia nueva cada vez para evitar estados de sesión corruptos
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Actúa como un narrador profesional de hipnosis. Lee con voz muy profunda, lenta y calmada. Haz pausas naturales. No dramatices. Texto: ${block.cleanText}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: prompt,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.id } }
          }
        },
      });

      const b64 = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      if (!b64) throw new Error("500: Server rejected block");

      const pcm = decodeBase64(b64);
      const url = URL.createObjectURL(createWavBlob(pcm, 24000));

      setBlocks(prev => prev.map((b, i) => i === index ? { 
        ...b, status: 'completed', pcm, url 
      } : b));
      return true;

    } catch (err) {
      console.error(`Error en bloque ${index}:`, err);
      
      if (retry < 3) {
        // Backoff exponencial: 5s, 15s, 45s
        const wait = [5000, 15000, 45000][retry];
        setProgressMsg(`Reintentando bloque ${index+1} en ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        return callTTS(index, retry + 1);
      }

      // Si falla después de reintentos, intentamos sub-segmentar si es posible
      if (block.cleanText.split(' ').length > 30) {
        setProgressMsg(`Dividiendo bloque ${index+1} por complejidad...`);
        const words = block.cleanText.split(' ');
        const mid = Math.floor(words.length / 2);
        const p1 = words.slice(0, mid).join(' ') + "...";
        const p2 = words.slice(mid).join(' ');

        const nextBlocks = [...blocks];
        nextBlocks.splice(index, 1, 
          { ...block, id: block.id + '-a', cleanText: p1, status: 'pending', errorCount: 0 },
          { ...block, id: block.id + '-b', cleanText: p2, status: 'pending', errorCount: 0 }
        );
        setBlocks(nextBlocks);
        return false;
      }

      setBlocks(prev => prev.map((b, i) => i === index ? { ...b, status: 'error' } : b));
      return false;
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    
    // Procesar uno por uno estrictamente
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].status !== 'completed') {
        setProgressMsg(`Generando bloque ${i + 1} de ${blocks.length}...`);
        const success = await callTTS(i);
        
        if (success) {
          // Pausa aleatoria (Jitter) de 4 a 7 segundos para no saturar
          const jitter = 4000 + Math.random() * 3000;
          await new Promise(r => setTimeout(r, jitter));
        } else {
          // Si el bloque fue dividido, la longitud de blocks cambió, 
          // volvemos a procesar el mismo índice
          if (blocks.length > i) {
             i--; 
             continue;
          }
        }
      }
    }
    setIsProcessing(false);
    setProgressMsg("¡Todos los bloques generados!");
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const finalize = async () => {
    const ready = blocks.filter(b => b.status === 'completed' && b.pcm);
    if (ready.length === 0) return;

    let totalLen = 0;
    ready.forEach(b => totalLen += b.pcm!.length);

    const masterPcm = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of ready) {
      masterPcm.set(b.pcm!, offset);
      offset += b.pcm!.length;
    }

    const blob = createWavBlob(masterPcm, 24000);
    const url = URL.createObjectURL(blob);
    
    setMasterBlob(blob);
    setMasterUrl(url);
    setMasterDuration(masterPcm.length / 48000);
    setActiveStep(3);
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in max-w-5xl mx-auto w-full">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-sage-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sage-600 rounded-2xl text-white shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-sage-800 tracking-tight">Narración IA Hipnótica</h3>
            <p className="text-[10px] uppercase font-bold text-sage-400 tracking-widest">Resiliencia de Red v3.0</p>
          </div>
        </div>
        {activeStep > 1 && !isProcessing && (
          <button onClick={() => setActiveStep(1)} className="p-3 text-sage-400 hover:text-sage-600 transition-colors flex items-center gap-2 text-xs font-bold uppercase">
            <Undo2 size={16} /> Editar Texto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-[2.5rem] border border-sage-100 shadow-sm sticky top-28">
              <h4 className="text-[10px] font-bold text-sage-400 uppercase tracking-widest mb-6">Configuración de Voz</h4>
              
              <div className="space-y-4">
                {VOICE_OPTIONS.map((v) => (
                  <button 
                    key={v.id} onClick={() => activeStep === 1 && setSelectedVoice(v)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${selectedVoice.id === v.id ? 'bg-sage-600 border-sage-600 text-white shadow-lg' : 'bg-sand-50 border-sand-200 text-sage-700 hover:bg-white disabled:opacity-50'}`}
                    disabled={activeStep !== 1}
                  >
                    <div className="font-bold text-xs">{v.name}</div>
                    <div className="text-[9px] opacity-60 uppercase">{v.gender === 'male' ? 'Masculino' : 'Femenino'} • Deep Calm</div>
                  </button>
                ))}

                <div className="pt-4 border-t border-sand-100">
                  <div className="flex justify-between mb-2">
                    <label className="text-[9px] font-bold text-sage-300 uppercase">Velocidad de Lectura</label>
                    <span className="text-[10px] font-bold text-sage-600">{speed}x</span>
                  </div>
                  <input 
                    type="range" min="0.8" max="1.1" step="0.01" 
                    value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    disabled={activeStep !== 1}
                    className="w-full h-2 bg-sand-200 rounded-full appearance-none cursor-pointer accent-sage-600"
                  />
                </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8">
          {activeStep === 1 && (
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-sage-100 space-y-6">
              <div className="p-5 bg-sage-50 rounded-[1.5rem] border border-sage-100 text-[11px] text-sage-600 leading-relaxed italic">
                <Info size={14} className="inline mr-2 mb-1" />
                El sistema divide automáticamente el texto en fragmentos de seguridad para evitar errores del servidor. El límite es de 60k caracteres.
              </div>
              <textarea 
                className="w-full min-h-[500px] p-8 bg-sand-50 border border-sand-200 rounded-[2.5rem] outline-none text-sage-800 text-sm leading-relaxed shadow-inner"
                placeholder="Pega tu guion de meditación aquí..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="flex justify-between items-center px-4">
                <span className="text-[10px] font-bold text-sage-300 uppercase">{inputText.length} / 60,000</span>
                <button 
                  onClick={prepareBlocks} disabled={!inputText.trim()}
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
                    <h4 className="font-bold text-lg">Estado de la Producción</h4>
                    <span className="text-[10px] font-bold uppercase opacity-70">{progressMsg || `${blocks.length} bloques en cola`}</span>
                 </div>
                 {!isProcessing ? (
                   <button 
                    onClick={processQueue}
                    className="px-8 py-3 bg-white text-sage-700 rounded-xl text-xs font-bold uppercase shadow-lg hover:scale-105 transition-all"
                   >
                     {blocks.some(b => b.status === 'completed') ? 'Continuar Grabación' : 'Iniciar Generación'}
                   </button>
                 ) : (
                   <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-xl">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider">Procesando...</span>
                   </div>
                 )}
               </div>

               <div className="space-y-3 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                 {blocks.map((block, idx) => (
                   <div 
                    key={block.id} 
                    className={`p-5 bg-white rounded-[1.8rem] border flex items-center gap-4 transition-all ${block.status === 'completed' ? 'border-sage-200 bg-sage-50/20' : block.status === 'error' ? 'border-red-200' : block.status === 'processing' ? 'border-sage-400 shadow-md ring-4 ring-sage-50' : 'border-sand-100 opacity-60'}`}
                   >
                      <span className="text-[10px] font-bold text-sand-300 w-8">{idx + 1}</span>
                      
                      {editingBlockId === block.id ? (
                        <div className="flex-1 flex gap-2">
                          <input 
                            type="text" value={block.cleanText} 
                            onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? {...b, cleanText: e.target.value} : b))}
                            className="flex-1 bg-sand-50 border border-sand-200 rounded-lg px-3 py-1 text-xs outline-none"
                          />
                          <button onClick={() => setEditingBlockId(null)} className="p-2 bg-sage-600 text-white rounded-lg"><Save size={14}/></button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-sage-800 italic flex-1 truncate">"{block.cleanText}"</p>
                      )}

                      <div className="flex items-center gap-2">
                        {block.status === 'processing' && <Loader2 size={16} className="animate-spin text-sage-600" />}
                        {block.status === 'completed' && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => new Audio(block.url!).play()} className="p-2 text-sage-600 hover:bg-sage-100 rounded-lg"><Play size={14}/></button>
                            <div className="p-1.5 bg-sage-600 text-white rounded-full"><Check size={12} /></div>
                          </div>
                        )}
                        {block.status === 'error' && (
                          <div className="flex gap-1">
                             <button onClick={() => setEditingBlockId(block.id)} className="p-2 text-sage-400 hover:text-sage-600"><Edit3 size={14}/></button>
                             <button onClick={() => callTTS(idx)} className="text-[9px] font-bold text-red-600 uppercase border border-red-100 px-3 py-1.5 rounded-lg bg-red-50">Reintentar</button>
                          </div>
                        )}
                      </div>
                   </div>
                 ))}
               </div>

               <button 
                onClick={finalize} disabled={blocks.some(b => b.status !== 'completed') || isProcessing}
                className="w-full py-8 bg-sage-800 text-white rounded-[2.5rem] font-bold text-xl shadow-2xl disabled:bg-sand-100 disabled:text-sand-300 transition-all hover:bg-black"
               >
                Crear Archivo Final (Master)
               </button>
            </div>
          )}

          {activeStep === 3 && masterUrl && (
            <div className="bg-white p-16 rounded-[4rem] shadow-2xl border border-sage-100 flex flex-col items-center gap-10 animate-in zoom-in">
               <div className="w-24 h-24 bg-sage-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                  <Music2 size={48} />
               </div>
               <div className="text-center space-y-2">
                 <h2 className="text-3xl font-bold text-sage-800 tracking-tight">Narración Lista</h2>
                 <p className="text-sage-400 text-sm font-medium">Duración: {Math.floor(masterDuration/60)}m {Math.floor(masterDuration%60)}s</p>
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
