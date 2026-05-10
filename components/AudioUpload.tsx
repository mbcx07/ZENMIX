import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileAudio, X, Play, Pause, Check, Layers, Loader2, Music2, Plus, AlertCircle, Info } from 'lucide-react';
import { SessionData } from '../types';
import { mergeAudioBuffers, audioBufferToWav } from '../services/audioEngine';
import { createAudioContext, safeDecodeAudioData, formatAudioError } from '../services/audioUtils';

interface AudioUploadProps {
  onUpload: (data: SessionData) => void;
}

interface AudioFileEntry {
  id: string;
  file: File;
  duration: number;
  previewUrl: string;
  format: string;
}

// ============================================================
// FORMAT DETECTION & SUPPORT
// ============================================================
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'audio/wav':         'WAV',
  'audio/wave':        'WAV',
  'audio/x-wav':       'WAV',
  'audio/mpeg':        'MP3',
  'audio/mp3':         'MP3',
  'audio/mp4':         'M4A / AAC',
  'audio/m4a':         'M4A',
  'audio/x-m4a':       'M4A',
  'audio/aac':         'AAC',
  'audio/ogg':         'OGG',
  'audio/vorbis':      'OGG Vorbis',
  'audio/opus':        'OGG Opus',
  'audio/flac':        'FLAC',
  'audio/x-flac':      'FLAC',
  'audio/webm':        'WebM',
};

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.wav':  'WAV',
  '.wave': 'WAV',
  '.mp3':  'MP3',
  '.m4a':  'M4A / AAC',
  '.aac':  'AAC',
  '.ogg':  'OGG',
  '.oga':  'OGG',
  '.opus': 'OGG Opus',
  '.flac': 'FLAC',
  '.webm': 'WebM',
  '.weba': 'WebM Audio',
};

function detectFormat(file: File): string {
  // 1) Intentar por MIME type del navegador
  const mime = file.type.toLowerCase();
  if (SUPPORTED_MIME_TYPES[mime]) return SUPPORTED_MIME_TYPES[mime];

  // 2) Intentar por extensión del nombre
  const name = file.name.toLowerCase();
  for (const [ext, label] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (name.endsWith(ext)) return label;
  }

  // 3) Magic bytes heuristic (fallback para navegadores que no reportan MIME)
  return 'Audio (' + (mime || 'desconocido') + ')';
}

