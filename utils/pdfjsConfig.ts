/**
 * Configuração Centralizada do PDF.js
 * Garante que API e Worker sejam sempre da mesma versão instalada localmente
 */

import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configuração do Worker - Vite serve localmente para evitar version mismatch
GlobalWorkerOptions.workerSrc = pdfWorker;

// Export para uso em outros módulos se necessário
export { GlobalWorkerOptions };