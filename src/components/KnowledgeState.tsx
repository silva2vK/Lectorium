import React, { useEffect, useState } from 'react';
import { dbService, DocumentMeta } from '../services/db';
import { extractDocumentMetadata } from '../services/ai';

interface KnowledgeStateProps {
  onSelectDoc: (doc: DocumentMeta) => void;
}

export function KnowledgeState({ onSelectDoc }: KnowledgeStateProps) {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const allDocs = await dbService.getDocuments();
    setDocs(allDocs);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // We will extract text in the PdfViewer, but for now we create a placeholder
      // or we could extract text here using pdfjs-dist directly.
      // For simplicity, we add the document and extract metadata later or let the user fill it.
      
      const newDoc = await dbService.addDocument({
        title: file.name,
        author: 'Desconhecido',
        year: new Date().getFullYear(),
        methodology: 'Pendente',
        socialImpact: 'Pendente',
        fileData: arrayBuffer,
      });
      
      await loadDocs();
      onSelectDoc(newDoc);
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
        <h2 className="text-lg font-mono text-zinc-100">Estado do Conhecimento</h2>
        <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-md font-mono text-sm transition-colors">
          {loading ? 'Processando...' : '+ Adicionar PDF'}
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
        </label>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {docs.length === 0 ? (
          <div className="text-zinc-500 text-center mt-10 font-mono text-sm">
            Nenhum documento no acervo. Adicione um PDF para iniciar a extração.
          </div>
        ) : (
          <div className="grid gap-4">
            {docs.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => onSelectDoc(doc)}
                className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors"
              >
                <h3 className="text-zinc-100 font-serif text-lg mb-1">{doc.title}</h3>
                <div className="flex gap-4 text-xs font-mono text-zinc-400 mb-3">
                  <span>{doc.author}</span>
                  <span>{doc.year}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-zinc-300">
                  <div>
                    <span className="text-zinc-500 block text-xs uppercase mb-1">Metodologia</span>
                    <span className="line-clamp-2">{doc.methodology}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-xs uppercase mb-1">Impacto Social</span>
                    <span className="line-clamp-2">{doc.socialImpact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