// ============================================================
// COMPONENT
// ============================================================
const AudioUpload: React.FC<AudioUploadProps> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<AudioFileEntry[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const entryUrlsRef = useRef<Set<string>>(new Set());

  // 🔥 Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      entryUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      entryUrlsRef.current.clear();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;

    const newEntries: AudioFileEntry[] = [];
    const errors: string[] = [];
    
    for (const file of selectedFiles) {
      const format = detectFormat(file);

      // Validar que sea un formato de audio reconocido
      if (!file.type.startsWith('audio/') && !Object.keys(SUPPORTED_EXTENSIONS).some(ext => file.name.toLowerCase().endsWith(ext))) {
        errors.push(`"${file.name}" no es un formato de audio reconocido.`);
        continue;
      }

      try {
        const url = URL.createObjectURL(file);
        
        const duration = await new Promise<number>((resolve, reject) => {
          const tempAudio = new Audio(url);
          tempAudio.onloadedmetadata = () => resolve(tempAudio.duration);
          tempAudio.onerror = () => reject(new Error(`No se pudo leer "${file.name}". El formato puede estar corrupto o no ser soportado por el navegador.`));
          // Timeout de 10s para archivos problemáticos
          setTimeout(() => reject(new Error(`Timeout al leer "${file.name}".`)), 10000);
        });

        newEntries.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          duration,
          previewUrl: url,
          format
        });
      } catch (err: any) {
        errors.push(err.message || `Error al procesar "${file.name}".`);
      }
    }

    if (errors.length > 0) {
      setWarning(errors.join('\n'));
      setTimeout(() => setWarning(null), 8000);
    }

    if (newEntries.length > 0) {
      setEntries(prev => [...prev, ...newEntries]);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeEntry = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry) URL.revokeObjectURL(entry.previewUrl);
    setEntries(prev => prev.filter(e => e.id !== id));
    if (isPlaying === id) setIsPlaying(null);
  };

  const handleMergeAndConfirm = async () => {
    if (entries.length === 0) return;
    setIsMerging(true);

    try {
      const audioCtx = createAudioContext();
      
      const buffers: AudioBuffer[] = [];
      for (const entry of entries) {
        const arrayBuffer = await entry.file.arrayBuffer();
        const decoded = await safeDecodeAudioData(audioCtx, arrayBuffer);
        buffers.push(decoded);
      }

      const mergedBuffer = mergeAudioBuffers(audioCtx, buffers);
      
      const finalWavBlob = audioBufferToWav(mergedBuffer);
      const finalUrl = URL.createObjectURL(finalWavBlob);
      const totalDuration = mergedBuffer.duration;

      onUpload({
        voiceBlob: finalWavBlob,
        voiceUrl: finalUrl,
        duration: totalDuration
      });
    } catch (err) {
      console.error("Merge error:", err);
      alert(formatAudioError(err));
    } finally {
      setIsMerging(false);
    }
  };

  const togglePreview = (id: string) => {
    if (isPlaying === id) {
      audioRef.current?.pause();
      setIsPlaying(null);
    } else {
      setIsPlaying(id);
      const entry = entries.find(e => e.id === id);
      if (entry && audioRef.current) {
        // 🔥 Revoke old src before setting new one
        if (audioRef.current.src) {
          const oldSrc = audioRef.current.src;
          if (oldSrc.startsWith('blob:')) {
            try { URL.revokeObjectURL(oldSrc); } catch {}
          }
        }
        audioRef.current.src = entry.previewUrl;
        audioRef.current.play();
      }
    }
  };

  const formatDuration = (d: number) => {
    const mins = Math.floor(d / 60);
    const secs = Math.floor(d % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDurationSeconds = entries.reduce((acc, curr) => acc + curr.duration, 0);
  const formatBadgeClass = (format: string) => {
    if (format.includes('WAV')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (format.includes('MP3')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (format.includes('M4A') || format.includes('AAC')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (format.includes('OGG') || format.includes('Opus') || format.includes('Vorbis')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (format.includes('FLAC')) return 'bg-green-50 text-green-700 border-green-200';
    return 'bg-sand-50 text-sage-700 border-sand-200';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="p-10 bg-white rounded-[3rem] shadow-sm border border-sand-200 flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h3 className="text-3xl font-black text-sage-900 uppercase tracking-tighter italic">Multi-Part Assembler</h3>
          <p className="text-[10px] text-sage-400 font-bold uppercase tracking-[0.3em]">Une múltiples grabaciones en una sola meditación continua</p>
        </div>

        {warning && (
          <div className="w-full max-w-2xl p-5 bg-amber-50 border-2 border-amber-200 rounded-[1.5rem] flex items-start gap-3 animate-in fade-in">
            <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 font-medium whitespace-pre-wrap">{warning}</p>
          </div>
        )}

        {entries.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-2xl border-4 border-dashed border-sand-200 rounded-[3rem] p-20 flex flex-col items-center gap-6 cursor-pointer hover:border-sage-400 hover:bg-sage-50 transition-all group"
          >
            <div className="p-8 bg-sand-100 rounded-[2rem] text-sand-300 group-hover:text-sage-600 group-hover:bg-white transition-all shadow-sm">
              <UploadCloud size={64} />
            </div>
            <div className="text-center space-y-2">
              <p className="font-black text-xl text-sage-800 uppercase italic">Selecciona uno o varios archivos</p>
              <p className="text-[11px] text-sage-400 font-bold uppercase tracking-widest">WAV • MP3 • OGG • FLAC • M4A • AAC • OPUS</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {['WAV', 'MP3', 'OGG', 'FLAC', 'M4A', 'AAC'].map(f => (
                <span key={f} className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase border ${formatBadgeClass(f)}`}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl space-y-6">
            <div className="bg-sand-50 p-4 rounded-3xl border-2 border-sand-200 flex justify-between items-center px-8">
               <div className="flex items-center gap-3">
                  <Layers size={18} className="text-sage-600" />
                  <span className="text-[11px] font-black text-sage-900 uppercase">{entries.length} Partes Cargadas</span>
               </div>
               <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-sand-200">
                  <Music2 size={14} className="text-sage-400" />
                  <span className="text-xs font-black text-sage-700">{formatDuration(totalDurationSeconds)} Total</span>
               </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {entries.map((entry, index) => (
                <div key={entry.id} className="bg-white p-5 rounded-[2rem] border-2 border-sand-100 flex items-center justify-between shadow-sm animate-in slide-in-from-bottom-2">
                   <div className="flex items-center gap-4 flex-1 truncate">
                      <div className="w-10 h-10 bg-sand-100 rounded-xl flex items-center justify-center font-black text-xs text-sage-400">
                        {index + 1}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sage-800 text-xs truncate uppercase tracking-tight">{entry.file.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[7px] font-bold uppercase border ${formatBadgeClass(entry.format)}`}>
                            {entry.format}
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-sage-400 uppercase tracking-widest">{formatDuration(entry.duration)} • {(entry.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3 ml-4">
                      <button 
                        onClick={() => togglePreview(entry.id)}
                        className={`p-3 rounded-xl transition-all ${isPlaying === entry.id ? 'bg-sage-600 text-white shadow-lg' : 'bg-sand-50 text-sage-400 hover:bg-white'}`}
                      >
                        {isPlaying === entry.id ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                      </button>
                      <button 
                        onClick={() => removeEntry(entry.id)}
                        className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                      >
                        <X size={16} />
                      </button>
                   </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
               <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-5 bg-white border-4 border-sage-800 text-sage-900 rounded-[2rem] font-black text-lg hover:bg-sand-50 transition-all flex items-center justify-center gap-3 shadow-md"
               >
                <Plus size={24} /> AÑADIR MÁS PARTES
               </button>
               
               <button 
                onClick={handleMergeAndConfirm}
                disabled={isMerging}
                className="flex-[2] py-5 bg-sage-900 text-white rounded-[2rem] font-black text-xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.4)] hover:bg-black flex items-center justify-center gap-3 transition-all border-b-8 border-sage-700 active:translate-y-1 active:border-b-4 disabled:opacity-50"
               >
                {isMerging ? (
                  <> <Loader2 size={24} className="animate-spin" /> PROCESANDO UNIÓN... </>
                ) : (
                  <> <Check size={24} /> UNIR Y CONTINUAR A MEZCLA </>
                )}
               </button>
            </div>
          </div>
        )}

        <div className="bg-sage-50/80 p-6 rounded-[2rem] border-2 border-sage-100 max-w-xl">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-sage-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-sage-500 leading-relaxed font-bold uppercase text-center tracking-widest">
              Asegúrate de que las partes estén en el orden correcto. Los archivos se unirán en la secuencia en la que aparecen en la lista. Formatos soportados: WAV, MP3, OGG, FLAC, M4A, AAC, OPUS.
            </p>
          </div>
        </div>
      </div>
      
      <audio ref={audioRef} onEnded={() => setIsPlaying(null)} hidden />
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="audio/wav,audio/wave,audio/mpeg,audio/ogg,audio/flac,audio/mp4,audio/x-m4a,audio/aac,audio/webm,.wav,.mp3,.ogg,.flac,.m4a,.aac,.opus,.oga,.webm"
        multiple 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #abc1aa; border-radius: 10px; }`}</style>
    </div>
  );
};

export default AudioUpload;
