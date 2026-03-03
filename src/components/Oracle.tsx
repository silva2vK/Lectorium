import React, { useState } from 'react';
import { askOracle } from '../services/ai';
import { DocumentMeta } from '../services/db';

interface OracleProps {
  contextDoc: DocumentMeta | null;
  extractedText: string;
}

export function Oracle({ contextDoc, extractedText }: OracleProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt.trim() || !contextDoc) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await askOracle(prompt, extractedText);
      setResponse(res);
    } catch (error) {
      console.error("Error asking oracle:", error);
      setResponse("Erro ao consultar o Oráculo. Verifique a chave da API Gemini.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
      <div className="p-4 border-b border-zinc-800 bg-zinc-950">
        <h2 className="text-lg font-mono text-zinc-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          O Oráculo (Gemini 3.0)
        </h2>
        <p className="text-xs text-zinc-500 mt-1">Contexto: {contextDoc ? contextDoc.title : 'Nenhum documento selecionado'}</p>
      </div>
      
      <div className="flex-1 overflow-auto p-4 bg-zinc-900 text-zinc-300 font-serif text-sm leading-relaxed">
        {response ? (
          <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, '<br/>') }} />
        ) : (
          <div className="text-zinc-600 italic text-center mt-10">
            Faça uma pergunta sobre o documento atual para gerar uma síntese.
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ex: Qual a metodologia utilizada?"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
          disabled={!contextDoc || loading}
        />
        <button
          onClick={handleAsk}
          disabled={!contextDoc || loading || !prompt.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 text-zinc-100 px-4 py-2 rounded-md font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Consultando...' : 'Perguntar'}
        </button>
      </div>
    </div>
  );
}
