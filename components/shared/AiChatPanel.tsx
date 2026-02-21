
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Sparkles, Loader2, User, Bot, Trash2, MessageSquare, FileSearch, Copy, Check, BrainCircuit, Database, BookOpen, Podcast } from 'lucide-react';
import { ChatMessage, SemanticLensData } from '../../types';
import { chatWithDocumentStream } from '../../services/chatService';
import { findRelevantChunks, extractPageRangeFromQuery } from '../../utils/textUtils';
import { generateDocumentBriefing } from '../../services/aiService';
import { semanticSearch } from '../../services/ragService';
import { useOptionalPdfContext } from '../../context/PdfContext';

interface Props {
  contextText: string;
  documentName: string;
  className?: string;
  fileId?: string; 
  onIndexRequest?: () => Promise<void>; 
  numPages?: number; 
}

const MessageItem: React.FC<{ m: ChatMessage }> = ({ m }) => {
    const [copied, setCopied] = useState(false);

    const onCopy = () => {
        if (!m.text) return;
        navigator.clipboard.writeText(m.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${m.role === 'user' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-brand/10 border-brand/30 text-brand'} backdrop-blur-sm`}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-surface/90 border border-border/50 text-text rounded-tl-none backdrop-blur-md'}`}>
              <div className="whitespace-pre-wrap select-text selection:bg-brand/30 selection:text-white">{m.text}</div>
              
              {m.role === 'model' && m.text && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex justify-end">
                      <button 
                        onClick={onCopy} 
                        className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-text-sec hover:text-brand transition-colors px-2 py-1 hover:bg-white/5 rounded"
                        title="Copiar resposta"
                      >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          {copied ? 'Copiado' : 'Copiar'}
                      </button>
                  </div>
              )}
          </div>
      </div>
    );
};

export const AiChatPanel: React.FC<Props> = ({ contextText, documentName, className = "", fileId, onIndexRequest, numPages = 0 }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRagActive, setIsRagActive] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const pdfContext = useOptionalPdfContext();
  const chatRequest = pdfContext?.chatRequest;
  const setChatRequest = pdfContext?.setChatRequest;
  const ocrMap = pdfContext?.ocrMap;
  const lensData = (pdfContext?.lensData || {}) as Record<number, SemanticLensData>;

  const isDirectReadingAllowed = numPages < 17;

  useEffect(() => {
    if (!isDirectReadingAllowed && fileId) {
        setIsRagActive(true);
    }
  }, [isDirectReadingAllowed, fileId]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleIndex = async () => {
      if (onIndexRequest && !isIndexing) {
          setIsIndexing(true);
          try {
              await onIndexRequest();
              setIsRagActive(true);
          } catch (e) {
              console.error(e);
          } finally {
              setIsIndexing(false);
          }
      }
  };

  const handleGenerateBriefing = async () => {
      if (isGeneratingBriefing || (!contextText && Object.keys(lensData).length === 0)) return;
      
      setIsGeneratingBriefing(true);
      setMessages(prev => [...prev, { role: 'user', text: "Gere um Briefing Tático deste documento, considerando a estrutura da Lente Semântica se disponível." }]);
      
      try {
          // Combina texto básico com markdown da lente para o briefing
          const semanticContent = Object.values(lensData).map((d: SemanticLensData) => d.markdown).join("\n\n");
          const combinedContext = semanticContent || contextText;
          const summary = await generateDocumentBriefing(combinedContext);
          setMessages(prev => [...prev, { role: 'model', text: summary }]);
      } catch (e: any) {
          setMessages(prev => [...prev, { role: 'model', text: "Erro ao gerar briefing: " + e.message }]);
      } finally {
          setIsGeneratingBriefing(false);
      }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = textToSend.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
        let retrievalContext = "";
        let mode = "TEXT-MATCH";

        // 1. INTENT CHECK: Page Specific Request
        const pageIntent = extractPageRangeFromQuery(userMessage);
        
        if (pageIntent) {
            mode = "PAGE-SPECIFIC";
            const { start, end } = pageIntent;
            const pagesContent: string[] = [];
            const min = Math.max(1, Math.min(start, end));
            const max = Math.min(numPages || 1000, Math.max(start, end));

            for (let i = min; i <= max; i++) {
                // PRIORIDADE: Markdown da Lente (Semântico) -> Depois OCR Words
                if (lensData[i]?.markdown) {
                    pagesContent.push(`[ESTRUTURA SEMÂNTICA PÁGINA ${i}]:\n${lensData[i].markdown}`);
                } else if (ocrMap && ocrMap[i]) {
                    const text = ocrMap[i].map((w: any) => w.text).join(' ');
                    pagesContent.push(`[TEXTO PÁGINA ${i}]:\n${text}`);
                }
            }
            
            if (pagesContent.length > 0) {
                retrievalContext = `Contexto específico solicitado para páginas ${min}-${max}:\n\n${pagesContent.join('\n\n---\n\n')}`;
            }
        }

        // 2. Semantic Search (Vector RAG)
        if (!retrievalContext && fileId && isRagActive) {
            try {
                const results = await semanticSearch(fileId, userMessage);
                if (results.length > 0) {
                    retrievalContext = results.map(r => `[Trecho Relevante - Pág ${r.page || '?'}] ${r.text}`).join("\n\n---\n\n");
                    mode = "NEURAL-RAG";
                }
            } catch (e) {
                console.warn("RAG failed", e);
            }
        }

        // 3. Fallback: Context Text + Semantic Lens Summary
        if (!retrievalContext) {
            const hasSemantic = Object.keys(lensData).length > 0;
            if (hasSemantic) {
                // Injeta um resumo do que a lente capturou se não houver contexto específico
                const semanticSample = Object.entries(lensData)
                    .slice(0, 5) // Pega as primeiras 5 páginas processadas como amostra
                    .map(([p, d]) => `[Pág ${p} - Estrutura]: ${(d as SemanticLensData).markdown.slice(0, 500)}...`)
                    .join("\n\n");
                retrievalContext = `${contextText}\n\n--- DADOS ADICIONAIS DA LENTE SEMÂNTICA ---\n${semanticSample}`;
                mode = "HYBRID-LENS";
            } else {
                retrievalContext = contextText;
            }
        }

        const stream = chatWithDocumentStream(retrievalContext || "Documento sem texto extraído.", messages, userMessage);
        let assistantText = "";
        setMessages(prev => [...prev, { role: 'model', text: "" }]);

        for await (const chunk of stream) {
            if (chunk.text) {
                assistantText += chunk.text;
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1].text = assistantText;
                    return next;
                });
            }

            if (chunk.functionCalls) {
                for (const call of chunk.functionCalls) {
                    console.log("[Kalaki] Action requested:", call.name, call.args);
                    
                    // Dispatch custom event for the application to handle
                    window.dispatchEvent(new CustomEvent('kalaki-action', { 
                        detail: { name: call.name, args: call.args } 
                    }));

                    // Add a feedback message in the chat
                    const actionMsg = `[Ação: ${call.name}] Executando comando na Cidade...`;
                    assistantText += `\n\n*${actionMsg}*`;
                    setMessages(prev => {
                        const next = [...prev];
                        next[next.length - 1].text = assistantText;
                        return next;
                    });
                }
            }
        }
    } catch (e: any) {
        setMessages(prev => [...prev, { role: 'model', text: "Erro: " + e.message }]);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (chatRequest && setChatRequest) {
        handleSend(chatRequest);
        setChatRequest(null);
    }
  }, [chatRequest, setChatRequest]);

  return (
    <div className={`flex flex-col h-full bg-bg relative overflow-hidden ${className}`}>
      {/* Background Effect - Infinite Grid */}
      <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.25) 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px'
          }}
      />
      
      {/* Subtle Bottom Gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-bg/80" />

      {/* Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-surface/80 backdrop-blur-md relative z-10 shadow-sm">
          <div className="flex items-center gap-2 text-brand">
              <MessageSquare size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Kalaki</span>
          </div>
          <div className="flex items-center gap-1">
              {isDirectReadingAllowed && (
                  <button onClick={() => setIsRagActive(false)} className={`p-1.5 rounded transition-colors ${!isRagActive ? 'text-brand bg-brand/10 ring-1 ring-brand/30' : 'text-text-sec hover:text-white'}`} title="Leitura Direta">
                      <BookOpen size={14} />
                  </button>
              )}
              {onIndexRequest && (
                  <button onClick={handleIndex} disabled={isIndexing} className={`p-1.5 rounded transition-colors ${isRagActive ? 'text-purple-400 bg-purple-500/10 ring-1 ring-purple-500/30' : 'text-text-sec hover:text-white'}`} title="Busca Semântica">
                      {isIndexing ? <Loader2 size={14} className="animate-spin"/> : <BrainCircuit size={14} />}
                  </button>
              )}
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button onClick={() => setMessages([])} className="p-1.5 text-text-sec hover:text-red-400 rounded" title="Limpar"><Trash2 size={14} /></button>
          </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
          {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 opacity-70">
                  <div className="relative">
                      <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full"></div>
                      <Sparkles size={48} className="text-brand animate-pulse relative z-10" />
                  </div>
                  <div className="space-y-1">
                      <p className="text-sm font-bold text-white">Kalaki está atenta.</p>
                      <p className="text-xs text-text-sec">Observando: {documentName}</p>
                      {Object.keys(lensData).length > 0 && (
                          <div className="mt-2 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] text-purple-300 font-bold backdrop-blur-sm">
                             <Sparkles size={10} className="inline mr-1" /> DADOS DA LENTE INTEGRADOS
                          </div>
                      )}
                  </div>
                  <button onClick={handleGenerateBriefing} disabled={isGeneratingBriefing} className="mt-4 flex items-center gap-2 bg-[#2c2c2c]/80 hover:bg-[#333] border border-gray-600 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg group backdrop-blur-sm">
                      {isGeneratingBriefing ? <Loader2 size={14} className="animate-spin" /> : <Podcast size={14} className="text-pink-400 group-hover:scale-110" />}
                      Gerar Guia de Estudo
                  </button>
              </div>
          )}
          {messages.map((m, i) => <MessageItem key={i} m={m} />)}
          {isLoading && messages[messages.length-1]?.role === 'user' && (
              <div className="flex gap-3 animate-in fade-in">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-brand/10 border-brand/30 text-brand backdrop-blur-sm">
                      <FileSearch size={16} className="animate-pulse" />
                  </div>
                  <div className="bg-surface/80 border border-border rounded-2xl rounded-tl-none p-3 flex items-center gap-2 backdrop-blur-sm">
                      <span className="text-xs text-text-sec italic">Processando...</span>
                      <div className="flex gap-1">
                          <div className="w-1 h-1 bg-brand rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-brand rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-surface/80 backdrop-blur-md relative z-10">
          <div className="relative">
              <textarea 
                rows={1} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                placeholder="Pergunte sobre o documento..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand/50 outline-none transition-all resize-none max-h-32 placeholder:text-gray-500" 
              />
              <button 
                onClick={() => handleSend()} 
                disabled={!input.trim() || isLoading} 
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand text-[#0b141a] rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand/20"
              >
                <Send size={18} />
              </button>
          </div>
      </div>
    </div>
  );
};
