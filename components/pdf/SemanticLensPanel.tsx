
import React, { useState, useMemo } from 'react';
import { Sparkles, Loader2, Copy, Check, Layers, Languages, ListRestart, Activity, X, Zap, Wand2 } from 'lucide-react';
import { usePdfContext } from '../../context/PdfContext';
import { SemanticRangeModal } from './modals/SemanticRangeModal';

interface Props {
  pageNumber: number;
  onNavigateBack?: () => void;
}

export const SemanticLensPanel: React.FC<Props> = ({ pageNumber, onNavigateBack }) => {
  const { 
    lensData, isLensLoading, ocrMap, 
    triggerTranslation, isTranslationMode, toggleTranslationMode,
    triggerRefinement,
    numPages, lastOcrMetrics
  } = usePdfContext();
  
  const [copied, setCopied] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [modalMode, setModalMode] = useState<'single' | 'batch'>('single');
  
  const data = lensData[pageNumber];
  const hasInjectedOcr = ocrMap[pageNumber] && ocrMap[pageNumber].length > 0 && ocrMap[pageNumber][0].isRefined;

  const isChrome = useMemo(() => {
    return typeof window !== 'undefined' && /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  }, []);

  const openAnalyzeSingle = () => {
      setModalMode('single');
      setShowRangeModal(true);
  };

  const openAnalyzeBatch = () => {
      setModalMode('batch');
      setShowRangeModal(true);
  };

  const handleCopy = () => {
      if (data?.markdown) {
          navigator.clipboard.writeText(data.markdown);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const handleTranslate = () => {
      if (!data) openAnalyzeSingle();
      else triggerTranslation(pageNumber);
  };

  const handleRefine = () => {
      if (data && !isLensLoading) {
          triggerRefinement(pageNumber);
      }
  };

  if (isLensLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
              <div className="relative">
                  <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
                  <Loader2 className="animate-spin text-brand relative z-10" size={48} />
              </div>
              <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Análise Cirúrgica...</h3>
                  <p className="text-xs text-text-sec">{isChrome ? "Usando aceleração via GPU (Chrome)" : "Aguardando resposta da pipeline..."}</p>
              </div>
          </div>
      );
  }

  if (!data) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
              <div className="bg-brand/10 p-4 rounded-full border border-brand/20 relative">
                  <Sparkles size={32} className="text-brand" />
                  {isChrome && <Zap size={14} className="absolute -top-1 -right-1 text-yellow-400 fill-yellow-400" title="Aceleração Chrome Ativa" />}
              </div>
              <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Lente Semântica</h3>
                  <p className="text-xs text-gray-400 max-w-[250px] leading-relaxed">
                      Extraia texto estruturado e injete camadas de pesquisa usando <strong>Gemini 3 Flash</strong>.
                  </p>
              </div>
              
              <div className="space-y-3 w-full">
                  <button 
                    onClick={openAnalyzeSingle}
                    className="w-full bg-brand text-[#0b141a] px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-brand/20 transition-all active:scale-95"
                  >
                      <Layers size={18} /> Analisar Página
                  </button>
                  <button 
                    onClick={openAnalyzeBatch}
                    className="w-full bg-[#2c2c2c] border border-[#333] text-gray-300 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#333] transition-all text-xs active:scale-95"
                  >
                      <ListRestart size={16} /> Processar Lote
                  </button>
              </div>

              <SemanticRangeModal isOpen={showRangeModal} onClose={() => setShowRangeModal(false)} numPages={numPages} currentPage={pageNumber} mode={modalMode} onBatchStarted={onNavigateBack} />
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full bg-[#141414] relative">
          <div className="flex justify-between items-center p-4 border-b border-white/5 bg-surface">
              <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Transcrição</span>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => setShowDiagnostics(!showDiagnostics)} className={`text-xs p-1.5 rounded transition-colors ${showDiagnostics ? 'bg-brand/20 text-brand' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`} title="Diagnóstico de Rede"><Activity size={14} /></button>
                  <button onClick={handleRefine} className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-brand/10 hover:text-brand text-gray-300 transition-colors" title="Organizar com IA"><Wand2 size={12} /> Organizar</button>
                  <button onClick={isTranslationMode ? toggleTranslationMode : handleTranslate} className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isTranslationMode ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}><Languages size={12} /> {isTranslationMode ? 'Original' : 'Traduzir'}</button>
                  <button onClick={handleCopy} className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">{copied ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>}</button>
              </div>
          </div>

          {showDiagnostics && (
              <div className="absolute top-14 left-0 right-0 z-20 bg-[#1a1a1a] border-b border-brand/20 p-4 shadow-xl animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-brand uppercase flex items-center gap-2"><Activity size={12} /> Desempenho Blink</h4>
                      <button onClick={() => setShowDiagnostics(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                  </div>
                  {lastOcrMetrics ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-300">
                            <div className="bg-black/30 p-2 rounded border border-white/5">
                                <span className="block text-gray-500 mb-1">Transferência Bitmaps</span>
                                <span className="font-mono text-lg text-white">{(lastOcrMetrics.uploadAndQueueTime / 1000).toFixed(2)}s</span>
                            </div>
                            <div className="bg-black/30 p-2 rounded border border-white/5">
                                <span className="block text-gray-500 mb-1">Processamento Gemini</span>
                                <span className="font-mono text-lg text-white">{(lastOcrMetrics.processingTime / 1000).toFixed(2)}s</span>
                            </div>
                        </div>
                        <div className="text-[9px] text-center text-gray-500 flex items-center justify-center gap-2">
                            {isChrome && <span className="flex items-center gap-1 text-brand/80"><Zap size={10}/> GPU Habilitada</span>}
                            <span>•</span>
                            <span>Total: {(lastOcrMetrics.totalTime / 1000).toFixed(2)}s</span>
                        </div>
                    </div>
                  ) : <p className="text-[10px] text-gray-500 text-center py-4">Métricas indisponíveis.</p>}
              </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <article className="prose prose-invert prose-sm max-w-none prose-p:text-gray-300 prose-p:leading-relaxed">
                  <div className="whitespace-pre-wrap font-serif text-base">{data.markdown}</div>
              </article>
          </div>
          
          <div className="p-3 border-t border-white/5 bg-surface flex justify-between items-center">
              <span className="text-[10px] text-gray-500">Gemini 3 Flash Vision</span>
              <button onClick={openAnalyzeBatch} className="text-[10px] text-brand hover:underline flex items-center gap-1"><ListRestart size={10} /> Iniciar Lote</button>
          </div>

          <SemanticRangeModal isOpen={showRangeModal} onClose={() => setShowRangeModal(false)} numPages={numPages} currentPage={pageNumber} mode={modalMode} onBatchStarted={onNavigateBack} />
      </div>
  );
};
