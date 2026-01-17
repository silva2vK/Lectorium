
import React, { createContext, useContext, useRef } from 'react';
import { createStore, useStore as useZustandStore, StoreApi } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ToolType } from '../context/PdfContext'; 

interface PdfUiState {
  // Viewport State
  scale: number;
  rotation: number;
  currentPage: number;
  numPages: number;
  
  // Layout State (Spread supported within Single View)
  isSpread: boolean;
  spreadSide: 'left' | 'right';
  
  // Dimensions
  pageDimensions: { width: number, height: number } | null;
  pageSizes: { width: number, height: number }[];
  
  // Tools
  activeTool: ToolType;
  
  // Actions
  setScale: (scale: number | ((prev: number) => number)) => void;
  setRotation: (rotation: number) => void;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  setNumPages: (num: number) => void;
  setIsSpread: (isSpread: boolean) => void;
  setSpreadSide: (side: 'left' | 'right') => void;
  setActiveTool: (tool: ToolType) => void;
  setPageDimensions: (dims: { width: number, height: number } | null) => void;
  setPageSizes: (sizes: { width: number, height: number }[]) => void;
  
  // Navigation
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: (containerWidth: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  jumpToPage: (page: number) => void;
}

interface PdfStoreInitProps {
    defaultPage?: number;
    defaultScale?: number;
}

// 1. Factory Function: Cria uma nova store isolada a cada chamada
const createPdfStore = (initProps?: PdfStoreInitProps) => createStore<PdfUiState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    scale: initProps?.defaultScale || 1.0,
    rotation: 0,
    currentPage: initProps?.defaultPage || 1,
    numPages: 0,
    isSpread: false,
    spreadSide: 'left',
    pageDimensions: null,
    pageSizes: [],
    activeTool: 'cursor',

    // Setters
    setScale: (input) => set((state) => {
        const nextScale = typeof input === 'function' ? input(state.scale) : input;
        return { scale: Math.min(Math.max(0.25, nextScale), 5.0) };
    }),
    
    setRotation: (rotation) => set({ rotation }),
    
    setCurrentPage: (input) => set((state) => {
        const next = typeof input === 'function' ? input(state.currentPage) : input;
        // Se numPages for 0 (carregando), permite definir qualquer página (confia no restore)
        // Se numPages > 0, clamp normal.
        const max = state.numPages > 0 ? state.numPages : 99999;
        const safePage = Math.max(1, Math.min(next, max));
        return { currentPage: safePage };
    }),

    setNumPages: (numPages) => set((state) => {
        // Ao definir o número real de páginas, garantimos que a página atual não exceda o limite
        // Útil se o arquivo mudou ou se o restore tentou ir para uma página inexistente
        const correctedPage = state.currentPage > numPages && numPages > 0 ? numPages : state.currentPage;
        return { numPages, currentPage: correctedPage };
    }),

    setIsSpread: (isSpread) => set({ isSpread }),
    setSpreadSide: (spreadSide) => set({ spreadSide }),
    setActiveTool: (activeTool) => set({ activeTool }),
    setPageDimensions: (pageDimensions) => set({ pageDimensions }),
    setPageSizes: (pageSizes) => set({ pageSizes }),

    // Helpers
    zoomIn: () => {
        const { setScale } = get();
        setScale(s => s + 0.25);
    },

    zoomOut: () => {
        const { setScale } = get();
        setScale(s => s - 0.25);
    },

    fitWidth: (containerWidth) => {
        const { pageDimensions, setScale } = get();
        if (!pageDimensions) return;
        
        const padding = containerWidth < 768 ? 20 : 60;
        const availableWidth = containerWidth - padding;
        const newScale = availableWidth / pageDimensions.width;
        
        setScale(newScale);
    },

    jumpToPage: (page: number) => {
        const { setCurrentPage, setIsSpread, setSpreadSide } = get();
        setCurrentPage(page);
        // Reset spread logic on direct jump
        setIsSpread(false);
        setSpreadSide('left');
    },

    nextPage: () => {
        const { currentPage, numPages, isSpread, spreadSide, setCurrentPage, setSpreadSide } = get();
        
        // Spread Logic (Optional)
        if (isSpread && spreadSide === 'left') {
            setSpreadSide('right');
            return;
        }
        
        if (currentPage < numPages) {
            setCurrentPage(currentPage + 1);
            if (isSpread) setSpreadSide('left');
        }
    },

    prevPage: () => {
        const { currentPage, isSpread, spreadSide, setCurrentPage, setSpreadSide } = get();
        
        // Spread Logic (Optional)
        if (isSpread && spreadSide === 'right') {
            setSpreadSide('left');
            return;
        }
        
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            if (isSpread) setSpreadSide('right');
        }
    }
  }))
);

// 2. Context Definition
const PdfStoreContext = createContext<StoreApi<PdfUiState> | null>(null);

// 3. Provider Component
export const PdfStoreProvider: React.FC<{ children: React.ReactNode, initialPage?: number, initialScale?: number }> = ({ children, initialPage, initialScale }) => {
  const storeRef = useRef<StoreApi<PdfUiState> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createPdfStore({ defaultPage: initialPage, defaultScale: initialScale });
  }

  return React.createElement(PdfStoreContext.Provider, { value: storeRef.current }, children);
};

// 4. Hook Consumer (Mantém a API compatível com o resto do app)
export function usePdfStore<T>(selector: (state: PdfUiState) => T): T {
  const store = useContext(PdfStoreContext);
  if (!store) {
    throw new Error('Missing PdfStoreProvider');
  }
  return useZustandStore(store, selector);
}

// 5. Hook to access store API directly (getState, setState, subscribe)
export function usePdfStoreApi(): StoreApi<PdfUiState> {
  const store = useContext(PdfStoreContext);
  if (!store) {
    throw new Error('Missing PdfStoreProvider');
  }
  return store;
}
