import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// No topo do arquivo PdfViewer.tsx, substitua a linha do workerSrc por esta:
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  fileBlob: Blob; // Sincronizado com o objeto vindo do App.tsx/Storage
  onTextExtracted?: (text: string) => void;
}

export function PdfViewer({ fileBlob, onTextExtracted }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Efeito de Carregamento e Conversão de Binários
  useEffect(() => {
    const loadPdf = async () => {
      if (!fileBlob) return;
      
      try {
        setError(null);
        // Conversão de Blob para ArrayBuffer exigida pelo motor PDF.js
        const arrayBuffer = await fileBlob.arrayBuffer();
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          // Otimização para React 19: evita clones desnecessários na memória heap
          useSystemFonts: true 
        });

        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setPageNum(1);
        
        if (onTextExtracted) {
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 10);
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
          onTextExtracted(fullText);
        }
      } catch (err) {
        console.error("Falha sistêmica no carregamento do PDF:", err);
        setError("Não foi possível processar o binário do PDF.");
      }
    };
    
    loadPdf();
  }, [fileBlob, onTextExtracted]);

  // Motor de Renderização Geométrica (Canvas)
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      
      try {
        setRendering(true);
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Erro na rasterização da página:", err);
      } finally {
        setRendering(false);
      }
    };
    
    renderPage();
  }, [pdfDoc, pageNum]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 font-mono">
        [ERRO_SISTÊMICO]: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center bg-zinc-900 p-4 rounded-xl overflow-hidden h-full">
      <div className="flex justify-between w-full mb-4 text-zinc-400 font-mono text-sm">
        <button 
          onClick={() => setPageNum(p => Math.max(1, p - 1))}
          disabled={pageNum <= 1 || rendering}
          className="hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          &lt; Anterior
        </button>
        <span className="text-zinc-500">
          Página <span className="text-brand">{pageNum}</span> / {pdfDoc?.numPages || '-'}
        </span>
        <button 
          onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || 1, p + 1))}
          disabled={pageNum >= (pdfDoc?.numPages || 1) || rendering}
          className="hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          Próxima &gt;
        </button>
      </div>
      
      <div className="flex-1 overflow-auto w-full flex justify-center custom-scrollbar">
        {!pdfDoc && !error && (
          <div className="flex items-center text-zinc-600 animate-pulse font-mono">
            Aguardando transmissão de dados...
          </div>
        )}
        <canvas 
          ref={canvasRef} 
          className={`shadow-2xl rounded-sm transition-opacity duration-300 ${rendering ? 'opacity-50' : 'opacity-100'}`}
        />
      </div>
    </div>
  );
}