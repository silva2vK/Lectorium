
import React, { useState, useEffect } from 'react';
import { MessageSquareText, X, Trash2, Maximize2, MoreHorizontal } from 'lucide-react';
import { Annotation } from '../../types';

interface NoteMarkerProps {
  ann: Annotation;
  scale: number; 
  activeTool: string;
  onDelete: (ann: Annotation) => void;
}

export const NoteMarker: React.FC<NoteMarkerProps> = ({ ann, scale, activeTool, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand newly created notes
  useEffect(() => {
    if (ann.createdAt && (Date.now() - new Date(ann.createdAt).getTime() < 2000)) {
      setIsExpanded(true);
    }
  }, [ann.createdAt]);

  const x = ann.bbox[0] * scale;
  const y = ann.bbox[1] * scale;
  const noteColor = ann.color || '#4ade80'; // Fallback to brand color if undefined

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleMarkerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onDelete(ann);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  if (!isExpanded) {
    return (
      <div 
        className="absolute z-30 group cursor-pointer pointer-events-auto"
        style={{
           left: x,
           top: y,
           transform: `translate(-50%, -50%)`, 
           cursor: activeTool === 'eraser' ? 'url(https://cdn-icons-png.flaticon.com/32/2661/2661282.png), pointer' : 'pointer'
        }}
        onClick={handleMarkerClick}
        title={activeTool === 'eraser' ? "Apagar Nota" : "Expandir nota"}
      >
        {/* Glow Effect Layer */}
        <div 
            className="absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-300"
            style={{ backgroundColor: activeTool === 'eraser' ? '#ef4444' : noteColor }}
        />
        
        {/* Main Marker Orb */}
        <div 
            className={`relative w-8 h-8 rounded-full bg-[#0a0a0a] border shadow-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${activeTool === 'eraser' ? 'border-red-500 text-red-500' : 'text-gray-200'}`}
            style={{ borderColor: activeTool === 'eraser' ? '#ef4444' : noteColor }}
        >
           {activeTool === 'eraser' ? (
               <X size={14} strokeWidth={3} />
           ) : (
               <MessageSquareText size={14} style={{ color: noteColor }} />
           )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="annotation-item absolute z-40 group pointer-events-auto animate-in zoom-in-95 fade-in duration-200 origin-top-left"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-[#121212]/95 backdrop-blur-xl text-gray-200 text-sm rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] border relative flex flex-col min-w-[240px] max-w-[320px] overflow-hidden transition-all"
        style={{ borderColor: `${noteColor}40` }} // 40 is hex for ~25% opacity
      >
        {/* Header Strip */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-white/5 border-b border-white/5 select-none">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: noteColor, boxShadow: `0 0 8px ${noteColor}` }} />
             <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Nota Pessoal</span>
          </div>
          
          <div className="flex items-center gap-1">
             {ann.id && !ann.isBurned && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(ann); }} 
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
             )}
             <button 
                onClick={toggleExpand} 
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Minimizar"
             >
                <X size={14} />
             </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 bg-gradient-to-b from-transparent to-black/20">
            <p className="whitespace-pre-wrap break-words font-medium leading-relaxed text-sm text-gray-300 font-sans selection:bg-brand/20 selection:text-white">
                {ann.text}
            </p>
        </div>

        {/* Footer Meta */}
        <div className="px-3 py-2 border-t border-white/5 flex justify-between items-center bg-[#0a0a0a]/50">
            <span className="text-[9px] text-gray-600 font-mono">
                {new Date(ann.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                <div className="w-1 h-1 rounded-full bg-gray-700"></div>
            </div>
        </div>
      </div>
    </div>
  );
};
