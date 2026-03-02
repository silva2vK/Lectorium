
import React, { useState, useEffect } from 'react';
import { Icon } from '../../src/components/shared/Icon';
import { usePdfContext } from '../../context/PdfContext';
import { usePdfStore } from '../../stores/usePdfStore';

interface Props {
  onFitWidth: () => void;
  onToggleSplitView?: () => void;
}

export const PdfToolbar: React.FC<Props> = ({ onFitWidth, onToggleSplitView }) => {
  // Consumindo ESTADOS diretamente do Store (Zustand)
  const activeTool = usePdfStore(s => s.activeTool);
  const setActiveTool = usePdfStore(s => s.setActiveTool);
  
  const currentPage = usePdfStore(s => s.currentPage);
  const numPages = usePdfStore(s => s.numPages);
  
  const scale = usePdfStore(s => s.scale);
  const setScale = usePdfStore(s => s.setScale);
  const isSplitView = usePdfStore(s => s.isSplitView);

  // Ações de Navegação do Store
  const goNext = usePdfStore(s => s.nextPage);
  const goPrev = usePdfStore(s => s.prevPage);
  const jumpToPage = usePdfStore(s => s.jumpToPage);

  // Consumindo DADOS do Context
  const { settings, docPageOffset } = usePdfContext();

  const [isEditingPage, setIsEditingPage] = useState(false);
  const [tempPageInput, setTempPageInput] = useState("1");

  // Display Logic: If offset exists, show Logical (Physical)
  const displayPage = currentPage + docPageOffset;
  const displayTotal = numPages + docPageOffset;
  const hasOffset = docPageOffset !== 0;

  useEffect(() => {
    if (!isEditingPage) {
      setTempPageInput(displayPage.toString());
    }
  }, [displayPage, isEditingPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = parseInt(tempPageInput);
    if (!isNaN(inputVal)) {
        // Se houver offset, o usuário digitou a página lógica. Converter para física.
        const targetPhysical = hasOffset ? inputVal - docPageOffset : inputVal;
        
        if (targetPhysical >= 1 && targetPhysical <= numPages) {
            jumpToPage(targetPhysical);
        }
    } else {
        setTempPageInput(displayPage.toString());
    }
    setIsEditingPage(false);
  };

  const ToolbarBtn = ({ active, onClick, icon: Icon, title, className = "" }: any) => (
      <button 
        onClick={onClick} 
        className={`
            relative p-3 rounded-full transition-all duration-300 group
            flex items-center justify-center touch-manipulation
            active:scale-95
            ${active 
                ? 'text-brand bg-white/10 ring-1 ring-inset ring-white/10 shadow-[0_0_15px_-5px_rgba(0,0,0,0.5)]' 
                : 'text-white hover:bg-white/10'} 
            ${className}
        `} 
        title={title}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="relative z-10 transition-transform duration-300 group-hover:scale-110" />
        {active && <div className="absolute inset-0 rounded-full bg-brand/5 blur-md" />}
      </button>
  );

  return (
    <div 
        className="maker-pdf-toolbar fixed left-1/2 z-[70] isolation-isolate animate-in slide-in-from-bottom-10 fade-in duration-500 origin-bottom ease-out"
        style={{
            bottom: `${32 + settings.toolbarYOffset}px`,
            transform: `translateX(-50%) scale(${settings.toolbarScale})`
        }}
    >
        <div className="
            flex items-center gap-1 p-2 px-3
            bg-black/90 backdrop-blur-xl
            border border-brand/50
            shadow-[0_8px_32px_rgba(0,0,0,0.6)] shadow-brand/10
            rounded-full
            ring-1 ring-white/5
        ">
            
            {/* Zone 1: Tools */}
            <div className="flex items-center gap-1">
                <ToolbarBtn active={activeTool === 'cursor'} onClick={() => setActiveTool('cursor')} icon={MousePointer2} title="Selecionar" />
                <ToolbarBtn active={activeTool === 'brush'} onClick={() => setActiveTool('brush')} icon={Paintbrush} title="Pincel de Destaque (Área)" />
                <ToolbarBtn active={activeTool === 'note'} onClick={() => setActiveTool('note')} icon={StickyNote} title="Nota" />
                <ToolbarBtn active={activeTool === 'ink'} onClick={() => setActiveTool('ink')} icon={Pen} title="Desenhar" />
                <ToolbarBtn active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} icon={Eraser} title="Apagar" />
            </div>
            
            {/* Divider */}
            <div className="h-8 w-px bg-white/20 mx-2"></div>

            {/* Zone 2: Navigation */}
            <div className="flex items-center gap-1">
                <button 
                    onClick={goPrev} 
                    className="p-2.5 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
                    title="Página Anterior"
                >
                    <ChevronLeft size={20} strokeWidth={1.5} />
                </button>
                
                <div className={`flex items-center justify-center px-3 py-1.5 rounded-full border min-w-[90px] gap-2 mx-1 shadow-inner transition-colors duration-300 ${isSplitView ? 'bg-brand/10 border-brand/30' : 'bg-white/5 border-white/10'}`}>
                    {isEditingPage ? (
                    <form onSubmit={handlePageSubmit} className="flex items-center justify-center">
                        <input 
                        autoFocus
                        type="number"
                        min="1"
                        max={hasOffset ? displayTotal : numPages}
                        value={tempPageInput}
                        onChange={(e) => setTempPageInput(e.target.value)}
                        onBlur={() => setIsEditingPage(false)}
                        className="w-8 bg-transparent text-center font-mono text-sm font-bold text-white outline-none p-0 selection:bg-brand/30"
                        />
                    </form>
                    ) : (
                    <button 
                        onClick={() => {
                        setTempPageInput(displayPage.toString());
                        setIsEditingPage(true);
                        }}
                        className="font-mono text-sm font-bold text-white hover:text-brand transition-colors text-center"
                    >
                        {displayPage}
                    </button>
                    )}
                    <span className="text-white text-xs font-mono select-none">/</span>
                    <span className="text-white text-xs font-mono select-none">{hasOffset ? displayTotal : numPages}</span>
                </div>

                <button 
                    onClick={goNext} 
                    className="p-2.5 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
                    title="Próxima Página"
                >
                    <ChevronRight size={20} strokeWidth={1.5} />
                </button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-white/20 mx-2"></div>

            {/* Zone 3: View & Zoom */}
            <div className="flex items-center gap-1">
                {onToggleSplitView && (
                    <ToolbarBtn 
                        active={false} 
                        onClick={onToggleSplitView} 
                        icon={SplitSquareHorizontal} 
                        title="Dividir Tela (Split View)" 
                    />
                )}

                <button 
                    onClick={onFitWidth} 
                    className="p-2.5 rounded-full text-white hover:bg-white/10 transition-all active:scale-90 group" 
                    title="Ajustar à Largura"
                >
                    <MoveHorizontal size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform"/>
                </button>

                <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                    <button 
                        onClick={() => setScale(s => Math.max(0.5, s - 0.2))} 
                        className="p-1.5 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
                    >
                        <Minus size={14} />
                    </button>
                    
                    <span className="text-[10px] font-mono font-bold w-[4ch] text-center text-white select-none">
                        {Math.round(scale * 100)}%
                    </span>
                    
                    <button 
                        onClick={() => setScale(s => Math.min(3, s + 0.2))} 
                        className="p-1.5 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
