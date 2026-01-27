
import { Annotation, SemanticLensData } from '../types';

/**
 * Pega um Blob de PDF e uma lista de anotações, e retorna um novo Blob.
 * Processamento movido para Web Worker para não travar a UI.
 */
export async function burnAnnotationsToPdf(
    originalBlob: Blob, 
    annotations: Annotation[], 
    ocrMap?: Record<number, any[]>,
    pageOffset?: number,
    lensData?: Record<number, SemanticLensData>,
    password?: string // Nova prop
): Promise<Blob> {
    const arrayBuffer = await originalBlob.arrayBuffer();
    
    return new Promise((resolve, reject) => {
        try {
            const worker = new Worker(
              new URL('./../workers/pdfAnnotationWorker.ts', import.meta.url),
              { type: 'module' }
            );

            worker.onmessage = (e) => {
                if (e.data.success) {
                    const blob = new Blob([e.data.pdfBytes], { type: 'application/pdf' });
                    worker.terminate();
                    resolve(blob);
                } else {
                    worker.terminate();
                    reject(new Error(e.data.error || 'Erro desconhecido no worker'));
                }
            };

            worker.onerror = (e) => {
                worker.terminate();
                reject(new Error('Falha no worker de PDF: ' + e.message));
            };

            worker.postMessage(
                { command: 'burn-all', pdfBytes: arrayBuffer, annotations, ocrMap, pageOffset, lensData, password }, 
                [arrayBuffer]
            );
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * "Sanitiza" um PDF: Cria um novo container PDF e copia todas as páginas do original.
 * Isso remove metadados de criptografia e senhas de "Owner", mantendo o conteúdo visual.
 * Funciona apenas se o arquivo puder ser aberto (mesmo que restrito).
 */
export async function sanitizePdf(originalBlob: Blob, password?: string): Promise<Blob> {
    const arrayBuffer = await originalBlob.arrayBuffer();
    
    return new Promise((resolve, reject) => {
        try {
            const worker = new Worker(
              new URL('./../workers/pdfAnnotationWorker.ts', import.meta.url),
              { type: 'module' }
            );

            worker.onmessage = (e) => {
                if (e.data.success) {
                    const blob = new Blob([e.data.pdfBytes], { type: 'application/pdf' });
                    worker.terminate();
                    resolve(blob);
                } else {
                    worker.terminate();
                    reject(new Error(e.data.error || 'Falha na sanitização'));
                }
            };
            
            worker.onerror = (e) => {
                worker.terminate();
                reject(new Error('Worker error: ' + e.message));
            };

            // Envia comando específico 'sanitize'
            worker.postMessage(
                { command: 'sanitize', pdfBytes: arrayBuffer, password }, 
                [arrayBuffer]
            );
        } catch(err) {
            reject(err);
        }
    });
}

/**
 * Queima APENAS o texto OCR de uma página específica no PDF.
 * Usado para atualização incremental da "Single Source of Truth".
 */
export async function burnPageOcrToPdf(
    currentPdfBlob: Blob,
    pageNumber: number,
    ocrData: any[],
    password?: string
): Promise<Blob> {
    const arrayBuffer = await currentPdfBlob.arrayBuffer();

    return new Promise((resolve, reject) => {
        try {
            const worker = new Worker(
                new URL('./../workers/pdfAnnotationWorker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (e) => {
                if (e.data.success) {
                    const blob = new Blob([e.data.pdfBytes], { type: 'application/pdf' });
                    worker.terminate();
                    resolve(blob);
                } else {
                    worker.terminate();
                    reject(new Error(e.data.error));
                }
            };

            worker.onerror = (e) => {
                worker.terminate();
                reject(new Error('Worker error: ' + e.message));
            };

            worker.postMessage(
                { 
                    command: 'burn-page-ocr', 
                    pdfBytes: arrayBuffer, 
                    pageNumber, 
                    ocrData,
                    password 
                }, 
                [arrayBuffer]
            );
        } catch (err) {
            reject(err);
        }
    });
}
