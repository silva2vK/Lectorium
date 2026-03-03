import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileData: ArrayBuffer;
  onTextExtracted?: (text: string) => void;
}

export function PdfViewer({ fileData, onTextExtracted }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: fileData });
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
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };
    loadPdf();
  }, [fileData, onTextExtracted]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current || rendering) return;
      setRendering(true);
      
      try {
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
      } catch (error) {
        console.error("Error rendering page:", error);
      } finally {
        setRendering(false);
      }
    };
    
    renderPage();
  }, [pdfDoc, pageNum]);

  return (
    <div className="flex flex-col items-center bg-zinc-900 p-4 rounded-xl overflow-hidden h-full">
      <div className="flex justify-between w-full mb-4 text-zinc-400 font-mono text-sm">
        <button 
          onClick={() => setPageNum(p => Math.max(1, p - 1))}
          disabled={pageNum <= 1 || rendering}
          className="hover:text-zinc-100 disabled:opacity-50"
        >
          &lt; Anterior
        </button>
        <span>Página {pageNum} / {pdfDoc?.numPages || '-'}</span>
        <button 
          onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || 1, p + 1))}
          disabled={pageNum >= (pdfDoc?.numPages || 1) || rendering}
          className="hover:text-zinc-100 disabled:opacity-50"
        >
          Próxima &gt;
        </button>
      </div>
      <div className="flex-1 overflow-auto w-full flex justify-center bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
        <canvas ref={canvasRef} className="max-w-full h-auto shadow-2xl" />
      </div>
    </div>
  );
}
