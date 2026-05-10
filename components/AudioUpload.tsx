
import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileAudio, X, Play, Pause, Check, Layers, Loader2, Music2, Plus } from 'lucide-react';
import { SessionData } from '../types';
import { mergeAudioBuffers, audioBufferToWav } from '../services/audioEngine';

interface AudioUploadProps {
  onUpload: (data: SessionData) => void;
}

interface AudioFileEntry {
  id: string;
  file: File;
  duration: number;
  previewUrl: string;
}

const AudioUpload: React.FC<AudioUploadProps> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<AudioFileEntry[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Forzamos el tipado a File[] para evitar errores de inferencia
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;

    const newEntries: AudioFileEntry[] = [];
    
    for (const file of selectedFiles) {
      if (file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        
        // Obtener duración de forma asíncrona
        const duration = await new Promise<number>((resolve) => {
          const tempAudio = new Audio(url);
          tempAudio.onloadedmetadata = () => resolve(tempAudio.duration);
        });

        newEntries.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          duration,
          previewUrl: url
        });
      }
    }

    setEntries(prev => [...prev, ...newEntries]);
    // Limpiamos el valor del input para permitir seleccionar los mismos archivos de nuevo si es necesario
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
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decodificar todos los archivos secuencialmente
      const buffers: AudioBuffer[] = [];
      for (const entry of entries) {
        const arrayBuffer = await entry.file.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        buffers.push(decoded);
      }

      // Unir los buffers de audio en uno solo
      const mergedBuffer = mergeAudioBuffers(audioCtx, buffers);
      
      // Convertir el resultado a un Blob WAV final
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
      alert("Error al unir los fragmentos de audio.");
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="p-10 bg-white rounded-[3rem] shadow-sm border border-sand-200 flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h3 className="text-3xl font-black text-sage-900 uppercase tracking-tighter italic">Multi-Part Assembler</h3>
          <p className="text-[10px] text-sage-400 font-bold uppercase tracking-[0.3em]">Une múltiples grabaciones en una sola meditación continua</p>
        </div>

        {entries.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-2xl border-4 border-dashed border-sand-200 rounded-[3rem] p-20 flex flex-col items-center gap-6 cursor-pointer hover:border-sage-400 hover:bg-sage-50 transition-all group"
          >
            <div className="p-8 bg-sand-100 rounded-[2rem] text-sand-300 group-hover:text-sage-600 group-hover:bg-white transition-all shadow-sm">
              <UploadCloud size={64} />
            </div>
            <div className="text-center">
              <p className="font-black text-xl text-sage-800 uppercase italic">Selecciona uno o varios archivos</p>
              <p className="text-[11px] text-sage-400 font-bold uppercase tracking-widest mt-2">WAV, MP3, AAC o grabaciones de móvil</p>
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
                        <p className="font-black text-sage-800 text-xs truncate uppercase tracking-tight">{entry.file.name}</p>
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
          <p className="text-[10px] text-sage-500 leading-relaxed font-bold uppercase italic text-center tracking-widest">
            Asegúrate de que las partes estén en el orden correcto. Los archivos se unirán en la secuencia en la que aparecen en la lista.
          </p>
        </div>
      </div>
      
      <audio ref={audioRef} onEnded={() => setIsPlaying(null)} hidden />
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="audio/*" 
        multiple 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #abc1aa; border-radius: 10px; }`}</style>
    </div>
  );
};

export default AudioUpload;
