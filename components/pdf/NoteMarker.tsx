
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../src/components/shared/Icon';
import { Annotation } from '../../types';
import { usePdfStore } from '../../stores/usePdfStore';

interface NoteMarkerProps {
  ann: Annotation;
  scale: number; 
  activeTool: string;
  onDelete: (ann: Annotation) => void;
  onUpdate: (ann: Annotation) => void;
}

export const NoteMarker: React.FC<NoteMarkerProps> = ({ ann, scale, activeTool, onDelete, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [text, setText] = useState(ann.text || '');
  const setActiveTool = usePdfStore(state => state.setActiveTool);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync text if prop updates
  useEffect(() => {
      setText(ann.text || '');
  }, [ann.text]);

  // Auto-expand newly created notes
  useEffect(() => {
    if (ann.createdAt && (Date.now() - new Date(ann.createdAt).getTime() < 1000)) {
      setIsExpanded(true);
      setActiveTool('cursor');
    }
  }, [ann.createdAt, setActiveTool]);

  // Auto-focus when expanded
  useEffect(() => {
      if (isExpanded && textareaRef.current) {
          // Pequeno delay para garantir que a animação não atrapalhe o foco
          setTimeout(() => textareaRef.current?.focus(), 100);
      }
  }, [isExpanded]);

  const x = ann.bbox[0] * scale;
  const y = ann.bbox[1] * scale;
  
  const goldColor = '#fbbf24'; 

  const handleMarkerClick = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (activeTool === 'eraser') {
      onDelete(ann);
    } else {
      setIsExpanded(true);
      setActiveTool('cursor');
    }
  };

  const saveChanges = () => {
      if (text !== ann.text) {
          onUpdate({ ...ann, text });
      }
  };

  const closeNote = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      saveChanges();
      setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <div 
        className="absolute z-[60] group cursor-pointer pointer-events-auto"
        style={{
           left: x,
           top: y,
           transform: `translate(-50%, -50%)`, 
           cursor: activeTool === 'eraser' ? 'url(https://cdn-icons-png.flaticon.com/32/2661/2661282.png), pointer' : 'pointer'
        }}
        onClick={handleMarkerClick}
        onPointerDown={handleMarkerClick}
        onMouseDown={handleMarkerClick}
        title={activeTool === 'eraser' ? "Apagar Nota" : "Ler nota"}
      >
        {/* Glow Effect Layer */}
        <div 
            className="absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-300"
            style={{ backgroundColor: activeTool === 'eraser' ? '#ef4444' : goldColor }}
        />
        
        {/* Main Marker Orb */}
        <div 
            className={`relative w-8 h-8 rounded-full bg-[#1a1a1a] border shadow-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${activeTool === 'eraser' ? 'border-red-500 text-red-500' : 'text-amber-400 border-amber-500/50'}`}
        >
           {activeTool === 'eraser' ? (
               <X size={14} strokeWidth={3} />
           ) : (
               <MessageSquareText size={14} className="fill-amber-400/20" />
           )}
        </div>
      </div>
    );
  }

  // MODAL CENTRALIZADO (Fixed Overlay)
  return (
    <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto" 
        onClick={closeNote}
        onPointerDown={(e) => e.stopPropagation()} // Impede propagação para camadas inferiores
    >
      <div
        className="relative w-full max-w-md bg-[#1a1a1a] border border-amber-500/30 rounded-2xl shadow-[0_0_50px_-10px_rgba(251,191,36,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 h-80"
        onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar dentro
      >
        {/* Header Strip */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/10 bg-[#151515] select-none shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <Quote size={14} className="fill-amber-400/50" />
             </div>
             <div>
                 <span className="text-xs font-bold tracking-widest text-amber-500 uppercase block">Nota de Leitura</span>
                 <span className="text-[10px] text-gray-500 font-mono">
                    {new Date(ann.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             {ann.id && !ann.isBurned && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(ann); }} 
                    className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Excluir Nota"
                >
                  <Trash2 size={16} />
                </button>
             )}
             <button 
                onClick={closeNote} 
                className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Fechar (Salvar)"
             >
                <X size={18} />
             </button>
          </div>
        </div>

        {/* Content Body (Editable) */}
        <div className="flex-1 bg-[#1a1a1a] relative">
            <textarea
                ref={textareaRef}
                className="w-full h-full p-6 bg-transparent border-none outline-none resize-none font-serif text-lg leading-relaxed text-[#e0e0e0] selection:bg-amber-500/30 selection:text-white placeholder:text-gray-700 custom-scrollbar"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={saveChanges}
                placeholder="Escreva sua anotação aqui..."
            />
        </div>

        {/* Footer Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-50 shrink-0" />
      </div>
    </div>
  );
};
